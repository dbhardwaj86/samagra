"""Build the FLAT POST /api/seeds capture fields for a munshi item (R1).

The deployed worker parses multipart form-data and the live /api/mcd/seeds
forwards only {type, raw_text, title?, source_ref?}; a nested detail{} would be
dropped. So we emit the flat, proven contract here and keep the corpus pointers
+ full proposal in SAMAGRA's own seed_proposed event + outbox file.
"""
from __future__ import annotations

from .text import item_text

# The seed types the mycontentdev capture endpoint accepts (mirrors the
# /api/mcd/seeds route's _SEED_TYPES). build_seed_payload only ever emits
# "question" or "rough_idea", but the set is the contract validate_seed_payload
# enforces at the bridge write boundary.
SEED_TYPES = {"concept", "question", "snippet", "simulation_idea",
              "experiment", "notebooklm_link", "rough_idea"}


def validate_seed_payload(body: dict) -> None:
    """Enforce the same shape the /api/mcd/seeds route enforces.

    `submit` calls McdClient.create_seed directly (the proven flat form-POST),
    bypassing that FastAPI route — so the route's type/raw_text validation must
    be re-asserted here or an empty-stem item would write a blank seed to prod.
    Raises ValueError on a bad payload.
    """
    if body.get("type") not in SEED_TYPES:
        raise ValueError(
            "seed type must be one of: " + ", ".join(sorted(SEED_TYPES)))
    raw_text = body.get("raw_text")
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise ValueError("seed raw_text is required (non-empty string)")


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
