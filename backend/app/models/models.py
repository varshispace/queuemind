"""
SQLAlchemy models. Together these tables form the complete audit trail:

Request (patient input)
  -> Extraction (Gemini output, post-validation)
  -> Recommendation (deterministic rule engine output)
  -> Decision (staff approve/override -> final queue)
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, Enum
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


class QueueName(str, enum.Enum):
    GENERAL_CONSULTATION = "general_consultation"
    PRIORITY_REVIEW = "priority_review"
    URGENT_REVIEW = "urgent_review"
    ADMINISTRATIVE = "administrative"
    MANUAL_REVIEW = "manual_review"  # fallback bucket, not a clinical queue


class RequestStatus(str, enum.Enum):
    PENDING_EXTRACTION = "pending_extraction"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    OVERRIDDEN = "overridden"
    FAILED = "failed"


class PatientRequest(Base):
    """The original free-text request submitted by a patient."""
    __tablename__ = "patient_requests"

    id = Column(String, primary_key=True, default=lambda: gen_id("QM"))
    patient_name = Column(String, nullable=False)
    patient_age = Column(Integer, nullable=True)
    raw_text = Column(Text, nullable=False)

    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING_EXTRACTION, nullable=False)
    is_demo_seed = Column(Boolean, default=False)  # marks synthetic demo data

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    extraction = relationship("Extraction", back_populates="request", uselist=False)
    recommendation = relationship("Recommendation", back_populates="request", uselist=False)
    decision = relationship("Decision", back_populates="request", uselist=False)


class Extraction(Base):
    """Gemini's structured understanding of the request, AFTER Pydantic
    validation. Raw/invalid Gemini output never lands here."""
    __tablename__ = "extractions"

    id = Column(String, primary_key=True, default=lambda: gen_id("EX"))
    request_id = Column(String, ForeignKey("patient_requests.id"), nullable=False, unique=True)

    summary = Column(Text, nullable=False)
    request_type = Column(String, nullable=False)
    department = Column(String, nullable=True)
    duration = Column(String, nullable=True)
    intents = Column(JSON, nullable=False, default=list)          # list[str]
    indicators = Column(JSON, nullable=False, default=list)        # list[str]
    confidence = Column(Float, nullable=False)
    multiple_intents = Column(Boolean, default=False)
    safety_flags = Column(JSON, nullable=False, default=list)      # e.g. prompt_injection_suspected

    is_valid = Column(Boolean, default=True)
    validation_errors = Column(JSON, nullable=True)
    raw_model_output = Column(Text, nullable=True)  # kept for audit/debugging only

    gemini_latency_ms = Column(Float, nullable=True)
    total_latency_ms = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    request = relationship("PatientRequest", back_populates="extraction")


class Recommendation(Base):
    """Deterministic rule-engine output. Never produced by the LLM."""
    __tablename__ = "recommendations"

    id = Column(String, primary_key=True, default=lambda: gen_id("REC"))
    request_id = Column(String, ForeignKey("patient_requests.id"), nullable=False, unique=True)

    recommended_queue = Column(Enum(QueueName), nullable=False)
    priority = Column(String, nullable=False)  # low | medium | high | urgent
    reason = Column(Text, nullable=False)
    manual_review_required = Column(Boolean, default=False)
    policy_version = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    request = relationship("PatientRequest", back_populates="recommendation")


class Decision(Base):
    """The final, human-made decision. This is the only thing that actually
    controls the final queue."""
    __tablename__ = "decisions"

    id = Column(String, primary_key=True, default=lambda: gen_id("DEC"))
    request_id = Column(String, ForeignKey("patient_requests.id"), nullable=False, unique=True)

    action = Column(String, nullable=False)  # "approve" | "override"
    final_queue = Column(Enum(QueueName), nullable=False)
    final_priority = Column(String, nullable=False)
    override_reason = Column(Text, nullable=True)
    reviewer_name = Column(String, nullable=True)

    decided_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    request = relationship("PatientRequest", back_populates="decision")
