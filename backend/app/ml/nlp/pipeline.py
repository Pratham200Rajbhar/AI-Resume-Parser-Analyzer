from __future__ import annotations

import re

import structlog

from app.ml.nlp.bert_ner import BertNER
from app.ml.nlp.section_segmenter import segment_sections
from app.ml.nlp.skill_normalizer import SkillNormalizer
from app.ml.nlp.spacy_ner import SpacyNER

logger = structlog.get_logger(__name__)

# Regex patterns for contact info extraction
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.IGNORECASE)
_PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-.]?)?"
    r"(?:\(?\d{2,4}\)?[\s\-.]?)?"
    r"\d{3,4}[\s\-.]?\d{3,4}"
    r"(?:[\s\-.]?\d{1,4})?",
    re.IGNORECASE,
)
_URL_RE = re.compile(
    r"(?:https?://|www\.)[^\s,;\"'<>()]+",
    re.IGNORECASE,
)
_LINKEDIN_RE = re.compile(r"linkedin\.com/in/([^\s,;\"'<>()]+)", re.IGNORECASE)
_GITHUB_RE = re.compile(r"github\.com/([^\s,;\"'<>()]+)", re.IGNORECASE)


def _extract_emails(text: str) -> list[str]:
    return list(dict.fromkeys(_EMAIL_RE.findall(text)))


def _extract_phones(text: str) -> list[str]:
    raw = _PHONE_RE.findall(text)
    cleaned = [p.strip() for p in raw if len(re.sub(r"\D", "", p)) >= 7]
    return list(dict.fromkeys(cleaned))


def _extract_urls(text: str) -> dict:
    linkedin_match = _LINKEDIN_RE.search(text)
    github_match = _GITHUB_RE.search(text)
    return {
        "linkedin": f"https://linkedin.com/in/{linkedin_match.group(1)}" if linkedin_match else None,
        "github": f"https://github.com/{github_match.group(1)}" if github_match else None,
    }


def _extract_experience_entries(section_text: str, spacy_entities: list[dict]) -> list[dict]:
    """
    Parse experience section into structured entries.
    Uses a heuristic: lines with ORG/DATE entities are likely job entries.
    """
    entries: list[dict] = []
    orgs = {e["text"] for e in spacy_entities if e["label"] == "ORG"}
    dates = [e["text"] for e in spacy_entities if e["label"] == "DATE"]

    lines = [l.strip() for l in section_text.split("\n") if l.strip()]
    current: dict | None = None

    for line in lines:
        # Heuristic: a line containing an ORG entity is a job header
        is_org_line = any(org.lower() in line.lower() for org in orgs)
        if is_org_line or (len(line) < 80 and re.search(r"\d{4}", line)):
            if current:
                entries.append(current)
            current = {
                "role": "",
                "company": next((org for org in orgs if org.lower() in line.lower()), ""),
                "duration": next((d for d in dates if d in line), ""),
                "description": "",
            }
        elif current:
            if not current["role"] and len(line) < 80:
                current["role"] = line
            else:
                current["description"] = (current["description"] + " " + line).strip()

    if current:
        entries.append(current)

    return entries


def _extract_education_entries(section_text: str, bert_entities: list[dict]) -> list[dict]:
    """Parse education section into structured entries."""
    entries: list[dict] = []
    degrees = [e["text"] for e in bert_entities if e["label"] == "DEGREE"]
    lines = [l.strip() for l in section_text.split("\n") if l.strip()]

    for line in lines:
        year_match = re.search(r"\b(19|20)\d{2}\b", line)
        degree_match = next((d for d in degrees if d.lower() in line.lower()), None)
        if degree_match or year_match:
            entries.append({
                "degree": degree_match or "",
                "institution": line,
                "year": year_match.group(0) if year_match else "",
            })

    return entries


class NLPPipeline:
    """
    Full NLP pipeline: section segmentation → spaCy NER → BERT NER → skill normalisation.
    Returns a structured entity dict from raw resume text.
    """

    def __init__(self) -> None:
        self._spacy = SpacyNER()
        self._bert = BertNER()
        self._skill_norm = SkillNormalizer()

    def run(self, text: str) -> dict:
        """
        Process raw resume text through the full pipeline.

        Returns:
            {
                name, email, phone, location, linkedin, github,
                summary, experience: [...], education: [...],
                skills: [...], certifications: [...], projects: [...]
            }
        """
        if not text or not text.strip():
            return self._empty_result()

        # ── 1. Section segmentation ──────────────────────────────────────────
        sections = segment_sections(text)

        # ── 2. spaCy NER (on full text) ──────────────────────────────────────
        spacy_entities = self._spacy.extract(text)

        # ── 3. BERT NER (on full text) ───────────────────────────────────────
        bert_entities = self._bert.extract(text)

        # ── 4. Contact info ──────────────────────────────────────────────────
        emails = _extract_emails(text)
        phones = _extract_phones(text)
        urls = _extract_urls(text)

        # ── 5. Name: prefer BERT NAME, fallback to spaCy PERSON ─────────────
        name = ""
        for e in bert_entities:
            if e["label"] == "NAME":
                name = e["text"]
                break
        if not name:
            for e in spacy_entities:
                if e["label"] == "PERSON":
                    name = e["text"]
                    break

        # ── 6. Location: spaCy GPE/LOC ───────────────────────────────────────
        location = ""
        for e in spacy_entities:
            if e["label"] in ("GPE", "LOC"):
                location = e["text"]
                break

        # ── 7. Skills: BERT SKILL entities + skill section text ──────────────
        raw_skills: list[str] = [e["text"] for e in bert_entities if e["label"] == "SKILL"]
        skills_section = sections.get("SKILLS", "")
        if skills_section:
            # Extract comma/bullet separated skills from the skills section
            skill_tokens = re.split(r"[,\n•·\-|/]", skills_section)
            raw_skills.extend([t.strip() for t in skill_tokens if 2 <= len(t.strip()) <= 50])

        # Deduplicate
        seen_skills: set[str] = set()
        unique_skills: list[str] = []
        for s in raw_skills:
            if s.lower() not in seen_skills:
                seen_skills.add(s.lower())
                unique_skills.append(s)

        normalised_skills = self._skill_norm.normalize(unique_skills)

        # ── 8. Experience ────────────────────────────────────────────────────
        experience_section = sections.get("EXPERIENCE", "")
        experience = _extract_experience_entries(experience_section, spacy_entities) if experience_section else []

        # ── 9. Education ─────────────────────────────────────────────────────
        education_section = sections.get("EDUCATION", "")
        education = _extract_education_entries(education_section, bert_entities) if education_section else []

        # ── 10. Certifications ───────────────────────────────────────────────
        cert_section = sections.get("CERTIFICATIONS", "")
        certifications: list[str] = []
        if cert_section:
            cert_lines = [l.strip() for l in cert_section.split("\n") if l.strip()]
            certifications.extend(cert_lines)
        # Also add CERT entities from BERT
        for e in bert_entities:
            if e["label"] == "CERT" and e["text"] not in certifications:
                certifications.append(e["text"])

        # ── 11. Projects ─────────────────────────────────────────────────────
        projects_section = sections.get("PROJECTS", "")
        projects: list[dict] = []
        if projects_section:
            proj_lines = [l.strip() for l in projects_section.split("\n") if l.strip()]
            current_proj: dict | None = None
            for line in proj_lines:
                if len(line) < 80 and not line.endswith("."):
                    if current_proj:
                        projects.append(current_proj)
                    current_proj = {"name": line, "description": ""}
                elif current_proj:
                    current_proj["description"] = (current_proj["description"] + " " + line).strip()
            if current_proj:
                projects.append(current_proj)

        # ── 12. Summary ──────────────────────────────────────────────────────
        summary = sections.get("SUMMARY", "").strip()

        return {
            "name": name,
            "email": emails[0] if emails else "",
            "emails": emails,
            "phone": phones[0] if phones else "",
            "phones": phones,
            "location": location,
            "linkedin": urls.get("linkedin"),
            "github": urls.get("github"),
            "summary": summary,
            "experience": experience,
            "education": education,
            "skills": normalised_skills,
            "certifications": certifications,
            "projects": projects,
        }

    @staticmethod
    def _empty_result() -> dict:
        return {
            "name": "",
            "email": "",
            "emails": [],
            "phone": "",
            "phones": [],
            "location": "",
            "linkedin": None,
            "github": None,
            "summary": "",
            "experience": [],
            "education": [],
            "skills": [],
            "certifications": [],
            "projects": [],
        }
