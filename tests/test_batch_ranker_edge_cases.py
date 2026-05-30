"""Test: Batch ranker — edge cases (empty list, single candidate, no JD embedding)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "batch_ranker"
SCENARIO = "edge_cases"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: batch_ranker / edge_cases")
    p("=" * 60)

    from app.ml.analysis.ranker import BatchRanker

    ranker = BatchRanker()

    # 1. Empty candidate list
    p("\n[1] Empty candidate list")
    result = ranker.rank([])
    assert result == [], f"Expected [], got {result}"
    p("  OK — empty list returns []")

    # 2. Single candidate
    p("\n[2] Single candidate")
    single = [{
        "resume_id": "r1",
        "candidate_name": "Pratham Rajbhar",
        "entities": {
            "skills": [{"raw": "Python"}, {"raw": "FastAPI"}, {"raw": "React.js"}],
            "experience": [{"role": "Dev", "company": "X", "duration": "2022-2024"}],
            "education": [{"degree": "B.Tech", "institution": "GU", "year": "2024"}],
        },
        "ats_score": 75,
        "match_score": 0.65,
    }]
    result = ranker.rank(single)
    assert len(result) == 1
    assert result[0]["rank"] == 1
    p(f"  OK — single candidate ranked: {result[0]}")

    # 3. No JD embedding (uses ATS score path)
    p("\n[3] No JD embedding — ATS score path")
    candidates = [
        {"resume_id": "r1", "candidate_name": "A",
         "entities": {"skills": [{"raw": "Python"}] * 15, "experience": [], "education": []},
         "ats_score": 90, "match_score": 0.0},
        {"resume_id": "r2", "candidate_name": "B",
         "entities": {"skills": [{"raw": "Java"}] * 5, "experience": [], "education": []},
         "ats_score": 40, "match_score": 0.0},
    ]
    result = ranker.rank(candidates, jd_embedding=None)
    assert result[0]["candidate_name"] == "A", "Higher ATS score should rank first"
    p(f"  OK — A ranked first with ATS score 90")

    # 4. Composite score is in [0, 100]
    p("\n[4] Composite score bounds")
    for r in result:
        assert 0 <= r["composite_score"] <= 100, f"Score out of bounds: {r['composite_score']}"
    p("  OK — all scores in [0, 100]")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "empty_handled": True,
        "single_candidate": True,
        "no_jd_embedding": True,
        "score_bounded": True,
    })
    print("PASS: batch_ranker/edge_cases")
    return True


if __name__ == "__main__":
    run()
