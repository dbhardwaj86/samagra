"""C2 live golden-thread smoke: one textbook seed -> answer-safe paper + drill via
the REAL QX engine, in an ISOLATED temp governance store (durable governance.db
untouched). Asserts both artifacts exist, are non-empty, and carry NO answer marker.
Run: python scripts/c2_smoke.py
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from samagra import config              # noqa: E402
from samagra.governance import store    # noqa: E402

# --- isolate every durable path into a throwaway tmp dir ---------------------
tmp = Path(tempfile.mkdtemp(prefix="c2-smoke-"))
durable_gov = config.GOVERNANCE_DB
durable_before = durable_gov.stat().st_mtime_ns if durable_gov.exists() else None

config.GOVERNANCE_DB = tmp / "governance.db"
config.DATA_DB = tmp / "samagra.db"
config.EXPORT_DIR = tmp / "exports"
store._INITIALIZED.clear()
store.ensure_tables()
os.chdir(tmp)                           # outbox writes board/<agent>/outbox under cwd

from samagra.factory import run         # noqa: E402  (import AFTER config override)
from samagra.factory.dispatch import _ANSWER_MARKERS  # noqa: E402

SEED = "textbook:circular-motion"
print(f"[smoke] seed = {SEED}  (live QX on {config.QX_SERVER_URL})")

run.plan(SEED, dry=False)
run.approve_seed(SEED)

conn = store.connect()
try:
    children = {r["pipeline"]: r["id"] for r in store.list_assignments(conn)}
finally:
    conn.close()
print(f"[smoke] planned + approved lanes: {sorted(children)}")
assert set(children) == {"revision", "lecture", "deck", "paper", "drill"}, children

for lane in ("paper", "drill"):
    res = run.build(children[lane])
    art = Path(res["artifact_ref"])
    text = art.read_text(encoding="utf-8")
    low = text.lower()
    leaked = [m for m in _ANSWER_MARKERS if m in low]
    # questions count comes from the deck/paper JSON sidecar next to the html
    import json as _json
    sidecar = art.with_name(art.name.replace(".html", ".json"))
    qn = len(_json.loads(sidecar.read_text(encoding="utf-8"))["questions"])
    assert art.is_file() and art.stat().st_size > 0, art
    assert not leaked, f"ANSWER LEAK in {lane}: {leaked}"
    print(f"[smoke] {lane:6} -> {qn:2} questions · {art.stat().st_size:6} bytes · answer-free OK · {art.name}")

conn = store.connect()
try:
    statuses = {r["pipeline"]: r["status"] for r in store.list_assignments(conn)}
finally:
    conn.close()
assert statuses["paper"] == "captured" and statuses["drill"] == "captured", statuses
print(f"[smoke] captured statuses: paper={statuses['paper']} drill={statuses['drill']}")

durable_after = durable_gov.stat().st_mtime_ns if durable_gov.exists() else None
assert durable_before == durable_after, "DURABLE governance.db WAS TOUCHED!"
print(f"[smoke] durable governance.db untouched (mtime unchanged) OK")
print("[smoke] PASS — one seed fanned to answer-safe paper + drill via live QX")
