"""
Analytics computed from real stored data only. No fabricated numbers.
If there isn't enough data yet, callers should show an honest empty state
(handled in the analytics route / frontend), not invented figures.
"""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import PatientRequest, Extraction, Recommendation, Decision, RequestStatus


def compute_analytics(db: Session) -> dict:
    total_requests = db.query(func.count(PatientRequest.id)).scalar() or 0
    pending = db.query(func.count(PatientRequest.id)).filter(
        PatientRequest.status == RequestStatus.PENDING_REVIEW
    ).scalar() or 0
    decided = db.query(func.count(Decision.id)).scalar() or 0

    if total_requests == 0:
        return {
            "has_data": False,
            "total_requests": 0,
            "message": "No requests yet. Submit a patient request or seed demo data to see analytics.",
        }

    # Queue volume distribution (based on final decision where available,
    # else the recommendation)
    queue_counts: dict[str, int] = {}
    for row in db.query(Decision.final_queue, func.count(Decision.id)).group_by(Decision.final_queue).all():
        queue_counts[row[0].value if hasattr(row[0], "value") else row[0]] = row[1]

    priority_counts: dict[str, int] = {}
    for row in db.query(Recommendation.priority, func.count(Recommendation.id)).group_by(Recommendation.priority).all():
        priority_counts[row[0]] = row[1]

    # Override rate = overridden decisions / all decisions
    overridden = db.query(func.count(Decision.id)).filter(Decision.action == "override").scalar() or 0
    override_rate = round((overridden / decided) * 100, 1) if decided else None

    # Routing accuracy proxy = approvals / all decisions (staff agreed with AI+rules)
    approved = db.query(func.count(Decision.id)).filter(Decision.action == "approve").scalar() or 0
    routing_accuracy = round((approved / decided) * 100, 1) if decided else None

    # Urgency recall / false negatives:
    # Among requests staff FINALLY placed in urgent_review, how many did the
    # rule engine also recommend as urgent_review (recall), and how many did
    # the rule engine miss (false negatives)?
    urgent_final = db.query(Decision).filter(Decision.final_queue == "urgent_review").all()
    urgent_final_ids = {d.request_id for d in urgent_final}
    urgent_recommended = db.query(Recommendation).filter(
        Recommendation.recommended_queue == "urgent_review"
    ).all()
    urgent_recommended_ids = {r.request_id for r in urgent_recommended}

    if urgent_final_ids:
        true_positive = len(urgent_final_ids & urgent_recommended_ids)
        urgency_recall = round((true_positive / len(urgent_final_ids)) * 100, 1)
        urgent_false_negatives = len(urgent_final_ids - urgent_recommended_ids)
    else:
        urgency_recall = None
        urgent_false_negatives = 0

    # Latency
    avg_gemini_latency = db.query(func.avg(Extraction.gemini_latency_ms)).scalar()
    avg_total_latency = db.query(func.avg(Extraction.total_latency_ms)).scalar()

    return {
        "has_data": True,
        "total_requests": total_requests,
        "pending_review": pending,
        "decided": decided,
        "queue_volume": queue_counts,
        "priority_distribution": priority_counts,
        "override_rate_pct": override_rate,
        "routing_accuracy_pct": routing_accuracy,
        "urgency_recall_pct": urgency_recall,
        "urgent_false_negatives": urgent_false_negatives,
        "avg_gemini_latency_ms": round(avg_gemini_latency, 1) if avg_gemini_latency else None,
        "avg_total_processing_ms": round(avg_total_latency, 1) if avg_total_latency else None,
    }
