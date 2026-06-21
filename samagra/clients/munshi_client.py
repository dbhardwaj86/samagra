"""Read-only library client for munshi (front-desk subsystem).

Mirrors myProd/stress/driver.mjs MunshiClient: cookie auth via
Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
"""
from __future__ import annotations

import os
from urllib.parse import quote

import requests

_TIMEOUT = 30


class MunshiClient:
    def __init__(self, api_url=None, secret=None):
        url = api_url or os.environ.get("MUNSHI_API_URL") or ""
        self.api_url = url.rstrip("/")
        self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""

    def available(self) -> bool:
        return bool(self.api_url and self._secret)

    def _cookie(self) -> str:
        # quote(..., safe="") mirrors JS encodeURIComponent. It over-encodes
        # ! ' ( ) * (which encodeURIComponent leaves literal), but the munshi
        # server decodeURIComponent's the cookie before comparing (index.ts),
        # so both forms round-trip to the same secret — auth is unaffected.
        return "munshi=" + quote(self._secret, safe="")

    def library(self) -> dict:
        r = requests.get(
            f"{self.api_url}/api/library",
            headers={"Cookie": self._cookie()},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()

    def create_item(self, kind: str, fields: dict) -> dict:
        # Owner-initiated capture. Deterministic /api/item write; same stateless
        # cookie auth as library(). kind must be todo|note|followup (the worker
        # rejects others). The secret is never logged.
        r = requests.post(
            f"{self.api_url}/api/item",
            headers={"Cookie": self._cookie(), "content-type": "application/json"},
            json={"kind": kind, **fields},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()

    def __repr__(self) -> str:  # never leak the secret
        return f"MunshiClient(api_url={self.api_url!r}, secret=<set:{bool(self._secret)}>)"
