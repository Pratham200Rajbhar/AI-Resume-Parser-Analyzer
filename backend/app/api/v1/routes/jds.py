import re
from datetime import datetime

import httpx
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


class UpdateJDRequest(BaseModel):
    title: str | None = None
    company: str | None = None
    raw_text: str | None = None


class ImportUrlRequest(BaseModel):
    url: str


class ImportUrlResponse(BaseModel):
    title: str
    company: str | None
    raw_text: str
    source_url: str


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
    resume_file_name: str | None = None


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("", response_model=JDResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("", response_model=JDListResponse)
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


@router.patch("/{jd_id}", response_model=JDResponse)
async def update_jd(
    jd_id: str,
    body: UpdateJDRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JDResponse:
    repo = JdRepository(db)
    jd = await repo.get_by_id(jd_id)
    if jd is None or jd.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found")

    update_data: dict = {}
    if body.title is not None:
        update_data["title"] = body.title
    if body.company is not None:
        update_data["company"] = body.company
    if body.raw_text is not None:
        from app.ml.analysis.jd_matcher import JDMatcher  # noqa: PLC0415
        matcher = JDMatcher()
        embedding = matcher.embed(body.raw_text)
        update_data["rawText"] = body.raw_text
        update_data["embeddingVector"] = embedding

    updated = await db.jobdescription.update(where={"id": jd_id}, data=update_data)
    return JDResponse(id=updated.id, title=updated.title, company=updated.company, raw_text=updated.rawText, created_at=updated.createdAt)


@router.post("/import-url", response_model=ImportUrlResponse)
async def import_from_url(
    body: ImportUrlRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportUrlResponse:
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid URL")

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; ResumeAI/1.0)",
        "Accept": "text/html,application/xhtml+xml",
    }
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"URL returned status {response.status_code}")
        html = response.text
    except httpx.RequestError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Failed to fetch URL: {str(e)}")

    # Strip HTML tags
    text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Extract title from <title> tag
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    page_title = title_match.group(1).strip() if title_match else ""
    page_title = re.sub(r"\s*[-|]\s*.*$", "", page_title).strip()

    # Limit text length
    raw_text = text[:8000]

    # Try to extract company from URL domain
    domain_match = re.search(r"https?://(?:www\.)?([^/]+)", url)
    company = None
    if domain_match:
        domain = domain_match.group(1)
        known = {"linkedin.com": None, "indeed.com": None, "greenhouse.io": None, "lever.co": None, "workday.com": None}
        if domain not in known:
            company = domain.split(".")[0].capitalize()

    return ImportUrlResponse(
        title=page_title or "Job Description",
        company=company,
        raw_text=raw_text,
        source_url=url,
    )


@router.get("/{jd_id}/matches")
async def get_jd_matches(
    jd_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MatchResponse]:
    repo = JdRepository(db)
    jd = await repo.get_by_id(jd_id)
    if jd is None or jd.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found")

    matches = await db.jdmatchresult.find_many(
        where={"jobDescriptionId": jd_id},
        include={"resume": True},
        order={"createdAt": "desc"},
    )
    return [
        MatchResponse(
            id=m.id,
            resume_id=m.resumeId,
            job_description_id=m.jobDescriptionId,
            match_score=m.matchScore,
            matched_skills=m.matchedSkills,
            gap_skills=m.gapSkills,
            keyword_report=m.keywordReport,
            created_at=m.createdAt,
            job_description={"id": jd.id, "title": jd.title, "company": jd.company},
            resume_file_name=m.resume.fileName if m.resume else None,
        )
        for m in matches
    ]


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
