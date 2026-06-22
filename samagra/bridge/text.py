"""Extract the verbatim human text of a munshi item.

Munshi payloads store their text under a kind-SPECIFIC key (note->issue/topic,
todo->task, question->stem, ...), never a generic "text" (mirrors
samagra/adapters/munshi.py _TITLE_KEYS_BY_KIND). We try those first, then fall
back to joining any string/number values so synthetic or renamed payloads still
yield text. Pure; no I/O.
"""
from __future__ import annotations

# Extends samagra/adapters/munshi.py _TITLE_KEYS_BY_KIND (most descriptive first):
# adds note->action and issue->source so the bridge captures richer item text
# than the title-only adapter does.
_KIND_KEYS = {
    "note": ("issue", "topic", "action"),
    "todo": ("task",),
    "issue": ("summary", "source"),
    "question": ("stem",),
    "followup": ("note",),
}


def item_text(item: dict) -> str:
    """Return the item's verbatim text (kind-specific key first, else joined values)."""
    payload = item.get("payload") or {}
    if isinstance(payload, str):
        return payload.strip()
    if not isinstance(payload, dict):
        return str(payload)
    kind = (item.get("kind") or "").lower()
    for key in _KIND_KEYS.get(kind, ()):
        val = payload.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    parts = [str(v) for v in payload.values() if isinstance(v, (str, int, float))]
    return " ".join(p for p in parts if p).strip()
