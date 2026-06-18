"""Render a physics-textbook chapter (content.json) to standalone HTML.

Used by the portal for live previews and by the Phase C exporter as the HTML
deliverable. content.json blocks already carry HTML; we wrap them in a clean,
MathJax-enabled, print-friendly document consistent with the workspace style.
"""
from __future__ import annotations

import html as _html
import json

from .. import config

DOC_CSS = """
:root{--bg:#ffffff;--fg:#1f2933;--muted:#647084;--accent:#4f46e5;--line:#e5e7eb;--soft:#f8fafc;}
*{box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--fg);
  background:var(--bg);line-height:1.65;margin:0;}
.wrap{max-width:860px;margin:0 auto;padding:48px 24px 96px;}
header.doc{border-bottom:2px solid var(--accent);padding-bottom:16px;margin-bottom:32px;}
header.doc .kicker{color:var(--accent);font-weight:600;font-size:13px;letter-spacing:.08em;text-transform:uppercase;}
header.doc h1{font-size:30px;margin:6px 0 4px;}
header.doc .sub{color:var(--muted);font-size:15px;}
section{margin:30px 0;}
section h2{font-size:21px;margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line);}
h3{font-size:16px;margin:18px 0 6px;}
p{margin:10px 0;}
.callout{background:var(--soft);border-left:4px solid var(--accent);border-radius:8px;
  padding:12px 16px;margin:14px 0;}
.image-need{background:#fff7ed;border:1px dashed #fdba74;color:#9a3412;border-radius:8px;
  padding:10px 14px;margin:14px 0;font-size:14px;}
figure{margin:18px 0;text-align:center;}
figure svg{max-width:100%;height:auto;}
figcaption{color:var(--muted);font-size:13px;margin-top:6px;}
table{border-collapse:collapse;width:100%;margin:14px 0;}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;}
.tag{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;
  padding:2px 10px;font-size:12px;color:var(--muted);}
@media print{.wrap{max-width:none;padding:0;}header.doc{page-break-after:avoid;}section{page-break-inside:avoid;}}
"""

DOC_TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>window.MathJax={{tex:{{inlineMath:[['$','$'],['\\\\(','\\\\)']],displayMath:[['$$','$$'],['\\\\[','\\\\]']]}}}};</script>
<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
<style>{css}</style></head>
<body><div class="wrap">
<header class="doc"><div class="kicker">{kicker}</div><h1>{title}</h1>
<div class="sub">{subtitle}</div></header>
{body}
</div></body></html>
"""


def load_chapter(slug: str) -> dict:
    cj = config.TEXTBOOK_CHAPTERS / slug / "content.json"
    if not cj.exists():
        raise FileNotFoundError(cj)
    return json.loads(cj.read_text(encoding="utf-8"))


def _block_html(block: dict) -> str:
    t = block.get("type")
    h = block.get("html") or ""
    if t == "callout":
        return h if "callout" in h else f'<div class="callout">{h}</div>'
    if t == "image-need":
        note = block.get("note") or block.get("description") or "figure to be added"
        return f'<div class="image-need">[figure] {_html.escape(str(note))}</div>'
    if t == "subheading":
        return h if h.lstrip().startswith("<h") else f"<h3>{h}</h3>"
    return h  # prose / equation / figure are already HTML


def sections_to_body(content: dict) -> str:
    parts: list[str] = []
    for sec in content.get("sections", []):
        parts.append(f'<section><h2>{_html.escape(sec.get("title", ""))}</h2>')
        for block in sec.get("blocks", []) or []:
            parts.append(_block_html(block))
        parts.append("</section>")
    return "\n".join(parts)


def render_chapter_html(content: dict, label: str = "Full lecture") -> str:
    """Render a content.json dict (thick original, or a thin variant) to HTML."""
    return DOC_TEMPLATE.format(
        title=_html.escape(content.get("title", "Lecture")),
        subtitle=_html.escape(content.get("subtitle", "")),
        kicker=_html.escape(label),
        css=DOC_CSS,
        body=sections_to_body(content),
    )
