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
        resumes = await db.resume.find_many(
            where={
                "userId": current_user.id,
                "fileName": {"contains": q, "mode": "insensitive"},
            },
            take=10,
            include={"analysis": True},
        )
        resume_results = []
        for r in resumes:
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
        # Also search by candidate name in analysis
        all_resumes = await db.resume.find_many(
            where={"userId": current_user.id},
            include={"analysis": True},
        )
        for r in all_resumes:
            if r.analysis:
                entities = r.analysis.entitiesJson or {}
                name = entities.get("name", "")
                if name and q.lower() in name.lower() and not any(x["id"] == r.id for x in resume_results):
                    resume_results.append({
                        "id": r.id,
                        "type": "resume",
                        "title": r.fileName,
                        "subtitle": name,
                        "href": f"/dashboard/resumes/{r.id}",
                    })
        results["resumes"] = resume_results[:10]

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
