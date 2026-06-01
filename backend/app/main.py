from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.middleware import RequestLoggingMiddleware
from app.db.client import disconnect_db, get_db

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import threading  # noqa: PLC0415

    configure_logging()
    logger.info("startup", environment=settings.environment)
    await get_db()
    
    def _prewarm_models():
        logger.info("prewarming_ml_models")
        try:
            from app.ml.analysis.jd_matcher import _get_embedder  # noqa: PLC0415
            from app.ml.nlp.bert_ner import _get_pipeline  # noqa: PLC0415
            from app.ml.nlp.spacy_ner import _get_nlp  # noqa: PLC0415
            
            _get_embedder()
            _get_pipeline()
            _get_nlp()
            logger.info("ml_models_prewarmed_successfully")
        except Exception as e:
            logger.error("ml_models_prewarm_failed", error=str(e))
            
    # Run pre-warming in a background thread so we don't block server startup
    threading.Thread(target=_prewarm_models, daemon=True).start()
    
    yield
    await disconnect_db()
    logger.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Resume Parser & Analyzer",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request logging
    app.add_middleware(RequestLoggingMiddleware)

    # Routers
    from app.api.v1.router import v1_router
    from app.api.websocket.handler import ws_router

    app.include_router(v1_router)
    app.include_router(ws_router)

    # Health check
    @app.get("/health", tags=["health"])
    async def health() -> dict:
        return {"status": "ok"}

    # Global exception handlers
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        logger.warning("value_error", path=request.url.path, error=str(exc))
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("unhandled_exception", path=request.url.path, error=str(exc), exc_info=True)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    return app


app = create_app()
