"""Semi-autonomous scheduler.

A tick: take the scheduler lock (no concurrent ticks), refresh the catalog, reflect
the real physics-textbook state into the `textbook` pipeline, raise the `approve`
hard gate (pause + notify) when drafting/enriching is complete, and export any
chapters that have been approved through TeachingOS. Hard gates never auto-advance.

TeachingOS is scheduler-of-record but coexists with physics-textbook's own 2h
automations by honoring its `.routine.lock`.
"""
from __future__ import annotations

import json
import subprocess
import time
from contextlib import nullcontext

from . import catalog, config, notify, state
from .lock import LockBusy, file_lock, is_busy

EXPORT_BATCH = 3  # chapters exported per tick once approved (bounded)
TASK_NAME = "TeachingOS-tick"


def _sched_lock():
    return config.STATE_DIR / ".scheduler.lock"


def _stamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _textbook_counts() -> dict:
    if not config.TEXTBOOK_QUEUE.exists():
        return {"total": 0, "drafted": 0, "enriched": 0, "approved": 0, "chapters": []}
    q = json.loads(config.TEXTBOOK_QUEUE.read_text(encoding="utf-8"))
    ch = q.get("chapters", [])
    done_states = {"drafted", "in-review", "approved", "enriched"}
    return {
        "total": len(ch),
        "drafted": sum(1 for c in ch if c.get("status") in done_states),
        "enriched": sum(1 for c in ch if c.get("enriched_at")),
        "approved": sum(1 for c in ch if c.get("status") == "approved"),
        "chapters": ch,
    }


def _reflect_textbook(dry: bool, events: list) -> dict:
    c = _textbook_counts()
    st = state.load("textbook")
    if c["total"] and c["drafted"] >= c["total"] and st["phases"]["draft"]["status"] != "done":
        if not dry:
            state.set_phase("textbook", "draft", "done",
                            artifacts=[f'{c["drafted"]}/{c["total"]} drafted'])
    if c["total"] and c["enriched"] >= c["total"] and st["phases"]["enrich"]["status"] != "done":
        if not dry:
            state.set_phase("textbook", "enrich", "done",
                            artifacts=[f'{c["enriched"]}/{c["total"]} enriched'])
    st = state.load("textbook")
    ready = (st["phases"]["draft"]["status"] == "done"
             and st["phases"]["enrich"]["status"] == "done")
    if ready and st["phases"]["approve"]["status"] == "pending":
        if not dry:
            state.set_phase("textbook", "approve", "awaiting_gate")
        events.append(("gate-ready",
                       f'textbook: "approve" gate ready — {c["drafted"]}/{c["total"]} '
                       "chapters drafted+enriched, awaiting approval."))
    return c


def _run_pending_exports(dry: bool, counts: dict, events: list) -> int:
    st = state.load("textbook")
    if st["phases"]["approve"]["status"] != "done":
        return 0  # not approved yet
    if st["phases"]["export"]["status"] == "done":
        return 0
    from .lectures import export as lex

    pending = []
    for c in counts["chapters"]:
        slug = c.get("slug")
        out = config.EXPORT_DIR / slug / f"{slug}-thick.html"
        if slug and not out.exists():
            pending.append(slug)
    if not pending:
        if not dry:
            state.set_phase("textbook", "export", "done",
                            artifacts=[f'{counts["total"]} chapters exported'])
        return 0
    batch = pending[:EXPORT_BATCH]
    if dry:
        events.append(("export", f"would export {len(batch)} chapter(s): {', '.join(batch)}"))
        return len(batch)
    for slug in batch:
        try:
            lex.run(slug, "both")
        except Exception as e:  # noqa: BLE001
            state.set_phase("textbook", "export", "failed", error=str(e))
            events.append(("failure", f"textbook export failed for {slug}: {e}"))
            return 0
    remaining = len(pending) - len(batch)
    events.append(("export", f"exported {len(batch)} chapter(s); {remaining} remaining"))
    if remaining == 0:
        state.set_phase("textbook", "export", "done",
                        artifacts=[f'{counts["total"]} chapters exported'])
    return len(batch)


def tick(dry_run: bool = False) -> dict:
    if is_busy(_sched_lock()):
        return {"skipped": "scheduler lock busy"}
    events: list = []
    log: list = []
    try:
        ctx = nullcontext() if dry_run else file_lock(_sched_lock())
        with ctx:
            totals = {} if dry_run else catalog.refresh(verbose=False)
            log.append(f"catalog: {('dry' if dry_run else sum(totals.values()))} artifacts")
            counts = _reflect_textbook(dry_run, events)
            log.append(f'textbook: {counts["drafted"]}/{counts["total"]} drafted, '
                       f'{counts["approved"]} approved')
            n = _run_pending_exports(dry_run, counts, events)
            log.append(f"exports this tick: {n}")
            if is_busy(config.TEXTBOOK_LOCK):
                log.append("note: physics-textbook routine lock active — coexisting")
    except LockBusy:
        return {"skipped": "lock busy"}
    for ev, msg in events:
        if not dry_run:
            notify.notify(ev, msg)
        log.append(f"NOTIFY[{ev}] {msg}")
    return {"dry_run": dry_run, "log": log, "events": [e for e, _ in events]}


def gate(pipeline: str, decision: str) -> dict:
    st = state.load(pipeline)
    gates = [n for n, p in st["phases"].items() if p.get("gate")]
    target = next((n for n in gates
                   if st["phases"][n]["status"] in ("awaiting_gate", "pending")),
                  gates[0] if gates else None)
    if not target:
        return {"error": f"{pipeline} has no gate"}
    if decision == "approve":
        state.set_phase(pipeline, target, "done", approved_at=_stamp())
        notify.notify("gate-approved", f'{pipeline}: "{target}" approved.')
    elif decision == "reject":
        state.set_phase(pipeline, target, "blocked")
        notify.notify("gate-rejected", f'{pipeline}: "{target}" rejected.')
    else:
        return {"error": f"unknown decision {decision!r}"}
    return {"pipeline": pipeline, "gate": target, "decision": decision}


# -- Windows Task Scheduler integration ---------------------------------
def install_task(cadence: str = "HOURLY") -> tuple[bool, str]:
    cmd_file = config.REPO_ROOT / "scripts" / "tos_tick.cmd"
    args = ["schtasks", "/Create", "/TN", TASK_NAME,
            "/TR", f'"{cmd_file}"', "/SC", cadence, "/F"]
    proc = subprocess.run(args, capture_output=True, text=True)
    return proc.returncode == 0, (proc.stdout + proc.stderr).strip()


def task_status() -> str | None:
    proc = subprocess.run(["schtasks", "/Query", "/TN", TASK_NAME, "/FO", "LIST"],
                          capture_output=True, text=True)
    return proc.stdout.strip() if proc.returncode == 0 else None
