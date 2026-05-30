"""Test: ATS scorer — edge cases (empty resume, missing sections, short/long text)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "ats_scorer"
SCENARIO = "edge_cases"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: ats_scorer / edge_cases")
    p("=" * 60)

    from app.ml.analysis.ats_scorer import ATSScorer

    scorer = ATSScorer()

    # 1. Completely empty entities
    p("\n[1] Empty entities")
    result = scorer.score({}, "", {})
    p(f"  Score: {result['score']}, suggestions: {len(result['suggestions'])}")
    assert 0 <= result["score"] <= 100
    assert len(result["suggestions"]) > 0, "Should suggest improvements for empty resume"
    p("  OK")

    # 2. Missing required sections
    p("\n[2] Missing required sections")
    entities = {"email": "test@test.com", "phone": "1234567890", "name": "Test User", "skills": []}
    result = scorer.score(entities, "Some text here", {})
    p(f"  Score: {result['score']}, suggestions: {result['suggestions']}")
    assert any("section" in s.lower() or "skill" in s.lower() for s in result["suggestions"]), \
        "Should suggest adding sections or skills"
    p("  OK")

    # 3. Very short text (< 300 words)
    p("\n[3] Very short text")
    short_text = "John Doe. Python developer. john@example.com"
    result = scorer.score(
        {"name": "John Doe", "email": "john@example.com", "phone": "", "skills": []},
        short_text,
        {}
    )
    p(f"  Score: {result['score']}")
    assert any("short" in s.lower() or "word" in s.lower() or "detail" in s.lower()
               for s in result["suggestions"]), "Should warn about short resume"
    p("  OK")

    # 4. Score is always in [0, 100]
    p("\n[4] Score bounds check")
    for _ in range(3):
        r = scorer.score({}, "", {})
        assert 0 <= r["score"] <= 100, f"Score out of bounds: {r['score']}"
    p("  OK — score always in [0, 100]")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "empty_handled": True,
        "missing_sections_flagged": True,
        "short_text_flagged": True,
        "score_bounded": True,
    })
    print("PASS: ats_scorer/edge_cases")
    return True


if __name__ == "__main__":
    run()
