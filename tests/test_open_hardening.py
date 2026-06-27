"""W1.5 — tighten the /open file server (defence-in-depth).

Traversal is already blocked (paths must resolve under a configured source
root), but ANY file under those broad roots was servable. Add an extension
allowlist and deny hidden / secret-looking names so a stray `.env`, `*.pem`, or
token file under a source root can't be exfiltrated by path.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from samagra.api import app as api_app


@pytest.fixture
def served_root(monkeypatch, tmp_path):
    monkeypatch.setattr(api_app, "ALLOWED_ROOTS", [tmp_path])
    return tmp_path


def _get(path):
    return TestClient(api_app.app).get("/open", params={"path": str(path)})


def test_allowed_extension_is_served(served_root):
    f = served_root / "doc.html"
    f.write_text("<h1>ok</h1>", encoding="utf-8")
    assert _get(f).status_code == 200


def test_markdown_is_served(served_root):
    f = served_root / "notes.md"
    f.write_text("# notes", encoding="utf-8")
    assert _get(f).status_code == 200


def test_disallowed_extension_is_refused(served_root):
    f = served_root / "payload.bin"
    f.write_bytes(b"\x00\x01")
    assert _get(f).status_code == 403


def test_hidden_dotfile_is_refused(served_root):
    f = served_root / ".env"
    f.write_text("MUNSHI_SECRET=supersecret", encoding="utf-8")
    assert _get(f).status_code == 403


def test_secret_named_file_is_refused_even_with_ok_extension(served_root):
    f = served_root / "munshi-secret.txt"
    f.write_text("token=abc", encoding="utf-8")
    assert _get(f).status_code == 403


def test_pem_key_is_refused(served_root):
    f = served_root / "cert.pem"
    f.write_text("-----BEGIN PRIVATE KEY-----", encoding="utf-8")
    assert _get(f).status_code == 403


def test_file_inside_hidden_directory_is_refused(served_root):
    d = served_root / ".git"
    d.mkdir()
    f = d / "config.txt"
    f.write_text("x", encoding="utf-8")
    assert _get(f).status_code == 403


def test_secret_named_directory_is_refused(served_root):
    # A secret-named DIRECTORY component must be denied too, not just the basename
    # (an allowed-extension, innocuous-named file under secrets/ stays unservable).
    d = served_root / "secrets"
    d.mkdir()
    f = d / "db.json"
    f.write_text("{}", encoding="utf-8")
    assert _get(f).status_code == 403


def test_outside_root_still_403(served_root, tmp_path):
    # the pre-existing root check is unchanged
    other = tmp_path.parent / "elsewhere.html"
    other.write_text("x", encoding="utf-8")
    assert _get(other).status_code == 403


def test_qx_root_not_in_allowed_roots():
    # review 27 MED-2: the QX source root holds answer-bearing audit/QC JSON
    # (codex_jobs/*/reports/*.report.json) + raw question data. QX is exposed ONLY
    # via the answer-safe /api/questions proxy; the raw /open file server must not
    # advertise the QX root (catalog QX rows carry relative paths that never
    # resolve there anyway — only absolute-path answer-audit access is removed).
    from samagra import config
    assert config.QX_ROOT not in api_app.ALLOWED_ROOTS
    # the other source roots stay servable
    assert config.TEXTBOOK_ROOT in api_app.ALLOWED_ROOTS
    assert config.EXPORT_DIR in api_app.ALLOWED_ROOTS
