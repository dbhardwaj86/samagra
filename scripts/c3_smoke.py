"""C3 live golden thread: one munshi content item -> exactly one mcd seed via the
factory seed lane, in an ISOLATED temp governance store (durable governance.db
untouched). The seed write hits REAL prod mycontentdev (owner-initiated capture,
the existing contract) — the created seed id is printed for owner cleanup.
Run: python scripts/c3_smoke.py            # scans munshi, builds the FIRST content seed
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from samagra import config                  # noqa: E402
from samagra.governance import store        # noqa: E402

tmp = Path(tempfile.mkdtemp(prefix="c3-smoke-"))
durable = config.GOVERNANCE_DB
durable_before = durable.stat().st_mtime_ns if durable.exists() else None

config.GOVERNANCE_DB = tmp / "governance.db"
config.DATA_DB = tmp / "samagra.db"
config.EXPORT_DIR = tmp / "exports"
store._INITIALIZED.clear()
store.ensure_tables()
os.chdir(tmp)

from samagra.factory import run             # noqa: E402

proposals = run.scan(dry=False)
print(f"[smoke] factory scan: {len(proposals)} content seed proposal(s)")
if not proposals:
    print("[smoke] SKIP -- no content-classified munshi item to seed (munshi empty/down).")
    raise SystemExit(0)
aid = proposals[0]["assignment_id"]
print(f"[smoke] building seed assignment {aid} (seed_ref={proposals[0]['seed_ref']})")
run.approve(aid)
res = run.build(aid)
assert res["artifact_ref"].startswith("mcd:"), res
seed_id = res["artifact_ref"].split(":", 1)[1]

conn = store.connect()
try:
    row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
    created = [e for e in store.list_events_for_assignment(conn, aid)
               if e["verb"] == "product_created"]
finally:
    conn.close()
assert row["status"] == "captured", row
assert len(created) == 1, created
durable_after = durable.stat().st_mtime_ns if durable.exists() else None
assert durable_before == durable_after, "DURABLE governance.db WAS TOUCHED!"

print(f"[smoke] OK -> {res['artifact_ref']} . assignment captured . one product_created")
print("[smoke] durable governance.db untouched (mtime unchanged)")
print(f"[smoke] >>> OWNER CLEANUP: archive prod mcd seed id {seed_id!r} <<<")
print("[smoke] PASS -- one munshi item fanned to exactly one mcd seed via the factory")
