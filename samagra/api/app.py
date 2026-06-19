"""SAMAGRA portal — FastAPI app.

Serves the unified portal (UI forked from QX's browser style) plus a small JSON
API over the catalog, QX live question search, the pipeline state machine, and a
safe local-file opener constrained to configured source roots.
"""
from __future__ import annotations

import mimetypes
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

import samagra
from .. import catalog, config, scheduler, state
from ..adapters import get_adapter
from ..lectures import render as lecture_render

PORTAL = Path(__file__).resolve().parent.parent / "portal"

app = FastAPI(title="SAMAGRA", version=samagra.__version__)
app.mount("/static", StaticFiles(directory=str(PORTAL / "static")), name="static")
templates = Jinja2Templates(directory=str(PORTAL / "templates"))

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
@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(
        request, "portal.html", {"version": samagra.__version__}
    )


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
