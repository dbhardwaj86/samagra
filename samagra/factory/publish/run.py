# samagra/factory/publish/run.py
"""The publish boundary orchestrator: captured -> published (owner-gated).

Reads ONLY captured local factory artifacts (governance.db + the files already on
disk) and writes ONLY under PUBLISHED_DIR + appends append-only `published` /
`unpublished` governance events. No write path to the 7 source subsystems; no
public surface; no assignment-state change; no migration. Manual CLI only.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from ...governance import store as gov
from ..lines import LINES
from . import manifest
from . import store as pub

_ACTOR = "owner"

# Every non-mcd lane produces a LOCAL artifact that can be copied into published/.
# The mcd `seed` lane writes inward to mycontentdev and has no local file to copy.
PUBLISHABLE = frozenset(k for k, l in LINES.items() if l.kind != "mcd")


def _titleize(chapter: str) -> str:
    # Assumes hyphen-delimited slugs (e.g. circular-motion); underscores are NOT
    # treated as word boundaries, so an underscore slug won't title-case per word.
    return chapter.replace("-", " ").title()


def _norm_lanes(lanes) -> set[str] | None:
    """Normalize a None | str("a,b") | iterable lane filter to a set, validated
    against PUBLISHABLE. None means 'all captured publishable lanes'; an empty or
    whitespace-only filter is a mistake, not 'all', and raises."""
    if lanes is None:
        return None
    items = lanes.split(",") if isinstance(lanes, str) else list(lanes)
    want = {x.strip() for x in items if x and x.strip()}
    if not want:
        raise ValueError(
            "empty lane filter — pass lanes=None to publish all captured lanes")
    bad = want - PUBLISHABLE
    if bad:
        raise ValueError(
            f"not publishable lane(s): {sorted(bad)} "
            f"(publishable: {sorted(PUBLISHABLE)})")
    return want


def _last_product_created(events: list[dict]) -> dict | None:
    """The artifact `result` dict from the LAST product_created note (a rebuilt
    assignment may have several). None if absent/malformed — a clean refusal."""
    result = None
    for ev in events:                         # list_events_for_assignment is oldest-first
        if ev.get("verb") != "product_created":
            continue
        try:
            note = json.loads(ev["note"])
        except (TypeError, ValueError):
            continue
        if isinstance(note, dict) and isinstance(note.get("artifact"), dict):
            result = note["artifact"]
    return result


def _captured_publishable(conn, chapter: str, want: set[str] | None) -> list[dict]:
    """Descriptors for the chapter's captured, publishable artifacts. Refuses (no
    phantom publish) if an artifact's product_created note or its html file on
    disk is missing — the owner must rebuild first.

    `conn` is a governance connection (read or write); the full scan over
    list_assignments is fine for the single-operator console."""
    seed = f"textbook:{chapter}"
    out: list[dict] = []
    for a in gov.list_assignments(conn):
        if a.get("seed_ref") != seed or a.get("status") != "captured":
            continue
        lane = a.get("pipeline")
        if lane not in PUBLISHABLE or (want is not None and lane not in want):
            continue
        result = _last_product_created(gov.list_events_for_assignment(conn, a["id"]))
        if not result:
            raise ValueError(
                f"assignment {a['id']} ({lane}) has no recoverable artifact — "
                f"rebuild before publishing")
        html = result.get("html")
        if not (html and Path(html).is_file()):
            raise ValueError(
                f"assignment {a['id']} ({lane}) artifact file missing on disk — "
                f"rebuild before publishing")
        files = [result[k] for k in ("html", "json", "docx")
                 if result.get(k) and Path(result[k]).is_file()]
        out.append({"assignment_id": a["id"], "lane": lane,
                    "captured_at": a.get("updated_at"),
                    "style_seed_version": result.get("style_seed_version"),
                    "source_files": files})
    return out


def publish(chapter: str, *, lanes=None, actor: str = _ACTOR) -> dict:
    """Owner release gate (manual): copy a chapter's captured artifacts into the
    immutable published/ snapshot. Idempotent — unchanged lanes are a no-op."""
    chapter = (chapter or "").strip()
    if not chapter:
        raise ValueError("chapter is required")
    want = _norm_lanes(lanes)
    conn = gov.connect()
    try:
        cands = _captured_publishable(conn, chapter, want)
        if not cands:
            raise ValueError(
                f"no captured publishable artifacts for chapter {chapter!r} "
                f"(build + capture them through the factory first)")
        # Stage: read each source file's bytes once + hash (no write yet).
        staged = []
        for c in cands:
            files = []
            for src in c["source_files"]:
                data = Path(src).read_bytes()
                files.append({"rel": f"{chapter}/{Path(src).name}",
                              "sha256": manifest.sha256_bytes(data),
                              "bytes": len(data), "_data": data})
            staged.append({**c, "files": files})
        current = pub.read_manifest()
        unchanged = manifest.unchanged_lanes(current, chapter, staged)
        changed = [s for s in staged if s["lane"] not in unchanged]
        if not changed:
            return {"chapter": chapter, "publication_id": None, "published": [],
                    "skipped_unchanged": sorted(unchanged), "noop": True}
        pub_id = "pub_" + uuid.uuid4().hex[:12]
        at = pub.now()
        entries = []
        for s in changed:
            out_files = []
            for f in s["files"]:
                rel = pub.write_published_file(chapter, Path(f["rel"]).name, f["_data"])
                out_files.append({"rel": rel, "sha256": f["sha256"], "bytes": f["bytes"]})
            entries.append({
                "uid": f"published:{chapter}:{s['lane']}", "lane": s["lane"],
                "assignment_id": s["assignment_id"], "files": out_files,
                "source_seed_ref": f"textbook:{chapter}",
                "style_seed_version": s.get("style_seed_version"),
                "captured_at": s.get("captured_at"), "published_at": at,
                "publication_id": pub_id})
        record = {"publication_id": pub_id, "action": "publish", "actor": actor,
                  "chapter": chapter, "seed_ref": f"textbook:{chapter}",
                  "title": _titleize(chapter), "lanes": [e["lane"] for e in entries],
                  "at": at, "artifacts": entries}
        pub.write_publication(record, sequence=pub.next_sequence())
        for e in entries:
            gov.append_event(
                conn, actor=actor, verb="published", assignment_id=e["assignment_id"],
                subsystem="published", subsystem_ref=chapter,
                note=json.dumps({"publication_id": pub_id, "lane": e["lane"],
                                 "uid": e["uid"],
                                 "sha256": [f["sha256"] for f in e["files"]]},
                                ensure_ascii=False))
        pub.write_manifest(
            manifest.derive_manifest(pub.read_publications(), generated_at=pub.now()))
        return {"chapter": chapter, "publication_id": pub_id,
                "published": [e["lane"] for e in entries],
                "skipped_unchanged": sorted(unchanged)}
    finally:
        conn.close()


def unpublish(chapter: str, *, lanes=None, actor: str = _ACTOR) -> dict:
    """Owner retract (manual, append-only): drop a chapter (or specific lanes)
    from the CURRENT manifest. The frozen bytes + publication records + ledger are
    never deleted — the consumer simply stops seeing the withdrawn artifacts."""
    chapter = (chapter or "").strip()
    want = _norm_lanes(lanes)
    current = pub.read_manifest() or manifest.derive_manifest(
        pub.read_publications(), generated_at=pub.now())
    ch = (current.get("chapters") or {}).get(chapter)
    if not ch:
        raise ValueError(f"chapter {chapter!r} is not published")
    present = {e["lane"]: e for e in ch.get("artifacts", [])}
    targets = sorted(present) if want is None else sorted(set(present) & want)
    if not targets:
        raise ValueError(f"no published lane(s) to withdraw for chapter {chapter!r}")
    conn = gov.connect()
    try:
        pub_id = "pub_" + uuid.uuid4().hex[:12]
        at = pub.now()
        record = {"publication_id": pub_id, "action": "unpublish", "actor": actor,
                  "chapter": chapter, "seed_ref": f"textbook:{chapter}",
                  "title": ch.get("title"), "lanes": targets, "at": at,
                  "artifacts": [present[l] for l in targets]}
        pub.write_publication(record, sequence=pub.next_sequence())
        for l in targets:
            gov.append_event(
                conn, actor=actor, verb="unpublished",
                assignment_id=present[l].get("assignment_id"),
                subsystem="published", subsystem_ref=chapter,
                note=json.dumps({"publication_id": pub_id, "lane": l,
                                 "uid": present[l].get("uid")}, ensure_ascii=False))
        pub.write_manifest(
            manifest.derive_manifest(pub.read_publications(), generated_at=pub.now()))
        return {"chapter": chapter, "publication_id": pub_id, "unpublished": targets}
    finally:
        conn.close()


def list_published() -> dict:
    """The current published manifest (the export contract). Re-derives from the
    immutable records if manifest.json is absent."""
    m = pub.read_manifest()
    if m is None:
        m = manifest.derive_manifest(pub.read_publications(), generated_at=pub.now())
    return m
