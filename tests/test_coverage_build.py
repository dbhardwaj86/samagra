import sqlite3
from samagra.factory import coverage
from samagra.factory.coverage import store


def _builder(path):
    con = sqlite3.connect(path)
    con.executescript(
        "CREATE TABLE concept(id INTEGER PRIMARY KEY, subject TEXT, chapter_id TEXT,"
        " label TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, built_at TEXT NOT NULL);"
        "CREATE TABLE question_concept(q_uid TEXT, concept_id INTEGER, score REAL,"
        " PRIMARY KEY(q_uid, concept_id));"
        "CREATE TABLE search_index(q_uid TEXT PRIMARY KEY, slug TEXT NOT NULL);")
    con.executemany("INSERT INTO concept VALUES (?,?,?,?,?,?)", [
        (1, "physics", "physics.laws_of_motion", "circular motion", 100, "t"),
        (2, "physics", "physics.laws_of_motion", "newton's laws", 200, "t")])
    con.executemany("INSERT INTO question_concept VALUES (?,?,?)",
                    [("pA-q1", 1, 0.5), ("pB-q1", 1, 0.5)])
    con.executemany("INSERT INTO search_index VALUES (?,?)",
                    [("pA-q1", "pA"), ("pB-q1", "pB")])
    con.commit(); con.close()


def test_full_build_writes_a_queryable_graph(tmp_path):
    qx = tmp_path / "builder.sqlite"; _builder(qx)
    graph = tmp_path / "concept_graph.db"
    aliases = tmp_path / "concept_aliases.json"
    aliases.write_text('{"version":1,"by_chapter":'
                       '{"lom-and-pseudo-force":{"add":["newton\'s laws"],"remove":[]}}}',
                       encoding="utf-8")
    chapters = [
        {"slug": "circular-motion", "title": "Circular Motion",
         "sections": [{"title": "uniform circular motion", "blocks": [
             {"type": "prose", "html": "<p>circular motion centripetal</p>"}]}]},
        {"slug": "lom-and-pseudo-force", "title": "Laws of Motion",
         "sections": [{"title": "pseudo force", "blocks": [
             {"type": "prose", "html": "<p>free body diagrams</p>"}]}]},
    ]
    assignments = [{"pipeline": "deck", "seed_ref": "textbook:circular-motion",
                    "status": "captured"}]

    summary = coverage.build_concept_graph(
        qx_db=qx, graph_db=graph, aliases_path=aliases,
        chapters=chapters, assignments=assignments)

    assert summary["concepts"] == 2
    assert summary["gaps"] > 0

    conn = store.connect_ro(graph)
    try:
        payload = store.coverage_payload(conn)
    finally:
        conn.close()
    cell = {(c["concept_id"], c["lane"]): c for c in payload["cells"]}
    assert cell[(1, "deck")]["state"] == "produced"
    assert cell[(2, "lecture")]["state"] == "base"   # overlay edge -> chapter base
    assert payload["gaps"][0]["plan_command"].startswith("samagra factory plan textbook:")


def _builder_with_orphan(path):
    con = sqlite3.connect(path)
    con.executescript(
        "CREATE TABLE concept(id INTEGER PRIMARY KEY, subject TEXT, chapter_id TEXT,"
        " label TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, built_at TEXT NOT NULL);"
        "CREATE TABLE question_concept(q_uid TEXT, concept_id INTEGER, score REAL,"
        " PRIMARY KEY(q_uid, concept_id));"
        "CREATE TABLE search_index(q_uid TEXT PRIMARY KEY, slug TEXT NOT NULL);")
    con.executemany("INSERT INTO concept VALUES (?,?,?,?,?,?)", [
        (1, "physics", "physics.optics", "wave optics", 100, "t"),
        (7, "physics", "physics.semiconductors", "transistors", 49, "t")])  # no chapter/overlay
    con.commit(); con.close()


def test_build_summary_lists_skipped_concepts_by_name(tmp_path):
    qx = tmp_path / "builder.sqlite"; _builder_with_orphan(qx)
    graph = tmp_path / "concept_graph.db"
    aliases = tmp_path / "concept_aliases.json"
    aliases.write_text('{"version":1,"by_chapter":{}}', encoding="utf-8")
    chapters = [{"slug": "wave-optics", "title": "Wave Optics",
                 "sections": [{"title": "interference", "blocks": [
                     {"type": "prose", "html": "<p>wave optics interference</p>"}]}]}]

    summary = coverage.build_concept_graph(
        qx_db=qx, graph_db=graph, aliases_path=aliases,
        chapters=chapters, assignments=[])

    assert summary["skipped_no_pointer"] == 1
    skipped = {s["label"]: s for s in summary["skipped_concepts"]}
    assert "transistors" in skipped                # surfaced BY NAME, not just a count
    assert skipped["transistors"]["demand_size"] == 49
    assert "wave optics" not in skipped            # it has a chapter pointer


def test_build_stamps_provenance_hashes_but_no_built_at(tmp_path):
    qx = tmp_path / "builder.sqlite"; _builder(qx)
    graph = tmp_path / "concept_graph.db"
    aliases = tmp_path / "concept_aliases.json"
    aliases.write_text('{"version":1,"by_chapter":{}}', encoding="utf-8")
    chapters = [{"slug": "circular-motion", "title": "Circular Motion", "sections": []}]

    coverage.build_concept_graph(qx_db=qx, graph_db=graph, aliases_path=aliases,
                                 chapters=chapters, assignments=[])

    conn = store.connect_ro(graph)
    try:
        meta = store.coverage_payload(conn)["meta"]
    finally:
        conn.close()
    assert len(meta["qx_builder_sha"]) == 64       # staleness signal: QX grows
    assert len(meta["aliases_sha"]) == 64          # staleness signal: overlay edits
    assert "builder_version" in meta
    assert "built_at" not in meta                  # excluded -> rebuilds stay byte-idempotent
