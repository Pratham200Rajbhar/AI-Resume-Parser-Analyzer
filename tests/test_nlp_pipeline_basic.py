"""Test: NLP pipeline — basic end-to-end extraction from sample.pdf"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result, get_sample_text

FEATURE = "nlp_pipeline"
SCENARIO = "basic"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: nlp_pipeline / basic")
    p("=" * 60)

    from app.ml.nlp.pipeline import NLPPipeline

    pipeline = NLPPipeline()
    text = get_sample_text()

    p(f"Running NLP pipeline on {len(text)} chars...")
    result = pipeline.run(text)

    p(f"\nExtracted fields:")
    p(f"  name:     {result['name']!r}")
    p(f"  email:    {result['email']!r}")
    p(f"  phone:    {result['phone']!r}")
    p(f"  location: {result['location']!r}")
    p(f"  linkedin: {result['linkedin']!r}")
    p(f"  github:   {result['github']!r}")
    p(f"  skills:   {len(result['skills'])} entries")
    p(f"  experience: {len(result['experience'])} entries")
    p(f"  education:  {len(result['education'])} entries")
    p(f"  certifications: {len(result['certifications'])}")
    p(f"  projects: {len(result['projects'])}")
    p(f"  summary:  {result['summary'][:100]!r}")

    # Core assertions
    assert result["email"] == "pratham.rajbhar@gmail.com", \
        f"Expected email, got {result['email']!r}"
    assert result["phone"], "Expected phone number"
    assert result["linkedin"] is not None, "Expected LinkedIn URL"
    assert result["github"] is not None, "Expected GitHub URL"
    assert len(result["skills"]) >= 5, \
        f"Expected at least 5 skills, got {len(result['skills'])}"

    # Skills should be dicts with required keys
    for s in result["skills"][:3]:
        assert isinstance(s, dict), f"Skill should be dict: {s}"
        assert "raw" in s and "normalized" in s, f"Skill missing keys: {s}"

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "name": result["name"],
        "email": result["email"],
        "phone": result["phone"],
        "location": result["location"],
        "linkedin": result["linkedin"],
        "github": result["github"],
        "skill_count": len(result["skills"]),
        "experience_count": len(result["experience"]),
        "education_count": len(result["education"]),
        "skills_preview": result["skills"][:5],
    })
    print("PASS: nlp_pipeline/basic")
    return True


if __name__ == "__main__":
    run()
