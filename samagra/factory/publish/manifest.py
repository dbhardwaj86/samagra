"""PURE manifest logic for the publish boundary.

No I/O beyond hashing bytes the caller already read. Owns the published-corpus
schema, content hashing, the per-lane-last-write-wins manifest derivation over an
ordered list of immutable publication records, and the idempotency comparison.
"""
from __future__ import annotations

import hashlib

SCHEMA = "samagra.published.v1"


def sha256_bytes(data: bytes) -> str:
    """Hex sha256 of raw bytes — the per-file content fingerprint."""
    return hashlib.sha256(data).hexdigest()


def derive_manifest(publications: list[dict], *, generated_at: str) -> dict:
    """Replay an ordered list of immutable publication records into the current
    published manifest. Publish adds/replaces a lane's entry (last-write-wins);
    unpublish removes a lane; a chapter with no remaining lanes drops out.

    The output `publication_count` is the RAW record count (it includes unpublish
    records) — it is NOT a count of currently-published artifacts."""
    chapters: dict[str, dict] = {}
    for rec in publications:
        ch = rec["chapter"]
        slot = chapters.setdefault(
            ch, {"chapter": ch, "title": rec.get("title"),
                 "seed_ref": rec.get("seed_ref"), "lanes": {}})
        if rec.get("title"):
            slot["title"] = rec["title"]
        if rec.get("seed_ref"):
            slot["seed_ref"] = rec["seed_ref"]
        action = rec.get("action")
        if action == "unpublish":
            for lane in rec.get("lanes", []):
                slot["lanes"].pop(lane, None)
        elif action == "publish":
            for entry in rec.get("artifacts", []):
                slot["lanes"][entry["lane"]] = entry
        else:
            raise ValueError(
                f"derive_manifest: unknown action {action!r} in "
                f"publication {rec.get('publication_id')!r}")
    out: dict[str, dict] = {}
    for ch, slot in chapters.items():
        if not slot["lanes"]:
            continue
        out[ch] = {"chapter": ch, "title": slot["title"],
                   "seed_ref": slot["seed_ref"],
                   "artifacts": [slot["lanes"][l] for l in sorted(slot["lanes"])]}
    return {"schema": SCHEMA, "generated_at": generated_at,
            "publication_count": len(publications), "chapters": out}


def unchanged_lanes(manifest_obj: dict | None, chapter: str,
                    candidates: list[dict]) -> set[str]:
    """Lanes whose candidate file-sha set EXACTLY matches the current manifest
    entry — these are no-ops a re-publish must skip (idempotency)."""
    if manifest_obj is None:
        return set()
    ch = (manifest_obj.get("chapters") or {}).get(chapter)
    if not ch:
        return set()
    current = {e["lane"]: {f["sha256"] for f in e.get("files", [])}
               for e in ch.get("artifacts", [])}
    out: set[str] = set()
    for c in candidates:
        cur = current.get(c["lane"])
        if cur and cur == {f["sha256"] for f in c["files"]}:
            out.add(c["lane"])
    return out
