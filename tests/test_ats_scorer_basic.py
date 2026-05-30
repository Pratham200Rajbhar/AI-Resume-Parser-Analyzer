"""Test: ATS scorer — basic scoring on sample.pdf resume"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result, get_sample_text

FEATURE = "ats_scorer"
SCENARIO = "basic"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: ats_scorer / basic")
    p("=" * 60)

    from app.ml.analysis.ats_scorer import ATSScorer
    from app.ml.nlp.section_segmenter import segment_sections

    text = get_sample_text()
    sections = segment_sections(text)

    # Build minimal entities from sample.pdf content
    entities = {
        "name": "Pratham Rajbhar",
        "email": "pratham.rajbhar@gmail.com",
        "phone": "+91 9512518403",
        "linkedin": "https://linkedin.com/in/prathamrajbhar",
        "github": "https://github.com/prathamrajbhar",
        "skills": [
            {"raw": "Python", "normalized": "Python", "confidence": 1.0, "category": "Programming"},
            {"raw": "JavaScript", "normalized": "JavaScript", "confidence": 1.0, "category": "Programming"},
            {"raw": "FastAPI", "normalized": "FastAPI", "confidence": 0.9, "category": "Framework"},
            {"raw": "React.js", "normalized": "React.js", "confidence": 0.9, "category": "Framework"},
            {"raw": "Docker", "normalized": "Docker", "confidence": 1.0, "category": "DevOps"},
            {"raw": "PostgreSQL", "normalized": "PostgreSQL", "confidence": 1.0, "category": "Database"},
            {"raw": "Redis", "normalized": "Redis", "confidence": 1.0, "category": "Database"},
            {"raw": "LangChain", "normalized": "LangChain", "confidence": 0.8, "category": "AI"},
            {"raw": "Flutter", "normalized": "Flutter", "confidence": 1.0, "category": "Mobile"},
            {"raw": "Next.js", "normalized": "Next.js", "confidence": 0.9, "category": "Framework"},
            {"raw": "TensorFlow", "normalized": "TensorFlow", "confidence": 1.0, "category": "AI"},
            {"raw": "PyTorch", "normalized": "PyTorch", "confidence": 1.0, "category": "AI"},
        ],
        "experience": [],
        "education": [{"degree": "B.Tech Computer Engineering", "institution": "Ganpat University", "year": "2024"}],
    }

    scorer = ATSScorer()
    result = scorer.score(entities, text, sections)

    p(f"ATS Score: {result['score']}/100")
    p(f"Breakdown: {result['breakdown']}")
    p(f"Suggestions ({len(result['suggestions'])}):")
    for s in result["suggestions"]:
        p(f"  - {s}")

    assert 0 <= result["score"] <= 100, f"Score out of range: {result['score']}"
    assert "breakdown" in result and isinstance(result["breakdown"], dict)
    assert "suggestions" in result and isinstance(result["suggestions"], list)
    assert result["score"] >= 40, f"Expected decent score for well-formed resume, got {result['score']}"

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, result)
    print("PASS: ats_scorer/basic")
    return True


if __name__ == "__main__":
    run()
