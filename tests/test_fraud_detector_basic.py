"""Test: Fraud detector — basic detection on clean resume (sample.pdf)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "fraud_detector"
SCENARIO = "basic"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: fraud_detector / basic")
    p("=" * 60)

    from app.ml.analysis.fraud_detector import FraudDetector

    detector = FraudDetector()

    # Entities from sample.pdf — clean resume, no fraud signals
    entities = {
        "experience": [
            {"role": "Full-Stack Developer", "company": "Hackathon Projects", "duration": "2022-2024"},
        ],
        "education": [
            {"degree": "Bachelor of Technology in Computer Engineering",
             "institution": "Ganpat University", "year": "2024"},
            {"degree": "Diploma of Computer Engineering",
             "institution": "Ganpat University", "year": "2021"},
        ],
    }

    flags = detector.detect(entities)

    p(f"Flags detected: {len(flags)}")
    for f in flags:
        p(f"  [{f['severity'].upper()}] {f['type']}: {f['description']}")

    # Clean resume should have no high-severity flags
    high_flags = [f for f in flags if f["severity"] == "high"]
    assert len(high_flags) == 0, f"Expected no high-severity flags for clean resume, got: {high_flags}"

    # All flags must have required keys
    for f in flags:
        assert "type" in f and "description" in f and "severity" in f, \
            f"Flag missing required keys: {f}"
        assert f["severity"] in ("low", "medium", "high"), \
            f"Invalid severity: {f['severity']}"

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {"flags": flags, "flag_count": len(flags)})
    print("PASS: fraud_detector/basic")
    return True


if __name__ == "__main__":
    run()
