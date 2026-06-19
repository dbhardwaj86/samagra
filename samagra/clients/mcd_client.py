"""Read-only admin-API client for mycontentdev (editorial subsystem).

Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
{apiUrl,adminKey} at the mycontentdev repo root, or env MCD_API_URL /
MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.

SAFETY: this client NEVER logs or reprs a key value. Phase 1 surface is READ-ONLY
(query / pending / available). The only write method, create_seed (POST
/api/seeds), is DEFERRED to Phase 3 per runbook D2/D9 and is intentionally not
built here; app_key is still resolved so the Phase-3 write path drops in cleanly.
"""
from __future__ import annotations

import json
import os

import requests

from .. import config

_TIMEOUT = 30
# mycontentdev repo root, sibling of the samagra repo under claude_box.
_MCD_ROOT = config.CLAUDE_BOX / "mycontentdev"


def _load_cloud_json() -> dict:
    p = _MCD_ROOT / "mcd-cloud.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return {}
    return {}


class McdClient:
    def __init__(self, api_url=None, admin_key=None, app_key=None):
        file = _load_cloud_json()
        url = api_url or os.environ.get("MCD_API_URL") or file.get("apiUrl") or ""
        self.api_url = url.rstrip("/")
        self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
        self._app_key = app_key or os.environ.get("MCD_APP_KEY") or file.get("appKey") or ""

    def available(self) -> bool:
        return bool(self.api_url and self._admin_key)

    def query(self, sql: str) -> list[dict]:
        r = requests.post(
            f"{self.api_url}/api/admin/query",
            headers={"x-mcd-admin": self._admin_key, "content-type": "application/json"},
            json={"sql": sql},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()

    def pending(self) -> list[dict]:
        r = requests.get(
            f"{self.api_url}/api/admin/pending",
            headers={"x-mcd-admin": self._admin_key},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()

    def __repr__(self) -> str:  # never leak key values
        return f"McdClient(api_url={self.api_url!r}, admin_key=<set:{bool(self._admin_key)}>)"
