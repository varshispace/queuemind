from app.database import SessionLocal
from app.models.models import StaffUser
from passlib.context import CryptContext

pwd = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

db = SessionLocal()

existing = (
    db.query(StaffUser)
    .filter(StaffUser.email == "admin@queuemind.com")
    .first()
)

if existing:
    print("User already exists")
else:
    user = StaffUser(
        email="admin@queuemind.com",
        password_hash=pwd.hash("queuemind123"),
        role="staff"
    )

    db.add(user)
    db.commit()

    print("Staff user created")

db.close()