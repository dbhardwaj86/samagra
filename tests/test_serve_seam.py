"""Serve-seam tests: SPA fallback never shadows the API; serves index when built."""
from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from fastapi import HTTPException

from samagra import config
from samagra.api import app as app_module


def test_spa_fallback_404s_api_paths():
    with pytest.raises(HTTPException) as ei:
        app_module.spa("api/overview")
    assert ei.value.status_code == 404


def test_spa_fallback_503_when_not_built(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "REPO_ROOT", tmp_path)  # dist absent
    importlib.reload(app_module)
    with pytest.raises(HTTPException) as ei:
        app_module.spa("dashboard")
    assert ei.value.status_code == 503
    importlib.reload(app_module)  # restore real module


def test_spa_fallback_serves_index_when_built(monkeypatch, tmp_path):
    dist = tmp_path / "frontend" / "dist"
    dist.mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><div id=root>", encoding="utf-8")
    monkeypatch.setattr(config, "REPO_ROOT", tmp_path)
    importlib.reload(app_module)
    resp = app_module.spa("notes")
    assert Path(resp.path).name == "index.html"
    importlib.reload(app_module)


def test_jinja_index_route_is_gone():
    paths = {r.path for r in app_module.app.routes}
    assert "/static" not in paths  # /static mount removed
