import json
import pytest
from samagra.factory.coverage import aliases

CONCEPTS = [
    {"concept_id": 226, "label": "ac circuits"},
    {"concept_id": 873, "label": "newton's laws"},
    {"concept_id": 587, "label": "friction"},
]


def test_resolve_overlay_maps_labels_to_ids():
    overlay = {"by_chapter": {
        "lom-and-pseudo-force": {"add": ["newton's laws", "FRICTION"], "remove": []},
        "circular-motion": {"add": [], "remove": ["ac circuits"]},
    }}
    resolved = aliases.resolve_overlay(overlay, CONCEPTS)
    assert resolved["lom-and-pseudo-force"]["add"] == {873, 587}   # case-insensitive
    assert resolved["circular-motion"]["remove"] == {226}


def test_unknown_label_is_a_hard_error():
    overlay = {"by_chapter": {"x": {"add": ["no such concept"], "remove": []}}}
    with pytest.raises(ValueError, match="unknown concept label"):
        aliases.resolve_overlay(overlay, CONCEPTS)


def test_unknown_slug_is_a_hard_error_when_valid_slugs_given():
    # symmetric with the label check: a typo'd chapter slug is caught at the review
    # surface instead of emitting a phantom edge + a broken plan_command downstream.
    overlay = {"by_chapter": {"circlar-moton": {"add": ["friction"], "remove": []}}}
    with pytest.raises(ValueError, match="unknown chapter slug"):
        aliases.resolve_overlay(overlay, CONCEPTS, valid_slugs={"circular-motion"})


def test_valid_slugs_optional_keeps_back_compat():
    # without valid_slugs the slug side is not validated (label check still runs)
    overlay = {"by_chapter": {"anything": {"add": ["friction"], "remove": []}}}
    resolved = aliases.resolve_overlay(overlay, CONCEPTS)   # no raise
    assert resolved["anything"]["add"] == {587}


def test_load_overlay_reads_json(tmp_path):
    p = tmp_path / "concept_aliases.json"
    p.write_text(json.dumps({"version": 1, "by_chapter": {}}), encoding="utf-8")
    assert aliases.load_overlay(p) == {"version": 1, "by_chapter": {}}
