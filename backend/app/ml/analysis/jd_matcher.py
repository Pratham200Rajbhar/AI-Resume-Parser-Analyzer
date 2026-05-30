from __future__ import annotations

import re
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    pass

logger = structlog.get_logger(__name__)

_EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        from pathlib import Path
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415
        
        _WEIGHTS_DIR = Path(__file__).parent.parent / "models" / "weights"
        try:
            _embedder = SentenceTransformer(_EMBEDDING_MODEL_NAME, cache_folder=str(_WEIGHTS_DIR), local_files_only=True)
        except Exception:
            logger.warning("sentence_transformer_not_found_locally_downloading", model=_EMBEDDING_MODEL_NAME)
            _embedder = SentenceTransformer(_EMBEDDING_MODEL_NAME, cache_folder=str(_WEIGHTS_DIR), local_files_only=False)
        logger.info("jd_matcher_embedder_loaded", model=_EMBEDDING_MODEL_NAME)
    return _embedder


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    import numpy as np  # noqa: PLC0415

    va = np.array(a, dtype=float)
    vb = np.array(b, dtype=float)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


def _extract_keywords(text: str) -> set[str]:
    """Extract meaningful keywords from text (2–30 char tokens, no stopwords)."""
    _STOPWORDS = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "must", "shall", "can", "need", "dare",
        "ought", "used", "we", "you", "they", "he", "she", "it", "i", "my",
        "your", "our", "their", "this", "that", "these", "those", "not",
        "no", "nor", "so", "yet", "both", "either", "neither", "each",
        "few", "more", "most", "other", "some", "such", "than", "too",
        "very", "just", "as", "if", "while", "although", "because", "since",
        "about", "above", "after", "before", "between", "during", "through",
        "under", "until", "up", "down", "out", "off", "over", "into",
    }
    tokens = re.findall(r"\b[a-zA-Z][a-zA-Z0-9+#.\-]{1,29}\b", text)
    return {t.lower() for t in tokens if t.lower() not in _STOPWORDS}


class JDMatcher:
    """
    Matches a resume against a job description using semantic embeddings
    and keyword gap analysis.
    """

    def embed(self, text: str) -> list[float]:
        """Embed text using SentenceTransformer. Returns a list of floats."""
        embedder = _get_embedder()
        vector = embedder.encode([text], convert_to_numpy=True, normalize_embeddings=True)
        return vector[0].tolist()

    def match(
        self,
        resume_entities: dict,
        resume_text: str,
        jd_text: str,
        jd_embedding: list[float],
    ) -> dict:
        """
        Compute match between a resume and a job description.

        Returns:
            {
                match_score: float,       # 0.0 – 1.0
                matched_skills: list[str],
                gap_skills: list[str],
                keyword_report: dict
            }
        """
        # ── 1. Semantic similarity ────────────────────────────────────────────
        # Build a weighted resume representation:
        # skills + experience roles get extra weight
        skills = resume_entities.get("skills", [])
        skill_texts = []
        for s in skills:
            if isinstance(s, dict):
                skill_texts.append(s.get("normalized") or s.get("raw", ""))
            else:
                skill_texts.append(str(s))

        experience = resume_entities.get("experience", [])
        role_texts = [e.get("role", "") for e in experience if isinstance(e, dict)]

        skill_str = " ".join(skill_texts)
        role_str = " ".join(role_texts)
        weighted_resume_text = (
            resume_text
            + (" " + skill_str) * 3   # skills weighted 3x
            + (" " + role_str) * 2    # roles weighted 2x
        )

        resume_embedding = self.embed(weighted_resume_text)
        semantic_score = _cosine_similarity(resume_embedding, jd_embedding)

        # ── 2. Keyword gap analysis ───────────────────────────────────────────
        jd_keywords = _extract_keywords(jd_text)
        resume_keywords = _extract_keywords(resume_text)

        # Also include normalised skill names in resume keywords
        for s in skill_texts:
            resume_keywords.update(_extract_keywords(s))

        matched_kw = jd_keywords & resume_keywords
        gap_kw = jd_keywords - resume_keywords

        # ── 3. Skill-level matching ───────────────────────────────────────────
        jd_skill_kw = _extract_keywords(jd_text)
        matched_skills: list[str] = []
        gap_skills: list[str] = []

        for skill_text in skill_texts:
            skill_lower = skill_text.lower()
            if skill_lower in jd_text.lower() or any(
                kw in jd_skill_kw for kw in _extract_keywords(skill_text)
            ):
                matched_skills.append(skill_text)

        # Gap skills: JD keywords that look like skills (capitalised or known tech terms)
        for kw in sorted(gap_kw):
            if len(kw) >= 3 and kw not in matched_skills:
                gap_skills.append(kw)

        # Cap lists to reasonable sizes
        matched_skills = matched_skills[:30]
        gap_skills = gap_skills[:30]

        keyword_report = {
            "jd_keyword_count": len(jd_keywords),
            "resume_keyword_count": len(resume_keywords),
            "matched_keyword_count": len(matched_kw),
            "gap_keyword_count": len(gap_kw),
            "coverage_pct": round(len(matched_kw) / max(len(jd_keywords), 1) * 100, 1),
            "top_gap_keywords": sorted(gap_kw)[:20],
        }

        # ── 4. Composite match score ──────────────────────────────────────────
        keyword_coverage = len(matched_kw) / max(len(jd_keywords), 1)
        match_score = round(0.6 * semantic_score + 0.4 * keyword_coverage, 4)

        logger.debug(
            "jd_match_computed",
            semantic=semantic_score,
            keyword_coverage=keyword_coverage,
            match_score=match_score,
        )

        return {
            "match_score": match_score,
            "matched_skills": matched_skills,
            "gap_skills": gap_skills,
            "keyword_report": keyword_report,
        }
