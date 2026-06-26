from samagra.factory.coverage import gaps


def test_rank_is_deficit_weighted_and_pointer_preloaded():
    concepts = [
        {"concept_id": 1, "label": "hot", "demand_size": 1000, "paper_count": 0},
        {"concept_id": 2, "label": "saturated", "demand_size": 1000, "paper_count": 99},
    ]
    cells = [
        # concept 1: a true samadhan gap, demand 1000, denom 0 -> deficit 1000
        {"concept_id": 1, "lane": "samadhan", "state": "gap", "produced_n": 0, "base_n": 0},
        # concept 2: a paper base cell, demand 1000, denom 99 -> deficit 10
        {"concept_id": 2, "lane": "paper", "state": "base", "produced_n": 0, "base_n": 99},
        # produced cells are NOT queued
        {"concept_id": 1, "lane": "deck", "state": "produced", "produced_n": 1, "base_n": 1},
    ]
    best_chapter = {1: "thermodynamics", 2: "optics"}

    ranked = gaps.rank_gaps(cells, concepts, best_chapter)

    assert [g["rank"] for g in ranked] == [1, 2]
    assert ranked[0]["concept_id"] == 1                       # higher deficit first
    assert ranked[0]["deficit_score"] == 1000.0
    assert ranked[0]["cell_state"] == "gap"
    assert ranked[0]["suggested_seed_ref"] == "textbook:thermodynamics"
    assert ranked[0]["plan_command"] == \
        "samagra factory plan textbook:thermodynamics --lane samadhan"
    assert ranked[1]["deficit_score"] == 10.0
    assert all(g["lane"] != "deck" for g in ranked)           # produced excluded


def test_concept_without_a_chapter_pointer_is_skipped():
    concepts = [{"concept_id": 7, "label": "z", "demand_size": 5, "paper_count": 0}]
    cells = [{"concept_id": 7, "lane": "samadhan", "state": "gap", "produced_n": 0, "base_n": 0}]
    assert gaps.rank_gaps(cells, concepts, best_chapter={}) == []
