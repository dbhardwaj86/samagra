from samagra import sims_manifest as sm
SAMPLE = """_482 deployed sims_
## Class 9  (57)
### Biology (15)
- 0466 — Osmosis & Plasmolysis Lab
- 0470 — Xylem & Phloem Transport
### Chemistry (11)
- 0127 — States of Matter Explorer
## Class 11  (3)
### Physics (3)
- 0020 — Vector Algebra Lab · KSS 180
"""
def test_parse_groups_and_urls():
    rows = sm.parse_deployed_sims(SAMPLE)
    assert len(rows) == 4
    bio = [r for r in rows if r["subject"] == "Biology"]
    assert {r["id"] for r in bio} == {"0466", "0470"}
    assert all(r["grade"] == "Class 9" for r in bio)
    phys = [r for r in rows if r["subject"] == "Physics"][0]
    assert phys["grade"] == "Class 11" and phys["title"].startswith("Vector Algebra")
def test_sim_url_pads():
    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"


def test_sim_url_rejects_non_conforming_ids():
    # S3 LOW-2: sim_url() previously padded ANY input, so a stray "abc"/"12345"
    # produced a malformed canonical URL silently. It now enforces a 1–4 digit id
    # (the parser-validated id space) and raises rather than emit a bad URL.
    import pytest
    for bad in ["abc", "12345", "", "1a", "-1", "  "]:
        with pytest.raises(ValueError):
            sm.sim_url(bad)
    # The valid edges still pass through (1–4 digits, zero-padded to 4).
    assert sm.sim_url("7") == "https://pratyakshsims.com/sims/SIM0007/SIM0007_sim"
    assert sm.sim_url("1234") == "https://pratyakshsims.com/sims/SIM1234/SIM1234_sim"


def test_h2_h3_disambiguation():
    # S3 LOW-3: a `## ` heading is a GRADE, a `### ` heading is a SUBJECT — the
    # extra hash must not let a subject heading be read as a grade (or vice versa).
    text = (
        "## Class 9 (2)\n"
        "### Physics (1)\n"
        "- 0001 — Newton's Cradle\n"
    )
    rows = sm.parse_deployed_sims(text)
    assert len(rows) == 1
    assert rows[0]["grade"] == "Class 9"      # from `## `, not `### `
    assert rows[0]["subject"] == "Physics"    # from `### `, not `## `


def test_trailing_count_is_stripped_from_grade_and_subject():
    # S3 LOW-3: the trailing `(NN)` count on a heading is dropped — the parsed
    # grade/subject are the bare names, even with the double-space the real
    # manifest uses before the count.
    text = (
        "## Class 11  (3)\n"
        "### Chemistry  (11)\n"
        "- 0127 — States of Matter\n"
    )
    rows = sm.parse_deployed_sims(text)
    assert rows[0]["grade"] == "Class 11"
    assert rows[0]["subject"] == "Chemistry"


def test_internal_em_dash_title_round_trips():
    # S3 LOW-3: only the FIRST `—`/`-` separates id from title; em-dashes WITHIN
    # the title are preserved verbatim (the real manifest has such titles).
    text = (
        "## Class 9 (1)\n"
        "### Physics (1)\n"
        "- 0128 — Change of State — Heating Curve\n"
    )
    rows = sm.parse_deployed_sims(text)
    assert rows[0]["title"] == "Change of State — Heating Curve"


def test_leading_italics_and_blank_lines_ignored():
    # S3 LOW-3: non-data lines (the leading `_..._` header, blank lines, stray
    # prose) produce no rows — only `- <id> — <title>` bullets do.
    text = (
        "_482 deployed sims_\n"
        "\n"
        "Some intro prose that is not a bullet.\n"
        "## Class 9 (1)\n"
        "\n"
        "### Physics (1)\n"
        "- 0001 — Newton's Cradle\n"
        "\n"
    )
    rows = sm.parse_deployed_sims(text)
    assert len(rows) == 1
    assert rows[0]["id"] == "0001"


def test_over_length_ids_are_dropped_not_misparsed():
    # S3 LOW-2 (flip side): _ITEM only matches \d{3,4}, so a 5+-digit bullet id is
    # dropped entirely (no row) rather than emitting a malformed URL. Lock this so
    # a future _ITEM widening surfaces the change rather than silently vanishing.
    text = (
        "## Class 9 (1)\n"
        "### Physics (1)\n"
        "- 12345 — Five Digit Id\n"
        "- 0001 — Valid Id\n"
    )
    rows = sm.parse_deployed_sims(text)
    assert [r["id"] for r in rows] == ["0001"]


def test_subject_resets_on_new_grade():
    # A new ## grade heading must clear the carried subject: an item that appears
    # under a grade before any ### subject heading must NOT inherit the previous
    # grade's last subject (cross-grade subject bleed).
    text = (
        "## Class 9  (1)\n"
        "### Biology (1)\n"
        "- 0466 — Osmosis & Plasmolysis Lab\n"
        "## Class 10  (1)\n"
        "- 0999 — Ungrouped sim under a fresh grade\n"
    )
    rows = sm.parse_deployed_sims(text)
    bled = [r for r in rows if r["id"] == "0999"][0]
    assert bled["grade"] == "Class 10"
    assert bled["subject"] is None
