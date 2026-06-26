import json
from samagra import config


def test_concept_graph_paths_defined():
    assert config.CONCEPT_GRAPH_DB.name == "concept_graph.db"
    assert config.CONCEPT_GRAPH_DB.parent == config.REPO_ROOT
    assert config.CONCEPT_ALIASES.name == "concept_aliases.json"
    assert config.CONCEPT_ALIASES.parent == config.REPO_ROOT


def test_concept_aliases_file_is_valid_overlay():
    data = json.loads(config.CONCEPT_ALIASES.read_text(encoding="utf-8"))
    assert data["version"] == 1
    assert isinstance(data["by_chapter"], dict)
    for slug, delta in data["by_chapter"].items():
        assert set(delta) <= {"add", "remove"}
        assert isinstance(delta.get("add", []), list)
        assert isinstance(delta.get("remove", []), list)
