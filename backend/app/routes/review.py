from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.api import ApproveRequest, OverrideRequest
from app.models.models import PatientRequest, Extraction, Recommendation, Decision, RequestStatus

router = APIRouter(prefix="/api", tags=["review"])


def _serialize_full(req: PatientRequest) -> dict:
    ext = req.extraction
    rec = req.recommendation
    dec = req.decision
    return {
        "id": req.id,
        "patient_name": req.patient_name,
        "patient_age": req.patient_age,
        "raw_text": req.raw_text,
        "status": req.status.value if hasattr(req.status, "value") else req.status,
        "created_at": req.created_at.isoformat(),
        "is_demo_seed": req.is_demo_seed,
        "extraction": {
            "summary": ext.summary,
            "request_type": ext.request_type,
            "department": ext.department,
            "duration": ext.duration,
            "intents": ext.intents,
            "indicators": ext.indicators,
            "confidence": ext.confidence,
            "multiple_intents": ext.multiple_intents,
            "safety_flags": ext.safety_flags,
            "is_valid": ext.is_valid,
            "validation_errors": ext.validation_errors,
            "gemini_latency_ms": ext.gemini_latency_ms,
        } if ext else None,
        "recommendation": {
            "recommended_queue": rec.recommended_queue.value if hasattr(rec.recommended_queue, "value") else rec.recommended_queue,
            "priority": rec.priority,
            "reason": rec.reason,
            "manual_review_required": rec.manual_review_required,
            "policy_version": rec.policy_version,
        } if rec else None,
        "decision": {
            "action": dec.action,
            "final_queue": dec.final_queue.value if hasattr(dec.final_queue, "value") else dec.final_queue,
            "final_priority": dec.final_priority,
            "override_reason": dec.override_reason,
            "reviewer_name": dec.reviewer_name,
            "decided_at": dec.decided_at.isoformat(),
        } if dec else None,
    }


@router.get("/review/{request_id}")
def get_review(request_id: str, db: Session = Depends(get_db)):
    req = db.query(PatientRequest).filter(PatientRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return _serialize_full(req)


@router.post("/review/{request_id}/approve")
def approve(request_id: str, payload: ApproveRequest, db: Session = Depends(get_db)):
    req = db.query(PatientRequest).filter(PatientRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if not req.recommendation:
        raise HTTPException(status_code=400, detail="No recommendation to approve")
    if req.decision:
        raise HTTPException(status_code=400, detail="This request already has a final decision")

    decision = Decision(
        request_id=req.id,
        action="approve",
        final_queue=req.recommendation.recommended_queue,
        final_priority=req.recommendation.priority,
        override_reason=None,
        reviewer_name=payload.reviewer_name,
    )
    db.add(decision)
    req.status = RequestStatus.APPROVED
    db.commit()
    return _serialize_full(req)


@router.post("/review/{request_id}/override")
def override(request_id: str, payload: OverrideRequest, db: Session = Depends(get_db)):
    req = db.query(PatientRequest).filter(PatientRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.decision:
        raise HTTPException(status_code=400, detail="This request already has a final decision")

    valid_queues = {"general_consultation", "priority_review", "urgent_review", "administrative", "manual_review"}
    if payload.queue not in valid_queues:
        raise HTTPException(status_code=400, detail=f"queue must be one of {sorted(valid_queues)}")

    priority_by_queue = {
        "urgent_review": "urgent",
        "priority_review": "high",
        "general_consultation": "low",
        "administrative": "low",
        "manual_review": "medium",
    }

    decision = Decision(
        request_id=req.id,
        action="override",
        final_queue=payload.queue,
        final_priority=priority_by_queue.get(payload.queue, "medium"),
        override_reason=payload.reason,
        reviewer_name=payload.reviewer_name,
    )
    db.add(decision)
    req.status = RequestStatus.OVERRIDDEN
    db.commit()
    return _serialize_full(req)
