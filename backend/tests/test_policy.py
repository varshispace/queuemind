import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.rule_engine import load_policy


def test_policy_loads_and_has_required_keys():
    policy = load_policy()
    for key in ["queues", "urgent_indicators", "priority_indicators", "confidence_threshold"]:
        assert key in policy


def test_policy_queues_include_manual_review_fallback():
    policy = load_policy()
    assert "manual_review" in policy["queues"]
