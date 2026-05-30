"""Test: Section segmenter — basic section detection on sample.pdf text"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result, get_sample_text

FEATURE = "section_segmenter"
SCENARIO = "basic"


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: section_segmenter / basic")
    p("=" * 60)

    from app.ml.nlp.section_segmenter import segment_sections

    text = get_sample_text()
    sections = segment_sections(text)

    p(f"Detected sections: {list(sections.keys())}")
    for name, body in sections.items():
        p(f"  [{name}] {len(body)} chars — preview: {body[:80].strip()!r}")

    # sample.pdf has SUMMARY, PROJECTS, SKILLS, EDUCATION
    assert len(sections) >= 2, "Expected at least 2 sections"
    assert any(k in sections for k in ("SUMMARY", "HEADER", "BODY")), \
        "Expected a SUMMARY or HEADER section"
    assert "SKILLS" in sections or "EDUCATION" in sections, \
        "Expected SKILLS or EDUCATION section"

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "sections_found": list(sections.keys()),
        "section_lengths": {k: len(v) for k, v in sections.items()},
    })
    print("PASS: section_segmenter/basic")
    return True


if __name__ == "__main__":
    run()
