from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    import spacy as _spacy_type

logger = structlog.get_logger(__name__)

# Labels we care about from spaCy's en_core_web_trf model
_RELEVANT_LABELS = {"PERSON", "ORG", "GPE", "DATE", "LOC", "NORP"}

_nlp_instance: _spacy_type.Language | None = None


def _download_spacy_model(model_name: str, target_dir: str) -> None:
    import subprocess  # noqa: PLC0415
    import sys  # noqa: PLC0415

    # SpaCy models can be installed directly from github releases.
    url = f"https://github.com/explosion/spacy-models/releases/download/{model_name}-3.8.0/{model_name}-3.8.0-py3-none-any.whl"
    logger.info("downloading_spacy_model_to_custom_dir", model=model_name, target=target_dir)
    subprocess.check_call([
        sys.executable, "-m", "pip", "install", url, "--target", target_dir, "--quiet"
    ])


def _get_nlp() -> _spacy_type.Language:
    global _nlp_instance
    if _nlp_instance is None:
        import sys  # noqa: PLC0415
        from pathlib import Path  # noqa: PLC0415

        import spacy  # noqa: PLC0415

        _WEIGHTS_DIR = str(Path(__file__).parent.parent / "models" / "weights" / "spacy_models")
        if _WEIGHTS_DIR not in sys.path:
            sys.path.insert(0, _WEIGHTS_DIR)

        try:
            _nlp_instance = spacy.load("en_core_web_trf")
            logger.info("spacy_model_loaded", model="en_core_web_trf")
        except OSError:
            logger.warning("spacy_trf_not_found_attempting_download", model="en_core_web_trf")
            try:
                _download_spacy_model("en_core_web_trf", _WEIGHTS_DIR)
                _nlp_instance = spacy.load("en_core_web_trf")
                logger.info("spacy_model_loaded_after_download", model="en_core_web_trf")
            except Exception as e:
                logger.warning("spacy_trf_failed_falling_back", fallback="en_core_web_sm", error=str(e))
                try:
                    _nlp_instance = spacy.load("en_core_web_sm")
                    logger.info("spacy_model_loaded", model="en_core_web_sm")
                except OSError:
                    logger.warning("spacy_sm_not_found_attempting_download", model="en_core_web_sm")
                    try:
                        _download_spacy_model("en_core_web_sm", _WEIGHTS_DIR)
                        _nlp_instance = spacy.load("en_core_web_sm")
                        logger.info("spacy_model_loaded_after_download", model="en_core_web_sm")
                    except Exception as exc:
                        raise RuntimeError(
                            "Failed to download or load spaCy models automatically."
                        ) from exc
    return _nlp_instance


class SpacyNER:
    """Singleton-backed spaCy NER extractor."""

    def extract(self, text: str) -> list[dict]:
        """
        Run spaCy NER on text.

        Returns a list of dicts: {text, label, start, end}
        for PERSON, ORG, GPE, DATE, LOC, NORP entities.
        """
        if not text or not text.strip():
            return []

        nlp = _get_nlp()

        # Truncate to avoid memory issues with very long resumes
        truncated = text[:50_000]
        doc = nlp(truncated)

        entities: list[dict] = []
        seen: set[tuple[str, str]] = set()

        for ent in doc.ents:
            if ent.label_ not in _RELEVANT_LABELS:
                continue
            key = (ent.text.strip(), ent.label_)
            if key in seen:
                continue
            seen.add(key)
            entities.append({
                "text": ent.text.strip(),
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char,
            })

        logger.debug("spacy_ner_done", entity_count=len(entities))
        return entities
