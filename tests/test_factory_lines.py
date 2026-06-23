from samagra.factory import lines

def test_textbook_seed_fans_to_revision_and_lecture():
    assert lines.classify("textbook:circular-motion") == ["revision", "lecture"]

def test_unknown_source_fans_to_nothing_in_phase1():
    assert lines.classify("mcd:123") == []
    assert lines.classify("") == []

def test_registry_has_expected_output_labels():
    assert lines.LINES["revision"].expected_output
    assert lines.LINES["lecture"].expected_output
    assert set(lines.LINES) == {"revision", "lecture"}
