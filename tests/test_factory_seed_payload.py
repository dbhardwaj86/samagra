"""Payload-shape tests, re-homed with seed_payload.py to the factory (Phase C3)."""
from __future__ import annotations

from samagra.factory.seed_payload import (
    SEED_TYPES, build_seed_payload, validate_seed_payload)
import pytest


def test_build_seed_payload_rough_idea_flat_body():
    item = {"id": "42", "uid": "munshi:42", "kind": "note",
            "payload": {"issue": "Idea: show work done by friction with a slider"},
            "status": "open"}
    body = build_seed_payload(item, [])
    assert body == {"type": "rough_idea",
                    "raw_text": "Idea: show work done by friction with a slider",
                    "source_ref": "munshi:42"}
    assert "detail" not in body                       # R1: worker drops nested detail{}


def test_build_seed_payload_question_maps_type():
    item = {"id": "7", "uid": "munshi:7", "kind": "question",
            "payload": {"stem": "A 2 kg block slides down a 30 deg incline; find a."},
            "status": "open"}
    body = build_seed_payload(item, [])
    assert body["type"] == "question"
    assert body["raw_text"].startswith("A 2 kg block")
    assert body["source_ref"] == "munshi:7"


def test_build_seed_payload_source_ref_from_id_when_no_uid():
    body = build_seed_payload(
        {"id": "9", "kind": "todo", "payload": {"task": "rotational kinetic energy demo"}}, [])
    assert body["source_ref"] == "munshi:9"


def test_validate_seed_payload_rejects_bad_type_and_empty_text():
    with pytest.raises(ValueError, match="type"):
        validate_seed_payload({"type": "nope", "raw_text": "x"})
    with pytest.raises(ValueError, match="raw_text"):
        validate_seed_payload({"type": "question", "raw_text": "   "})
    validate_seed_payload({"type": "rough_idea", "raw_text": "ok"})   # no raise


def test_seed_types_contract_unchanged():
    assert {"question", "rough_idea"} <= SEED_TYPES
