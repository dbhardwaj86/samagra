"""W3.3 — `samagra serve --reload` contradicts the D-1 orphaned-worker gotcha
(a reload worker once held the port). Guard it: --reload is ignored with a loud
warning unless SAMAGRA_ALLOW_RELOAD is explicitly set.
"""
from __future__ import annotations

import types

import pytest

from samagra import __main__ as cli


class _FakeUvicorn(types.SimpleNamespace):
    def run(self, *a, **kw):
        self.called_kw = kw


@pytest.fixture
def fake_uvicorn(monkeypatch):
    fake = _FakeUvicorn()
    # cmd_serve does `import uvicorn` inside the function; inject our fake.
    monkeypatch.setitem(__import__("sys").modules, "uvicorn", fake)
    return fake


def _args(reload):
    return types.SimpleNamespace(host="127.0.0.1", port=8799, reload=reload)


def test_reload_is_disabled_by_default(fake_uvicorn, monkeypatch, capsys):
    monkeypatch.delenv("SAMAGRA_ALLOW_RELOAD", raising=False)
    cli.cmd_serve(_args(reload=True))
    assert fake_uvicorn.called_kw["reload"] is False
    assert "reload" in capsys.readouterr().out.lower()


def test_reload_allowed_with_explicit_override(fake_uvicorn, monkeypatch):
    monkeypatch.setenv("SAMAGRA_ALLOW_RELOAD", "1")
    cli.cmd_serve(_args(reload=True))
    assert fake_uvicorn.called_kw["reload"] is True


def test_no_reload_flag_runs_without_reload(fake_uvicorn, monkeypatch):
    monkeypatch.delenv("SAMAGRA_ALLOW_RELOAD", raising=False)
    cli.cmd_serve(_args(reload=False))
    assert fake_uvicorn.called_kw["reload"] is False
