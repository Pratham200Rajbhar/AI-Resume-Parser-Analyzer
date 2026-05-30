from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    pass

logger = structlog.get_logger(__name__)

_DATA_PATH = Path(__file__).parent.parent / "data" / "onet_skills.json"

_EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
_embedder = None
_onet_skills: list[dict] | None = None
_onet_embeddings = None  # numpy array, lazy


def _load_onet() -> list[dict]:
    global _onet_skills
    if _onet_skills is None:
        with open(_DATA_PATH, encoding="utf-8") as f:
            _onet_skills = json.load(f)
    return _onet_skills


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415
        _embedder = SentenceTransformer(_EMBEDDING_MODEL_NAME)
        logger.info("skill_normalizer_embedder_loaded", model=_EMBEDDING_MODEL_NAME)
    return _embedder


def _get_onet_embeddings():

    global _onet_embeddings
    if _onet_embeddings is None:
        skills = _load_onet()
        embedder = _get_embedder()
        names = [s["name"] for s in skills]
        _onet_embeddings = embedder.encode(names, convert_to_numpy=True, normalize_embeddings=True)
    return _onet_embeddings


def _levenshtein(a: str, b: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (ca != cb)))
        prev = curr
    return prev[-1]


class SkillNormalizer:
    """
    Normalises raw skill strings against the O*NET skill taxonomy.
    Strategy: exact match → fuzzy (Levenshtein) → embedding similarity fallback.
    """

    def __init__(self) -> None:
        self._skills = _load_onet()
        self._name_map: dict[str, dict] = {s["name"].lower(): s for s in self._skills}

    def normalize(self, skills: list[str]) -> list[dict]:
        """
        Normalise a list of raw skill strings.

        Returns a list of dicts:
            {raw, normalized, onet_id, category, confidence}
        """
        results: list[dict] = []
        for raw in skills:
            if not raw or not raw.strip():
                continue
            result = self._normalize_one(raw.strip())
            results.append(result)
        return results

    def _normalize_one(self, raw: str) -> dict:
        lower = raw.lower()

        # 1. Exact match
        if lower in self._name_map:
            skill = self._name_map[lower]
            return {
                "raw": raw,
                "normalized": skill["name"],
                "onet_id": skill["id"],
                "category": skill["category"],
                "confidence": 1.0,
            }

        # 2. Fuzzy match (Levenshtein) — only consider short edit distances
        best_dist = 999
        best_skill: dict | None = None
        for name_lower, skill in self._name_map.items():
            dist = _levenshtein(lower, name_lower)
            if dist < best_dist:
                best_dist = dist
                best_skill = skill

        # Accept fuzzy match if distance is within 30% of the longer string length
        max_len = max(len(lower), 1)
        if best_skill and best_dist <= max(2, int(max_len * 0.3)):
            return {
                "raw": raw,
                "normalized": best_skill["name"],
                "onet_id": best_skill["id"],
                "category": best_skill["category"],
                "confidence": round(1.0 - best_dist / max_len, 3),
            }

        # 3. Embedding similarity fallback
        try:
            import numpy as np  # noqa: PLC0415

            embedder = _get_embedder()
            onet_embs = _get_onet_embeddings()
            raw_emb = embedder.encode([raw], convert_to_numpy=True, normalize_embeddings=True)
            sims = (onet_embs @ raw_emb.T).flatten()
            best_idx = int(np.argmax(sims))
            best_sim = float(sims[best_idx])

            if best_sim >= 0.6:
                skill = self._skills[best_idx]
                return {
                    "raw": raw,
                    "normalized": skill["name"],
                    "onet_id": skill["id"],
                    "category": skill["category"],
                    "confidence": round(best_sim, 3),
                }
        except Exception as exc:
            logger.warning("skill_normalizer_embedding_failed", raw=raw, error=str(exc))

        # 4. No match — return raw as-is
        return {
            "raw": raw,
            "normalized": raw,
            "onet_id": None,
            "category": "Unknown",
            "confidence": 0.0,
        }
