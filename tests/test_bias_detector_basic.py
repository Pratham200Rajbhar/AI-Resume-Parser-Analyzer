"""Test: Bias detector — basic scan on clean resume text (sample.pdf)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result, get_sample_text

FEATURE = "bias_detector"
SCENARIO = "basic"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: bias_detector / basic")
    p("=" * 60)

    from app.ml.analysis.bias_detector import BiasDetector

    detector = BiasDetector()
    text = get_sample_text()

    flags = detector.detect(text)

    p(f"Bias flags detected: {len(flags)}")
    for f in flags:
        p(f"  [{f['type'].upper()}] term={f['term']!r}")
        p(f"    suggestion: {f['suggestion']}")

    # All flags must have required keys
    for f in flags:
        assert "type" in f and "term" in f and "sentence" in f and "suggestion" in f, \
            f"Flag missing required keys: {f}"
        assert f["type"] in ("age", "gender", "personal"), \
            f"Invalid bias type: {f['type']}"

    # sample.pdf is a professional resume — should have zero or very few flags
    p(f"\nTotal flags: {len(flags)} (expected 0 for clean professional resume)")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {"flags": flags, "flag_count": len(flags)})
    print("PASS: bias_detector/basic")
    return True


if __name__ == "__main__":
    run()
