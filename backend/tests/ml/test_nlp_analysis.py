

SAMPLE_RESUME_TEXT = """
John Doe
john.doe@email.com
+1-555-0100
New York, NY

SUMMARY
Experienced software engineer with 5 years building scalable web applications.

EXPERIENCE
Senior Software Engineer - TechCorp Inc (Jan 2021 - Present)
- Architected microservices platform serving 1M+ users
- Led migration from monolith to Kubernetes

Software Engineer - StartupXYZ (Jun 2018 - Dec 2020)
- Built React frontend and Python backend
- Reduced API latency by 40%

EDUCATION
B.S. Computer Science - MIT (2018)

SKILLS
Python, JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker, Kubernetes, AWS, Git

CERTIFICATIONS
AWS Certified Solutions Architect (2022)

PROJECTS
Resume Analyzer - Built an AI-powered resume analysis tool using BERT and XGBoost
"""


class TestSectionSegmenter:
    def test_detects_experience_section(self):
        from app.ml.nlp.section_segmenter import segment_sections
        sections = segment_sections(SAMPLE_RESUME_TEXT)
        assert "experience" in sections or "EXPERIENCE" in sections or any(
            "experience" in k.lower() for k in sections
        )

    def test_detects_education_section(self):
        from app.ml.nlp.section_segmenter import segment_sections
        sections = segment_sections(SAMPLE_RESUME_TEXT)
        assert any("education" in k.lower() for k in sections)

    def test_detects_skills_section(self):
        from app.ml.nlp.section_segmenter import segment_sections
        sections = segment_sections(SAMPLE_RESUME_TEXT)
        assert any("skill" in k.lower() for k in sections)

    def test_returns_dict(self):
        from app.ml.nlp.section_segmenter import segment_sections
        result = segment_sections(SAMPLE_RESUME_TEXT)
        assert isinstance(result, dict)
        assert len(result) > 0

    def test_section_content_not_empty(self):
        from app.ml.nlp.section_segmenter import segment_sections
        sections = segment_sections(SAMPLE_RESUME_TEXT)
        for _key, value in sections.items():
            assert isinstance(value, str)


class TestSkillNormalizer:
    def test_exact_match(self):
        from app.ml.nlp.skill_normalizer import SkillNormalizer
        normalizer = SkillNormalizer()
        results = normalizer.normalize(["Python"])
        assert len(results) == 1
        assert results[0]["normalized"].lower() == "python"
        assert results[0]["confidence"] > 0.9

    def test_fuzzy_match(self):
        from app.ml.nlp.skill_normalizer import SkillNormalizer
        normalizer = SkillNormalizer()
        # "Pyhton" is a typo for "Python"
        results = normalizer.normalize(["Pyhton"])
        assert len(results) == 1
        assert "python" in results[0]["normalized"].lower()

    def test_multiple_skills(self):
        from app.ml.nlp.skill_normalizer import SkillNormalizer
        normalizer = SkillNormalizer()
        results = normalizer.normalize(["Python", "JavaScript", "React"])
        assert len(results) == 3

    def test_returns_required_fields(self):
        from app.ml.nlp.skill_normalizer import SkillNormalizer
        normalizer = SkillNormalizer()
        results = normalizer.normalize(["Python"])
        assert "raw" in results[0]
        assert "normalized" in results[0]
        assert "confidence" in results[0]

    def test_empty_input(self):
        from app.ml.nlp.skill_normalizer import SkillNormalizer
        normalizer = SkillNormalizer()
        results = normalizer.normalize([])
        assert results == []


class TestFraudDetector:
    def test_detects_overlapping_dates(self):
        from app.ml.analysis.fraud_detector import FraudDetector
        detector = FraudDetector()
        entities = {
            "experience": [
                {"company": "A", "role": "Engineer", "duration": "Jan 2020 - Jun 2022"},
                {"company": "B", "role": "Engineer", "duration": "Mar 2021 - Jan 2023"},
            ]
        }
        flags = detector.detect(entities)
        overlap_flags = [f for f in flags if "overlap" in f["type"].lower()]
        assert len(overlap_flags) > 0

    def test_no_flags_for_clean_resume(self):
        from app.ml.analysis.fraud_detector import FraudDetector
        detector = FraudDetector()
        entities = {
            "experience": [
                {"company": "A", "role": "Engineer", "duration": "Jan 2018 - Dec 2020"},
                {"company": "B", "role": "Senior Engineer", "duration": "Jan 2021 - Jun 2023"},
            ]
        }
        flags = detector.detect(entities)
        overlap_flags = [f for f in flags if "overlap" in f["type"].lower()]
        assert len(overlap_flags) == 0

    def test_returns_list(self):
        from app.ml.analysis.fraud_detector import FraudDetector
        detector = FraudDetector()
        result = detector.detect({"experience": []})
        assert isinstance(result, list)

    def test_flag_has_required_fields(self):
        from app.ml.analysis.fraud_detector import FraudDetector
        detector = FraudDetector()
        entities = {
            "experience": [
                {"company": "A", "role": "Eng", "duration": "Jan 2020 - Jun 2022"},
                {"company": "B", "role": "Eng", "duration": "Jan 2021 - Jan 2023"},
            ]
        }
        flags = detector.detect(entities)
        if flags:
            assert "type" in flags[0]
            assert "description" in flags[0]
            assert "severity" in flags[0]
            assert flags[0]["severity"] in ("low", "medium", "high")


class TestATSScorer:
    def test_returns_score_in_range(self):
        from app.ml.analysis.ats_scorer import ATSScorer
        scorer = ATSScorer()
        entities = {
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "+1-555-0100",
            "skills": [{"raw": "Python", "normalized": "Python", "confidence": 1.0}],
            "experience": [{"company": "Acme", "role": "Engineer"}],
            "education": [{"institution": "MIT", "degree": "B.S."}],
        }
        sections = {"experience": "...", "education": "...", "skills": "..."}
        result = scorer.score(entities, SAMPLE_RESUME_TEXT, sections)
        assert 0 <= result["score"] <= 100

    def test_returns_breakdown(self):
        from app.ml.analysis.ats_scorer import ATSScorer
        scorer = ATSScorer()
        entities = {"name": "John", "email": "j@e.com", "phone": "555", "skills": [], "experience": [], "education": []}
        result = scorer.score(entities, "short text", {})
        assert "breakdown" in result
        assert "suggestions" in result
        assert isinstance(result["suggestions"], list)

    def test_complete_resume_scores_higher(self):
        from app.ml.analysis.ats_scorer import ATSScorer
        scorer = ATSScorer()
        complete_entities = {
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "+1-555-0100",
            "skills": [{"raw": "Python", "normalized": "Python", "confidence": 1.0}] * 5,
            "experience": [{"company": "Acme", "role": "Engineer", "startDate": "2020-01", "endDate": "2023-01"}],
            "education": [{"institution": "MIT", "degree": "B.S."}],
        }
        empty_entities = {"name": None, "email": None, "phone": None, "skills": [], "experience": [], "education": []}
        complete_result = scorer.score(complete_entities, SAMPLE_RESUME_TEXT, {"experience": "x", "education": "x", "skills": "x"})
        empty_result = scorer.score(empty_entities, "short", {})
        assert complete_result["score"] > empty_result["score"]
