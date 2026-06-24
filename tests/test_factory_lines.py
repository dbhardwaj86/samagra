from samagra.factory import lines


def test_textbook_seed_fans_to_five_content_lanes():
    assert lines.classify("textbook:circular-motion") == [
        "revision", "lecture", "deck", "paper", "drill"]


def test_unknown_source_fans_to_nothing():
    assert lines.classify("mcd:123") == []
    assert lines.classify("") == []


def test_registry_has_expected_output_labels():
    for key in ("revision", "lecture", "deck", "paper", "drill"):
        assert lines.LINES[key].expected_output
    assert set(lines.LINES) == {"revision", "lecture", "deck", "paper", "drill"}


def test_deck_line_is_local_kind_and_textbook_sourced():
    deck = lines.LINES["deck"]
    assert deck.kind == "local"
    assert deck.source_prefixes == ("textbook:",)


def test_existing_lanes_default_to_local_kind():
    assert lines.LINES["revision"].kind == "local"
    assert lines.LINES["lecture"].kind == "local"


def test_paper_and_drill_are_qx_kind_and_textbook_sourced():
    for key in ("paper", "drill"):
        ln = lines.LINES[key]
        assert ln.kind == "qx"
        assert ln.source_prefixes == ("textbook:",)
        assert ln.variant == key      # the engine reads variant to size paper vs drill
