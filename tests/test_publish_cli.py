# tests/test_publish_cli.py
import pytest
from samagra import config, __main__ as cli
from samagra.governance import store
from samagra.factory import run as factory


@pytest.fixture
def publish_env(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    store._INITIALIZED.clear()
    store.ensure_tables()
    monkeypatch.chdir(tmp_path)
    yield tmp_path
    store._INITIALIZED.clear()


def test_parser_wires_publish_subcommands():
    p = cli.build_parser()
    ns = p.parse_args(["factory", "publish", "circular-motion", "--lanes", "revision"])
    assert ns.action == "publish" and ns.chapter == "circular-motion" and ns.lanes == "revision"
    ns2 = p.parse_args(["factory", "published"])
    assert ns2.action == "published"
    ns3 = p.parse_args(["factory", "unpublish", "circular-motion"])
    assert ns3.action == "unpublish" and ns3.lanes is None


def test_cli_publish_then_published_prints(publish_env, monkeypatch, capsys):
    def fake_export_one(slug, variant, **kw):
        out = publish_env / f"{slug}-{variant}.html"
        out.write_text(f"<h1>{slug} {variant}</h1>", encoding="utf-8")
        return {"variant": variant, "html": str(out), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)
    rev = next(p for p in factory.plan("textbook:circular-motion", dry=False)
               if p["line"] == "revision")
    factory.approve(rev["assignment_id"]); factory.build(rev["assignment_id"])

    p = cli.build_parser()
    cli.cmd_factory(p.parse_args(["factory", "publish", "circular-motion", "--lanes", "revision"]))
    cli.cmd_factory(p.parse_args(["factory", "published"]))
    out = capsys.readouterr().out
    assert "factory publish: circular-motion" in out
    assert "circular-motion: revision" in out
