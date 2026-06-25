"""The factory `plan --lane` CLI arg (Phase D2) — the opt-in samadhan lane is only
reachable by naming it explicitly."""
from __future__ import annotations


def test_factory_plan_accepts_lane_arg():
    from samagra.__main__ import build_parser
    args = build_parser().parse_args(
        ["factory", "plan", "textbook:circular-motion", "--lane", "samadhan", "--dry-run"])
    assert args.lane == "samadhan" and args.seed_ref == "textbook:circular-motion"


def test_factory_plan_lane_defaults_to_none():
    from samagra.__main__ import build_parser
    args = build_parser().parse_args(["factory", "plan", "textbook:circular-motion"])
    assert args.lane is None
