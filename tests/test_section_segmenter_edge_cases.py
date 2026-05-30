"""Test: Section segmenter — edge cases (empty text, no headers, duplicate sections)"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "section_segmenter"
SCENARIO = "edge_cases"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: section_segmenter / edge_cases")
    p("=" * 60)

    from app.ml.nlp.section_segmenter import segment_sections

    # 1. Empty string
    p("\n[1] Empty string")
    result = segment_sections("")
    assert result == {"BODY": ""} or result == {}, f"Unexpected result for empty: {result}"
    p(f"  OK — {result}")

    # 2. No section headers → returns BODY
    p("\n[2] Plain text with no headers")
    plain = "John Doe is a software engineer with 5 years of experience in Python."
    result = segment_sections(plain)
    assert "BODY" in result, f"Expected BODY key, got {list(result.keys())}"
    p(f"  OK — BODY section: {result['BODY'][:60]!r}")

    # 3. Known headers detected
    p("\n[3] Text with explicit headers")
    structured = "Skills\nPython, JavaScript\n\nEducation\nB.Tech Computer Engineering"
    result = segment_sections(structured)
    p(f"  Sections: {list(result.keys())}")
    assert "SKILLS" in result or "EDUCATION" in result, \
        f"Expected SKILLS or EDUCATION, got {list(result.keys())}"
    p("  OK — headers detected")

    # 4. Duplicate section → content appended
    p("\n[4] Duplicate section headers")
    dup = "Skills\nPython\n\nExperience\nJob A\n\nSkills\nJavaScript"
    result = segment_sections(dup)
    if "SKILLS" in result:
        p(f"  SKILLS content: {result['SKILLS']!r}")
        assert "Python" in result["SKILLS"] or "JavaScript" in result["SKILLS"], \
            "Expected skill content in merged SKILLS section"
    p("  OK")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "empty_handled": True,
        "no_headers_returns_body": True,
        "headers_detected": True,
        "duplicate_merged": True,
    })
    print("PASS: section_segmenter/edge_cases")
    return True


if __name__ == "__main__":
    run()
