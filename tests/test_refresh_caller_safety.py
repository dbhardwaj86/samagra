"""S-06 (Codex H3): refresh() callers must survive a failed adapter.

``catalog.refresh()`` intentionally maps a FAILED source to ``None`` in the
per-source totals dict (last-known-good preserved). Callers that naively do
``sum(totals.values())`` then crash with ``TypeError: unsupported operand
type(s) for +: 'int' and 'NoneType'`` on the exact failure path S-05 was built
for. Both the ``samagra refresh`` CLI and the scheduler tick must instead:

  - NOT raise,
  - count only successful artifacts, and
  - SURFACE which sources failed (never hide the failure).

``config.DATA_DB`` is auto-isolated to a per-test temp DB by ``tests/conftest.py``.
"""
from __future__ import annotations

import io
from contextlib import redirect_stdout

from samagra import __main__ as cli
from samagra import catalog


def test_cmd_refresh_survives_failed_adapter(monkeypatch):
    """`samagra refresh` must not crash when an adapter fails, and must name it."""
    # refresh() returns None for the failed source ("bad"), int for the good one.
    monkeypatch.setattr(catalog, "refresh", lambda verbose=True: {"good": 5, "bad": None})

    buf = io.StringIO()
    with redirect_stdout(buf):
        cli.cmd_refresh(object())  # stub args; cmd_refresh ignores them

    out = buf.getvalue()
    # Did NOT raise (we got here) and the failed source is surfaced by name.
    assert "bad" in out, f"failed source must be named in output, got:\n{out}"
    # Only the successful artifacts are counted (5), the None is not summed.
    assert "5" in out, f"successful artifact count (5) must appear, got:\n{out}"


def test_cmd_refresh_all_ok_unchanged(monkeypatch):
    """Happy path: no failures -> the original 'Done. N artifacts...' message."""
    monkeypatch.setattr(catalog, "refresh", lambda verbose=True: {"good": 5, "more": 2})

    buf = io.StringIO()
    with redirect_stdout(buf):
        cli.cmd_refresh(object())

    out = buf.getvalue()
    assert "7" in out, f"total artifacts (7) must appear, got:\n{out}"
    assert "failed" not in out.lower(), f"no failure wording when all OK, got:\n{out}"
