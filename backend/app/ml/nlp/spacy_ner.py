from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    import spacy as _spacy_type

logger = structlog.get_logger(__name__)

# Labels we care about from spaCy's en_core_web_trf model
_RELEVANT_LABELS = {"PERSON", "ORG", "GPE", "DATE", "LOC", "NORP"}

_nlp_instance: _spacy_type.Language | None = None


def _get_nlp() -> _spacy_type.Language:
    global _nlp_instance
    if _nlp_instance is None:
        import spacy  # noqa: PLC0415

        try:
            _nlp_instance = spacy.load("en_core_web_trf")
            logger.info("spacy_model_loaded", model="en_core_web_trf")
        except OSError:
            # Fallback to smaller model if transformer model not installed
            logger.warning("spacy_trf_not_found_falling_back", fallback="en_core_web_sm")
            try:
                _nlp_instance = spacy.load("en_core_web_sm")
            except OSError as exc:
                raise RuntimeError(
                    "No spaCy model found. Run: python -m spacy download en_core_web_trf"
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
