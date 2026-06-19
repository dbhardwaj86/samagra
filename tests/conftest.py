"""Shared pytest fixtures for the SAMAGRA test suite.

S-01 (F-14): test isolation. ``catalog.connect()`` reads ``config.DATA_DB`` at
call time, so redirecting ``config.DATA_DB`` to a per-test temp path before any
test runs guarantees the suite never reads or overwrites the real ``samagra.db``
(the production catalog).
"""
from __future__ import annotations

import pytest

from samagra import config


@pytest.fixture(autouse=True)
def isolate_data_db(monkeypatch, tmp_path):
    """Repoint ``config.DATA_DB`` at a per-test temp DB for every test.

    Function-scoped + autouse, so every test in the suite is isolated from the
    real catalog DB without having to opt in. ``monkeypatch`` restores the
    original value automatically at teardown.
    """
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
