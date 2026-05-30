"""Test: Bias detector — edge cases (empty text, known bias patterns)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "bias_detector"
SCENARIO = "edge_cases"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: bias_detector / edge_cases")
    p("=" * 60)

    from app.ml.analysis.bias_detector import BiasDetector

    detector = BiasDetector()

    # 1. Empty text
    p("\n[1] Empty text")
    flags = detector.detect("")
    assert flags == [], f"Expected [], got {flags}"
    p("  OK — empty text returns []")

    # 2. Whitespace only
    p("\n[2] Whitespace only")
    flags = detector.detect("   \n\t  ")
    assert flags == [], f"Expected [], got {flags}"
    p("  OK")

    # 3. Gendered title
    p("\n[3] Gendered title (Mr.)")
    text = "Mr. John Doe is applying for the position of Software Engineer."
    flags = detector.detect(text)
    gender_flags = [f for f in flags if f["type"] == "gender"]
    assert len(gender_flags) >= 1, f"Expected gender flag for 'Mr.', got: {flags}"
    p(f"  OK — gender flag: {gender_flags[0]['term']!r}")

    # 4. Age disclosure
    p("\n[4] Age disclosure (born in YYYY)")
    text = "Born in 1990. Software engineer with 10 years of experience."
    flags = detector.detect(text)
    age_flags = [f for f in flags if f["type"] == "age"]
    assert len(age_flags) >= 1, f"Expected age flag for 'born in', got: {flags}"
    p(f"  OK — age flag: {age_flags[0]['term']!r}")

    # 5. Marital status
    p("\n[5] Marital status")
    text = "Marital status: Married. Looking for a full-time position."
    flags = detector.detect(text)
    personal_flags = [f for f in flags if f["type"] == "personal"]
    assert len(personal_flags) >= 1, f"Expected personal flag for marital status, got: {flags}"
    p(f"  OK — personal flag: {personal_flags[0]['term']!r}")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "empty_handled": True,
        "whitespace_handled": True,
        "gender_detected": True,
        "age_detected": True,
        "personal_detected": True,
    })
    print("PASS: bias_detector/edge_cases")
    return True


if __name__ == "__main__":
    run()
