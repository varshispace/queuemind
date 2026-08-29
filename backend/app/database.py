"""
SQLAlchemy engine / session management, backed by PostgreSQL (Neon).
DATABASE_URL comes from the environment only (see config.py).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# Neon requires SSL; the DATABASE_URL already includes sslmode=require.
# pool_pre_ping avoids stale-connection errors on serverless Postgres.
engine = create_engine(
    settings.DATABASE_URL or "postgresql://placeholder",
    pool_pre_ping=True,
    pool_recycle=300,
    # A hard connect timeout means a temporarily unreachable database fails
    # fast (and is reported honestly) instead of hanging app startup/requests
    # forever. Statement timeout protects against runaway queries.
    connect_args={"connect_timeout": 5, "options": "-c statement_timeout=15000"},
) if settings.DATABASE_URL else None

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    if SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL is not configured. Set it as an environment variable."
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables if they don't exist. Simple, deployment-safe approach
    for a hackathon project (Alembic migrations would be the production
    upgrade path)."""
    if engine is None:
        return False
    from app import models  # noqa: F401  (ensure models are registered)
    Base.metadata.create_all(bind=engine)
    return True
