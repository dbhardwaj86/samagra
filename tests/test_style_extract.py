from samagra.factory.style import extract


# A two-chapter, hand-computable corpus (list of content dicts — what
# render.load_chapter returns). No disk, no monkeypatch needed for facet math.
CORPUS = [
    {"slug": "a", "sections": [
        {"id": "s1", "title": "One", "blocks": [
            {"type": "prose", "html": "<p>Imagine you push the ball. It moves.</p>"},
            {"type": "equation", "tex": "v=\\omega R", "number": "1"},
            {"type": "callout", "variant": "key", "html": "<p>key idea</p>"},
        ], "flags": [{"kind": "clarified", "note": "n1"}]},
    ]},
    {"slug": "b", "sections": [
        {"id": "s1", "title": "Two", "blocks": [
            {"type": "prose", "html": "<p>This is generally approximate.</p>"},
            {"type": "callout", "variant": "warn", "html": "<p>careful</p>"},
        ], "flags": []},
    ]},
]


def test_voice_counts_sentences_and_rates():
    v = extract.voice(CORPUS)
    # Sentences: "Imagine you push the ball." / "It moves." / "This is generally approximate."
    assert v["n_sentences"] == 3
    # word lengths 5, 2, 4 -> mean 3.6667
    assert v["mean_sentence_len"] == 3.6667
    # all <= 10 words
    assert v["len_mix"] == {"short": 1.0, "medium": 0.0, "long": 0.0}
    # "you" in sentence 1 only -> 1/3
    assert v["second_person_rate"] == 0.3333
    # "generally" + "approximate" hedge in sentence 3 only -> 1/3
    assert v["hedge_rate"] == 0.3333
    # sentence 1 starts with "imagine" -> 1/3
    assert v["imperative_rate"] == 0.3333


def test_sequencing_bigrams_and_section_count():
    s = extract.sequencing(CORPUS)
    assert s["mean_sections_per_chapter"] == 1.0
    # chapter a bigrams: prose>equation, equation>callout ; chapter b: prose>callout
    bigrams = dict(s["top_block_bigrams"])
    assert set(bigrams) == {"prose>equation", "equation>callout", "prose>callout"}
    assert bigrams["prose>equation"] == 0.3333   # 1 of 3 transitions


def test_analogy_rate_over_prose_and_callouts():
    a = extract.analogy(CORPUS)
    # 4 prose/callout blocks; only chapter-a prose ("Imagine ...") has a marker
    assert a["n_blocks"] == 4
    assert a["analogy_block_rate"] == 0.25


def test_rigor_from_section_flags():
    r = extract.rigor(CORPUS)
    # 2 sections, 1 flag (kind "clarified")
    assert r["flags_per_section"] == 0.5
    assert r["kind_mix"] == [["clarified", 1.0]]


def test_selection_callout_variant_mix_and_density():
    s = extract.selection(CORPUS)
    # 5 blocks total: 2 prose, 1 equation, 2 callouts
    assert s["equation_density"] == 0.2
    assert s["callout_density"] == 0.4
    assert s["callout_variant_mix"] == [["key", 0.5], ["warn", 0.5]]


import json

from samagra import config


def _hermetic_corpus(tmp_path, monkeypatch):
    """Write two content.json files + a queue.json, repoint config at them."""
    chapters_dir = tmp_path / "chapters"
    for ch in CORPUS:
        d = chapters_dir / ch["slug"]
        d.mkdir(parents=True)
        (d / "content.json").write_text(json.dumps(ch), encoding="utf-8")
    queue = tmp_path / "queue.json"
    queue.write_text(json.dumps({"chapters": [{"slug": c["slug"]} for c in CORPUS]}),
                     encoding="utf-8")
    monkeypatch.setattr(config, "TEXTBOOK_CHAPTERS", chapters_dir)
    monkeypatch.setattr(config, "TEXTBOOK_QUEUE", queue)


def test_load_corpus_reads_queue_slugs_in_sorted_order(tmp_path, monkeypatch):
    _hermetic_corpus(tmp_path, monkeypatch)
    loaded = extract.load_corpus()
    assert [c["slug"] for c in loaded] == ["a", "b"]   # sorted, all present


def test_build_profile_has_all_five_facets_and_is_deterministic():
    p1 = extract.build_profile(CORPUS)
    p2 = extract.build_profile(list(reversed(CORPUS)))   # facets are corpus-wide aggregates
    assert set(p1) == {"voice", "sequencing", "analogy", "rigor", "selection"}
    # order-independent: same multiset of chapters -> identical facets
    assert p1 == p2
