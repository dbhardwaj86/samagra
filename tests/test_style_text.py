from samagra.factory.style import text as T


def test_strip_html_removes_tags_and_collapses_whitespace():
    assert T.strip_html("<p>Hello   <b>world</b>.</p>") == "Hello world."
    assert T.strip_html("<p>a&amp;b</p>") == "a&b"        # entities unescaped
    assert T.strip_html("") == ""
    assert T.strip_html(None) == ""


def test_sentences_splits_on_terminal_punctuation():
    assert T.sentences("Imagine you push the ball. It moves.") == [
        "Imagine you push the ball.", "It moves."]
    assert T.sentences("No terminal punctuation") == ["No terminal punctuation"]
    assert T.sentences("") == []


def test_words_lowercases_and_keeps_apostrophes():
    assert T.words("Let's GO, now!") == ["let's", "go", "now"]


def test_marker_vocabularies_are_frozen_sets():
    # closed sets → deterministic membership tests, no accidental mutation
    for vocab in (T.SECOND_PERSON, T.HEDGES, T.IMPERATIVE_STARTERS, T.ANALOGY_MARKERS):
        assert isinstance(vocab, frozenset) and vocab
    assert "you" in T.SECOND_PERSON
    assert "imagine" in T.IMPERATIVE_STARTERS
    assert all(" " not in m or m == m.lower() for m in T.ANALOGY_MARKERS)
