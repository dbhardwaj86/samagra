"""Build the FLAT POST /api/seeds capture fields for a munshi item (R1).

The deployed worker parses multipart form-data and the live /api/mcd/seeds
forwards only {type, raw_text, title?, source_ref?}; a nested detail{} would be
dropped. So we emit the flat, proven contract here and keep the corpus pointers
+ full proposal in SAMAGRA's own seed_proposed event + outbox file.
"""
from __future__ import annotations

from .text import item_text


def _source_ref(item: dict) -> str | None:
    uid = item.get("uid")
    if isinstance(uid, str) and uid:
        return uid
    iid = item.get("id")
    return f"munshi:{iid}" if iid is not None else None


def build_seed_payload(item: dict, pointers: list[dict]) -> dict:
    """Return the flat POST /api/seeds body. `pointers` are NOT shipped to mcd
    (recorded in SAMAGRA's audit trail instead); the param is kept for symmetry
    and future use."""
    kind = (item.get("kind") or "").lower()
    seed_type = "question" if kind == "question" else "rough_idea"
    body = {"type": seed_type, "raw_text": item_text(item)}
    ref = _source_ref(item)
    if ref:
        body["source_ref"] = ref
    return body
