"""Test: PDF parser — basic text extraction from sample.pdf"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import SAMPLE_PDF, save_log, save_result

FEATURE = "pdf_parser"
SCENARIO = "basic"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: pdf_parser / basic")
    p("=" * 60)

    from app.ml.parsers.pdf_parser import parse_pdf

    text = parse_pdf(SAMPLE_PDF)

    p(f"Extracted {len(text)} characters, {len(text.split())} words")
    p(f"First 300 chars:\n{text[:300]}")

    # Assertions
    assert len(text) > 100, "Expected substantial text from sample.pdf"
    assert "PRATHAM" in text.upper(), "Expected candidate name in text"
    assert "RAJBHAR" in text.upper(), "Expected candidate surname in text"
    assert "@" in text, "Expected email address in text"
    assert any(kw in text.upper() for kw in ["PYTHON", "FASTAPI", "REACT"]), \
        "Expected at least one known skill keyword"

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "char_count": len(text),
        "word_count": len(text.split()),
        "has_name": "PRATHAM" in text.upper(),
        "has_email": "@" in text,
        "preview": text[:500],
    })
    print("PASS: pdf_parser/basic")
    return True


if __name__ == "__main__":
    run()
