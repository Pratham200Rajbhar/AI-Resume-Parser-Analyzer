

class TestBatchRanker:
    def test_ranks_by_composite_score(self):
        from app.ml.analysis.ranker import BatchRanker
        ranker = BatchRanker()
        candidates = [
            {
                "resume_id": "r1",
                "file_name": "alice.pdf",
                "entities": {"skills": [{"raw": "Python"}] * 8, "experience": [{"durationMonths": 36}], "education": [{"degree": "B.S."}]},
                "ats_score": 85,
                "match_score": 90.0,
            },
            {
                "resume_id": "r2",
                "file_name": "bob.pdf",
                "entities": {"skills": [{"raw": "Python"}] * 3, "experience": [{"durationMonths": 12}], "education": []},
                "ats_score": 55,
                "match_score": 40.0,
            },
        ]
        results = ranker.rank(candidates, jd_embedding=None)
        assert results[0]["rank"] == 1
        assert results[0]["composite_score"] > results[1]["composite_score"]

    def test_rank_field_is_sequential(self):
        from app.ml.analysis.ranker import BatchRanker
        ranker = BatchRanker()
        candidates = [
            {"resume_id": f"r{i}", "file_name": f"r{i}.pdf", "entities": {"skills": [], "experience": [], "education": []}, "ats_score": 50, "match_score": 50.0}
            for i in range(5)
        ]
        results = ranker.rank(candidates, jd_embedding=None)
        ranks = [r["rank"] for r in results]
        assert ranks == list(range(1, 6))

    def test_empty_candidates(self):
        from app.ml.analysis.ranker import BatchRanker
        ranker = BatchRanker()
        results = ranker.rank([], jd_embedding=None)
        assert results == []

    def test_composite_score_in_range(self):
        from app.ml.analysis.ranker import BatchRanker
        ranker = BatchRanker()
        candidates = [
            {
                "resume_id": "r1",
                "file_name": "test.pdf",
                "entities": {"skills": [{"raw": "Python"}] * 5, "experience": [{"durationMonths": 24}], "education": [{"degree": "M.S."}]},
                "ats_score": 75,
                "match_score": 80.0,
            }
        ]
        results = ranker.rank(candidates, jd_embedding=None)
        assert 0 <= results[0]["composite_score"] <= 100


class TestJDMatcher:
    def test_embed_returns_list(self):
        from app.ml.analysis.jd_matcher import JDMatcher
        matcher = JDMatcher()
        embedding = matcher.embed("Python developer with 5 years experience")
        assert isinstance(embedding, list)
        assert len(embedding) == 384

    def test_match_returns_required_fields(self):
        from app.ml.analysis.jd_matcher import JDMatcher
        matcher = JDMatcher()
        resume_entities = {
            "skills": [{"raw": "Python", "normalized": "Python", "confidence": 1.0}],
            "experience": [],
            "education": [],
        }
        jd_text = "Looking for a Python developer with React experience."
        jd_embedding = matcher.embed(jd_text)
        result = matcher.match(resume_entities, "Python developer resume", jd_text, jd_embedding)
        assert "match_score" in result
        assert "matched_skills" in result
        assert "gap_skills" in result
        assert "keyword_report" in result

    def test_match_score_in_range(self):
        from app.ml.analysis.jd_matcher import JDMatcher
        matcher = JDMatcher()
        resume_entities = {"skills": [{"raw": "Python", "normalized": "Python", "confidence": 1.0}], "experience": [], "education": []}
        jd_text = "Python developer needed."
        jd_embedding = matcher.embed(jd_text)
        result = matcher.match(resume_entities, "Python developer", jd_text, jd_embedding)
        assert 0 <= result["match_score"] <= 1.0

    def test_high_match_for_similar_content(self):
        from app.ml.analysis.jd_matcher import JDMatcher
        matcher = JDMatcher()
        resume_text = "Experienced Python developer with Django, REST APIs, PostgreSQL, Docker."
        jd_text = "We need a Python developer with Django and REST API experience."
        jd_embedding = matcher.embed(jd_text)
        resume_entities = {
            "skills": [
                {"raw": "Python", "normalized": "Python", "confidence": 1.0},
                {"raw": "Django", "normalized": "Django", "confidence": 1.0},
            ],
            "experience": [],
            "education": [],
        }
        result = matcher.match(resume_entities, resume_text, jd_text, jd_embedding)
        assert result["match_score"] > 0.5

    def test_low_match_for_unrelated_content(self):
        from app.ml.analysis.jd_matcher import JDMatcher
        matcher = JDMatcher()
        resume_text = "Experienced chef with culinary arts degree and restaurant management."
        jd_text = "Senior software engineer needed for distributed systems work."
        jd_embedding = matcher.embed(jd_text)
        resume_entities = {"skills": [{"raw": "Cooking", "normalized": "Cooking", "confidence": 1.0}], "experience": [], "education": []}
        result = matcher.match(resume_entities, resume_text, jd_text, jd_embedding)
        assert result["match_score"] < 0.6
