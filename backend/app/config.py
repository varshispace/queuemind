"""
Central configuration for QueueMind AI backend.

All secrets (GEMINI_API_KEY, DATABASE_URL) are read from environment
variables ONLY. They are never hardcoded and never exposed to the frontend.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env for local development. In production (Railway/Render), env vars
# are injected directly by the platform, so this is a no-op there.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    # --- Secrets (env only) ---
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # --- Gemini model ---
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

    # --- CORS ---
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    ALLOWED_ORIGINS: list[str] = [
        o.strip() for o in os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",") if o.strip()
    ]

    # --- App behavior ---
    ENV: str = os.getenv("ENV", "development")

    def validate(self) -> list[str]:
        """Return a list of human-readable problems with the current config.
        Used at startup to warn (not crash) about missing configuration, per
        the requirement that missing credentials must be reported, not faked.
        """
        problems = []
        if not self.GEMINI_API_KEY:
            problems.append(
                "GEMINI_API_KEY is not set. Real Gemini calls will fail until "
                "this environment variable is provided."
            )
        if not self.DATABASE_URL:
            problems.append(
                "DATABASE_URL is not set. Database reads/writes will fail "
                "until this environment variable is provided."
            )
        return problems


settings = Settings()
