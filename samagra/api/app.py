"""SAMAGRA OS — FastAPI app.

Serves the Vite-built SAMAGRA OS single-page app (`frontend/dist/`) plus a small
JSON API over the catalog, QX live question search, the pipeline state machine,
and a safe local-file opener constrained to configured source roots.
"""
from __future__ import annotations

import mimetypes
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

import samagra
from .. import catalog, config, scheduler, state
from ..adapters import get_adapter
from ..clients import McdClient, MunshiClient
from ..governance import store as gstore
from ..lectures import render as lecture_render
from ..org import ORG  # E2.1 static org chart

# Vite build output (E1.17). Computed from config.REPO_ROOT at import time so the
# serve seam follows config.REPO_ROOT under test (the suite reloads this module
# after monkeypatching REPO_ROOT to a built/unbuilt tmp tree).
FRONTEND_DIST = config.REPO_ROOT / "frontend" / "dist"

app = FastAPI(title="SAMAGRA", version=samagra.__version__)
# Serve hashed Vite assets only when a build is present; absent before the first
# `npm run build`, so guard the mount to avoid a StaticFiles directory error.
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")),
              name="assets")

ALLOWED_ROOTS = [
    config.QX_ROOT, config.TEXTBOOK_ROOT, config.BOOKLETS_ROOT,
    config.INSP_ROOT, config.SIMS_ROOT, config.EXPORT_DIR,
]


def _allowed(p: Path) -> bool:
    rp = p.resolve()
    for root in ALLOWED_ROOTS:
        try:
            rp.relative_to(root.resolve())
            return True
        except ValueError:
            continue
    return False


# -- pages ---------------------------------------------------------------
@app.get("/lecture/{slug}", response_class=HTMLResponse)
def lecture_preview(slug: str):
    try:
        content = lecture_render.load_chapter(slug)
    except FileNotFoundError:
        raise HTTPException(404, f"chapter {slug!r} not found")
    return HTMLResponse(lecture_render.render_chapter_html(content, label="Preview"))


# -- api -----------------------------------------------------------------
@app.get("/api/overview")
def api_overview():
    return catalog.overview()


@app.get("/api/facets")
def api_facets():
    return catalog.facets()


@app.get("/api/search")
def api_search(q: str = "", source: str | None = None,
               kind: str | None = None, limit: int = 200):
    return {"results": catalog.search(q, source=source, kind=kind, limit=limit)}


@app.get("/api/questions")
def api_questions(q: str = "", subject: str | None = None,
                  chapter: str | None = None, qtype: str | None = None,
                  limit: int = 50):
    qx = get_adapter("qx")
    if not qx or not qx.available():
        return {"results": [], "error": "QX source not present"}
    return {"results": qx.search_questions(
        q, subject=subject, chapter=chapter, qtype=qtype, limit=limit)}


@app.get("/api/pipelines")
def api_pipelines():
    return {"pipelines": state.all_states()}


@app.get("/api/assignments")
def api_assignments():
    # Reads the DURABLE governance DB (governance.db, D6) — separate from the
    # rebuildable catalog. init_tables is idempotent + safe to call per request.
    conn = gstore.connect()
    try:
        gstore.init_tables(conn)  # inside try: a failed init must still close the conn
        return {"assignments": gstore.list_assignments(conn),
                "events": gstore.list_events(conn)}
    finally:
        conn.close()


@app.post("/api/refresh")
def api_refresh():
    totals = catalog.refresh(verbose=False)
    return {"ok": True, "totals": totals}


@app.post("/api/tick")
def api_tick(dry_run: bool = False):
    return scheduler.tick(dry_run=dry_run)


@app.post("/api/gate/{pipeline}/{decision}")
def api_gate(pipeline: str, decision: str):
    result = scheduler.gate(pipeline, decision)
    # F-02: a refused gate decision (prereqs incomplete, not awaiting_gate, bad
    # decision) is a conflict with current pipeline state — surface it as HTTP
    # 409 instead of a 200 with a silent JSON error body.
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])
    return result


# -- safe local file opener ---------------------------------------------
@app.get("/open")
def open_file(path: str, download: bool = False):
    p = Path(path)
    if not _allowed(p):
        raise HTTPException(403, "path outside allowed source roots")
    if not p.exists() or not p.is_file():
        raise HTTPException(404, "file not found")
    media, _ = mimetypes.guess_type(str(p))
    filename = p.name if (download or p.suffix.lower() == ".docx") else None
    return FileResponse(str(p), media_type=media or "application/octet-stream",
                        filename=filename)


@app.get("/api/org")
def api_org():
    return ORG


_MUNSHI_REQUIRED = {
    "todo": ("assignee", "task"),
    "note": ("student", "issue"),
    "followup": ("date", "note"),
}
# Contract passthrough — must mirror the TS buildMunshiCapture OPTIONAL whitelist
# (frontend/src/lib/capture/munshi.ts). The server is the real trust boundary for
# this production write, so it independently whitelists allowed fields.
_MUNSHI_OPTIONAL = {
    "todo": ("due",),
    "note": ("label",),
    "followup": ("person",),
}


@app.post("/api/munshi/capture")
def api_munshi_capture(payload: dict):
    kind = (payload or {}).get("kind")
    if not isinstance(kind, str) or kind not in _MUNSHI_REQUIRED:
        raise HTTPException(400, "kind must be one of: todo, note, followup")
    required = _MUNSHI_REQUIRED[kind]
    allowed = required + _MUNSHI_OPTIONAL[kind]
    # Whitelist + sanitize: only contract-allowed keys with string values are
    # forwarded to the live worker. Unknown keys (status, id, ts, ...) are dropped.
    fields: dict[str, str] = {}
    for k in allowed:
        if k not in payload:
            continue
        v = payload[k]
        if not isinstance(v, str):
            raise HTTPException(400, f"field {k!r} must be a string")
        v = v.strip()
        if v:
            fields[k] = v
    missing = [k for k in required if k not in fields]
    if missing:
        raise HTTPException(400, f"missing required field(s): {', '.join(missing)}")
    client = MunshiClient()
    if not client.available():
        raise HTTPException(503, "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET")
    try:
        created = client.create_item(kind, fields)
    except Exception:  # noqa: BLE001 — never surface the upstream/secret details
        raise HTTPException(502, "munshi capture failed")
    return {"ok": True, "item": created}


_SEED_TYPES = {"concept", "question", "snippet", "simulation_idea",
               "experiment", "notebooklm_link", "rough_idea"}


@app.post("/api/mcd/seeds")
def api_mcd_create_seed(payload: dict):
    typ = (payload or {}).get("type")
    raw_text = str((payload or {}).get("raw_text") or "").strip()
    if typ not in _SEED_TYPES:
        raise HTTPException(400, "type must be one of: " + ", ".join(sorted(_SEED_TYPES)))
    if not raw_text:
        raise HTTPException(400, "raw_text is required")
    client = McdClient()
    if not client.available():
        raise HTTPException(503, "mycontentdev not configured — set mcd-cloud.json adminKey")
    fields = {"type": typ, "raw_text": raw_text}
    for opt in ("title", "source_ref"):
        v = str((payload or {}).get(opt) or "").strip()
        if v:
            fields[opt] = v
    try:
        created = client.create_seed(fields)
    except Exception:  # noqa: BLE001
        raise HTTPException(502, "mycontentdev seed create failed")
    return {"ok": True, "seed": created}


# -- SPA fallback (MUST be declared LAST) -------------------------------
# Catch-all for client-side routes: serve the Vite-built index.html so the React
# router can take over. Declared last so it never shadows the API, the lecture
# preview, or the file opener above. Explicitly 404s anything under `api/` (an
# unknown API path should be a real 404, not the SPA shell).
@app.get("/{full_path:path}", response_class=HTMLResponse)
def spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(404, "unknown API route")
    index_html = FRONTEND_DIST / "index.html"
    if not index_html.is_file():
        raise HTTPException(503, "frontend not built — run `npm run build`")
    return FileResponse(str(index_html))
