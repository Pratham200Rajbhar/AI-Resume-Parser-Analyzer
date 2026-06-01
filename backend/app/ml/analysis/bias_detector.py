from __future__ import annotations

import re
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

_WEIGHTS_DIR = Path(__file__).parent.parent / "models" / "weights" / "bias"

_age_pipeline = None
_gender_pipeline = None
_personal_pipeline = None


def _load_pipeline(name: str):
    import joblib  # noqa: PLC0415

    path = _WEIGHTS_DIR / f"{name}_pipeline.joblib"
    if not path.exists():
        logger.warning("bias_pipeline_not_found", path=str(path))
        return None
    model = joblib.load(str(path))
    logger.info("bias_pipeline_loaded", name=name)
    return model


def _get_age_pipeline():
    global _age_pipeline
    if _age_pipeline is None:
        _age_pipeline = _load_pipeline("age")
    return _age_pipeline


def _get_gender_pipeline():
    global _gender_pipeline
    if _gender_pipeline is None:
        _gender_pipeline = _load_pipeline("gender")
    return _gender_pipeline


def _get_personal_pipeline():
    global _personal_pipeline
    if _personal_pipeline is None:
        _personal_pipeline = _load_pipeline("personal")
    return _personal_pipeline


class BiasDetector:
    """
    Detects potentially biased language in resume text.
    Uses ML pipelines (age, gender, personal).
    """

    def detect(self, text: str) -> list[dict]:
        """
        Scan text for bias indicators using ML pipelines.

        Returns a list of dicts:
            {type: "gender"|"age"|"personal", term: str, sentence: str, suggestion: str}
        """
        if not text or not text.strip():
            return []

        flags: list[dict] = []
        seen: set[str] = set()

        # ── ML pipeline detection ─────────────────────────────────────────────
        for bias_type, get_fn in [
            ("age", _get_age_pipeline),
            ("gender", _get_gender_pipeline),
            ("personal", _get_personal_pipeline),
        ]:
            pipeline = get_fn()
            if pipeline is not None:
                try:
                    # Split text into sentences for sentence-level classification
                    sentences = re.split(r"(?<=[.!?])\s+", text)
                    for sentence in sentences:
                        if not sentence.strip():
                            continue
                        prediction = pipeline.predict([sentence])[0]
                        # Assume binary classifier: 1 = biased, 0 = clean
                        if prediction == 1:
                            key = f"{bias_type}:{sentence[:50]}"
                            if key not in seen:
                                seen.add(key)
                                flags.append({
                                    "type": bias_type,
                                    "term": sentence[:100],
                                    "sentence": sentence.strip(),
                                    "suggestion": f"Review this sentence for potential {bias_type}-related bias.",
                                })
                except Exception as exc:
                    logger.warning("bias_ml_pipeline_failed", bias_type=bias_type, error=str(exc))

        logger.debug("bias_detection_done", flag_count=len(flags))
        return flags

