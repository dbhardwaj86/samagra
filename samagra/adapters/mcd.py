"""mycontentdev (editorial) source adapter — read-only.

Normalizes non-archived seed rows into Artifact records. seed.type in
[concept,question,snippet,simulation_idea,experiment,notebooklm_link,rough_idea];
seed.status in [captured,needs_processing,processing,draft_ready,
changes_requested,approved,brief_generated,content_linked,done,archived].
"""
from __future__ import annotations

from typing import Iterator

from ..clients import McdClient
from .base import Adapter, Artifact

_SEED_SQL = (
    "SELECT id,type,title,status,created_at,updated_at "
    "FROM seeds WHERE status != 'archived'"
)


class McdAdapter(Adapter):
    name = "mycontentdev"
    label = "Editorial (mycontentdev)"

    def __init__(self, client: McdClient | None = None):
        self.client = client or McdClient()

    def available(self) -> bool:
        return self.client.available()

    def artifacts(self) -> Iterator[Artifact]:
        api_url = self.client.api_url
        for row in self.client.query(_SEED_SQL):
            yield Artifact(
                uid=f"mcd:{row['id']}",
                source="mycontentdev",
                kind=row["type"],
                title=row["title"],
                subject="physics",
                unit=None,
                chapter=None,
                status=row["status"],
                path=None,
                url=f"{api_url}/seed/{row['id']}",
                updated_at=row["updated_at"],
                meta={"seedId": row["id"]},
            )
