"""Test: Fraud detector — edge cases (overlapping jobs, future dates, gaps)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "fraud_detector"
SCENARIO = "edge_cases"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: fraud_detector / edge_cases")
    p("=" * 60)

    from app.ml.analysis.fraud_detector import FraudDetector

    detector = FraudDetector()

    # 1. Empty entities — no crash
    p("\n[1] Empty entities")
    flags = detector.detect({})
    assert flags == [], f"Expected [], got {flags}"
    p("  OK — empty entities returns []")

    # 2. Overlapping employment
    p("\n[2] Overlapping employment")
    entities = {
        "experience": [
            {"role": "Engineer A", "company": "Corp A", "duration": "2018-2022"},
            {"role": "Engineer B", "company": "Corp B", "duration": "2019-2023"},
        ],
        "education": [],
    }
    flags = detector.detect(entities)
    p(f"  Flags: {flags}")
    overlap_flags = [f for f in flags if f["type"] == "overlapping_employment"]
    assert len(overlap_flags) >= 1, "Expected overlapping_employment flag"
    p(f"  OK — overlap detected: {overlap_flags[0]['description']}")

    # 3. Future graduation year
    p("\n[3] Future graduation year")
    entities = {
        "experience": [],
        "education": [{"degree": "B.Tech", "institution": "GU", "year": "2099"}],
    }
    flags = detector.detect(entities)
    future_flags = [f for f in flags if f["type"] == "future_graduation_year"]
    assert len(future_flags) >= 1, "Expected future_graduation_year flag"
    p(f"  OK — future grad year detected: {future_flags[0]['description']}")

    # 4. Employment gap > 2 years
    p("\n[4] Employment gap > 2 years")
    entities = {
        "experience": [
            {"role": "Dev A", "company": "A", "duration": "2015-2017"},
            {"role": "Dev B", "company": "B", "duration": "2020-2023"},
        ],
        "education": [],
    }
    flags = detector.detect(entities)
    gap_flags = [f for f in flags if f["type"] == "employment_gap"]
    assert len(gap_flags) >= 1, "Expected employment_gap flag"
    p(f"  OK — gap detected: {gap_flags[0]['description']}")

    # 5. Implausible tenure (> 30 years)
    p("\n[5] Implausible tenure")
    entities = {
        "experience": [
            {"role": "Lifer", "company": "MegaCorp", "duration": "1980-2020"},
        ],
        "education": [],
    }
    flags = detector.detect(entities)
    tenure_flags = [f for f in flags if f["type"] == "implausible_tenure"]
    assert len(tenure_flags) >= 1, "Expected implausible_tenure flag"
    p(f"  OK — implausible tenure detected: {tenure_flags[0]['description']}")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "empty_handled": True,
        "overlap_detected": True,
        "future_grad_detected": True,
        "gap_detected": True,
        "implausible_tenure_detected": True,
    })
    print("PASS: fraud_detector/edge_cases")
    return True


if __name__ == "__main__":
    run()
