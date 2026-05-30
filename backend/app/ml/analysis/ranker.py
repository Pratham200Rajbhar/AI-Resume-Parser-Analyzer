from __future__ import annotations

import structlog

logger = structlog.get_logger(__name__)

# Education level scoring map (higher = better)
_EDUCATION_LEVELS = {
    "phd": 4, "doctorate": 4, "doctoral": 4,
    "master": 3, "msc": 3, "mba": 3, "m.s": 3, "m.a": 3,
    "bachelor": 2, "bsc": 2, "b.s": 2, "b.a": 2, "undergraduate": 2,
    "associate": 1, "diploma": 1, "certificate": 1,
}


def _education_level_score(education: list[dict]) -> float:
    """Return a 0–1 score based on highest education level."""
    if not education:
        return 0.0
    max_level = 0
    for edu in education:
        if not isinstance(edu, dict):
            continue
        degree = (edu.get("degree") or "").lower()
        for keyword, level in _EDUCATION_LEVELS.items():
            if keyword in degree:
                max_level = max(max_level, level)
    return min(1.0, max_level / 4.0)


def _experience_years_score(experience: list[dict]) -> float:
    """Estimate total years of experience and return a 0–1 score (caps at 15 years)."""
    import re  # noqa: PLC0415

    _YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
    total_months = 0

    for exp in experience:
        if not isinstance(exp, dict):
            continue
        duration = exp.get("duration", "")
        years_found = _YEAR_RE.findall(duration)
        if len(years_found) >= 2:
            try:
                start = int(years_found[0])
                end = int(years_found[-1])
                total_months += max(0, (end - start) * 12)
            except ValueError:
                pass

    total_years = total_months / 12
    return min(1.0, total_years / 15.0)


def _skills_count_score(skills: list) -> float:
    """Return a 0–1 score based on number of skills (caps at 20)."""
    return min(1.0, len(skills) / 20.0)


class BatchRanker:
    """
    Ranks a batch of candidates using a composite weighted score.

    Weights:
        JD match score:   50%
        Skills count:     25%
        Experience years: 15%
        Education level:  10%
    """

    _WEIGHTS = {
        "match_score": 0.50,
        "skills_score": 0.25,
        "experience_score": 0.15,
        "education_score": 0.10,
    }

    def rank(
        self,
        candidates: list[dict],
        jd_embedding: list[float] | None = None,
    ) -> list[dict]:
        """
        Rank candidates by composite score.

        Each candidate dict must contain:
            resume_id, entities, ats_score, match_score

        Returns a sorted list with added fields:
            rank, composite_score, component_scores, candidate_name
        """
        if not candidates:
            return []

        scored: list[dict] = []

        for candidate in candidates:
            entities = candidate.get("entities", {})
            ats_score = candidate.get("ats_score", 0)
            match_score = candidate.get("match_score", 0.0)

            skills = entities.get("skills", [])
            experience = entities.get("experience", [])
            education = entities.get("education", [])

            skills_score = _skills_count_score(skills)
            experience_score = _experience_years_score(experience)
            education_score = _education_level_score(education)

            # If no JD provided, redistribute match_score weight to ATS score
            if jd_embedding is None:
                ats_normalised = min(1.0, ats_score / 100.0)
                composite = (
                    ats_normalised * 0.50
                    + skills_score * 0.25
                    + experience_score * 0.15
                    + education_score * 0.10
                )
                component_scores = {
                    "ats_score": ats_score,
                    "match_score": 0.0,
                    "skills_score": round(skills_score, 4),
                    "experience_score": round(experience_score, 4),
                    "education_score": round(education_score, 4),
                }
            else:
                composite = (
                    match_score * self._WEIGHTS["match_score"]
                    + skills_score * self._WEIGHTS["skills_score"]
                    + experience_score * self._WEIGHTS["experience_score"]
                    + education_score * self._WEIGHTS["education_score"]
                )
                component_scores = {
                    "ats_score": ats_score,
                    "match_score": round(match_score, 4),
                    "skills_score": round(skills_score, 4),
                    "experience_score": round(experience_score, 4),
                    "education_score": round(education_score, 4),
                }

            scored.append({
                "resume_id": candidate.get("resume_id", ""),
                "candidate_name": candidate.get("candidate_name", entities.get("name", "Unknown")),
                "file_name": candidate.get("file_name", ""),
                "entities": entities,
                "composite_score": round(composite * 100, 2),  # scale to 0–100
                "ats_score": ats_score,
                "match_score": round(match_score * 100, 2),
                "skills_score": round(skills_score * 100, 2),
                "experience_score": round(experience_score * 100, 2),
                "education_score": round(education_score * 100, 2),
                "component_scores": component_scores,
            })

        # Sort descending by composite score
        scored.sort(key=lambda x: x["composite_score"], reverse=True)

        # Assign ranks
        for i, item in enumerate(scored):
            item["rank"] = i + 1

        logger.info("batch_ranked", candidate_count=len(scored))
        return scored
