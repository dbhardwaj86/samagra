# samagra/factory/publish/read.py
"""Read-only resolver over the G1 published export contract (Phase G2).

The outward read surface reads ONLY what G1 released: the derived manifest
(`run.list_published()`) and the frozen artifact bytes under PUBLISHED_DIR. It
performs NO writes and never touches governance.db, EXPORT_DIR, the immutable
`_publications/` records, or the seven source subsystems. The artifact path is
always resolved from the manifest entry (never a client-supplied path) and
re-verified by sha256 before any bytes are returned.
"""
from __future__ import annotations

from ... import config
from . import manifest, run
from . import store as pub

# kind -> (accepted file extensions, response media type)
_KIND_EXT = {"html": (".html", ".htm"), "json": (".json",), "docx": (".docx",)}
_KIND_MEDIA = {
    "html": "text/html; charset=utf-8",
    "json": "application/json",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def published_manifest() -> dict:
    """The current published corpus (the `samagra.published.v1` manifest), derived
    from the immutable publication records. Graceful-empty (chapters == {}) when
    nothing is published — never raises for an absent published/ dir."""
    return run.list_published()


def resolve_artifact(chapter: str, lane: str, kind: str = "html") -> dict | None:
    """Resolve ONE published artifact file for (chapter, lane, kind) FROM the
    manifest, re-verify its sha256, and return
    {rel, abs_path, bytes, sha256, media_type}. Returns None for an unknown
    chapter / lane / kind / missing file. Raises ValueError if the on-disk bytes no
    longer match the manifest sha (an integrity breach — surfaced, never silently
    served)."""
    exts = _KIND_EXT.get(kind)
    if exts is None:
        return None
    chap = (published_manifest().get("chapters") or {}).get(chapter)
    if not chap:
        return None
    entry = next((a for a in chap.get("artifacts", []) if a.get("lane") == lane), None)
    if entry is None:
        return None
    f = next((g for g in entry.get("files", [])
              if str(g.get("rel", "")).lower().endswith(exts)), None)
    if f is None:
        return None
    rel = f.get("rel") or ""
    # Defense-in-depth: rel is from our own manifest, but re-validate it is a
    # <safe-chapter>/<safe-basename> pair that stays under PUBLISHED_DIR.
    parts = rel.split("/")
    if len(parts) != 2 or not all(pub._SAFE_SEGMENT.match(p) for p in parts):
        return None
    root = config.PUBLISHED_DIR.resolve()
    abs_path = (config.PUBLISHED_DIR / rel).resolve()
    try:
        abs_path.relative_to(root)
    except ValueError:
        return None
    if not abs_path.is_file():
        return None
    data = abs_path.read_bytes()
    if manifest.sha256_bytes(data) != f.get("sha256"):
        raise ValueError(f"published artifact integrity check failed: {rel}")
    return {"rel": rel, "abs_path": str(abs_path), "bytes": data,
            "sha256": f.get("sha256"), "media_type": _KIND_MEDIA[kind]}
