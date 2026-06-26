import sqlite3
from samagra.factory.coverage import concepts


def _make_builder(path):
    con = sqlite3.connect(path)
    con.executescript(
        "CREATE TABLE concept(id INTEGER PRIMARY KEY, subject TEXT, chapter_id TEXT,"
        " label TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, built_at TEXT NOT NULL);"
        "CREATE TABLE question_concept(q_uid TEXT, concept_id INTEGER, score REAL,"
        " PRIMARY KEY(q_uid, concept_id));"
        "CREATE TABLE search_index(q_uid TEXT PRIMARY KEY, slug TEXT NOT NULL);"
    )
    con.executemany("INSERT INTO concept VALUES (?,?,?,?,?,?)", [
        (226, "physics", "physics.alternating_currents", "ac circuits", 173, "t"),
        (242, "physics", "physics.current_electricity", "kirchhoff's laws", 616, "t"),
        (999, "chemistry", "chemistry.organic_chemistry", "alkanes", 50, "t"),
    ])
    con.executemany("INSERT INTO question_concept VALUES (?,?,?)", [
        ("paperA-q01", 226, 0.5), ("paperA-q02", 226, 0.4), ("paperB-q01", 226, 0.3),
        ("paperA-q03", 242, 0.5),
    ])
    con.executemany("INSERT INTO search_index VALUES (?,?)", [
        ("paperA-q01", "paperA"), ("paperA-q02", "paperA"),
        ("paperB-q01", "paperB"), ("paperA-q03", "paperA"),
    ])
    con.commit()
    con.close()


def test_loads_physics_concepts_with_demand_and_paper_count(tmp_path):
    db = tmp_path / "builder.sqlite"
    _make_builder(db)
    rows = concepts.load_physics_concepts(db)

    assert {r["label"] for r in rows} == {"ac circuits", "kirchhoff's laws"}  # chemistry excluded
    by_id = {r["concept_id"]: r for r in rows}
    assert by_id[226]["demand_size"] == 173
    assert by_id[226]["paper_count"] == 2   # paperA + paperB
    assert by_id[226]["chapter_id"] == "physics.alternating_currents"
    assert by_id[242]["paper_count"] == 1
