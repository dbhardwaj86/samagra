"""QuestionDB adapter — QX's online HuggingFace Space (deployment target).

Currently private/offline; this is a stub that records the target URL so the portal
can show the online status. A later slice deploys QX here and this adapter starts
reporting live status.
"""
from __future__ import annotations

from typing import Iterator

from .. import config
from .base import Adapter, Artifact


class QuestionDBAdapter(Adapter):
    name = "questiondb"
    label = "QuestionDB (online)"

    def available(self) -> bool:
        return True

    def summary(self) -> dict:
        return {"status": "offline (HF Space private)", "url": config.QUESTIONDB_URL}

    def artifacts(self) -> Iterator[Artifact]:
        return iter(())
