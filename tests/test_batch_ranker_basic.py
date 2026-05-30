"""Test: Batch ranker — basic ranking of multiple candidates"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "batch_ranker"
SCENARIO = "basic"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: batch_ranker / basic")
    p("=" * 60)

    from app.ml.analysis.ranker import BatchRanker

    ranker = BatchRanker()

    # Candidates based on sample.pdf profile (Pratham) vs weaker candidates
    candidates = [
        {
            "resume_id": "resume-001",
            "candidate_name": "Pratham Rajbhar",
            "entities": {
                "skills": [
                    {"raw": "Python"}, {"raw": "JavaScript"}, {"raw": "FastAPI"},
                    {"raw": "React.js"}, {"raw": "Docker"}, {"raw": "PostgreSQL"},
                    {"raw": "Redis"}, {"raw": "LangChain"}, {"raw": "Flutter"},
                    {"raw": "TensorFlow"}, {"raw": "Next.js"}, {"raw": "PyTorch"},
                ],
                "experience": [
                    {"role": "Full-Stack Developer", "company": "Projects", "duration": "2022-2024"},
                ],
                "education": [
                    {"degree": "Bachelor of Technology in Computer Engineering",
                     "institution": "Ganpat University", "year": "2024"},
                ],
            },
            "ats_score": 82,
            "match_score": 0.78,
        },
        {
            "resume_id": "resume-002",
            "candidate_name": "Jane Smith",
            "entities": {
                "skills": [{"raw": "Python"}, {"raw": "SQL"}, {"raw": "Excel"}],
                "experience": [
                    {"role": "Data Analyst", "company": "Corp", "duration": "2020-2022"},
                ],
                "education": [
                    {"degree": "Bachelor of Science", "institution": "State University", "year": "2020"},
                ],
            },
            "ats_score": 55,
            "match_score": 0.42,
        },
        {
            "resume_id": "resume-003",
            "candidate_name": "Bob Lee",
            "entities": {
                "skills": [{"raw": "Java"}, {"raw": "Spring Boot"}, {"raw": "MySQL"},
                            {"raw": "Docker"}, {"raw": "Kubernetes"}],
                "experience": [
                    {"role": "Backend Engineer", "company": "TechCo", "duration": "2018-2023"},
                ],
                "education": [
                    {"degree": "Master of Science in Computer Science",
                     "institution": "MIT", "year": "2018"},
                ],
            },
            "ats_score": 70,
            "match_score": 0.55,
        },
    ]

    ranked = ranker.rank(candidates)

    p(f"Ranked {len(ranked)} candidates:")
    for r in ranked:
        p(f"  Rank {r['rank']}: {r['candidate_name']} — composite={r['composite_score']:.2f}")
        p(f"    components: {r['component_scores']}")

    assert len(ranked) == 3, f"Expected 3 ranked candidates, got {len(ranked)}"
    # Ranks should be 1, 2, 3
    ranks = [r["rank"] for r in ranked]
    assert ranks == [1, 2, 3], f"Ranks should be sequential: {ranks}"
    # Scores should be descending
    scores = [r["composite_score"] for r in ranked]
    assert scores == sorted(scores, reverse=True), f"Scores not descending: {scores}"
    # Pratham should rank #1 (highest match + skills)
    assert ranked[0]["candidate_name"] == "Pratham Rajbhar", \
        f"Expected Pratham at rank 1, got {ranked[0]['candidate_name']}"

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, ranked)
    print("PASS: batch_ranker/basic")
    return True


if __name__ == "__main__":
    run()
