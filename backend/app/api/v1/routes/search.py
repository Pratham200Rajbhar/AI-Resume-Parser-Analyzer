import structlog
from fastapi import APIRouter, Depends, Query
from prisma.models import User

from app.api.deps import get_current_user, get_db
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=1),
    types: str = Query("resumes,jds,coaching,applications"),
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    requested = set(types.split(","))
    results: dict = {}

    if "resumes" in requested:
        # Single query: match by filename OR by candidate name stored in analysis JSON
        all_matching = await db.resume.find_many(
            where={
                "userId": current_user.id,
                "OR": [
                    {"fileName": {"contains": q, "mode": "insensitive"}},
                    {"analysis": {"is": {"entitiesJson": {"path": ["name"], "string_contains": q}}}},
                ],
            },
            take=10,
            include={"analysis": True},
        )
        resume_results = []
        seen_ids: set[str] = set()
        for r in all_matching:
            if r.id in seen_ids:
                continue
            seen_ids.add(r.id)
            name = None
            if r.analysis:
                entities = r.analysis.entitiesJson or {}
                name = entities.get("name")
            resume_results.append({
                "id": r.id,
                "type": "resume",
                "title": r.fileName,
                "subtitle": name,
                "href": f"/dashboard/resumes/{r.id}",
            })
        results["resumes"] = resume_results


    if "jds" in requested:
        jds = await db.jobdescription.find_many(
            where={
                "userId": current_user.id,
                "OR": [
                    {"title": {"contains": q, "mode": "insensitive"}},
                    {"company": {"contains": q, "mode": "insensitive"}},
                ],
            },
            take=10,
        )
        results["jds"] = [
            {
                "id": j.id,
                "type": "jd",
                "title": j.title,
                "subtitle": j.company,
                "href": f"/dashboard/jds/{j.id}",
            }
            for j in jds
        ]

    if "coaching" in requested:
        sessions = await db.coachingsession.find_many(
            where={
                "userId": current_user.id,
                "title": {"contains": q, "mode": "insensitive"},
            },
            take=10,
        )
        results["coaching"] = [
            {
                "id": s.id,
                "type": "coaching",
                "title": s.title,
                "subtitle": None,
                "href": "/dashboard/coach",
            }
            for s in sessions
        ]

    if "applications" in requested:
        apps = await db.jobapplication.find_many(
            where={
                "userId": current_user.id,
                "OR": [
                    {"company": {"contains": q, "mode": "insensitive"}},
                    {"jobTitle": {"contains": q, "mode": "insensitive"}},
                ],
            },
            take=10,
        )
        results["applications"] = [
            {
                "id": a.id,
                "type": "application",
                "title": f"{a.jobTitle} at {a.company}",
                "subtitle": a.stage,
                "href": "/dashboard/applications",
            }
            for a in apps
        ]

    return results
