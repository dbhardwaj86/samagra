"""munshi (front-desk) source adapter — read-only, intake-only.

Normalizes non-dismissed library items into Artifact records. item.kind in
[note,todo,issue,question,followup]; item.status in
[open,claimed_done,validated,dismissed]; item.payload is a dict.
"""
from __future__ import annotations

from typing import Iterator

from ..clients import MunshiClient
from .base import Adapter, Artifact


def _title_from(item: dict) -> str:
    """First non-empty line of the payload text, else the item kind."""
    payload = item.get("payload") or {}
    text = ""
    if isinstance(payload, dict):
        text = str(payload.get("text") or payload.get("body") or "").strip()
    elif isinstance(payload, str):
        text = payload.strip()
    if text:
        return text.splitlines()[0][:120]
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
