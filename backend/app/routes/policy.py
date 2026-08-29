import json
from fastapi import APIRouter, HTTPException

from app.schemas.api import PolicyUpdate
from app.services.rule_engine import load_policy, POLICY_PATH

router = APIRouter(prefix="/api", tags=["policy"])


@router.get("/policy")
def get_policy():
    return load_policy()


@router.put("/policy")
def update_policy(payload: PolicyUpdate):
    new_policy = payload.policy
    required_keys = {"queues", "urgent_indicators", "priority_indicators", "confidence_threshold"}
    missing = required_keys - set(new_policy.keys())
    if missing:
        raise HTTPException(status_code=400, detail=f"Policy missing required keys: {sorted(missing)}")

    with open(POLICY_PATH, "w") as f:
        json.dump(new_policy, f, indent=2)

    return {"status": "saved", "policy": new_policy}
