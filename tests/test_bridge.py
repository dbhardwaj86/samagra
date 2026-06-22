"""Phase 3 — active-loop bridge tests. All HTTP clients are mocked; no live calls."""
from __future__ import annotations

import json
import sys

import pytest

from samagra.bridge.text import item_text
from samagra.bridge.classify import classify_item


def _item(kind, payload, **kw):
    base = {"id": "i1", "kind": kind, "payload": payload, "status": "open"}
    base.update(kw)
    return base


@pytest.mark.parametrize(
    "item,expected",
    [
        # real munshi kind-specific keys (R2)
        (_item("question", {"stem": "Find the work done by friction on a block?"}), "content"),
        (_item("note", {"issue": "Nice intuition for Gauss's law and electric flux"}), "content"),
        (_item("todo", {"task": "Make a question on rotational kinetic energy"}), "content"),
        # synthetic generic-text payloads still work via the fallback join
        (_item("note", {"text": "Gauss law electric flux through a cube"}), "content"),
        # ops: issues / followups / person-directed / non-physics
        (_item("issue", {"summary": "Projector in room 4 is broken"}), "ops"),
        (_item("followup", {"note": "Call the parent about fees"}, person="Riya"), "ops"),
        (_item("note", {"issue": "Buy more whiteboard markers"}), "ops"),
        (_item("todo", {"task": "Order new chairs"}), "ops"),
    ],
)
def test_classify_item(item, expected):
    assert classify_item(item) == expected


def test_item_text_uses_kind_specific_key():
    assert item_text(_item("todo", {"task": "Order new chairs"})) == "Order new chairs"
    assert item_text(_item("question", {"stem": "Find a?"})) == "Find a?"


def test_item_text_falls_back_to_joined_values():
    # no kind-specific key present -> join string values
    assert "Gauss" in item_text(_item("note", {"text": "Gauss law"}))


def test_item_text_empty_payload_is_empty_string():
    assert item_text(_item("todo", {})) == ""
