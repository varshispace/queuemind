"""
Deterministic rule engine.

HARD RULES:
  - This module NEVER imports or calls gemini_service.
  - This module's entry point ONLY accepts a validated GeminiExtraction
    (Pydantic model), never raw dict/text from the LLM.
  - The LLM identifies indicators; THIS module decides what they mean
    operationally. The LLM never picks the queue.

This file is intentionally pure/stateless so it is trivially unit-testable
without any network calls or LLM involvement (see tests/test_rule_engine.py).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.schemas.extraction import GeminiExtraction

POLICY_PATH = Path(__file__).resolve().parent.parent / "policy" / "routing_policy.json"


def load_policy() -> dict:
    with open(POLICY_PATH, "r") as f:
        return json.load(f)


@dataclass
class RuleEngineResult:
    recommended_queue: str
    priority: str  # low | medium | high | urgent
    reason: str
    manual_review_required: bool
    policy_version: str


def _text_contains_any(haystack: list[str], needles: list[str]) -> list[str]:
    """Case-insensitive substring match of policy indicator phrases against
    the LLM-identified indicator phrases (and summary, as a backstop)."""
    hay_lower = " | ".join(h.lower() for h in haystack)
    return [n for n in needles if n.lower() in hay_lower]


def evaluate(extraction: GeminiExtraction, policy: Optional[dict] = None) -> RuleEngineResult:
    """The ONLY entry point. Input MUST be a validated GeminiExtraction —
    this is enforced by the type signature and by callers (routes/intake.py),
    which only ever construct this from output that already passed
    validation_service.get_validated_extraction().
    """
    if policy is None:
        policy = load_policy()

    version = policy.get("version", "unknown")
    confidence_threshold = policy.get("confidence_threshold", 0.75)

    haystack = list(extraction.indicators) + [extraction.summary]

    urgent_hits = _text_contains_any(haystack, policy.get("urgent_indicators", []))
    priority_hits = _text_contains_any(haystack, policy.get("priority_indicators", []))

    reasons: list[str] = []

    # --- Fail-safe checks first: these always win, regardless of indicators ---
    if extraction.confidence < confidence_threshold:
        reasons.append(
            f"Extraction confidence {extraction.confidence:.2f} is below the "
            f"policy threshold of {confidence_threshold:.2f}."
        )
        return RuleEngineResult(
            recommended_queue="manual_review",
            priority="medium",
            reason=" ".join(reasons),
            manual_review_required=True,
            policy_version=version,
        )

    if extraction.multiple_intents or len(extraction.intents) > 1:
        reasons.append(
            f"Multiple intents detected ({', '.join(extraction.intents)}); "
            "routing decisions spanning several needs require human triage."
        )
        return RuleEngineResult(
            recommended_queue="manual_review",
            priority="medium",
            reason=" ".join(reasons),
            manual_review_required=True,
            policy_version=version,
        )

    if extraction.safety_flags:
        reasons.append(
            f"Safety flag(s) present: {', '.join(extraction.safety_flags)}. "
            "Requires human review before any routing decision is trusted."
        )
        return RuleEngineResult(
            recommended_queue="manual_review",
            priority="medium",
            reason=" ".join(reasons),
            manual_review_required=True,
            policy_version=version,
        )

    # --- Normal deterministic routing ---
    if urgent_hits:
        reasons.append(f"Urgent operational indicators matched: {', '.join(urgent_hits)}.")
        return RuleEngineResult(
            recommended_queue="urgent_review",
            priority="urgent",
            reason=" ".join(reasons),
            manual_review_required=False,
            policy_version=version,
        )

    if extraction.request_type in policy.get("administrative_request_types", []):
        reasons.append(f"Request type '{extraction.request_type}' is classified as administrative.")
        return RuleEngineResult(
            recommended_queue="administrative",
            priority="low",
            reason=" ".join(reasons),
            manual_review_required=False,
            policy_version=version,
        )

    if priority_hits:
        reasons.append(f"Priority operational indicators matched: {', '.join(priority_hits)}.")
        return RuleEngineResult(
            recommended_queue="priority_review",
            priority="high",
            reason=" ".join(reasons),
            manual_review_required=False,
            policy_version=version,
        )

    reasons.append("No urgent/priority indicators matched; routed as a routine consultation.")
    return RuleEngineResult(
        recommended_queue="general_consultation",
        priority="low",
        reason=" ".join(reasons),
        manual_review_required=False,
        policy_version=version,
    )
