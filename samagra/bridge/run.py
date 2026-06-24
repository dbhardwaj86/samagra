"""DEPRECATED (Phase C3 / F-C2): the munshi->mcd write folded into the factory
`seed` lane, which is now the ONE canonical mcd writer. These verbs remain as thin
delegating aliases — a one-line deprecation notice on stderr + a forward to the
factory — so existing muscle-memory and scripts keep working. They add NO second
write path: `submit` forwards to the factory `build` (the only code path that
calls McdClient.create_seed). Prefer `samagra factory {scan,approve,build}`.

The pure helpers (classify_item, item_text, resolve_pointers) keep their homes in
this package and are imported by the factory; only the WORKFLOW verbs are folded.
"""
from __future__ import annotations

import sys

from ..factory import run as _factory

_DEPRECATION = ("[deprecated] `samagra bridge` folded into the factory seed lane "
                "(Phase C3) — use `samagra factory {scan,approve,build}`.")


def scan(dry: bool = True) -> list[dict]:
    print(_DEPRECATION, file=sys.stderr)
    return _factory.scan(dry=dry)


def approve(assignment_id: str) -> dict:
    print(_DEPRECATION, file=sys.stderr)
    return _factory.approve(assignment_id)


def submit(assignment_id: str) -> dict:
    """RETIRED prod write — forwards to the factory build (the one mcd writer)."""
    print(_DEPRECATION, file=sys.stderr)
    return _factory.build(assignment_id)
