"""S-01 — Test-harness isolation (F-14).

Proves the autouse conftest fixture redirects ``config.DATA_DB`` to a per-test
temp DB so the test suite never reads or overwrites the real ``samagra.db``.

The real DB path + its mtime/existence are captured at *import time*, before any
fixture overrides ``config.DATA_DB``. That captured value is the genuine on-disk
path; the assertion that matters is "the real samagra.db is unchanged
(same mtime if it pre-existed, or still absent) after a refresh during tests."
"""
from __future__ import annotations

from samagra import catalog, config

# Capture the REAL DB path + state at import time — before the autouse fixture
# (added in conftest.py) repoints config.DATA_DB to a tmp path.
_REAL_DB = config.DATA_DB
_REAL_EXISTED = _REAL_DB.exists()
_REAL_MTIME_NS = _REAL_DB.stat().st_mtime_ns if _REAL_EXISTED else None


def test_refresh_does_not_touch_real_db():
    # The autouse conftest fixture should have repointed config.DATA_DB to a
    # per-test tmp path that is NOT the real DB.
    assert config.DATA_DB != _REAL_DB, (
        "config.DATA_DB was not redirected away from the real samagra.db; "
        "the autouse isolation fixture is missing or not applied."
    )

    # A full refresh is destructive (DELETE then re-insert). It must hit the
    # tmp DB only.
    catalog.refresh(verbose=False)

    # The tmp DB must now exist and be non-empty.
    assert config.DATA_DB.exists(), "refresh did not create the temp DB"
    assert config.DATA_DB.stat().st_size > 0, "temp DB is empty after refresh"

    # The REAL samagra.db must be untouched.
    if _REAL_EXISTED:
        assert _REAL_DB.exists(), "real samagra.db disappeared during the test"
        assert _REAL_DB.stat().st_mtime_ns == _REAL_MTIME_NS, (
            "real samagra.db was modified by refresh() during tests "
            "(mtime changed) — isolation failed"
        )
    else:
        assert not _REAL_DB.exists(), (
            "refresh() created the real samagra.db during tests — "
            "isolation failed"
        )
