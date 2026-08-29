from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.models import StaffUser
from app.database import SessionLocal
from passlib.context import CryptContext


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(data: LoginRequest):

    db = SessionLocal()

    user = (
        db.query(StaffUser)
        .filter(StaffUser.email == data.email)
        .first()
    )

    db.close()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    if not pwd_context.verify(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    return {
        "message": "Login successful",
        "staff_id": user.id,
        "role": user.role
    }