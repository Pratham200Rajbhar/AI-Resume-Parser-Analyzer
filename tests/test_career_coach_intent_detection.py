"""Test: Career coach intent detection and fallback responses"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "career_coach"
SCENARIO = "intent_detection"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: career_coach / intent_detection")
    p("=" * 60)

    # Import the private helper directly (no LLM needed)
    from app.ml.llm.coach import _detect_intent, _FALLBACK_RESPONSES

    test_cases = [
        ("Can you rewrite my bullet points?", "rewrite"),
        ("Help me improve this bullet point", "rewrite"),
        ("Write me a cover letter for this job", "cover_letter"),
        ("I need a covering letter", "cover_letter"),
        ("What skill gap do I have?", "skill_gap"),
        ("What skills am I missing?", "skill_gap"),
        ("Help me prepare for the interview", "interview"),
        ("What interview questions should I expect?", "interview"),
        ("Tell me about yourself", "default"),
        ("", "default"),
    ]

    p("\nIntent detection results:")
    all_passed = True
    for message, expected in test_cases:
        detected = _detect_intent(message)
        status = "OK" if detected == expected else "FAIL"
        if status == "FAIL":
            all_passed = False
        p(f"  [{status}] {message!r:45s} → {detected!r} (expected {expected!r})")

    assert all_passed, "Some intent detections failed"

    # Verify all fallback responses are non-empty strings
    p("\nFallback response check:")
    for intent, response in _FALLBACK_RESPONSES.items():
        assert isinstance(response, str) and len(response) > 20, \
            f"Fallback for {intent!r} is too short or not a string"
        p(f"  [{intent}] {len(response)} chars — OK")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "intent_cases_tested": len(test_cases),
        "all_passed": True,
        "fallback_intents": list(_FALLBACK_RESPONSES.keys()),
    })
    print("PASS: career_coach/intent_detection")
    return True


if __name__ == "__main__":
    run()
