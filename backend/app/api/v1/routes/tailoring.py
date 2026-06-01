"""Resume Tailoring Studio.

Generates an ATS-optimized resume version targeting a specific job description by
composing existing building blocks: JD matching (gap_skills/keyword_report), the
CareerCoach LLM (bullet rewriting + tailored summary), ATS scoring, the resume
version chain (parentResumeId), and the existing export endpoints. No new Prisma
model is required — a tailored resume is a normal Resume row + ResumeAnalysis +
JdMatchResult, so versions/export/coach all keep working unchanged.
"""

from __future__ import annotations

import copy
import hashlib
import json
import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.db.repositories.analysis_repo import AnalysisRepository
from app.db.repositories.jd_repo import JdRepository, MatchRepository
from app.db.repositories.resume_repo import ResumeRepository
from app.ml.llm.prompts import TAILOR_RESUME_PROMPT
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/tailoring", tags=["tailoring"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class TailorRequest(BaseModel):
    resume_id: str
    job_description_id: str


class ScorePair(BaseModel):
    ats_score: int
    match_score: int  # 0-100


class TailoredExperience(BaseModel):
    company: str
    role: str
    rewritten_bullets: list[str]


class TailorResponse(BaseModel):
    new_resume_id: str
    source_resume_id: str
    job_description_id: str
    summary: str
    rewritten_experiences: list[TailoredExperience]
    added_keywords: list[str]
    before: ScorePair
    after: ScorePair


# ── Helpers ──────────────────────────────────────────────────────────────────

def _format_experience_block(experience: list[dict]) -> str:
    """Render the candidate's roles + bullets for the prompt."""
    if not experience:
        return "(No structured experience available — write a strong, honest summary only.)"
    lines: list[str] = []
    for idx, exp in enumerate(experience, 1):
        role = exp.get("role", "") or "Role"
        company = exp.get("company", "") or "Company"
        lines.append(f"{idx}. {role} at {company}")
        description = exp.get("description", "") or ""
        for raw_line in description.split("\n"):
            cleaned = raw_line.strip(" -•\t")
            if cleaned:
                lines.append(f"   - {cleaned}")
    return "\n".join(lines)


def _entities_to_text(entities: dict) -> str:
    """Reconstruct a plain-text resume from entities so the ATS scorer and section
    segmenter (which operate on raw text) can score the tailored version."""
    parts: list[str] = []
    if entities.get("name"):
        parts.append(str(entities["name"]))
    contact = " | ".join(
        str(entities[k]) for k in ("email", "phone", "location") if entities.get(k)
    )
    if contact:
        parts.append(contact)
    if entities.get("summary"):
        parts.append("\nSUMMARY\n" + str(entities["summary"]))

    skills = entities.get("skills", [])
    if skills:
        skill_names = [s.get("normalized") or s.get("raw", "") for s in skills if isinstance(s, dict)]
        skill_names = [s for s in skill_names if s]
        if skill_names:
            parts.append("\nSKILLS\n" + ", ".join(skill_names))

    experience = entities.get("experience", [])
    if experience:
        exp_lines = ["\nEXPERIENCE"]
        for exp in experience:
            exp_lines.append(f"{exp.get('role', '')} at {exp.get('company', '')}".strip())
            if exp.get("description"):
                exp_lines.append(str(exp["description"]))
        parts.append("\n".join(exp_lines))

    education = entities.get("education", [])
    if education:
        edu_lines = ["\nEDUCATION"]
        for edu in education:
            if isinstance(edu, dict):
                edu_lines.append(
                    f"{edu.get('degree', '')} {edu.get('institution', '')}".strip()
                )
            else:
                edu_lines.append(str(edu))
        parts.append("\n".join(edu_lines))

    return "\n".join(parts).strip()


def _parse_llm_json(raw: str) -> dict:
    """Extract the JSON object from an LLM response (mirrors interview_prep)."""
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start < 0 or end <= start:
        raise ValueError("No JSON object found in LLM response")
    return json.loads(raw[start:end])


def _apply_tailoring(original_entities: dict, tailored: dict) -> tuple[dict, list[TailoredExperience]]:
    """Deep-copy the original entities and overlay the tailored summary + bullets.

    Keeps the {name, summary, skills[], experience[], education[]} shape the
    exporter and ATS scorer expect. Matches rewritten experiences back to the
    originals by (company, role); falls back to positional matching.
    """
    new_entities = copy.deepcopy(original_entities)
    if tailored.get("summary"):
        new_entities["summary"] = str(tailored["summary"]).strip()

    original_exp = new_entities.get("experience", []) or []
    tailored_exp = tailored.get("experiences", []) or []
    rewritten: list[TailoredExperience] = []

    def _key(company: str, role: str) -> str:
        return f"{(company or '').strip().lower()}|{(role or '').strip().lower()}"

    by_key = {_key(e.get("company", ""), e.get("role", "")): e for e in original_exp}

    for pos, t in enumerate(tailored_exp):
        if not isinstance(t, dict):
            continue
        company = str(t.get("company", "")).strip()
        role = str(t.get("role", "")).strip()
        bullets = [str(b).strip() for b in t.get("rewritten_bullets", []) if str(b).strip()]
        if not bullets:
            continue

        target = by_key.get(_key(company, role))
        if target is None and pos < len(original_exp):
            target = original_exp[pos]
        if target is not None:
            target["description"] = "\n".join(f"• {b}" for b in bullets)

        rewritten.append(
            TailoredExperience(
                company=company or (target.get("company", "") if target else ""),
                role=role or (target.get("role", "") if target else ""),
                rewritten_bullets=bullets,
            )
        )

    return new_entities, rewritten


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=TailorResponse)
async def generate_tailored_resume(
    body: TailorRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TailorResponse:
    resume_repo = ResumeRepository(db)
    analysis_repo = AnalysisRepository(db)
    jd_repo = JdRepository(db)
    match_repo = MatchRepository(db)

    # ── Ownership + readiness checks (mirror jds.match_jd) ────────────────────
    resume = await resume_repo.get_by_id(body.resume_id)
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    analysis = await analysis_repo.get_by_resume_id(body.resume_id)
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume must be analyzed before it can be tailored",
        )

    jd = await jd_repo.get_by_id(body.job_description_id)
    if jd is None or jd.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found")

    from app.ml.analysis.jd_matcher import JDMatcher  # noqa: PLC0415

    matcher = JDMatcher()

    # ── "Before" match (reuse existing result if present) ─────────────────────
    before_match = await match_repo.get(body.resume_id, body.job_description_id)
    if before_match is None:
        result = matcher.match(
            resume_entities=analysis.entitiesJson,
            resume_text=analysis.rawText,
            jd_text=jd.rawText,
            jd_embedding=jd.embeddingVector,
        )
        before_match = await match_repo.upsert(
            resume_id=body.resume_id,
            jd_id=body.job_description_id,
            match_score=result["match_score"],
            matched_skills=result["matched_skills"],
            gap_skills=result["gap_skills"],
            keyword_report=result["keyword_report"],
        )

    entities = analysis.entitiesJson or {}
    matched_skills = before_match.matchedSkills or []
    gap_skills = before_match.gapSkills or []

    # ── Build prompt + call the LLM ───────────────────────────────────────────
    prompt = TAILOR_RESUME_PROMPT.format(
        jd_title=jd.title,
        jd_company_clause=f" at {jd.company}" if jd.company else "",
        matched_skills=", ".join(str(s) for s in matched_skills[:25]) or "(none detected)",
        gap_skills=", ".join(str(s) for s in gap_skills[:25]) or "(none — already well matched)",
        experience_block=_format_experience_block(entities.get("experience", [])),
    )

    try:
        from app.ml.llm.coach import CareerCoach  # noqa: PLC0415

        coach = CareerCoach()
        raw = await coach.chat(
            session_messages=[],
            user_message=prompt,
            resume_entities=entities,
            jd_text=jd.rawText,
        )
        tailored = _parse_llm_json(raw)
    except Exception as exc:
        # Do NOT persist a half-baked resume — surface a clean 503 instead.
        logger.error("tailoring_generation_failed", resume_id=body.resume_id, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resume tailoring is temporarily unavailable. Please try again shortly.",
        ) from exc

    new_entities, rewritten = _apply_tailoring(entities, tailored)
    summary = new_entities.get("summary", "") or ""

    # ── Recompute ATS + materialize the tailored version ──────────────────────
    from app.ml.analysis.ats_scorer import ATSScorer  # noqa: PLC0415
    from app.ml.nlp.section_segmenter import segment_sections  # noqa: PLC0415

    tailored_text = _entities_to_text(new_entities)
    sections = segment_sections(tailored_text)
    ats_result = ATSScorer().score(new_entities, tailored_text, sections)
    breakdown_with_suggestions = {
        **ats_result["breakdown"],
        "suggestions": ats_result["suggestions"],
    }

    # Persist the tailored text as a real file so export/version flows work.
    new_file_name = f"{resume.fileName.rsplit('.', 1)[0]} — tailored for {jd.title}.txt"
    file_hash = hashlib.sha256(tailored_text.encode("utf-8")).hexdigest()
    dest_dir = settings.upload_dir / current_user.id
    dest_dir.mkdir(parents=True, exist_ok=True)
    file_path = dest_dir / f"tailored_{uuid.uuid4().hex}.txt"
    file_path.write_text(tailored_text, encoding="utf-8")

    new_resume = await db.resume.create(
        data={
            "userId": current_user.id,
            "fileName": new_file_name,
            "filePath": str(file_path),
            "fileType": "txt",
            "fileSize": len(tailored_text.encode("utf-8")),
            "fileHash": file_hash,
            "status": "ANALYZED",
            "parentResumeId": resume.id,
        }
    )

    await analysis_repo.create(
        resume_id=new_resume.id,
        raw_text=tailored_text,
        entities=new_entities,
        ats_score=ats_result["score"],
        ats_breakdown=breakdown_with_suggestions,
        bias_flags=analysis.biasFlagsJson or [],
        fraud_flags=analysis.fraudFlagsJson or [],
    )

    # ── "After" match for the tailored version ────────────────────────────────
    after_result = matcher.match(
        resume_entities=new_entities,
        resume_text=tailored_text,
        jd_text=jd.rawText,
        jd_embedding=jd.embeddingVector,
    )
    await match_repo.upsert(
        resume_id=new_resume.id,
        jd_id=body.job_description_id,
        match_score=after_result["match_score"],
        matched_skills=after_result["matched_skills"],
        gap_skills=after_result["gap_skills"],
        keyword_report=after_result["keyword_report"],
    )

    # Keywords newly covered by the tailored version.
    before_gap = {str(s).lower() for s in gap_skills}
    after_gap = {str(s).lower() for s in (after_result["gap_skills"] or [])}
    added_keywords = sorted(before_gap - after_gap)

    logger.info(
        "resume_tailored",
        source_resume_id=resume.id,
        new_resume_id=new_resume.id,
        jd_id=jd.id,
        ats_before=analysis.atsScore,
        ats_after=ats_result["score"],
    )

    return TailorResponse(
        new_resume_id=new_resume.id,
        source_resume_id=resume.id,
        job_description_id=jd.id,
        summary=summary,
        rewritten_experiences=rewritten,
        added_keywords=added_keywords,
        before=ScorePair(
            ats_score=analysis.atsScore,
            match_score=round((before_match.matchScore or 0) * 100),
        ),
        after=ScorePair(
            ats_score=ats_result["score"],
            match_score=round((after_result["match_score"] or 0) * 100),
        ),
    )


@router.get("/{resume_id}")
async def get_tailored_resume(
    resume_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Read back a tailored version: its analysis plus the best JD match."""
    resume_repo = ResumeRepository(db)
    analysis_repo = AnalysisRepository(db)

    resume = await resume_repo.get_by_id(resume_id)
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    analysis = await analysis_repo.get_by_resume_id(resume_id)
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not available")

    matches = await db.jdmatchresult.find_many(
        where={"resumeId": resume_id},
        order={"matchScore": "desc"},
        take=1,
    )
    best = matches[0] if matches else None

    return {
        "resume_id": resume_id,
        "source_resume_id": resume.parentResumeId,
        "file_name": resume.fileName,
        "ats_score": analysis.atsScore,
        "summary": (analysis.entitiesJson or {}).get("summary"),
        "entities": analysis.entitiesJson,
        "match_score": round((best.matchScore or 0) * 100) if best else None,
        "job_description_id": best.jobDescriptionId if best else None,
    }
