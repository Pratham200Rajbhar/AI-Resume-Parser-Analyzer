"""Test: PDF parser — edge cases (router, unsupported type, real file)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import SAMPLE_PDF, save_log, save_result

FEATURE = "pdf_parser"
SCENARIO = "edge_cases"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: pdf_parser / edge_cases")
    p("=" * 60)

    from app.ml.parsers.router import parse_file
    from app.ml.parsers.pdf_parser import parse_pdf

    # 1. Router correctly dispatches .pdf
    p("\n[1] Router dispatch for .pdf")
    text = parse_file(SAMPLE_PDF, "pdf")
    assert len(text) > 100, "Router should return text for pdf"
    p(f"  OK — {len(text)} chars returned")

    # 2. Router raises ValueError for unsupported type
    p("\n[2] Router raises ValueError for unsupported type")
    try:
        parse_file(SAMPLE_PDF, "xyz")
        assert False, "Should have raised ValueError"
    except ValueError as e:
        p(f"  OK — ValueError raised: {e}")

    # 3. Leading dot in extension is stripped
    p("\n[3] Router handles '.pdf' with leading dot")
    text2 = parse_file(SAMPLE_PDF, ".pdf")
    assert len(text2) > 100
    p(f"  OK — {len(text2)} chars returned")

    # 4. Text contains newlines (basic structure check)
    p("\n[4] Text structure check")
    assert "\n" in text, "Expected newlines in extracted text"
    assert len(text.split()) >= 50, "Expected at least 50 words in extracted text"
    p(f"  OK — text has {len(text.split())} words and newlines")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "router_dispatch": True,
        "unsupported_raises": True,
        "leading_dot_handled": True,
        "multipage_separator": True,
    })
    print("PASS: pdf_parser/edge_cases")
    return True


if __name__ == "__main__":
    run()
