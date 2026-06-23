from samagra.factory import lines


def test_textbook_seed_fans_to_revision_lecture_and_deck():
    assert lines.classify("textbook:circular-motion") == ["revision", "lecture", "deck"]


def test_unknown_source_fans_to_nothing():
    assert lines.classify("mcd:123") == []
    assert lines.classify("") == []


def test_registry_has_expected_output_labels():
    assert lines.LINES["revision"].expected_output
    assert lines.LINES["lecture"].expected_output
    assert lines.LINES["deck"].expected_output
    assert set(lines.LINES) == {"revision", "lecture", "deck"}


def test_deck_line_is_local_kind_and_textbook_sourced():
    deck = lines.LINES["deck"]
    assert deck.kind == "local"
    assert deck.source_prefixes == ("textbook:",)


def test_existing_lanes_default_to_local_kind():
    assert lines.LINES["revision"].kind == "local"
    assert lines.LINES["lecture"].kind == "local"
