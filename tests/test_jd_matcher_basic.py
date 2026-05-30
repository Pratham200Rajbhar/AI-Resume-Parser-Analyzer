"""Test: JD Matcher — basic matching of sample.pdf resume against a job description"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result, get_sample_text

FEATURE = "jd_matcher"
SCENARIO = "basic"

SAMPLE_JD = """
Senior Full-Stack Engineer

We are looking for a Full-Stack Engineer with strong Python and JavaScript skills.

Requirements:
- 2+ years of experience with Python and FastAPI or Django
- Proficiency in React.js or Next.js for frontend development
- Experience with PostgreSQL and Redis
- Familiarity with Docker and CI/CD pipelines
- Knowledge of REST APIs and WebSockets
- Experience with AI/ML integrations (LangChain, OpenAI API) is a plus
- Strong understanding of Git and GitHub Actions

Nice to have:
- Flutter or React Native mobile development
- Experience with TensorFlow or PyTorch
- Knowledge of cloud platforms (AWS, GCP)
"""


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: jd_matcher / basic")
    p("=" * 60)

    from app.ml.analysis.jd_matcher import JDMatcher

    matcher = JDMatcher()
    resume_text = get_sample_text()

    # Build resume entities from sample.pdf
    resume_entities = {
        "name": "Pratham Rajbhar",
        "skills": [
            {"raw": "Python", "normalized": "Python"},
            {"raw": "JavaScript", "normalized": "JavaScript"},
            {"raw": "FastAPI", "normalized": "FastAPI"},
            {"raw": "React.js", "normalized": "React.js"},
            {"raw": "Next.js", "normalized": "Next.js"},
            {"raw": "Docker", "normalized": "Docker"},
            {"raw": "PostgreSQL", "normalized": "PostgreSQL"},
            {"raw": "Redis", "normalized": "Redis"},
            {"raw": "LangChain", "normalized": "LangChain"},
            {"raw": "Flutter", "normalized": "Flutter"},
            {"raw": "TensorFlow", "normalized": "TensorFlow"},
        ],
        "experience": [
            {"role": "Full-Stack Developer", "company": "Hackathon Projects", "duration": "2022-2024"},
        ],
    }

    p("Embedding JD...")
    jd_embedding = matcher.embed(SAMPLE_JD)
    p(f"JD embedding dim: {len(jd_embedding)}")

    p("Running match...")
    result = matcher.match(resume_entities, resume_text, SAMPLE_JD, jd_embedding)

    p(f"\nMatch score: {result['match_score']:.4f}")
    p(f"Matched skills ({len(result['matched_skills'])}): {result['matched_skills'][:10]}")
    p(f"Gap skills ({len(result['gap_skills'])}): {result['gap_skills'][:10]}")
    p(f"Keyword report: {result['keyword_report']}")

    assert 0.0 <= result["match_score"] <= 1.0, f"Score out of range: {result['match_score']}"
    assert isinstance(result["matched_skills"], list)
    assert isinstance(result["gap_skills"], list)
    assert "coverage_pct" in result["keyword_report"]
    # Pratham's resume should match well against this JD
    assert result["match_score"] >= 0.3, f"Expected decent match, got {result['match_score']}"

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "match_score": result["match_score"],
        "matched_skills": result["matched_skills"],
        "gap_skills": result["gap_skills"],
        "keyword_report": result["keyword_report"],
    })
    print("PASS: jd_matcher/basic")
    return True


if __name__ == "__main__":
    run()
