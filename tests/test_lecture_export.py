"""W3.1 — cover the lecture exporter's Pandoc DOCX subprocess + the export_one
orchestration. The "130 eqns verified" note was a one-off manual check, not a
regression guard; this mocks the Pandoc/Drive boundary and pins the wiring.
"""
from __future__ import annotations

import types

import pytest

from samagra import config
from samagra.lectures import export as lex


# --- _html_to_docx ------------------------------------------------------
def test_html_to_docx_skips_when_pandoc_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(lex.shutil, "which", lambda name: None)
    assert lex._html_to_docx(tmp_path / "a.html", tmp_path / "a.docx") is False


def test_html_to_docx_runs_pandoc_with_math_extension(monkeypatch, tmp_path):
    monkeypatch.setattr(lex.shutil, "which", lambda name: "/usr/bin/pandoc")
    captured = {}

    def fake_run(cmd, capture_output=True, text=True):
        captured["cmd"] = cmd
        return types.SimpleNamespace(returncode=0, stderr="")

    monkeypatch.setattr(lex.subprocess, "run", fake_run)
    ok = lex._html_to_docx(tmp_path / "a.html", tmp_path / "a.docx")
    assert ok is True
    # the tex_math_dollars extension is what turns $...$ into native OMML
    assert "html+tex_math_dollars" in captured["cmd"]
    assert "docx" in captured["cmd"]


def test_html_to_docx_returns_false_on_pandoc_error(monkeypatch, tmp_path):
    monkeypatch.setattr(lex.shutil, "which", lambda name: "/usr/bin/pandoc")
    monkeypatch.setattr(lex.subprocess, "run",
                        lambda *a, **k: types.SimpleNamespace(returncode=1, stderr="boom"))
    assert lex._html_to_docx(tmp_path / "a.html", tmp_path / "a.docx") is False


# --- export_one orchestration ------------------------------------------
def _wire_content(monkeypatch):
    monkeypatch.setattr(lex.render, "load_chapter",
                        lambda slug: {"title": "Vectors", "sections": []})
    monkeypatch.setattr(lex.render, "render_chapter_html",
                        lambda content, label="": f"<html>{label}</html>")


def test_export_one_writes_html_and_uploads_when_docx_built(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path)
    _wire_content(monkeypatch)
    monkeypatch.setattr(lex, "_html_to_docx", lambda h, d: True)
    monkeypatch.setattr(lex.gdocs, "upload", lambda docx, title: "https://docs/x")

    out = lex.export_one("vectors", "thick")
    assert out["variant"] == "thick"
    assert out["html"].endswith("vectors-thick.html")
    assert out["docx"].endswith("vectors-thick.docx")
    assert out["gdoc"] == "https://docs/x"
    # the HTML file is really written
    assert (tmp_path / "vectors" / "vectors-thick.html").read_text(encoding="utf-8")


def test_export_one_skips_upload_when_docx_absent(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path)
    _wire_content(monkeypatch)
    monkeypatch.setattr(lex, "_html_to_docx", lambda h, d: False)
    uploaded = []
    monkeypatch.setattr(lex.gdocs, "upload",
                        lambda docx, title: uploaded.append(title))

    out = lex.export_one("vectors", "thin")
    assert out["docx"] is None and out["gdoc"] is None
    assert uploaded == []  # no upload attempted without a DOCX
