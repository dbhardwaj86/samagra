from samagra.factory.coverage import store


def _sample():
    concepts = [{"concept_id": 1, "label": "circular motion",
                 "chapter_id": "physics.laws_of_motion", "demand_size": 100, "paper_count": 7}]
    chapter_edges = [{"concept_id": 1, "slug": "circular-motion", "score": 5.0, "source": "fts"}]
    cells = [{"concept_id": 1, "lane": "samadhan", "state": "gap", "produced_n": 0, "base_n": 0},
             {"concept_id": 1, "lane": "deck", "state": "produced", "produced_n": 1, "base_n": 1}]
    gaps = [{"rank": 1, "concept_id": 1, "lane": "samadhan", "cell_state": "gap",
             "demand_size": 100, "existing_corpus_n": 0, "deficit_score": 100.0,
             "suggested_seed_ref": "textbook:circular-motion",
             "plan_command": "samagra factory plan textbook:circular-motion --lane samadhan"}]
    return concepts, chapter_edges, cells, gaps


def test_write_then_read_payload(tmp_path):
    db = tmp_path / "concept_graph.db"
    concepts, chapter_edges, cells, gaps = _sample()
    conn = store.connect(db)
    try:
        store.init_schema(conn)
        store.write_graph(conn, concepts=concepts, chapter_edges=chapter_edges,
                          cells=cells, gaps=gaps, meta={"concept_count": 1})
    finally:
        conn.close()

    conn = store.connect_ro(db)
    try:
        payload = store.coverage_payload(conn)
        dossier = store.concept_dossier(conn, 1)
        only = store.list_gaps(conn, lane="samadhan")
    finally:
        conn.close()

    assert payload["lanes"] == store.matrix.COVERAGE_LANES
    assert payload["concepts"][0]["paper_count"] == 7
    assert len(payload["cells"]) == 2
    assert payload["gaps"][0]["plan_command"].endswith("--lane samadhan")
    assert dossier["label"] == "circular motion"
    assert dossier["chapters"] == ["circular-motion"]
    assert {c["lane"] for c in dossier["cells"]} == {"samadhan", "deck"}
    assert [g["lane"] for g in only] == ["samadhan"]


def test_write_graph_is_idempotent(tmp_path):
    db = tmp_path / "concept_graph.db"
    concepts, chapter_edges, cells, gaps = _sample()
    for _ in range(2):
        conn = store.connect(db)
        try:
            store.init_schema(conn)
            store.write_graph(conn, concepts=concepts, chapter_edges=chapter_edges,
                              cells=cells, gaps=gaps, meta={"concept_count": 1})
        finally:
            conn.close()
    conn = store.connect_ro(db)
    try:
        assert len(store.coverage_payload(conn)["concepts"]) == 1   # not duplicated
    finally:
        conn.close()


def test_connect_ro_missing_db_raises(tmp_path):
    import pytest
    with pytest.raises(FileNotFoundError):
        store.connect_ro(tmp_path / "nope.db")


def test_list_gaps_top_zero_returns_no_rows(tmp_path):
    db = tmp_path / "concept_graph.db"
    concepts, chapter_edges, cells, gaps = _sample()
    conn = store.connect(db)
    try:
        store.init_schema(conn)
        store.write_graph(conn, concepts=concepts, chapter_edges=chapter_edges,
                          cells=cells, gaps=gaps, meta={"concept_count": 1})
        # top=0 means "zero rows", NOT "all rows" (the falsy-LIMIT footgun)
        assert store.list_gaps(conn, top=0) == []
        assert len(store.list_gaps(conn, top=None)) == 1   # None still means "all"
        assert len(store.list_gaps(conn, top=5)) == 1
    finally:
        conn.close()
