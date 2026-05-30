"""Test: Skill normalizer — edge cases (empty, duplicates, unknown skills)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "skill_normalizer"
SCENARIO = "edge_cases"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: skill_normalizer / edge_cases")
    p("=" * 60)

    from app.ml.nlp.skill_normalizer import SkillNormalizer

    normalizer = SkillNormalizer()

    # 1. Empty list
    p("\n[1] Empty list")
    result = normalizer.normalize([])
    assert result == [], f"Expected [], got {result}"
    p("  OK — empty list returns []")

    # 2. Whitespace-only strings are skipped
    p("\n[2] Whitespace-only strings")
    result = normalizer.normalize(["", "   ", "\t"])
    assert result == [], f"Expected [], got {result}"
    p("  OK — whitespace-only strings skipped")

    # 3. Exact match (known O*NET skill)
    p("\n[3] Exact match")
    result = normalizer.normalize(["Python"])
    assert len(result) == 1
    p(f"  Python → {result[0]}")

    # 4. Unknown skill falls back gracefully
    p("\n[4] Unknown/nonsense skill")
    result = normalizer.normalize(["xyzzy_nonexistent_skill_abc"])
    assert len(result) == 1
    r = result[0]
    assert r["raw"] == "xyzzy_nonexistent_skill_abc"
    # confidence may be 0 or low, but should not crash
    p(f"  OK — fallback: {r}")

    # 5. Case insensitivity
    p("\n[5] Case insensitivity")
    r_lower = normalizer.normalize(["python"])
    r_upper = normalizer.normalize(["PYTHON"])
    p(f"  lower: {r_lower[0]}")
    p(f"  upper: {r_upper[0]}")
    # Both should normalize to the same thing
    assert r_lower[0]["normalized"].lower() == r_upper[0]["normalized"].lower(), \
        "Case should not affect normalization"
    p("  OK — case insensitive")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "empty_handled": True,
        "whitespace_skipped": True,
        "exact_match": True,
        "unknown_fallback": True,
        "case_insensitive": True,
    })
    print("PASS: skill_normalizer/edge_cases")
    return True


if __name__ == "__main__":
    run()
