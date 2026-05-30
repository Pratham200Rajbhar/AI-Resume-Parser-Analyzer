"""Test: NLP pipeline — edge cases (empty text, whitespace, minimal resume)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "nlp_pipeline"
SCENARIO = "edge_cases"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: nlp_pipeline / edge_cases")
    p("=" * 60)

    from app.ml.nlp.pipeline import NLPPipeline

    pipeline = NLPPipeline()

    # 1. Empty string
    p("\n[1] Empty string")
    result = pipeline.run("")
    assert result["name"] == ""
    assert result["email"] == ""
    assert result["skills"] == []
    assert result["experience"] == []
    p("  OK — empty string returns empty result")

    # 2. Whitespace only
    p("\n[2] Whitespace only")
    result = pipeline.run("   \n\t  ")
    assert result["name"] == ""
    assert result["skills"] == []
    p("  OK — whitespace returns empty result")

    # 3. Email extraction
    p("\n[3] Email extraction")
    text = "Contact me at john.doe@example.com for more info."
    result = pipeline.run(text)
    assert result["email"] == "john.doe@example.com", \
        f"Expected email, got {result['email']!r}"
    p(f"  OK — email: {result['email']!r}")

    # 4. Phone extraction
    p("\n[4] Phone extraction")
    text = "Call me at +91 9512518403 anytime."
    result = pipeline.run(text)
    assert result["phone"], f"Expected phone, got {result['phone']!r}"
    p(f"  OK — phone: {result['phone']!r}")

    # 5. LinkedIn/GitHub URL extraction
    p("\n[5] URL extraction")
    text = "Find me at linkedin.com/in/johndoe and github.com/johndoe"
    result = pipeline.run(text)
    assert result["linkedin"] is not None, "Expected LinkedIn URL"
    assert result["github"] is not None, "Expected GitHub URL"
    p(f"  OK — linkedin={result['linkedin']!r}, github={result['github']!r}")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "empty_handled": True,
        "whitespace_handled": True,
        "email_extracted": True,
        "phone_extracted": True,
        "urls_extracted": True,
    })
    print("PASS: nlp_pipeline/edge_cases")
    return True


if __name__ == "__main__":
    run()
