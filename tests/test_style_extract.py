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
