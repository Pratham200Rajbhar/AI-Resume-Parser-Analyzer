from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from prisma.models import User
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_current_user, get_db
from app.db.repositories.analysis_repo import AnalysisRepository
from app.db.repositories.jd_repo import JdRepository, MatchRepository
from app.db.repositories.resume_repo import ResumeRepository
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/jds", tags=["job-descriptions"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateJDRequest(BaseModel):
    title: str
    company: str | None = None
    raw_text: str


class JDResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    company: str | None
    raw_text: str
    created_at: datetime


class JDListResponse(BaseModel):
    items: list[JDResponse]
    total: int


class MatchResponse(BaseModel):
    id: str
    resume_id: str
    job_description_id: str
    match_score: float
    matched_skills: list
    gap_skills: list
    keyword_report: dict
    created_at: datetime
    job_description: dict | None = None


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/", response_model=JDResponse, status_code=status.HTTP_201_CREATED)
async def create_jd(
    body: CreateJDRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JDResponse:
    from app.ml.analysis.jd_matcher import JDMatcher  # noqa: PLC0415

    matcher = JDMatcher()
    embedding = matcher.embed(body.raw_text)

    repo = JdRepository(db)
    jd = await repo.create(
        user_id=current_user.id,
        title=body.title,
        company=body.company,
        raw_text=body.raw_text,
        embedding_vector=embedding,
    )
    logger.info("jd_created", jd_id=jd.id, user_id=current_user.id)
    return JDResponse(id=jd.id, title=jd.title, company=jd.company, raw_text=jd.rawText, created_at=jd.createdAt)


@router.get("/", response_model=JDListResponse)
async def list_jds(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JDListResponse:
    repo = JdRepository(db)
    skip = (page - 1) * page_size
    jds = await repo.list_by_user(current_user.id, skip=skip, take=page_size)
    total = await repo.count_by_user(current_user.id)
    items = [
        JDResponse(id=j.id, title=j.title, company=j.company, raw_text=j.rawText, created_at=j.createdAt)
        for j in jds
    ]
    return JDListResponse(items=items, total=total)


@router.get("/{jd_id}", response_model=JDResponse)
async def get_jd(
    jd_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JDResponse:
    repo = JdRepository(db)
    jd = await repo.get_by_id(jd_id)
    if jd is None or jd.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found")
    return JDResponse(id=jd.id, title=jd.title, company=jd.company, raw_text=jd.rawText, created_at=jd.createdAt)


@router.delete("/{jd_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_jd(
    jd_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    repo = JdRepository(db)
    jd = await repo.get_by_id(jd_id)
    if jd is None or jd.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found")
    await repo.delete(jd_id)
    logger.info("jd_deleted", jd_id=jd_id, user_id=current_user.id)


@router.post("/{jd_id}/match/{resume_id}", response_model=MatchResponse)
async def match_jd(
    jd_id: str,
    resume_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MatchResponse:
    jd_repo = JdRepository(db)
    jd = await jd_repo.get_by_id(jd_id)
    if jd is None or jd.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found")

    resume_repo = ResumeRepository(db)
    resume = await resume_repo.get_by_id(resume_id)
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    analysis_repo = AnalysisRepository(db)
    analysis = await analysis_repo.get_by_resume_id(resume_id)
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume analysis not yet available",
        )

    from app.ml.analysis.jd_matcher import JDMatcher  # noqa: PLC0415

    matcher = JDMatcher()
    result = matcher.match(
        resume_entities=analysis.entitiesJson,
        resume_text=analysis.rawText,
        jd_text=jd.rawText,
        jd_embedding=jd.embeddingVector,
    )

    match_repo = MatchRepository(db)
    match_record = await match_repo.upsert(
        resume_id=resume_id,
        jd_id=jd_id,
        match_score=result["match_score"],
        matched_skills=result["matched_skills"],
        gap_skills=result["gap_skills"],
        keyword_report=result["keyword_report"],
    )

    logger.info("jd_match_computed", jd_id=jd_id, resume_id=resume_id, score=result["match_score"])
    return MatchResponse(
        id=match_record.id,
        resume_id=resume_id,
        job_description_id=jd_id,
        match_score=match_record.matchScore,
        matched_skills=match_record.matchedSkills,
        gap_skills=match_record.gapSkills,
        keyword_report=match_record.keywordReport,
        created_at=match_record.createdAt,
        job_description={"id": jd.id, "title": jd.title, "company": jd.company},
    )
