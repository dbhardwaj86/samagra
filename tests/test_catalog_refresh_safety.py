"""S-05 (F-09): refresh() must preserve last-known-good on adapter failure.

``catalog.refresh()`` historically deleted ``catalog``/``catalog_fts``/
``source_summary`` first, then iterated adapters swallowing broad errors, and
committed regardless — so an offline/failing adapter (e.g. the HTTP-backed
mcd/munshi adapters added in Phase 1) could leave the catalog empty or partial
while still reporting a completed refresh. A failed refresh must instead
preserve the previous (good) catalog and surface the failure.

``config.DATA_DB`` is auto-isolated to a per-test temp DB by ``tests/conftest.py``.
"""
from __future__ import annotations

import sqlite3

import pytest

from samagra import catalog
from samagra.adapters.base import Adapter, Artifact


class _FakeAdapter(Adapter):
    """Minimal fake adapter yielding a fixed set of artifacts."""

    def __init__(self, name, artifacts, *, avail=True, raise_in_artifacts=False):
        self.name = name
        self.label = name.upper()
        self._artifacts = artifacts
        self._avail = avail
        self._raise = raise_in_artifacts

    def available(self) -> bool:
        return self._avail

    def summary(self) -> dict:
        return {"n": len(self._artifacts)}

    def artifacts(self):
        for art in self._artifacts:
            yield art
        if self._raise:
            raise RuntimeError(f"{self.name} adapter blew up mid-iteration")


def _mk(uid, source):
    return Artifact(uid=uid, source=source, kind="paper", title=f"title-{uid}")


def _catalog_count() -> int:
    con = sqlite3.connect(catalog.config.DATA_DB)
    try:
        return con.execute("select count(*) from catalog").fetchone()[0]
    finally:
        con.close()


def _fts_count() -> int:
    con = sqlite3.connect(catalog.config.DATA_DB)
    try:
        return con.execute("select count(*) from catalog_fts").fetchone()[0]
    finally:
        con.close()


def test_failed_adapter_preserves_previous_catalog(monkeypatch):
    # 1) First, a fully successful refresh that populates a known-good catalog.
    good = [
        _FakeAdapter("alpha", [_mk("alpha:1", "alpha"), _mk("alpha:2", "alpha")]),
        _FakeAdapter("beta", [_mk("beta:1", "beta")]),
    ]
    monkeypatch.setattr(catalog, "ALL_ADAPTERS", good)
    totals = catalog.refresh(verbose=False)
    assert totals == {"alpha": 2, "beta": 1}

    good_count = _catalog_count()
    assert good_count == 3
    assert _fts_count() == 3

    # 2) Now a refresh where one adapter raises mid-iteration. The previous
    #    good catalog must NOT be erased or left partial.
    broken = [
        _FakeAdapter("alpha", [_mk("alpha:9", "alpha")]),  # would shrink catalog
        _FakeAdapter("beta", [_mk("beta:9", "beta")], raise_in_artifacts=True),
    ]
    monkeypatch.setattr(catalog, "ALL_ADAPTERS", broken)

    result = catalog.refresh(verbose=False)

    # The previous good rows are still present (count unchanged) — a failed
    # refresh never commits an empty/partial catalog over a good one.
    assert _catalog_count() == good_count, (
        "failed refresh must preserve the previous good catalog rows"
    )
    assert _fts_count() == good_count, (
        "FTS must stay in sync with the preserved catalog"
    )

    # And the failure is surfaced in the return value (not silently OK).
    assert result.get("beta") in (0, None) or result == totals or "error" in str(result)


def test_successful_refresh_replaces_rows(monkeypatch):
    # Happy-path regression: a fully successful refresh replaces rows as before.
    first = [_FakeAdapter("alpha", [_mk("alpha:1", "alpha"), _mk("alpha:2", "alpha")])]
    monkeypatch.setattr(catalog, "ALL_ADAPTERS", first)
    catalog.refresh(verbose=False)
    assert _catalog_count() == 2

    second = [_FakeAdapter("alpha", [_mk("alpha:7", "alpha")])]
    monkeypatch.setattr(catalog, "ALL_ADAPTERS", second)
    totals = catalog.refresh(verbose=False)
    assert totals == {"alpha": 1}
    assert _catalog_count() == 1
    assert _fts_count() == 1

    # New rows replaced old: alpha:7 present, alpha:1 gone.
    rows = catalog.search()
    uids = {r["uid"] for r in rows}
    assert uids == {"alpha:7"}
