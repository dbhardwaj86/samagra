"""Thin/thick multi-format lecture export: HTML + local DOCX + Google Docs.

PDF is intentionally omitted (browser/Word print covers it). DOCX is produced via
Pandoc with the tex_math_dollars extension so `$...$` math becomes native OMML
equations. Google Docs upload is creds-gated (see gdocs.py).
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from .. import config
from . import gdocs, render
from .thin import build_thin

LABELS = {"thick": "Full lecture", "thin": "Revision sheet"}


def _out_dir(slug: str) -> Path:
    d = config.EXPORT_DIR / slug
    d.mkdir(parents=True, exist_ok=True)
    return d


def _html_to_docx(html_path: Path, docx_path: Path) -> bool:
    pandoc = shutil.which("pandoc")
    if not pandoc:
        print("  ! pandoc not on PATH — skipping DOCX")
        return False
    cmd = [pandoc, str(html_path), "-f", "html+tex_math_dollars",
           "-t", "docx", "-o", str(docx_path)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(f"  ! pandoc failed: {proc.stderr.strip()[:200]}")
        return False
    return True


def export_one(slug: str, variant: str) -> dict:
    content = render.load_chapter(slug)
    if variant == "thin":
        content = build_thin(content)
    label = LABELS[variant]
    html = render.render_chapter_html(content, label=label)

    out = _out_dir(slug)
    html_path = out / f"{slug}-{variant}.html"
    html_path.write_text(html, encoding="utf-8")

    docx_path = out / f"{slug}-{variant}.docx"
    have_docx = _html_to_docx(html_path, docx_path)

    gdoc = None
    if have_docx:
        title = f"{content.get('title', slug)} — {label}"
        gdoc = gdocs.upload(docx_path, title)

    return {
        "variant": variant,
        "html": str(html_path),
        "docx": str(docx_path) if have_docx else None,
        "gdoc": gdoc,
    }


def run(chapter: str, variant: str = "both") -> list[dict]:
    variants = ["thin", "thick"] if variant == "both" else [variant]
    print(f"Exporting chapter {chapter!r}: {', '.join(variants)}")
    results = []
    for v in variants:
        r = export_one(chapter, v)
        results.append(r)
        print(f"  [{v}] html  = {r['html']}")
        print(f"        docx  = {r['docx']}")
        print(f"        gdoc  = {r['gdoc'] or '(not configured — set GOOGLE_OAUTH_CLIENT)'}")
    return results
