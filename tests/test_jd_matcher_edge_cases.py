"""Test: JD Matcher — edge cases (empty JD, empty resume, zero-vector handling)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result, get_sample_text

FEATURE = "jd_matcher"
SCENARIO = "edge_cases"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: jd_matcher / edge_cases")
    p("=" * 60)

    from app.ml.analysis.jd_matcher import JDMatcher

    matcher = JDMatcher()
    resume_text = get_sample_text()

    # 1. Empty JD text
    p("\n[1] Empty JD text")
    empty_emb = matcher.embed("")
    result = matcher.match({}, resume_text, "", empty_emb)
    p(f"  match_score={result['match_score']}, gap_skills={result['gap_skills'][:5]}")
    assert 0.0 <= result["match_score"] <= 1.0
    p("  OK — no crash on empty JD")

    # 2. Empty resume entities and text
    p("\n[2] Empty resume")
    jd = "Python developer with FastAPI experience needed."
    jd_emb = matcher.embed(jd)
    result = matcher.match({}, "", jd, jd_emb)
    p(f"  match_score={result['match_score']}")
    assert 0.0 <= result["match_score"] <= 1.0
    p("  OK — no crash on empty resume")

    # 3. Embedding is a list of floats
    p("\n[3] Embedding type check")
    emb = matcher.embed("Python FastAPI developer")
    assert isinstance(emb, list), f"Expected list, got {type(emb)}"
    assert all(isinstance(x, float) for x in emb[:5]), "Embedding values should be floats"
    p(f"  OK — embedding is list[float] of length {len(emb)}")

    # 4. Keyword report coverage_pct is 0–100
    p("\n[4] Keyword coverage bounds")
    jd2 = "We need a Python and JavaScript developer."
    jd2_emb = matcher.embed(jd2)
    result2 = matcher.match(
        {"skills": [{"raw": "Python", "normalized": "Python"}]},
        "Python developer",
        jd2,
        jd2_emb,
    )
    cov = result2["keyword_report"]["coverage_pct"]
    assert 0.0 <= cov <= 100.0, f"coverage_pct out of range: {cov}"
    p(f"  OK — coverage_pct={cov}")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "empty_jd_handled": True,
        "empty_resume_handled": True,
        "embedding_type_correct": True,
        "coverage_bounded": True,
    })
    print("PASS: jd_matcher/edge_cases")
    return True


if __name__ == "__main__":
    run()
