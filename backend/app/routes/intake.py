import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.api import IntakeRequest, IntakeResponse
from app.services.validation_service import get_validated_extraction
from app.services.rule_engine import evaluate as run_rule_engine, load_policy
from app.models.models import PatientRequest, Extraction, Recommendation, RequestStatus

router = APIRouter(prefix="/api", tags=["intake"])


@router.post("/intake", response_model=IntakeResponse)
def submit_intake(payload: IntakeRequest, db: Session = Depends(get_db)):
    start = time.perf_counter()

    request_row = PatientRequest(
        patient_name=payload.patient_name,
        patient_age=payload.patient_age,
        raw_text=payload.raw_text,
        status=RequestStatus.PENDING_EXTRACTION,
    )
    db.add(request_row)
    db.commit()
    db.refresh(request_row)

    outcome = get_validated_extraction(payload.raw_text)

    if not outcome.is_valid:
        # Fail-safe: invalid/failed Gemini output -> manual review, never guessed.
        extraction_row = Extraction(
            request_id=request_row.id,
            summary="(extraction failed — manual review required)",
            request_type="other",
            department="unknown",
            duration=None,
            intents=["unclassified"],
            indicators=[],
            confidence=0.0,
            multiple_intents=False,
            safety_flags=["insufficient_information"],
            is_valid=False,
            validation_errors=outcome.errors,
            raw_model_output=outcome.raw_text,
            gemini_latency_ms=outcome.gemini_latency_ms,
        )
        db.add(extraction_row)

        recommendation_row = Recommendation(
            request_id=request_row.id,
            recommended_queue="manual_review",
            priority="medium",
            reason="Gemini extraction failed or did not pass validation: " + "; ".join(outcome.errors),
            manual_review_required=True,
            policy_version=load_policy().get("version"),
        )
        db.add(recommendation_row)

        request_row.status = RequestStatus.PENDING_REVIEW
        db.commit()

        total_ms = (time.perf_counter() - start) * 1000
        extraction_row.total_latency_ms = total_ms
        db.commit()

        return IntakeResponse(
            request_id=request_row.id,
            status=request_row.status.value,
            extraction=None,
            recommendation={
                "recommended_queue": "manual_review",
                "priority": "medium",
                "reason": recommendation_row.reason,
                "manual_review_required": True,
            },
            processing_ms=total_ms,
            warning="AI extraction failed validation — routed directly to manual review.",
        )

    ext = outcome.extraction  # validated GeminiExtraction (Pydantic model)

    extraction_row = Extraction(
        request_id=request_row.id,
        summary=ext.summary,
        request_type=ext.request_type,
        department=ext.department,
        duration=ext.duration,
        intents=ext.intents,
        indicators=ext.indicators,
        confidence=ext.confidence,
        multiple_intents=ext.multiple_intents,
        safety_flags=ext.safety_flags,
        is_valid=True,
        validation_errors=None,
        raw_model_output=outcome.raw_text,
        gemini_latency_ms=outcome.gemini_latency_ms,
    )
    db.add(extraction_row)

    # Rule engine ONLY ever receives the validated Pydantic model — never
    # the raw dict, never raw Gemini text.
    rule_result = run_rule_engine(ext)

    recommendation_row = Recommendation(
        request_id=request_row.id,
        recommended_queue=rule_result.recommended_queue,
        priority=rule_result.priority,
        reason=rule_result.reason,
        manual_review_required=rule_result.manual_review_required,
        policy_version=rule_result.policy_version,
    )
    db.add(recommendation_row)

    request_row.status = RequestStatus.PENDING_REVIEW
    db.commit()

    total_ms = (time.perf_counter() - start) * 1000
    extraction_row.total_latency_ms = total_ms
    db.commit()

    return IntakeResponse(
        request_id=request_row.id,
        status=request_row.status.value,
        extraction={
            "summary": ext.summary,
            "request_type": ext.request_type,
            "department": ext.department,
            "duration": ext.duration,
            "intents": ext.intents,
            "indicators": ext.indicators,
            "confidence": ext.confidence,
            "multiple_intents": ext.multiple_intents,
            "safety_flags": ext.safety_flags,
        },
        recommendation={
            "recommended_queue": rule_result.recommended_queue,
            "priority": rule_result.priority,
            "reason": rule_result.reason,
            "manual_review_required": rule_result.manual_review_required,
        },
        processing_ms=total_ms,
    )
