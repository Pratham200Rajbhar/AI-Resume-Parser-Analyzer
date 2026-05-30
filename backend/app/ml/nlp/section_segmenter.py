import re

import structlog

logger = structlog.get_logger(__name__)

# Ordered list of (section_name, regex_pattern) pairs.
# Patterns are case-insensitive and match common resume section headers.
_SECTION_PATTERNS: list[tuple[str, str]] = [
    ("CONTACT", r"(?:contact(?:\s+information)?|personal\s+(?:details|information)|reach\s+me)"),
    ("SUMMARY", r"(?:(?:professional\s+)?summary|objective|profile|about\s+me|career\s+objective)"),
    ("EXPERIENCE", r"(?:(?:work\s+|professional\s+|employment\s+)?experience|work\s+history|employment(?:\s+history)?|career\s+history)"),
    ("EDUCATION", r"(?:education(?:al\s+background)?|academic(?:\s+background)?|qualifications?|degrees?)"),
    ("SKILLS", r"(?:(?:technical\s+|core\s+|key\s+)?skills?|competenc(?:y|ies)|expertise|technologies|tech\s+stack)"),
    ("PROJECTS", r"(?:projects?|personal\s+projects?|side\s+projects?|portfolio)"),
    ("CERTIFICATIONS", r"(?:certifications?|certificates?|licenses?|accreditations?|credentials?)"),
    ("AWARDS", r"(?:awards?|honors?|achievements?|accomplishments?|recognition)"),
    ("PUBLICATIONS", r"(?:publications?|papers?|research|articles?)"),
    ("LANGUAGES", r"(?:languages?|language\s+proficiency)"),
    ("VOLUNTEER", r"(?:volunteer(?:ing|s)?|community\s+(?:service|involvement)|social\s+work)"),
    ("REFERENCES", r"(?:references?|referees?)"),
]

# Build a combined regex that matches any section header on its own line
_HEADER_RE = re.compile(
    r"^(?P<header>"
    + "|".join(f"(?P<sec_{name}>{pattern})" for name, pattern in _SECTION_PATTERNS)
    + r")\s*[:\-–—]?\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def segment_sections(text: str) -> dict[str, str]:
    """
    Rule-based section detection using regex patterns for common resume headers.

    Returns a dict mapping section name → section text.
    An implicit 'HEADER' section captures any text before the first recognised section.
    """
    sections: dict[str, str] = {}
    matches = list(_HEADER_RE.finditer(text))

    if not matches:
        # No sections detected — return the whole text as BODY
        logger.debug("section_segmenter_no_sections_found", chars=len(text))
        return {"BODY": text.strip()}

    # Text before the first section header
    preamble = text[: matches[0].start()].strip()
    if preamble:
        sections["HEADER"] = preamble

    for i, match in enumerate(matches):
        # Determine which named group matched
        section_name = "UNKNOWN"
        for name, _ in _SECTION_PATTERNS:
            if match.group(f"sec_{name}") is not None:
                section_name = name
                break

        # Section body: from end of this header to start of next header (or end of text)
        body_start = match.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end].strip()

        # If the same section appears twice, append rather than overwrite
        if section_name in sections:
            sections[section_name] = sections[section_name] + "\n" + body
        else:
            sections[section_name] = body

    logger.debug("section_segmenter_done", sections=list(sections.keys()))
    return sections
