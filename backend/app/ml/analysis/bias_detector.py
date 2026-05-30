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


# Fallback rule-based patterns when ML models are unavailable
_AGE_PATTERNS = [
    (re.compile(r"\b(born\s+in\s+\d{4}|age[d]?\s*:?\s*\d{2}|d\.?o\.?b\.?)\b", re.IGNORECASE),
     "Explicit age/DOB disclosure", "Remove age or date of birth — it is not required and may introduce bias."),
    (re.compile(r"\b(class\s+of\s+19\d{2}|graduated\s+19\d{2})\b", re.IGNORECASE),
     "Graduation year implying age", "Consider omitting graduation years from the 1990s or earlier."),
]

_GENDER_PATTERNS = [
    (re.compile(r"\b(mr\.?|mrs\.?|ms\.?|miss|sir|madam)\b", re.IGNORECASE),
     "Gendered title", "Remove gendered titles (Mr./Mrs./Ms.) from the resume."),
    (re.compile(r"\b(he/him|she/her|they/them)\b", re.IGNORECASE),
     "Pronoun disclosure", "Pronouns are personal; consider whether to include them on a resume."),
]

_PERSONAL_PATTERNS = [
    (re.compile(r"\b(marital\s+status|married|single|divorced|widowed)\b", re.IGNORECASE),
     "Marital status", "Remove marital status — it is irrelevant and may introduce bias."),
    (re.compile(r"\b(religion|religious|church|mosque|temple|faith)\b", re.IGNORECASE),
     "Religious affiliation", "Remove religious references unless directly relevant to the role."),
    (re.compile(r"\b(nationality|citizen(?:ship)?|passport|visa\s+status)\b", re.IGNORECASE),
     "Nationality/citizenship", "Nationality details are generally not required on a resume."),
    (re.compile(r"\b(photo|photograph|picture|headshot)\b", re.IGNORECASE),
     "Photo reference", "Avoid including photos — they can introduce unconscious bias."),
    (re.compile(r"\b(race|ethnicity|ethnic)\b", re.IGNORECASE),
     "Race/ethnicity", "Remove race or ethnicity references — they are not relevant to job performance."),
]


def _get_context_sentence(text: str, match_start: int, match_end: int) -> str:
    """Extract the sentence containing the match."""
    # Find sentence boundaries
    start = text.rfind(".", 0, match_start)
    start = start + 1 if start != -1 else 0
    end = text.find(".", match_end)
    end = end + 1 if end != -1 else len(text)
    return text[start:end].strip()


class BiasDetector:
    """
    Detects potentially biased language in resume text.
    Uses ML pipelines (age, gender, personal) with rule-based fallback.
    """

    def detect(self, text: str) -> list[dict]:
        """
        Scan text for bias indicators.

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
                    # Fall through to rule-based

        # ── Rule-based fallback / supplement ─────────────────────────────────
        all_patterns = (
            [("age", p, term, suggestion) for p, term, suggestion in _AGE_PATTERNS]
            + [("gender", p, term, suggestion) for p, term, suggestion in _GENDER_PATTERNS]
            + [("personal", p, term, suggestion) for p, term, suggestion in _PERSONAL_PATTERNS]
        )

        for bias_type, pattern, term_desc, suggestion in all_patterns:
            for match in pattern.finditer(text):
                matched_term = match.group(0)
                key = f"{bias_type}:{matched_term.lower()}"
                if key in seen:
                    continue
                seen.add(key)
                sentence = _get_context_sentence(text, match.start(), match.end())
                flags.append({
                    "type": bias_type,
                    "term": matched_term,
                    "sentence": sentence,
                    "suggestion": suggestion,
                })

        logger.debug("bias_detection_done", flag_count=len(flags))
        return flags
