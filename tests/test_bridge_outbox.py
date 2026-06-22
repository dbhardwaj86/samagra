from pathlib import Path

from samagra.bridge import outbox


def test_write_outbox_file_creates_frontmatter_prompt(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    payload = {"type": "rough_idea", "raw_text": "idea about projectile motion",
               "source_ref": "munshi:9"}
    pointers = [{"source": "textbook", "uid": "tb:1", "kind": "chapter", "title": "Kinematics"}]
    rel = outbox.write_outbox_file(
        agent="khanak", assignment_id="abcd1234ef", pipeline="mycontentdev",
        seed_ref="munshi:9", expected_output="Create mycontentdev seed",
        review_by="khanak", payload=payload, pointers=pointers,
    )
    f = Path(rel)
    assert f.exists()
    text = f.read_text(encoding="utf-8")
    assert "assignee: khanak" in text
    assert "pipeline: mycontentdev" in text
    assert "samagra bridge approve abcd1234ef" in text
    assert "samagra bridge submit abcd1234ef" in text
    assert "Kinematics" in text
    assert f.parent.as_posix().endswith("board/khanak/outbox")
