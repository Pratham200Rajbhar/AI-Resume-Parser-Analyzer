from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/cover-letters", tags=["cover-letters"])


class CoverLetterGenerate(BaseModel):
    resume_id: str
    job_description_id: str | None = None
    tone: str = "professional"
    word_count: int = 300


class CoverLetterResponse(BaseModel):
    id: str
    resume_id: str
    job_description_id: str | None
    title: str
    content: str
    tone: str
    word_count: int
    created_at: datetime
    updated_at: datetime


@router.get("", response_model=list[CoverLetterResponse])
async def list_cover_letters(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CoverLetterResponse]:
    letters = await db.coverletter.find_many(
        where={"userId": current_user.id},
        order={"createdAt": "desc"},
    )
    return [
        CoverLetterResponse(
            id=l.id, resume_id=l.resumeId, job_description_id=l.jobDescriptionId,
            title=l.title, content=l.content, tone=l.tone, word_count=l.wordCount,
            created_at=l.createdAt, updated_at=l.updatedAt,
        )
        for l in letters
    ]


@router.post("/generate", response_model=CoverLetterResponse, status_code=status.HTTP_201_CREATED)
async def generate_cover_letter(
    body: CoverLetterGenerate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CoverLetterResponse:
    resume = await db.resume.find_unique(where={"id": body.resume_id}, include={"analysis": True})
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    if resume.analysis is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume must be analyzed first")

    jd_text = None
    jd_title = "the position"
    jd_company = ""
    if body.job_description_id:
        jd = await db.jobdescription.find_unique(where={"id": body.job_description_id})
        if jd is None or jd.userId != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found")
        jd_text = jd.rawText
        jd_title = jd.title
        jd_company = jd.company or ""

    entities = resume.analysis.entitiesJson or {}
    candidate_name = entities.get("name", "the candidate")
    skills = [s.get("normalized", s.get("raw", "")) for s in entities.get("skills", [])[:10]]
    experience = entities.get("experience", [])

    tone_instructions = {
        "professional": "formal and professional",
        "conversational": "warm and conversational",
        "enthusiastic": "enthusiastic and energetic",
        "concise": "concise and direct",
    }
    tone_desc = tone_instructions.get(body.tone, "professional")

    word_target = body.word_count

    prompt_parts = [
        f"Write a {tone_desc} cover letter for {candidate_name} applying to {jd_title}",
        f"at {jd_company}." if jd_company else ".",
        f"Target length: approximately {word_target} words.",
        f"Key skills: {', '.join(skills[:8])}." if skills else "",
    ]
    if experience:
        exp = experience[0]
        prompt_parts.append(f"Most recent role: {exp.get('role', '')} at {exp.get('company', '')}.")
    if jd_text:
        prompt_parts.append(f"\nJob description:\n{jd_text[:1500]}")

    prompt = " ".join(p for p in prompt_parts if p)

    try:
        from app.ml.llm.coach import CareerCoach
        coach = CareerCoach()
        content = await coach.chat(
            session_messages=[],
            user_message=prompt,
            resume_entities=entities,
            jd_text=jd_text,
        )
    except Exception as e:
        logger.error("cover_letter_generation_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cover letter generation is temporarily unavailable. Please try again shortly.",
        ) from e

    if not content or not content.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cover letter generation returned an empty result. Please try again.",
        )

    title = f"Cover Letter — {jd_title}{' at ' + jd_company if jd_company else ''}"
    letter = await db.coverletter.create(data={
        "userId": current_user.id,
        "resumeId": body.resume_id,
        "jobDescriptionId": body.job_description_id,
        "title": title,
        "content": content,
        "tone": body.tone,
        "wordCount": body.word_count,
    })
    logger.info("cover_letter_generated", letter_id=letter.id, user_id=current_user.id)
    return CoverLetterResponse(
        id=letter.id, resume_id=letter.resumeId, job_description_id=letter.jobDescriptionId,
        title=letter.title, content=letter.content, tone=letter.tone, word_count=letter.wordCount,
        created_at=letter.createdAt, updated_at=letter.updatedAt,
    )


@router.delete("/{letter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cover_letter(
    letter_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    letter = await db.coverletter.find_unique(where={"id": letter_id})
    if letter is None or letter.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cover letter not found")
    await db.coverletter.delete(where={"id": letter_id})
