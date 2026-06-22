"""W1.3 — guard for SAMAGRA_QX_SERVER_URL (SSRF / open asset-host).

`QX_SERVER_URL` is trusted as both the backend `requests.get` target and the
figure `<img src>` host the browser loads. Constrain it to loopback unless the
operator explicitly opts a host in via `SAMAGRA_QX_SERVER_ALLOWED_HOSTS`.
"""
from __future__ import annotations

from urllib.parse import urlparse

from .. import config

_LOOPBACK = frozenset({"127.0.0.1", "::1", "localhost"})


def _allowlist() -> set[str]:
    raw = config.QX_SERVER_ALLOWED_HOSTS or ""
    return {h.strip().lower() for h in raw.split(",") if h.strip()}


def host_is_allowed(host: str | None) -> bool:
    if not host:
        return False
    host = host.lower()
    return host in _LOOPBACK or host in _allowlist()


def validate_qx_url(url: str) -> str:
    """Return `url` if it targets an allowed host over http(s), else ValueError."""
    parsed = urlparse(url or "")
    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"QX_SERVER_URL must be http(s), got {parsed.scheme!r}")
    if not host_is_allowed(parsed.hostname):
        raise ValueError(
            f"QX_SERVER_URL host {parsed.hostname!r} is not loopback and not in "
            "SAMAGRA_QX_SERVER_ALLOWED_HOSTS — refusing (SSRF / asset-host guard)")
    return url
