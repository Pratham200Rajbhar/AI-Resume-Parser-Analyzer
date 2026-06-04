from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/teams", tags=["teams"])


class TeamCreate(BaseModel):
    name: str


class TeamResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: datetime


class MemberInvite(BaseModel):
    user_id: str
    role: str = "VIEWER"


class MemberUpdate(BaseModel):
    role: str


class MemberResponse(BaseModel):
    id: str
    user_id: str
    team_id: str
    role: str
    created_at: datetime


@router.get("", response_model=list[TeamResponse])
async def list_teams(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TeamResponse]:
    memberships = await db.teammember.find_many(
        where={"userId": current_user.id},
        include={"team": True},
    )
    return [
        TeamResponse(id=m.team.id, name=m.team.name, owner_id=m.team.ownerId, created_at=m.team.createdAt)
        for m in memberships
        if m.team
    ]


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    body: TeamCreate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamResponse:
    team = await db.team.create(data={"name": body.name, "ownerId": current_user.id})
    await db.teammember.create(data={"teamId": team.id, "userId": current_user.id, "role": "OWNER"})
    logger.info("team_created", team_id=team.id, user_id=current_user.id)
    return TeamResponse(id=team.id, name=team.name, owner_id=team.ownerId, created_at=team.createdAt)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    team = await db.team.find_unique(where={"id": team_id})
    if team is None or team.ownerId != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can delete a team")
    await db.team.delete(where={"id": team_id})


@router.get("/{team_id}/members", response_model=list[MemberResponse])
async def list_members(
    team_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MemberResponse]:
    member = await db.teammember.find_first(where={"teamId": team_id, "userId": current_user.id})
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a team member")
    members = await db.teammember.find_many(where={"teamId": team_id})
    return [MemberResponse(id=m.id, user_id=m.userId, team_id=m.teamId, role=m.role, created_at=m.createdAt) for m in members]


@router.post("/{team_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    team_id: str,
    body: MemberInvite,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MemberResponse:
    requester = await db.teammember.find_first(where={"teamId": team_id, "userId": current_user.id})
    if requester is None or requester.role not in ("OWNER", "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    existing = await db.teammember.find_first(where={"teamId": team_id, "userId": body.user_id})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already a member")

    m = await db.teammember.create(data={"teamId": team_id, "userId": body.user_id, "role": body.role})
    return MemberResponse(id=m.id, user_id=m.userId, team_id=m.teamId, role=m.role, created_at=m.createdAt)


@router.patch("/{team_id}/members/{member_id}", response_model=MemberResponse)
async def update_member_role(
    team_id: str,
    member_id: str,
    body: MemberUpdate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MemberResponse:
    requester = await db.teammember.find_first(where={"teamId": team_id, "userId": current_user.id})
    if requester is None or requester.role not in ("OWNER", "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    m = await db.teammember.find_unique(where={"id": member_id})
    if m is None or m.teamId != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    updated = await db.teammember.update(where={"id": member_id}, data={"role": body.role})
    return MemberResponse(id=updated.id, user_id=updated.userId, team_id=updated.teamId, role=updated.role, created_at=updated.createdAt)


@router.delete("/{team_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    team_id: str,
    member_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    requester = await db.teammember.find_first(where={"teamId": team_id, "userId": current_user.id})
    if requester is None or requester.role not in ("OWNER", "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    m = await db.teammember.find_unique(where={"id": member_id})
    if m is None or m.teamId != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    await db.teammember.delete(where={"id": member_id})


class InviteByEmail(BaseModel):
    email: str
    role: str = "VIEWER"


@router.post("/{team_id}/invite-by-email", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_by_email(
    team_id: str,
    body: InviteByEmail,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MemberResponse:
    requester = await db.teammember.find_first(where={"teamId": team_id, "userId": current_user.id})
    if requester is None or requester.role not in ("OWNER", "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    target = await db.user.find_unique(where={"email": body.email})
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No user found with that email address")

    existing = await db.teammember.find_first(where={"teamId": team_id, "userId": target.id})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a team member")

    m = await db.teammember.create(data={"teamId": team_id, "userId": target.id, "role": body.role})
    logger.info("team_member_invited", team_id=team_id, invitee_id=target.id, invited_by=current_user.id)
    return MemberResponse(id=m.id, user_id=m.userId, team_id=m.teamId, role=m.role, created_at=m.createdAt)

