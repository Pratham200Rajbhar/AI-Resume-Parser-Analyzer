from fastapi import APIRouter

from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.batches import router as batches_router
from app.api.v1.routes.coaching import router as coaching_router
from app.api.v1.routes.jds import router as jds_router
from app.api.v1.routes.resumes import router as resumes_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth_router)
v1_router.include_router(resumes_router)
v1_router.include_router(jds_router)
v1_router.include_router(batches_router)
v1_router.include_router(coaching_router)
