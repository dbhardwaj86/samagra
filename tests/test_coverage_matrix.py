from samagra.factory.coverage import matrix


def test_cells_are_3_state_per_lane():
    concepts = [{"concept_id": 1, "label": "x", "chapter_id": "physics.optics",
                 "demand_size": 100, "paper_count": 7}]
    chapter_edges = [{"concept_id": 1, "slug": "optics", "score": 1.0, "source": "fts"}]
    produced = {(1, "deck"): 1}   # a captured factory deck

    cells = matrix.build_cells(concepts, chapter_edges, produced)
    by_lane = {c["lane"]: c for c in cells}

    assert set(by_lane) == set(matrix.COVERAGE_LANES)
    assert by_lane["deck"]["state"] == "produced"            # factory artifact
    assert by_lane["lecture"]["state"] == "base"             # chapter edge, not produced
    assert by_lane["lecture"]["base_n"] == 1
    assert by_lane["paper"]["state"] == "base"               # paper_count > 0
    assert by_lane["paper"]["base_n"] == 7
    assert by_lane["samadhan"]["state"] == "gap"             # no source equivalent
    assert by_lane["samadhan"]["base_n"] == 0


def test_no_chapter_edge_makes_chapter_lanes_a_gap():
    concepts = [{"concept_id": 5, "label": "y", "chapter_id": "physics.misc",
                 "demand_size": 10, "paper_count": 0}]
    cells = matrix.build_cells(concepts, chapter_edges=[], produced={})
    by_lane = {c["lane"]: c for c in cells}
    assert by_lane["lecture"]["state"] == "gap"
    assert by_lane["paper"]["state"] == "gap"
