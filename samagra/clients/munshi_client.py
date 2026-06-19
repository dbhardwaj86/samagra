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
        # quote(..., safe="") matches JS encodeURIComponent for our charset.
        return "munshi=" + quote(self._secret, safe="")

    def library(self) -> dict:
        r = requests.get(
            f"{self.api_url}/api/library",
            headers={"Cookie": self._cookie()},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()

    def __repr__(self) -> str:  # never leak the secret
        return f"MunshiClient(api_url={self.api_url!r}, secret=<set:{bool(self._secret)}>)"
