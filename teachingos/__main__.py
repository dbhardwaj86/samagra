"""TeachingOS CLI: refresh | status | search | serve | tick | gate | export."""
from __future__ import annotations

import argparse
import sys

from . import catalog, config, state


def cmd_refresh(args) -> None:
    print(f"Refreshing TeachingOS catalog -> {config.DATA_DB}")
    totals = catalog.refresh(verbose=True)
    print(f"Done. {sum(totals.values())} artifacts across {len(totals)} sources.")


def cmd_status(args) -> None:
    ov = catalog.overview()
    print(f"Catalog refreshed_at: {ov['refreshed_at']}")
    if not ov["sources"]:
        print("  (empty — run `python -m teachingos refresh` first)")
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
    uvicorn.run("teachingos.api.app:app", host=args.host, port=args.port,
                reload=args.reload)


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

    res = notify.notify("test", "TeachingOS notification test — channels online.")
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


def main() -> None:
    p = argparse.ArgumentParser(prog="teachingos",
                                description="TeachingOS control plane")
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

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
