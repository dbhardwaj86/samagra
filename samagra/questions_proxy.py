"""Helpers for proxying the QX question engine's JSON search into SAMAGRA.

QX renders question HTML with relative asset URLs (``/asset?slug=..&id=..``) for
figures and equation-image fallbacks. The Questions app is served from SAMAGRA's
own origin, so those relative URLs would resolve against SAMAGRA (404). Rewrite
them to absolute QX-server URLs so the browser loads assets directly from QX.
Pure string transform — no HTTP, no parsing beyond a prefix replace.
"""
from __future__ import annotations

_REL = 'src="/asset?'


def absolutize_assets(payload: dict, qx_base_url: str) -> dict:
    """Rewrite every ``src="/asset?...`` in each result's HTML to an absolute QX
    URL. Mutates and returns ``payload``. No-op when there are no results / html."""
    base = (qx_base_url or "").rstrip("/")
    repl = f'src="{base}/asset?'
    for row in payload.get("results") or []:
        html = row.get("html")
        if isinstance(html, str) and _REL in html:
            row["html"] = html.replace(_REL, repl)
    return payload
