from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.analytics_service import compute_analytics

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    return compute_analytics(db)
