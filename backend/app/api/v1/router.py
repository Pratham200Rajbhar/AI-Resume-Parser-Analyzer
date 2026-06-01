from fastapi import APIRouter

from app.api.v1.routes.analytics import router as analytics_router
from app.api.v1.routes.applications import router as applications_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.batches import router as batches_router
from app.api.v1.routes.coaching import router as coaching_router
from app.api.v1.routes.cover_letters import router as cover_letters_router
from app.api.v1.routes.interview_prep import router as interview_prep_router
from app.api.v1.routes.jds import router as jds_router
from app.api.v1.routes.learning_plans import router as learning_plans_router
from app.api.v1.routes.notifications import router as notifications_router
from app.api.v1.routes.resumes import router as resumes_router
from app.api.v1.routes.search import router as search_router
from app.api.v1.routes.settings import router as settings_router
from app.api.v1.routes.share import router as share_router
from app.api.v1.routes.tailoring import router as tailoring_router
from app.api.v1.routes.teams import router as teams_router
from app.api.v1.routes.workspace import router as workspace_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth_router)
v1_router.include_router(resumes_router)
v1_router.include_router(jds_router)
v1_router.include_router(batches_router)
v1_router.include_router(coaching_router)
v1_router.include_router(workspace_router)
v1_router.include_router(analytics_router)
v1_router.include_router(applications_router)
v1_router.include_router(notifications_router)
v1_router.include_router(cover_letters_router)
v1_router.include_router(interview_prep_router)
v1_router.include_router(search_router)
v1_router.include_router(share_router)
v1_router.include_router(teams_router)
v1_router.include_router(settings_router)
v1_router.include_router(tailoring_router)
v1_router.include_router(learning_plans_router)
