"""Request/response schemas for FastAPI endpoints (separate from the
Gemini-extraction schema, which lives in extraction.py)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class IntakeRequest(BaseModel):
    patient_name: str = Field(..., min_length=1, max_length=200)
    patient_age: Optional[int] = Field(default=None, ge=0, le=130)
    raw_text: str = Field(..., min_length=1, max_length=4000)


class IntakeResponse(BaseModel):
    request_id: str
    status: str
    extraction: Optional[dict] = None
    recommendation: Optional[dict] = None
    processing_ms: Optional[float] = None
    warning: Optional[str] = None


class OverrideRequest(BaseModel):
    queue: str
    reason: str = Field(..., min_length=1, max_length=1000)
    reviewer_name: Optional[str] = None


class ApproveRequest(BaseModel):
    reviewer_name: Optional[str] = None


class PolicyUpdate(BaseModel):
    policy: dict


class RequestSummary(BaseModel):
    id: str
    patient_name: str
    patient_age: Optional[int]
    raw_text: str
    status: str
    created_at: datetime
    summary: Optional[str] = None
    recommended_queue: Optional[str] = None
    priority: Optional[str] = None
    confidence: Optional[float] = None
    final_queue: Optional[str] = None
    is_demo_seed: bool = False

    class Config:
        from_attributes = True
