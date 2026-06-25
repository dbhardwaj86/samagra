from samagra.factory import run


def test_plan_lane_samadhan_proposes_only_that_lane(monkeypatch):
    props = run.plan("textbook:circular-motion", dry=True, lane="samadhan")
    assert [p["line"] for p in props] == ["samadhan"]


def test_plan_lane_rejects_mismatched_prefix():
    import pytest
    with pytest.raises(ValueError):
        run.plan("munshi:5", dry=True, lane="samadhan")


def test_plan_without_lane_is_unchanged(monkeypatch):
    props = run.plan("textbook:circular-motion", dry=True)
    assert "samadhan" not in [p["line"] for p in props]
