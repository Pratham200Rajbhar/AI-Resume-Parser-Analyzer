from datetime import UTC, datetime, timedelta

import structlog
from fastapi import APIRouter, Depends
from prisma.models import User

from app.api.deps import get_current_user, get_db
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def get_summary(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # All analyzed resumes for this user
    resumes = await db.resume.find_many(
        where={"userId": current_user.id},
        include={"analysis": True},
    )

    analyzed = [r for r in resumes if r.analysis is not None]
    total = len(resumes)
    avg_score = round(sum(r.analysis.atsScore for r in analyzed) / len(analyzed)) if analyzed else 0

    def _as_utc(dt: datetime) -> datetime:
        """Ensure datetime is timezone-aware (UTC). Prisma may return either."""
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)

    # Highest score this month
    this_month = [r for r in analyzed if _as_utc(r.createdAt) >= month_start]
    highest_this_month = max((r.analysis.atsScore for r in this_month), default=0)


    # Status counts
    status_counts = {}
    for r in resumes:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1

    # Score distribution
    buckets = {"0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0}
    for r in analyzed:
        s = r.analysis.atsScore
        if s < 20:
            buckets["0-20"] += 1
        elif s < 40:
            buckets["20-40"] += 1
        elif s < 60:
            buckets["40-60"] += 1
        elif s < 80:
            buckets["60-80"] += 1
        else:
            buckets["80-100"] += 1

    # Weekly trend (last 12 weeks)
    weekly_trend = []
    for week_offset in range(11, -1, -1):
        week_start = now - timedelta(weeks=week_offset + 1)
        week_end = now - timedelta(weeks=week_offset)
        week_resumes = [r for r in analyzed if week_start <= r.createdAt < week_end]
        avg = round(sum(r.analysis.atsScore for r in week_resumes) / len(week_resumes)) if week_resumes else None
        weekly_trend.append({
            "week": week_start.strftime("%b %d"),
            "avg_score": avg,
            "count": len(week_resumes),
        })

    # Top skills
    skill_counts: dict[str, int] = {}
    for r in analyzed:
        entities = r.analysis.entitiesJson or {}
        for skill in entities.get("skills", []):
            name = skill.get("normalized") or skill.get("raw", "")
            if name:
                skill_counts[name] = skill_counts.get(name, 0) + 1
    top_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:15]

    # Active coaching sessions
    active_sessions = await db.coachingsession.count(where={"userId": current_user.id})

    return {
        "total_resumes": total,
        "avg_ats_score": avg_score,
        "highest_score_this_month": highest_this_month,
        "active_coaching_sessions": active_sessions,
        "status_counts": status_counts,
        "score_distribution": [{"range": k, "count": v} for k, v in buckets.items()],
        "weekly_trend": weekly_trend,
        "top_skills": [{"skill": s, "count": c} for s, c in top_skills],
    }
