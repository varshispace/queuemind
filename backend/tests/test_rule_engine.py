"""Rule engine tests. Deliberately construct GeminiExtraction objects
directly (bypassing Gemini entirely) to prove the rule engine is testable
in complete isolation from the LLM, per the architecture requirement."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.schemas.extraction import GeminiExtraction
from app.services.rule_engine import evaluate, load_policy

POLICY = load_policy()


def make_extraction(**overrides) -> GeminiExtraction:
    base = dict(
        summary="Patient requests a routine consultation.",
        request_type="new_consultation",
        department="general_medicine",
        duration=None,
        intents=["new_consultation"],
        indicators=[],
        confidence=0.9,
        multiple_intents=False,
        safety_flags=[],
    )
    base.update(overrides)
    return GeminiExtraction(**base)


def test_routine_request_routes_general_consultation():
    ext = make_extraction()
    result = evaluate(ext, POLICY)
    assert result.recommended_queue == "general_consultation"
    assert result.manual_review_required is False


def test_urgent_indicator_routes_urgent_review():
    ext = make_extraction(indicators=["symptoms getting worse", "as soon as possible"])
    result = evaluate(ext, POLICY)
    assert result.recommended_queue == "urgent_review"
    assert result.priority == "urgent"


def test_priority_indicator_routes_priority_review():
    ext = make_extraction(indicators=["persistent", "concerned"])
    result = evaluate(ext, POLICY)
    assert result.recommended_queue == "priority_review"
    assert result.priority == "high"


def test_administrative_request_type_routes_administrative():
    ext = make_extraction(request_type="billing_administrative", indicators=[])
    result = evaluate(ext, POLICY)
    assert result.recommended_queue == "administrative"


def test_low_confidence_forces_manual_review():
    ext = make_extraction(confidence=0.4, indicators=["as soon as possible"])
    result = evaluate(ext, POLICY)
    assert result.recommended_queue == "manual_review"
    assert result.manual_review_required is True


def test_multiple_intents_forces_manual_review():
    ext = make_extraction(
        intents=["reschedule", "prescription_question"],
        multiple_intents=True,
    )
    result = evaluate(ext, POLICY)
    assert result.recommended_queue == "manual_review"
    assert result.manual_review_required is True


def test_safety_flag_forces_manual_review_even_with_urgent_indicators():
    ext = make_extraction(
        indicators=["as soon as possible"],
        safety_flags=["prompt_injection_suspected"],
    )
    result = evaluate(ext, POLICY)
    assert result.recommended_queue == "manual_review"
    assert result.manual_review_required is True


def test_urgent_takes_priority_over_administrative_type():
    # Even if request_type looks administrative, an urgent indicator should win.
    ext = make_extraction(
        request_type="billing_administrative",
        indicators=["emergency"],
    )
    result = evaluate(ext, POLICY)
    assert result.recommended_queue == "urgent_review"
