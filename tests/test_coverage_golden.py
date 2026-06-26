import pytest
from samagra import config
from samagra.factory import coverage
from samagra.factory.coverage import store


@pytest.mark.skipif(not config.QX_BUILDER_DB.exists(), reason="QX builder.sqlite absent")
@pytest.mark.skipif(not config.TEXTBOOK_CHAPTERS.exists(), reason="textbook corpus absent")
def test_golden_thread_real_sources(tmp_path):
    graph = tmp_path / "concept_graph.db"
    summary = coverage.build_concept_graph(graph_db=graph)   # real QX + corpus + governance

    assert summary["concepts"] == 86          # the 86 QX physics concepts
    assert summary["gaps"] > 0

    conn = store.connect_ro(graph)
    try:
        payload = store.coverage_payload(conn)
    finally:
        conn.close()

    states = {c["state"] for c in payload["cells"]}
    assert "gap" in states                     # samadhan everywhere is a gap
    # the top gap is a high-demand concept and is pointer-pre-loaded
    top = payload["gaps"][0]
    assert top["plan_command"].startswith("samagra factory plan textbook:")
    assert top["deficit_score"] >= payload["gaps"][-1]["deficit_score"]
