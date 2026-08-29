import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.config import settings
from app.database import init_db
from app.routes import intake, review, queue, analytics, policy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("queuemind")

app = FastAPI(
    title="QueueMind AI API",
    description="AI-assisted clinic request routing. LLM understands, rule engine applies policy, humans decide.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intake.router)
app.include_router(review.router)
app.include_router(queue.router)
app.include_router(analytics.router)
app.include_router(policy.router)


@app.exception_handler(OperationalError)
async def db_operational_error_handler(request: Request, exc: OperationalError):
    """The database is unreachable or timed out. Report this honestly to the
    client instead of leaking a raw traceback or pretending the request
    succeeded."""
    logger.error("Database operational error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={
            "detail": "The database is temporarily unreachable. Please try again shortly.",
            "error_type": "database_unavailable",
        },
    )


@app.exception_handler(SQLAlchemyError)
async def db_generic_error_handler(request: Request, exc: SQLAlchemyError):
    logger.error("Database error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred.", "error_type": "database_error"},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred.", "error_type": "internal_error"},
    )


@app.on_event("startup")
def on_startup():
    problems = settings.validate()
    for p in problems:
        logger.warning("CONFIG WARNING: %s", p)
    try:
        created = init_db()
        if created:
            logger.info("Database tables ensured.")
        else:
            logger.warning("Database not initialized (DATABASE_URL missing).")
    except Exception as exc:
        logger.error("Database initialization failed: %s", exc)


@app.get("/")
def root():
    return {
        "service": "QueueMind AI API",
        "status": "ok",
        "config_warnings": settings.validate(),
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}
