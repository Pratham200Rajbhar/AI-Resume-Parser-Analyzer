from __future__ import annotations

import re
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

_WEIGHTS_PATH = Path(__file__).parent.parent / "models" / "weights" / "xgboost_v2.joblib"

_xgb_model = None


def _get_model():
    global _xgb_model
    if _xgb_model is None:
        import joblib  # noqa: PLC0415

        if _WEIGHTS_PATH.exists():
            _xgb_model = joblib.load(str(_WEIGHTS_PATH))
            logger.info("ats_xgb_model_loaded", path=str(_WEIGHTS_PATH))
        else:
            logger.warning("ats_xgb_model_not_found", path=str(_WEIGHTS_PATH))
    return _xgb_model


# Required sections for a well-structured resume
_REQUIRED_SECTIONS = {"EXPERIENCE", "EDUCATION", "SKILLS", "CONTACT"}
_PREFERRED_SECTIONS = {"SUMMARY", "CERTIFICATIONS", "PROJECTS"}

# ATS-unfriendly patterns (tables, columns, graphics indicators)
_TABLE_PATTERN = re.compile(r"\|.+\|", re.MULTILINE)
_MULTI_COLUMN_PATTERN = re.compile(r"(?:\S+\s{4,}\S+){3,}", re.MULTILINE)


class ATSScorer:
    """
    ATS compatibility scorer.
    Combines rule-based checks with an XGBoost degradation predictor.
    Final score = rule_score - xgb_degradation, clamped to [0, 100].
    """

    def score(self, entities: dict, raw_text: str, sections: dict) -> dict:
        """
        Score a resume for ATS compatibility.

        Returns:
            {
                score: int,
                breakdown: {keywords, format, sections, contact, length},
                suggestions: [str]
            }
        """
        suggestions: list[str] = []
        breakdown: dict[str, int] = {}

        # ── 1. Sections score (25 pts) ────────────────────────────────────────
        present_sections = set(sections.keys())
        missing_required = _REQUIRED_SECTIONS - present_sections
        sections_score = max(0, 25 - len(missing_required) * 6)
        breakdown["sections"] = sections_score
        for sec in missing_required:
            suggestions.append(f"Add a '{sec}' section to improve ATS compatibility.")

        # ── 2. Contact info score (20 pts) ────────────────────────────────────
        contact_score = 0
        if entities.get("email"):
            contact_score += 10
        else:
            suggestions.append("Include a professional email address.")
        if entities.get("phone"):
            contact_score += 5
        else:
            suggestions.append("Include a phone number.")
        if entities.get("name"):
            contact_score += 5
        else:
            suggestions.append("Ensure your full name is clearly visible at the top.")
        breakdown["contact"] = contact_score

        # ── 3. Keywords / skills score (25 pts) ───────────────────────────────
        skills = entities.get("skills", [])
        skill_count = len(skills)
        if skill_count >= 10:
            keywords_score = 25
        elif skill_count >= 5:
            keywords_score = 18
        elif skill_count >= 2:
            keywords_score = 10
        else:
            keywords_score = 0
            suggestions.append("Add more relevant skills to improve keyword matching.")
        breakdown["keywords"] = keywords_score

        # ── 4. Format score (15 pts) ──────────────────────────────────────────
        format_score = 15
        if _TABLE_PATTERN.search(raw_text):
            format_score -= 5
            suggestions.append("Avoid ASCII tables — ATS parsers often misread them.")
        if _MULTI_COLUMN_PATTERN.search(raw_text):
            format_score -= 5
            suggestions.append("Use a single-column layout for better ATS parsing.")
        breakdown["format"] = max(0, format_score)

        # ── 5. Length score (15 pts) ──────────────────────────────────────────
        word_count = len(raw_text.split())
        if 400 <= word_count <= 800:
            length_score = 15
        elif 300 <= word_count < 400 or 800 < word_count <= 1200:
            length_score = 10
            if word_count < 400:
                suggestions.append("Your resume seems short. Aim for 400–800 words.")
            else:
                suggestions.append("Your resume is quite long. Consider trimming to 800 words.")
        else:
            length_score = 5
            if word_count < 300:
                suggestions.append("Resume is too short. Add more detail to your experience and skills.")
            else:
                suggestions.append("Resume is very long. Recruiters prefer concise 1–2 page resumes.")
        breakdown["length"] = length_score

        rule_score = sum(breakdown.values())

        # ── 6. XGBoost degradation ────────────────────────────────────────────
        xgb_degradation = 0
        model = _get_model()
        if model is not None:
            try:
                import numpy as np  # noqa: PLC0415

                features = self._build_features(entities, raw_text, sections, breakdown)
                feature_array = np.array([features])
                degradation_raw = float(model.predict(feature_array)[0])
                xgb_degradation = max(0, min(30, degradation_raw))
            except Exception as exc:
                logger.warning("ats_xgb_prediction_failed", error=str(exc))

        final_score = max(0, min(100, int(rule_score - xgb_degradation)))

        logger.debug(
            "ats_scored",
            rule_score=rule_score,
            xgb_degradation=xgb_degradation,
            final_score=final_score,
        )

        return {
            "score": final_score,
            "breakdown": breakdown,
            "suggestions": suggestions,
        }

    @staticmethod
    def _build_features(
        entities: dict,
        raw_text: str,
        sections: dict,
        breakdown: dict,
    ) -> list[float]:
        """Build a feature vector for the XGBoost model."""
        word_count = len(raw_text.split())
        skill_count = len(entities.get("skills", []))
        exp_count = len(entities.get("experience", []))
        edu_count = len(entities.get("education", []))
        has_email = 1.0 if entities.get("email") else 0.0
        has_phone = 1.0 if entities.get("phone") else 0.0
        section_count = len(sections)
        has_table = 1.0 if _TABLE_PATTERN.search(raw_text) else 0.0
        has_multi_col = 1.0 if _MULTI_COLUMN_PATTERN.search(raw_text) else 0.0
        sections_score = breakdown.get("sections", 0)
        keywords_score = breakdown.get("keywords", 0)

        return [
            word_count,
            skill_count,
            exp_count,
            edu_count,
            has_email,
            has_phone,
            section_count,
            has_table,
            has_multi_col,
            sections_score,
            keywords_score,
        ]
