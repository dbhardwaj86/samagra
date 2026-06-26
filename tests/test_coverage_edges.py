from samagra.factory.coverage import edges


def test_chapter_text_concatenates_title_sections_prose():
    chapter = {
        "title": "Circular Motion",
        "sections": [
            {"title": "Centripetal acceleration", "blocks": [
                {"type": "prose", "html": "<p>The body moves in a <b>circle</b>.</p>"},
                {"type": "equation", "html": "$$a=v^2/r$$"},
                {"type": "callout", "variant": "note", "html": "<p>Key idea here.</p>"},
            ]},
        ],
    }
    text = edges.chapter_text(chapter)
    assert "Circular Motion" in text
    assert "Centripetal acceleration" in text
    assert "The body moves in a circle." in text   # html stripped
    assert "Key idea here." in text                 # callout included
    assert "<p>" not in text                         # tags gone


CHAPTER_TEXTS = {
    "circular-motion": "Circular Motion centripetal acceleration uniform circular motion",
    "gauss-law": "Gauss Law electric flux through a closed surface",
    "lom-and-pseudo-force": "Pseudo forces in non inertial frames and free body diagrams",
}
CONCEPTS = [
    {"concept_id": 1, "label": "circular motion"},
    {"concept_id": 2, "label": "gauss's law"},
    {"concept_id": 3, "label": "newton's laws"},   # NOT in any chapter text -> needs overlay
]


def test_fts_edges_match_obvious_chapters():
    e = edges.build_chapter_concept_edges(CHAPTER_TEXTS, CONCEPTS)
    pairs = {(x["concept_id"], x["slug"]) for x in e}
    assert (1, "circular-motion") in pairs
    assert (2, "gauss-law") in pairs
    assert all(x["source"] == "fts" for x in e)
    assert (3, "lom-and-pseudo-force") not in pairs   # 'newton's laws' not in the text


def test_or_fallback_when_and_prefix_finds_nothing():
    # 'centripetal' is only in circular-motion, 'surface' only in gauss-law: the
    # AND-prefix co-location requirement fails, so the OR-prefix fallback rescues a
    # best-effort pointer to BOTH chapters (marked 'fts-or', a weaker-confidence edge).
    concepts = [{"concept_id": 4, "label": "centripetal surface"}]
    e = edges.build_chapter_concept_edges(CHAPTER_TEXTS, concepts)
    assert {x["slug"] for x in e} == {"circular-motion", "gauss-law"}
    assert all(x["source"] == "fts-or" for x in e)


def test_and_prefix_is_preferred_over_or_fallback():
    # both tokens co-locate in circular-motion -> AND wins, source stays 'fts',
    # the OR fallback never runs (so unrelated chapters are NOT pulled in).
    concepts = [{"concept_id": 1, "label": "circular motion"}]
    e = edges.build_chapter_concept_edges(CHAPTER_TEXTS, concepts)
    assert {x["slug"] for x in e} == {"circular-motion"}
    assert all(x["source"] == "fts" for x in e)


def test_overlay_adds_and_removes_edges():
    base = edges.build_chapter_concept_edges(CHAPTER_TEXTS, CONCEPTS)
    resolved = {
        "lom-and-pseudo-force": {"add": {3}, "remove": set()},
        "circular-motion": {"add": set(), "remove": {1}},
    }
    merged = edges.apply_overlay(base, resolved)
    pairs = {(x["concept_id"], x["slug"]) for x in merged}
    assert (3, "lom-and-pseudo-force") in pairs                      # added
    assert next(x for x in merged if x["concept_id"] == 3)["source"] == "overlay-add"
    assert (1, "circular-motion") not in pairs                       # removed


def test_best_chapter_picks_highest_score():
    edges_in = [
        {"concept_id": 1, "slug": "a", "score": 1.0, "source": "fts"},
        {"concept_id": 1, "slug": "b", "score": 5.0, "source": "fts"},
    ]
    assert edges.best_chapter_by_concept(edges_in) == {1: "b"}


def test_factory_produced_counts_from_captured_assignments():
    chapter_edges = [
        {"concept_id": 1, "slug": "circular-motion", "score": 1.0, "source": "fts"},
        {"concept_id": 9, "slug": "circular-motion", "score": 1.0, "source": "fts"},
    ]
    assignments = [
        {"pipeline": "deck", "seed_ref": "textbook:circular-motion", "status": "captured"},
        {"pipeline": "deck", "seed_ref": "textbook:circular-motion", "status": "in-review"},  # not captured
        {"pipeline": "paper", "seed_ref": "munshi:52", "status": "captured"},                  # not textbook
        {"pipeline": "drill", "seed_ref": "textbook:gauss-law", "status": "captured"},         # no edge
    ]
    produced = edges.factory_produced_counts(assignments, chapter_edges)
    assert produced[(1, "deck")] == 1   # concept 1 + concept 9 both inherit the captured deck
    assert produced[(9, "deck")] == 1
    assert (1, "paper") not in produced
