"""munshi (front-desk) source adapter — read-only, intake-only.

Normalizes non-dismissed library items into Artifact records. item.kind in
[note,todo,issue,question,followup]; item.status in
[open,claimed_done,validated,dismissed]; item.payload is a dict.
"""
from __future__ import annotations

from typing import Iterator

from ..clients import MunshiClient
from .base import Adapter, Artifact


# Live munshi payload schema (myProd/src/tools.ts insertItem calls): each item
# kind stores its human-meaningful text under a kind-SPECIFIC key, never a
# generic "text"/"body" field. Map each kind to its title key(s), most
# descriptive first:
#   note     -> {topic, issue, action}      (issue = the doubt, 1-2 lines)
#   todo     -> {task}
#   issue    -> {summary, source}
#   question -> {stem, options, answer, ...}
#   followup -> {note}
_TITLE_KEYS_BY_KIND = {
    "note": ("issue", "topic"),
    "todo": ("task",),
    "issue": ("summary",),
    "question": ("stem",),
    "followup": ("note",),
}
# Tried after the kind-specific keys, so an unknown/renamed kind still yields a
# real title instead of collapsing to the bare kind. "text"/"body" are kept as a
# last-ditch defensive fallback for any future generic payload.
_TITLE_FALLBACK_KEYS = ("task", "summary", "stem", "note", "issue", "topic",
                        "text", "body")


def _title_from(item: dict) -> str:
    """First non-empty line of the kind-specific payload text, else the kind.

    Reads the title from the live munshi per-kind payload key (see
    `_TITLE_KEYS_BY_KIND`), falling back across the other known content keys,
    then to the item kind. A string payload is used verbatim.
    """
    payload = item.get("payload") or {}
    if isinstance(payload, str):
        text = payload.strip()
        return text.splitlines()[0][:120] if text else (item.get("kind") or "item")
    if isinstance(payload, dict):
        keys = _TITLE_KEYS_BY_KIND.get(item.get("kind"), ()) + _TITLE_FALLBACK_KEYS
        for key in keys:
            val = payload.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip().splitlines()[0][:120]
    return item.get("kind") or "item"


class MunshiAdapter(Adapter):
    name = "munshi"
    label = "Front Desk (munshi)"

    def __init__(self, client: MunshiClient | None = None):
        self.client = client or MunshiClient()

    def available(self) -> bool:
        return self.client.available()

    def artifacts(self) -> Iterator[Artifact]:
        for item in self.client.library().get("items", []):
            if item.get("status") == "dismissed":
                continue
            yield Artifact(
                uid=f"munshi:{item['id']}",
                source="munshi",
                kind=item["kind"],
                title=_title_from(item),
                subject="physics",
                unit=None,
                chapter=None,
                status=item["status"],
                path=None,
                url=None,
                updated_at=item["ts"],
                meta={
                    "payload": item["payload"],
                    "tags": item.get("tags"),
                    "person": item.get("person"),
                    "due": item.get("due"),
                },
            )
