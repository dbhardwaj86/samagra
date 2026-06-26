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


def test_load_overlay_reads_json(tmp_path):
    p = tmp_path / "concept_aliases.json"
    p.write_text(json.dumps({"version": 1, "by_chapter": {}}), encoding="utf-8")
    assert aliases.load_overlay(p) == {"version": 1, "by_chapter": {}}
