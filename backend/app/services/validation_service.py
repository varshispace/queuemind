"""
Validation gate between Gemini output and the rule engine.

Rules enforced here (per project requirements):
  1. Gemini output must be valid JSON matching GeminiExtraction schema.
  2. Invalid output is rejected, never silently passed downstream.
  3. Optionally retried once.
  4. If still invalid -> fall back to manual review, never guessed.
  5. Cross-field consistency (multiple_intents vs actual intent count) is
     enforced here, since it spans multiple fields.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from pydantic import ValidationError

from app.schemas.extraction import GeminiExtraction
from app.services.gemini_service import (
    call_gemini_extraction, parse_json_or_none, _heuristic_injection_detected,
)


@dataclass
class ValidationOutcome:
    is_valid: bool
    extraction: Optional[GeminiExtraction] = None
    raw_text: str = ""
    errors: list[str] = field(default_factory=list)
    gemini_latency_ms: float = 0.0
    attempts: int = 0


def _validate_payload(payload: dict, patient_text: str) -> tuple[Optional[GeminiExtraction], list[str]]:
    try:
        extraction = GeminiExtraction(**payload)
    except ValidationError as e:
        return None, [str(err) for err in e.errors()]

    errors = []
    # Cross-field consistency check
    if extraction.multiple_intents and len(extraction.intents) < 2:
        errors.append(
            "multiple_intents=true but fewer than 2 intents were extracted"
        )
    if (not extraction.multiple_intents) and len(extraction.intents) >= 2:
        # Not fatal, but we correct it rather than trust an inconsistent flag.
        extraction.multiple_intents = True

    # Independent, code-side injection detection — doesn't rely on the
    # model correctly flagging itself.
    if _heuristic_injection_detected(patient_text):
        if "prompt_injection_suspected" not in extraction.safety_flags:
            extraction.safety_flags = extraction.safety_flags + ["prompt_injection_suspected"]

    if errors:
        return None, errors
    return extraction, []


def get_validated_extraction(patient_text: str, max_attempts: int = 2) -> ValidationOutcome:
    """Calls Gemini, validates the result, retries once on failure.
    Never fabricates data to make a failure look like a success."""
    last_errors: list[str] = []
    last_raw = ""
    total_latency = 0.0

    for attempt in range(1, max_attempts + 1):
        result = call_gemini_extraction(patient_text)
        total_latency += result.latency_ms
        last_raw = result.raw_text

        if result.error:
            last_errors = [f"Gemini API error: {result.error}"]
            continue

        payload = parse_json_or_none(result.raw_text)
        if payload is None:
            last_errors = ["Gemini output was not valid JSON."]
            continue

        extraction, errors = _validate_payload(payload, patient_text)
        if extraction is not None:
            return ValidationOutcome(
                is_valid=True,
                extraction=extraction,
                raw_text=result.raw_text,
                errors=[],
                gemini_latency_ms=total_latency,
                attempts=attempt,
            )
        last_errors = errors

    # All attempts failed -> honest failure, caller must route to manual review.
    return ValidationOutcome(
        is_valid=False,
        extraction=None,
        raw_text=last_raw,
        errors=last_errors,
        gemini_latency_ms=total_latency,
        attempts=max_attempts,
    )
