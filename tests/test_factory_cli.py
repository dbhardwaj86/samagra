import samagra.__main__ as cli


def test_factory_plan_dispatches(monkeypatch, capsys):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.plan",
                        lambda seed_ref, dry: seen.update(plan=(seed_ref, dry)) or [])
    monkeypatch.setattr("sys.argv",
                        ["samagra", "factory", "plan", "textbook:circular-motion", "--dry-run"])
    cli.main()
    assert seen["plan"] == ("textbook:circular-motion", True)


def test_factory_approve_seed_dispatches(monkeypatch):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.approve_seed",
                        lambda seed_ref: seen.update(ref=seed_ref) or {"approved": []})
    monkeypatch.setattr("sys.argv",
                        ["samagra", "factory", "approve-seed", "textbook:circular-motion"])
    cli.main()
    assert seen["ref"] == "textbook:circular-motion"


def test_factory_build_dispatches(monkeypatch):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.build",
                        lambda aid: seen.update(aid=aid) or {"artifact_ref": "x", "line": "revision"})
    monkeypatch.setattr("sys.argv", ["samagra", "factory", "build", "abc123"])
    cli.main()
    assert seen["aid"] == "abc123"
