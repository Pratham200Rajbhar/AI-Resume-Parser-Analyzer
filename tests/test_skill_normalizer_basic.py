"""Test: Skill normalizer — basic normalization against O*NET taxonomy"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result, get_sample_text

FEATURE = "skill_normalizer"
SCENARIO = "basic"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: skill_normalizer / basic")
    p("=" * 60)

    from app.ml.nlp.skill_normalizer import SkillNormalizer

    normalizer = SkillNormalizer()

    # Skills extracted from sample.pdf
    raw_skills = [
        "Python", "JavaScript", "SQL", "React.js", "Next.js",
        "FastAPI", "Docker", "PostgreSQL", "Redis", "LangChain",
    ]

    p(f"Normalizing {len(raw_skills)} skills from sample.pdf...")
    results = normalizer.normalize(raw_skills)

    p(f"\nResults ({len(results)} entries):")
    for r in results:
        p(f"  raw={r['raw']!r:20s} → normalized={r['normalized']!r:30s} "
          f"confidence={r['confidence']:.3f} category={r['category']!r}")

    assert len(results) == len(raw_skills), "Should return one result per input skill"
    for r in results:
        assert "raw" in r and "normalized" in r and "confidence" in r and "category" in r, \
            f"Missing keys in result: {r}"
        assert 0.0 <= r["confidence"] <= 1.0, f"Confidence out of range: {r['confidence']}"

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, results)
    print("PASS: skill_normalizer/basic")
    return True


if __name__ == "__main__":
    run()
