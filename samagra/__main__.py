"""SAMAGRA CLI: refresh | status | search | serve | tick | gate | export | unlock."""
from __future__ import annotations

import argparse
import sys

from . import catalog, config, lock, state


def cmd_refresh(args) -> None:
    print(f"Refreshing SAMAGRA catalog -> {config.DATA_DB}")
    totals = catalog.refresh(verbose=True)
    # H3: a FAILED source maps to None (last-known-good preserved). Count only
    # successful artifacts — never sum None — and name any failed source(s).
    ok_count = sum(v for v in totals.values() if v is not None)
    failed = [s for s, v in totals.items() if v is None]
    if failed:
        print(f"Done. {ok_count} artifacts across {len(totals)} sources "
              f"({len(failed)} failed: {', '.join(failed)}). "
              "Previous catalog preserved for failed source(s).")
    else:
        print(f"Done. {ok_count} artifacts across {len(totals)} sources.")


def cmd_status(args) -> None:
    ov = catalog.overview()
    print(f"Catalog refreshed_at: {ov['refreshed_at']}")
    if not ov["sources"]:
        print("  (empty — run `python -m samagra refresh` first)")
    for s in ov["sources"]:
        flag = "OK" if s["available"] else "--"
        print(f"  [{flag}] {s['source']:12} {s['n_artifacts']:>6} artifacts  {s['summary']}")
    print("\nPipelines:")
    for st in state.all_states():
        phs = "  ".join(f"{k}:{v['status']}" for k, v in st["phases"].items())
        print(f"  {st['pipeline']:10} current={st.get('current'):8} | {phs}")


def cmd_search(args) -> None:
    rows = catalog.search(args.query or "", source=args.source,
                          kind=args.kind, limit=args.limit)
    print(f"{len(rows)} result(s)")
    for r in rows:
        print(f"  [{r['source']}/{r['kind']}] {r['title']}  "
              f"({r.get('subject') or '-'})")


def cmd_serve(args) -> None:
    try:
        import uvicorn
    except ImportError:
        print("Portal needs deps. Run: pip install -r requirements.txt")
        sys.exit(1)
    reload = args.reload
    # D-1 gotcha: an orphaned --reload worker once held the port. Guard the flag —
    # ignore it (loud warning) unless the operator explicitly opts in.
    if reload and not config._env_bool("SAMAGRA_ALLOW_RELOAD", False):
        print("WARNING: --reload is disabled (D-1 orphaned-worker gotcha — a reload "
              "worker once held the port). Set SAMAGRA_ALLOW_RELOAD=1 to override.")
        reload = False
    uvicorn.run("samagra.api.app:app", host=args.host, port=args.port,
                reload=reload)


def cmd_tick(args) -> None:
    from . import scheduler

    res = scheduler.tick(dry_run=args.dry_run)
    if res.get("skipped"):
        print(f"skipped: {res['skipped']}")
        return
    print(f"tick ({'dry-run' if res['dry_run'] else 'live'}):")
    for line in res["log"]:
        print(f"  {line}")


def cmd_gate(args) -> None:
    from . import scheduler

    print(scheduler.gate(args.pipeline, args.decision))


def cmd_notify_test(args) -> None:
    from . import notify

    res = notify.notify("test", "SAMAGRA notification test — channels online.")
    print(res["logged"])
    for ch, (ok, msg) in res["results"].items():
        print(f"  {ch:9} {'OK' if ok else '--'}  {msg}")


def cmd_schedule_install(args) -> None:
    from . import scheduler

    ok, out = scheduler.install_task(args.cadence)
    print(("installed" if ok else "FAILED") + f" ({scheduler.TASK_NAME}, {args.cadence})")
    print(out)


def cmd_export(args) -> None:
    from .lectures import export as lex

    lex.run(args.chapter, args.variant)


def cmd_review_staged(args) -> None:
    from .review.precommit import review_staged_diff

    sys.exit(review_staged_diff())


def cmd_unlock(args) -> None:
    """Manually clear SAMAGRA's OWN locks left behind by a crashed run.

    Removes ``.scheduler.lock`` and ``.state.lock`` under ``config.STATE_DIR``.
    Does NOT touch the foreign physics-textbook ``TEXTBOOK_LOCK`` — that belongs
    to another system. Acquisition has no auto-reclaim, so this is the supported
    recovery path when a crashed job leaves its lock present.
    """
    removed = []
    for name in (".scheduler.lock", ".state.lock"):
        if lock.clear(config.STATE_DIR / name):
            removed.append(name)
    if removed:
        print("removed SAMAGRA lock(s): " + ", ".join(removed))
    else:
        print("no SAMAGRA locks present")


def cmd_bridge(args) -> None:
    from .bridge import run

    if args.action == "scan":
        proposals = run.scan(dry=args.dry_run)
        mode = "dry-run" if args.dry_run else "live"
        print(f"bridge scan ({mode}): {len(proposals)} content proposal(s)")
        for p in proposals:
            aid = p.get("assignment_id", "-")
            tag = " (reused)" if p.get("reused") else ""
            print(f"  [{aid}] {p['item']['uid']} -> {p['payload']['type']}  "
                  f"({len(p['pointers'])} pointer(s)){tag}")
    elif args.action == "approve":
        res = run.approve(args.assignment_id)
        print(f"approved {args.assignment_id} -> {res['status']}")
    elif args.action == "submit":
        res = run.submit(args.assignment_id)
        seed = res.get("seed") or {}
        print(f"submitted {args.assignment_id} -> seed {seed.get('id')} "
              f"({seed.get('status')})")


def main() -> None:
    p = argparse.ArgumentParser(prog="samagra",
                                description="SAMAGRA control plane")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("refresh", help="rebuild the unified catalog").set_defaults(
        func=cmd_refresh)
    sub.add_parser("status", help="source summaries + pipeline states").set_defaults(
        func=cmd_status)

    s = sub.add_parser("search", help="search the catalog")
    s.add_argument("query", nargs="?", default="")
    s.add_argument("--source")
    s.add_argument("--kind")
    s.add_argument("--limit", type=int, default=25)
    s.set_defaults(func=cmd_search)

    sv = sub.add_parser("serve", help="run the portal")
    sv.add_argument("--host", default=config.HOST)
    sv.add_argument("--port", type=int, default=config.PORT)
    sv.add_argument("--reload", action="store_true")
    sv.set_defaults(func=cmd_serve)

    tk = sub.add_parser("tick", help="run one scheduler tick")
    tk.add_argument("--dry-run", action="store_true")
    tk.set_defaults(func=cmd_tick)

    g = sub.add_parser("gate", help="approve/reject a pipeline's hard gate")
    g.add_argument("pipeline")
    g.add_argument("decision", choices=["approve", "reject"])
    g.set_defaults(func=cmd_gate)

    sub.add_parser("notify-test", help="send a test notification").set_defaults(
        func=cmd_notify_test)

    si = sub.add_parser("schedule-install", help="register the Windows Task Scheduler tick")
    si.add_argument("--cadence", default="HOURLY")
    si.set_defaults(func=cmd_schedule_install)

    e = sub.add_parser("export", help="export a lecture (Phase C)")
    e.add_argument("--chapter", required=True)
    e.add_argument("--variant", choices=["thin", "thick", "both"], default="both")
    e.set_defaults(func=cmd_export)

    sub.add_parser("unlock",
                   help="clear SAMAGRA's own scheduler/state locks (crashed run)"
                   ).set_defaults(func=cmd_unlock)

    sub.add_parser(
        "review-staged",
        help="advisory Codex review over the staged diff (0=allow, 1=confirmed-CRITICAL)",
    ).set_defaults(func=cmd_review_staged)

    br = sub.add_parser("bridge", help="active loop: scan munshi / approve / submit")
    br_sub = br.add_subparsers(dest="action", required=True)
    br_scan = br_sub.add_parser("scan", help="propose seeds from munshi items")
    br_scan.add_argument("--dry-run", action="store_true",
                         help="propose only; record no assignments")
    br_approve = br_sub.add_parser("approve", help="approve an in-review proposal")
    br_approve.add_argument("assignment_id")
    br_submit = br_sub.add_parser("submit",
                                  help="create a seed for an APPROVED assignment")
    br_submit.add_argument("assignment_id")
    br.set_defaults(func=cmd_bridge)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
