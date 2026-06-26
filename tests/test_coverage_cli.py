from samagra.factory.coverage import store


def _seed_graph(db):
    conn = store.connect(db)
    try:
        store.init_schema(conn)
        store.write_graph(
            conn,
            concepts=[{"concept_id": 1, "label": "x", "chapter_id": "physics.optics",
                       "demand_size": 50, "paper_count": 0}],
            chapter_edges=[{"concept_id": 1, "slug": "optics", "score": 1.0, "source": "fts"}],
            cells=[{"concept_id": 1, "lane": "samadhan", "state": "gap",
                    "produced_n": 0, "base_n": 0}],
            gaps=[{"rank": 1, "concept_id": 1, "lane": "samadhan", "cell_state": "gap",
                   "demand_size": 50, "existing_corpus_n": 0, "deficit_score": 50.0,
                   "suggested_seed_ref": "textbook:optics",
                   "plan_command": "samagra factory plan textbook:optics --lane samadhan"}],
            meta={"concept_count": 1})
    finally:
        conn.close()


def test_gaps_cli_prints_ranked_plan_commands(tmp_path, monkeypatch, capsys):
    db = tmp_path / "concept_graph.db"
    _seed_graph(db)
    monkeypatch.setattr("samagra.config.CONCEPT_GRAPH_DB", db, raising=False)

    import samagra.__main__ as cli
    monkeypatch.setattr("sys.argv", ["samagra", "factory", "gaps", "--top", "5"])
    cli.main()

    out = capsys.readouterr().out
    assert "samagra factory plan textbook:optics --lane samadhan" in out
    assert "#  1" in out or "#1" in out
