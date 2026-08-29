from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.models import PatientRequest, RequestStatus

router = APIRouter(prefix="/api", tags=["queue"])


@router.get("/queue")
def list_queue(
    status: str | None = Query(default=None, description="Filter by status"),
    queue: str | None = Query(default=None, description="Filter by recommended queue"),
    search: str | None = Query(default=None, description="Search patient name or text"),
    db: Session = Depends(get_db),
):
    q = db.query(PatientRequest).options(
        joinedload(PatientRequest.extraction),
        joinedload(PatientRequest.recommendation),
        joinedload(PatientRequest.decision),
    ).order_by(PatientRequest.created_at.desc())

    if status:
        q = q.filter(PatientRequest.status == status)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (PatientRequest.patient_name.ilike(like)) | (PatientRequest.raw_text.ilike(like))
        )

    rows = q.all()
    results = []
    for r in rows:
        rec_queue = None
        if r.recommendation:
            rec_queue = r.recommendation.recommended_queue.value if hasattr(
                r.recommendation.recommended_queue, "value"
            ) else r.recommendation.recommended_queue
        if queue and rec_queue != queue:
            continue

        waiting_seconds = None
        if r.status.value == "pending_review" if hasattr(r.status, "value") else r.status == "pending_review":
            waiting_seconds = (datetime.utcnow() - r.created_at).total_seconds()

        results.append({
            "id": r.id,
            "patient_name": r.patient_name,
            "patient_age": r.patient_age,
            "raw_text": r.raw_text,
            "status": r.status.value if hasattr(r.status, "value") else r.status,
            "created_at": r.created_at.isoformat(),
            "is_demo_seed": r.is_demo_seed,
            "summary": r.extraction.summary if r.extraction else None,
            "confidence": r.extraction.confidence if r.extraction else None,
            "recommended_queue": rec_queue,
            "priority": r.recommendation.priority if r.recommendation else None,
            "manual_review_required": r.recommendation.manual_review_required if r.recommendation else None,
            "final_queue": (
                r.decision.final_queue.value if r.decision and hasattr(r.decision.final_queue, "value")
                else (r.decision.final_queue if r.decision else None)
            ),
            "waiting_seconds": waiting_seconds,
        })
    return {"count": len(results), "requests": results}
