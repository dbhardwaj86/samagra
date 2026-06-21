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
