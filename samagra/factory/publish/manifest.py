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
    unpublish removes a lane; a chapter with no remaining lanes drops out."""
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
        if rec.get("action") == "unpublish":
            for lane in rec.get("lanes", []):
                slot["lanes"].pop(lane, None)
        else:
            for entry in rec.get("artifacts", []):
                slot["lanes"][entry["lane"]] = entry
    out: dict[str, dict] = {}
    for ch, slot in chapters.items():
        if not slot["lanes"]:
            continue
        out[ch] = {"chapter": ch, "title": slot["title"],
                   "seed_ref": slot["seed_ref"],
                   "artifacts": [slot["lanes"][l] for l in sorted(slot["lanes"])]}
    return {"schema": SCHEMA, "generated_at": generated_at,
            "publication_count": len(publications), "chapters": out}
