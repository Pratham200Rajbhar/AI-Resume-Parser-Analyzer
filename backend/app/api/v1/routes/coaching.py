from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from prisma.models import User
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_current_user, get_db
from app.db.repositories.analysis_repo import AnalysisRepository
from app.db.repositories.batch_repo import CoachingRepository
from app.db.repositories.jd_repo import JdRepository
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/coaching", tags=["coaching"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    title: str = "New Session"
    resume_id: str | None = None
    jd_id: str | None = None


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    messages: list
    created_at: datetime
    updated_at: datetime


class SessionListResponse(BaseModel):
    items: list[SessionResponse]
    total: int


class SendMessageRequest(BaseModel):
    message: str


class MessageResponse(BaseModel):
    role: str
    content: str


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    # Validate resume analysis exists if resume_id provided
    analysis_id: str | None = None
    if body.resume_id:
        analysis_repo = AnalysisRepository(db)
        analysis = await analysis_repo.get_by_resume_id(body.resume_id)
        if analysis is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume analysis not found",
            )
        analysis_id = analysis.id

    # Validate JD exists if jd_id provided
    if body.jd_id:
        jd_repo = JdRepository(db)
        jd = await jd_repo.get_by_id(body.jd_id)
        if jd is None or jd.userId != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found")

    repo = CoachingRepository(db)
    session = await repo.create(
        user_id=current_user.id,
        title=body.title,
        resume_analysis_id=analysis_id,
        jd_id=body.jd_id,
    )
    logger.info("coaching_session_created", session_id=session.id, user_id=current_user.id)
    return SessionResponse(
        id=session.id,
        title=session.title,
        messages=session.messages or [],
        created_at=session.createdAt,
        updated_at=session.updatedAt,
    )


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionListResponse:
    repo = CoachingRepository(db)
    skip = (page - 1) * page_size
    sessions = await repo.list_by_user(current_user.id, skip=skip, take=page_size)
    total = await repo.count_by_user(current_user.id)
    items = [
        SessionResponse(
            id=s.id,
            title=s.title,
            messages=s.messages or [],
            created_at=s.createdAt,
            updated_at=s.updatedAt,
        )
        for s in sessions
    ]
    return SessionListResponse(items=items, total=total)


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    repo = CoachingRepository(db)
    session = await repo.get_by_id(session_id)
    if session is None or session.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return SessionResponse(
        id=session.id,
        title=session.title,
        messages=session.messages or [],
        created_at=session.createdAt,
        updated_at=session.updatedAt,
    )


@router.post("/sessions/{session_id}/messages", response_model=MessageResponse)
async def send_message(
    session_id: str,
    body: SendMessageRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    repo = CoachingRepository(db)
    session = await repo.get_by_id(session_id)
    if session is None or session.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Fetch resume entities and JD text if linked
    resume_entities: dict = {}
    jd_text: str | None = None

    if session.resumeAnalysisId:
        analysis_repo = AnalysisRepository(db)
        analysis = await analysis_repo.get_by_id(session.resumeAnalysisId)
        if analysis:
            resume_entities = analysis.entitiesJson or {}

    if session.jobDescriptionId:
        jd_repo = JdRepository(db)
        jd = await jd_repo.get_by_id(session.jobDescriptionId)
        if jd:
            jd_text = jd.rawText

    from app.ml.llm.coach import CareerCoach  # noqa: PLC0415

    coach = CareerCoach()
    messages: list[dict] = list(session.messages or [])
    reply = await coach.chat(
        session_messages=messages,
        user_message=body.message,
        resume_entities=resume_entities,
        jd_text=jd_text,
    )

    # Append both user message and assistant reply
    messages.append({"role": "user", "content": body.message})
    messages.append({"role": "assistant", "content": reply})
    await repo.append_message(session_id, messages)

    logger.info("coaching_message_sent", session_id=session_id, user_id=current_user.id)
    return MessageResponse(role="assistant", content=reply)


class UpdateSessionRequest(BaseModel):
    title: str


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    body: UpdateSessionRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    repo = CoachingRepository(db)
    session = await repo.get_by_id(session_id)
    if session is None or session.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    updated = await repo.update_title(session_id, body.title.strip())
    logger.info("coaching_session_updated", session_id=session_id, user_id=current_user.id)
    return SessionResponse(
        id=updated.id,
        title=updated.title,
        messages=updated.messages or [],
        created_at=updated.createdAt,
        updated_at=updated.updatedAt,
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    repo = CoachingRepository(db)
    session = await repo.get_by_id(session_id)
    if session is None or session.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    await repo.delete(session_id)
    logger.info("coaching_session_deleted", session_id=session_id, user_id=current_user.id)
