"""
Strict Pydantic schema for validating Gemini's structured JSON output.

This is the ONLY gate between the LLM and the rest of the system.
If Gemini's output does not pass validation here, it must never reach
the rule engine. See services/validation_service.py for the enforcement.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, field_validator

# Fixed, closed vocabulary the model must choose from. Keeping this closed
# (rather than free text) is what makes downstream validation meaningful.
ALLOWED_REQUEST_TYPES = {
    "new_consultation",
    "follow_up",
    "reschedule",
    "prescription_question",
    "billing_administrative",
    "test_results_inquiry",
    "general_question",
    "other",
}

ALLOWED_DEPARTMENTS = {
    "general_medicine",
    "pediatrics",
    "cardiology",
    "dermatology",
    "administrative",
    "pharmacy",
    "unknown",
}

ALLOWED_SAFETY_FLAGS = {
    "prompt_injection_suspected",
    "contradictory_information",
    "insufficient_information",
    "out_of_scope_request",
}


class GeminiExtraction(BaseModel):
    """The structured shape we REQUEST from Gemini and REQUIRE from it.
    Pydantic v2 will reject anything that doesn't conform."""

    model_config = {"extra": "forbid"}  # unknown fields = rejected, not ignored

    summary: str = Field(..., min_length=1, max_length=600)
    request_type: str
    department: Optional[str] = None
    duration: Optional[str] = Field(default=None, max_length=100)
    intents: list[str] = Field(default_factory=list)
    indicators: list[str] = Field(default_factory=list, max_length=25)
    confidence: float = Field(..., ge=0.0, le=1.0)
    multiple_intents: bool = False
    safety_flags: list[str] = Field(default_factory=list)

    @field_validator("request_type")
    @classmethod
    def request_type_must_be_known(cls, v: str) -> str:
        if v not in ALLOWED_REQUEST_TYPES:
            raise ValueError(
                f"request_type '{v}' is not in the allowed set: {sorted(ALLOWED_REQUEST_TYPES)}"
            )
        return v

    @field_validator("department")
    @classmethod
    def department_must_be_known(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_DEPARTMENTS:
            raise ValueError(
                f"department '{v}' is not in the allowed set: {sorted(ALLOWED_DEPARTMENTS)}"
            )
        return v

    @field_validator("intents")
    @classmethod
    def intents_non_empty_and_bounded(cls, v: list[str]) -> list[str]:
        if len(v) == 0:
            raise ValueError("intents must contain at least one item")
        if len(v) > 10:
            raise ValueError("intents list implausibly long (>10) — likely malformed output")
        return v

    @field_validator("safety_flags")
    @classmethod
    def safety_flags_must_be_known(cls, v: list[str]) -> list[str]:
        unknown = [f for f in v if f not in ALLOWED_SAFETY_FLAGS]
        if unknown:
            raise ValueError(f"unknown safety_flags: {unknown}")
        return v

    @field_validator("multiple_intents")
    @classmethod
    def multiple_intents_consistency(cls, v: bool, info) -> bool:
        # Note: cross-field consistency (multiple_intents vs len(intents)>1)
        # is additionally enforced in validation_service.py, since Pydantic
        # v2 field order isn't guaranteed at this validation stage.
        return v
