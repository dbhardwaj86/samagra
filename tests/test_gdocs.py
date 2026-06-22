"""W3.1 — cover gdocs.upload (creds-gated Google Drive export). Mock the Drive
boundary; the upload path had zero coverage despite the scheduler driving it.
"""
from __future__ import annotations

import types

import pytest

from samagra.lectures import gdocs


def test_configured_false_without_env(monkeypatch):
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT", raising=False)
    assert gdocs.configured() is False


def test_upload_returns_none_when_unconfigured(monkeypatch, tmp_path):
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT", raising=False)
    assert gdocs.upload(tmp_path / "a.docx", "Title") is None


def test_upload_returns_none_when_client_file_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT", str(tmp_path / "nope.json"))
    assert gdocs.upload(tmp_path / "a.docx", "Title") is None


def test_upload_happy_path_returns_weblink(monkeypatch, tmp_path):
    pytest.importorskip("googleapiclient.discovery")
    pytest.importorskip("google.oauth2.credentials")
    import google.oauth2.credentials as gcred
    import googleapiclient.discovery as gdisc
    import googleapiclient.http as ghttp

    client = tmp_path / "client_secret.json"
    client.write_text("{}", encoding="utf-8")
    (tmp_path / "google_token.json").write_text("{}", encoding="utf-8")
    docx = tmp_path / "vectors-thick.docx"
    docx.write_bytes(b"PK")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT", str(client))

    monkeypatch.setattr(gcred.Credentials, "from_authorized_user_file",
                        classmethod(lambda cls, *a, **k: types.SimpleNamespace(valid=True)))
    monkeypatch.setattr(ghttp, "MediaFileUpload",
                        lambda *a, **k: types.SimpleNamespace())

    created = {"id": "doc1", "webViewLink": "https://docs.google.com/document/d/doc1"}

    class FakeFiles:
        def create(self, **kw):
            FakeFiles.body = kw.get("body")
            return types.SimpleNamespace(execute=lambda: created)

    class FakeDrive:
        def files(self):
            return FakeFiles()

    monkeypatch.setattr(gdisc, "build", lambda *a, **k: FakeDrive())

    link = gdocs.upload(docx, "Vectors — Full lecture")
    assert link == "https://docs.google.com/document/d/doc1"
    # the upload targets a native Google Doc
    assert FakeFiles.body["mimeType"] == "application/vnd.google-apps.document"
