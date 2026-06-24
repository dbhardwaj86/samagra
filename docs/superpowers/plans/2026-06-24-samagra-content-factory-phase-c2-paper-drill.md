# Content Factory Phase C2 — `paper` / `drill` lanes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two QX-backed, answer-safe factory lanes — `paper` (Pariksha, a full question set) and `drill` (Abhyaas, a smaller focused set) — so one `textbook:<slug>` seed now fans to **5** captured local artifacts, with the real `_assert_no_answer_leak` guard enforced for `kind="qx"`.

**Architecture:** A new pure-ish engine `samagra/factory/paper.py` reads the always-up local QX engine's read-only `/api/qsearch` (which renders question-only HTML — stem/options/passage/matrix with KaTeX `data-tex` spans + figure `<img>`s — and *never* renders answers/solutions) and assembles a printable, KaTeX-enabled question paper under `config.EXPORT_DIR`. The `Line.kind="qx"` seam (added in C1) is consumed here: `dispatch.run_line` routes `kind=="qx"` lanes to the engine, and `dispatch._assert_no_answer_leak` becomes **real** for `kind=="qx"` — a defense-in-depth structural scan of the assembled artifact that refuses any answer/solution marker at the guarded `build()` write boundary. `build()` itself is **unchanged** (the five crash-safety guards are identical for every kind). QX-unreachable ⇒ the engine raises `ValueError` *before writing any file* ⇒ `build()` refuses cleanly with no partial artifact (mirrors the bridge's munshi-down posture, review 22 M2).

**Tech Stack:** Python 3.14, pytest (TDD), the existing `samagra.clients.QxClient` (thin `requests` client to QX `:8783`), `samagra.questions_proxy.absolutize_assets`, KaTeX 0.16.9 (CDN, in the printable only). No new dependency, no migration, no new prod write path (QX is read-only), no new web endpoint, no CLI change.

---

## Context an implementer needs (read before Task 1)

**Where this sits.** Phase 1 built the dispatch spine (`samagra/factory/{lines,dispatch,run,outbox}.py` + CLI `samagra factory plan|approve|approve-seed|build`). C1 added the `deck` lane and the `Line.kind` seam (`local|qx|mcd`, default `local`). C2 activates the `qx` kind. C3 (next) will activate `mcd` (the bridge fold). Spec: `docs/superpowers/specs/2026-06-23-samagra-content-factory-phase-c-design.md` §3.2 + §4.

**The guarded boundary (`samagra/factory/run.py:132` `build()`) — DO NOT MODIFY.** Its order is: load → workflow-firewall → guard1 status `approved` → guard2 no prior `product_created` → guard3 not in-flight → `validate_seed_for_line` (cheap pre-check) → append `product_building` intent → `result = dispatch.run_line(line, slug)` → `dispatch.validate_product(line, result)` (guard4) → `artifact_ref = result["html"]` → append `product_created` → set `captured` (guard5). C2 changes ONLY `dispatch.run_line` (add the `qx` branch) and `dispatch._assert_no_answer_leak` (make it real for `qx`), plus the `lines.py` registry. Everything else is reuse.

**QX response shape** (from `gpt-extract-ques/tools/qx/json_search.py::search_payload`, grounded live):
```python
{
  "total": 1, "page": 1, "page_size": 25, "mode": "exact", "degraded": False,
  "results": [
    {"q_uid": "q1", "slug": "paper-a", "q_type": "mcq_single",
     "subject": "physics", "chapter": "Kinematics", "difficulty": None,
     "snippet": "A projectile [fig]",
     "html": '<div class="stem">A projectile</div><img class="fig" src="/asset?slug=paper-a&amp;id=f1">'},
  ],
  "facets": {"subject": [["physics", 1]], "chapter": [["Kinematics", 1]], "qtype": [["mcq_single", 1]]},
}
```
The per-result `html` is **question-only** (passage/stem/options/matrix). QX's search route NEVER renders `rj["answer"]` — answers live only in QX's *authoring* views (`gui/builder_pages.py`, which emits `<div class="answer"><span class="answer-label">Ans: …`). We do not trust that and re-assert at our boundary.

**QX math markup** (`render_html.py`, `math='standalone'`): each equation →
`<span class="mwrap"><span class="ktx" data-tex="\\Delta x"></span><img class="eq eq-hidden" src="/asset?…" …></span>`.
The `.ktx[data-tex]` span is rendered by KaTeX client-side; if KaTeX is absent/fails, QX un-hides the `img.eq` fallback (its `renderAllMath`, `gui/qx_browser.py:571`). The printable mirrors this exactly.

**`QxClient`** (`samagra/clients/qx_client.py`): `QxClient(base_url=None)` (defaults to `config.QX_SERVER_URL` = `http://127.0.0.1:8783`, validates the URL for SSRF). `.search(*, q="", mode="exact", subject=None, chapter=None, qtype=None, page=1) -> dict`. Tests monkeypatch `samagra.factory.paper.QxClient` (the import target), exactly as `tests/test_api_questions.py` monkeypatches `api_app.QxClient`.

**`absolutize_assets`** (`samagra/questions_proxy.py`): `absolutize_assets(payload: dict, qx_base_url: str) -> dict` rewrites every `src="/asset?…"` in `payload["results"][*]["html"]` to an absolute QX URL, **mutating** the rows in place. No-op when no results/html.

**Test isolation:** the engine tests monkeypatch `config.EXPORT_DIR` to a tmp dir and `samagra.factory.paper.QxClient` to a fake. The `run.py` tests reuse the existing `factory_env` fixture in `tests/test_factory_run.py` (it repoints `GOVERNANCE_DB`/`DATA_DB`/`EXPORT_DIR`, calls `store.ensure_tables()`, `chdir`s to tmp).

**Run the suite:** `python -m pytest -q` from `C:\SandBox\claude_box\TeachingOS`. (A pre-existing env failure `tests/test_gdocs.py::test_upload_happy_path_returns_weblink` is unrelated — missing Google API libs. On Windows/Python-3.14 a `PermissionError [WinError 5]` during tmpdir cleanup can suppress pytest's final summary line; get the authoritative count via `python -m pytest -q --junitxml=junit.xml` and read `tests=`/`failures=` from the XML.)

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `samagra/factory/lines.py` | lane registry + `classify` | **Modify** — add `paper`+`drill` (kind `qx`), extend `_ORDER` |
| `samagra/factory/paper.py` | the QX paper/drill engine (pure-ish, read-only QX, local write) | **Create** |
| `samagra/factory/dispatch.py` | lane→engine routing + output guards | **Modify** — `run_line` qx branch + real `_assert_no_answer_leak` |
| `samagra/factory/run.py` | the guarded fan-out boundary | **Unchanged** (lane-kind design — verified, not edited) |
| `tests/test_factory_lines.py` | registry/classify | **Modify** — 5 lanes |
| `tests/test_factory_paper.py` | the engine | **Create** |
| `tests/test_factory_dispatch.py` | routing + guards | **Modify** — qx route + answer-leak |
| `tests/test_factory_run.py` | fan-out integration | **Modify** — 5-lane + poisoned-payload + QX-down |

---

### Task 1: Registry — `paper` + `drill` lanes (`kind="qx"`)

**Files:**
- Modify: `samagra/factory/lines.py`
- Test: `tests/test_factory_lines.py`

- [ ] **Step 1: Update the failing tests** — replace the whole body of `tests/test_factory_lines.py` with:

```python
from samagra.factory import lines


def test_textbook_seed_fans_to_five_content_lanes():
    assert lines.classify("textbook:circular-motion") == [
        "revision", "lecture", "deck", "paper", "drill"]


def test_unknown_source_fans_to_nothing():
    assert lines.classify("mcd:123") == []
    assert lines.classify("") == []


def test_registry_has_expected_output_labels():
    for key in ("revision", "lecture", "deck", "paper", "drill"):
        assert lines.LINES[key].expected_output
    assert set(lines.LINES) == {"revision", "lecture", "deck", "paper", "drill"}


def test_deck_line_is_local_kind_and_textbook_sourced():
    deck = lines.LINES["deck"]
    assert deck.kind == "local"
    assert deck.source_prefixes == ("textbook:",)


def test_existing_lanes_default_to_local_kind():
    assert lines.LINES["revision"].kind == "local"
    assert lines.LINES["lecture"].kind == "local"


def test_paper_and_drill_are_qx_kind_and_textbook_sourced():
    for key in ("paper", "drill"):
        ln = lines.LINES[key]
        assert ln.kind == "qx"
        assert ln.source_prefixes == ("textbook:",)
        assert ln.variant == key      # the engine reads variant to size paper vs drill
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_factory_lines.py -q`
Expected: FAIL — `test_textbook_seed_fans_to_five_content_lanes` (classify returns 3), `test_paper_and_drill_are_qx_kind_and_textbook_sourced` (KeyError), `test_registry_has_expected_output_labels` (set mismatch).

- [ ] **Step 3: Add the two lanes + extend `_ORDER`** — in `samagra/factory/lines.py`, replace the `LINES` dict and `_ORDER` with:

```python
LINES: dict[str, Line] = {
    "revision": Line("revision", "Revision sheet (thin lecture export)",
                     "thin", ("textbook:",)),
    "lecture": Line("lecture", "Full lecture (thick lecture export)",
                    "thick", ("textbook:",)),
    "deck": Line("deck", "Flashcard deck (equation/callout projection)",
                 "deck", ("textbook:",), "local"),
    "paper": Line("paper", "Question paper (answer-safe)",
                  "paper", ("textbook:",), "qx"),
    "drill": Line("drill", "Adaptive drill set (answer-safe)",
                  "drill", ("textbook:",), "qx"),
}

# Deterministic lane order so a seed always fans out the same way.
_ORDER = ["revision", "lecture", "deck", "paper", "drill"]
```

(`classify` is unchanged — it already filters `_ORDER` by each lane's `source_prefixes`, so the textbook lanes never see a `munshi:`/`mcd:` seed.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_factory_lines.py -q`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/lines.py tests/test_factory_lines.py
git commit -m "feat(factory): register qx paper/drill lanes; classify fans textbook to 5 (Phase C2)"
```

---

### Task 2: The QX paper/drill engine `samagra/factory/paper.py`

**Files:**
- Create: `samagra/factory/paper.py`
- Test: `tests/test_factory_paper.py`

- [ ] **Step 1: Write the failing tests** — create `tests/test_factory_paper.py`:

```python
import json
from pathlib import Path

import pytest

from samagra import config
from samagra.factory import paper


def _q(uid, body):
    """A QX result row carrying QX's question-only render (answer-free)."""
    return {"q_uid": uid, "slug": "circular-motion", "q_type": "mcq_single",
            "subject": "physics", "chapter": "Circular Motion", "difficulty": None,
            "snippet": body, "html": body}


class _FakeQx:
    """Stub of QxClient: returns a fixed answer-free payload, records the query."""
    base_url = "http://127.0.0.1:8783"
    last_kw = None

    def __init__(self, *a, **k):
        pass

    def search(self, **kw):
        _FakeQx.last_kw = kw
        return {
            "results": [
                _q("q1", '<div class="stem">A wheel spins. '
                         '<span class="mwrap"><span class="ktx" data-tex="v=\\\\omega R"></span>'
                         '<img class="eq eq-hidden" src="/asset?slug=circular-motion&amp;id=eq1"></span></div>'
                         '<div class="options"><div class="opt"><span class="opt-label">(A)</span> two</div></div>'),
                _q("q2", '<div class="stem">A car turns. '
                         '<img class="fig" src="/asset?slug=circular-motion&amp;id=f1"></div>'),
            ],
            "total": 2, "page": 1, "page_size": 25, "mode": "exact", "degraded": False,
            "facets": {},
        }


class _ManyQx(_FakeQx):
    def search(self, **kw):
        return {"results": [_q(f"q{i}", f'<div class="stem">Q{i}</div>') for i in range(12)],
                "total": 12, "page": 1, "page_size": 25, "mode": "exact",
                "degraded": False, "facets": {}}


class _DownQx:
    base_url = "http://127.0.0.1:8783"

    def __init__(self, *a, **k):
        pass

    def search(self, **kw):
        raise RuntimeError("connection refused")


@pytest.fixture
def export_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    return tmp_path / "exports"


def _deck_json(export_dir, name):
    return json.loads((export_dir / "circular-motion" / name).read_text(encoding="utf-8"))


def test_build_paper_queries_qx_with_dehyphenated_slug(export_dir, monkeypatch):
    monkeypatch.setattr(paper, "QxClient", _FakeQx)
    res = paper.build_paper("circular-motion", variant="paper")
    assert _FakeQx.last_kw["q"] == "circular motion"   # slug de-hyphenated -> query
    assert _FakeQx.last_kw["mode"] == "exact"
    assert res["variant"] == "paper" and res["questions"] == 2


def test_build_paper_writes_nonempty_katex_html_with_question_bodies(export_dir, monkeypatch):
    monkeypatch.setattr(paper, "QxClient", _FakeQx)
    res = paper.build_paper("circular-motion", variant="paper")
    html_path = Path(res["html"])
    assert html_path.is_file() and html_path.stat().st_size > 0
    html = html_path.read_text(encoding="utf-8")
    assert "katex" in html.lower()              # KaTeX loaded for the data-tex spans
    assert 'data-tex="v=\\\\omega R"' in html   # QX's math markup carried through
    assert "A wheel spins." in html and "A car turns." in html
    assert res["html"].endswith("circular-motion-paper.html")
    assert res["json"].endswith("circular-motion-paper.json")


def test_build_paper_absolutizes_asset_urls(export_dir, monkeypatch):
    monkeypatch.setattr(paper, "QxClient", _FakeQx)
    res = paper.build_paper("circular-motion", variant="paper")
    html = Path(res["html"]).read_text(encoding="utf-8")
    assert 'src="http://127.0.0.1:8783/asset?slug=circular-motion&amp;id=f1"' in html
    assert 'src="/asset?' not in html           # no relative asset URL survives


def test_build_paper_is_answer_free(export_dir, monkeypatch):
    monkeypatch.setattr(paper, "QxClient", _FakeQx)
    res = paper.build_paper("circular-motion", variant="paper")
    html = Path(res["html"]).read_text(encoding="utf-8").lower()
    for marker in ('class="answer"', "answer-label", "data-answer", 'class="solution"'):
        assert marker not in html


def test_drill_is_a_smaller_subset_than_paper(export_dir, monkeypatch):
    monkeypatch.setattr(paper, "QxClient", _ManyQx)
    full = paper.build_paper("circular-motion", variant="paper")
    drill = paper.build_paper("circular-motion", variant="drill")
    assert full["questions"] == 12
    assert drill["questions"] == paper._DRILL_SIZE     # capped to the focused size
    assert drill["questions"] < full["questions"]


def test_drill_keeps_all_when_fewer_than_cap(export_dir, monkeypatch):
    monkeypatch.setattr(paper, "QxClient", _FakeQx)   # only 2 results
    drill = paper.build_paper("circular-motion", variant="drill")
    assert drill["questions"] == 2


def test_build_paper_json_lists_questions(export_dir, monkeypatch):
    monkeypatch.setattr(paper, "QxClient", _FakeQx)
    paper.build_paper("circular-motion", variant="paper")
    data = _deck_json(export_dir, "circular-motion-paper.json")
    assert data["variant"] == "paper" and len(data["questions"]) == 2
    assert [q["q_uid"] for q in data["questions"]] == ["q1", "q2"]


def test_build_paper_raises_and_writes_nothing_when_qx_unreachable(export_dir, monkeypatch):
    monkeypatch.setattr(paper, "QxClient", _DownQx)
    with pytest.raises(ValueError):
        paper.build_paper("circular-motion", variant="paper")
    assert not (export_dir / "circular-motion" / "circular-motion-paper.html").exists()


def test_build_paper_result_is_json_serializable(export_dir, monkeypatch):
    monkeypatch.setattr(paper, "QxClient", _FakeQx)
    res = paper.build_paper("circular-motion", variant="paper")
    json.dumps(res)   # build() json.dumps the result into the event note — must not raise
    assert all(isinstance(v, (str, int)) for v in res.values())
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_factory_paper.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'samagra.factory.paper'`.

- [ ] **Step 3: Create the engine** — write `samagra/factory/paper.py`:

```python
"""The paper lane engine: assemble an answer-safe question paper / drill from QX.

Deterministic given QX's response — NO LLM. Reads the always-up local QX engine's
read-only /api/qsearch, whose per-result HTML is question-only (passage / stem /
options / matrix, with KaTeX data-tex spans + figure <img>s). QX's search route
NEVER renders rj["answer"] — answers live only in QX's authoring views — so this
lane is answer-free by construction; the build boundary's _assert_no_answer_leak
re-asserts that (defense in depth, dispatch.py).

Two variants share one engine: `paper` = the full first page of QX hits; `drill` =
a smaller focused subset (the first _DRILL_SIZE). Writes <slug>-<variant>.json (the
question list) + <slug>-<variant>.html (a printable, KaTeX-enabled paper) under
config.EXPORT_DIR/<slug>/. There is deliberately NO external/network WRITE here —
QX is read-only and the only writes are local files (no new prod write path).

If QX is unreachable, build_paper raises ValueError BEFORE writing any file, so the
guarded build() refuses cleanly with no partial artifact (mirrors the bridge's
munshi-down posture, review 22 M2).
"""
from __future__ import annotations

import html as _html
import json

from .. import config, questions_proxy
from ..clients import QxClient

# A drill is a smaller, focused subset of the chapter's questions (the first N of
# QX's stable exact-search order — deterministic, no LLM).
_DRILL_SIZE = 8

# Card/question layout + QX's standalone-math classes (.mwrap/.ktx/.eq-hidden) so
# the KaTeX spans render and the hidden image fallback stays hidden until needed.
# NOTE: this CSS must never name an `.answer`/`.solution` class — that would self-
# trip the answer-leak guard in dispatch.py.
_PAGE_CSS = """
.paper{max-width:820px}
.qpaper-item{border:1px solid #e3e3e6;border-radius:10px;padding:14px 18px;margin:12px 0;background:#fff}
.qpaper-n{color:#8a8f98;font-weight:700;margin-right:6px}
.qpaper-meta{color:#8a8f98;font-size:12px;margin-bottom:6px}
.stem{margin:2px 0 8px}
.passage{background:#f8fafc;border-left:3px solid #c7ccd4;padding:8px 12px;margin:0 0 8px;border-radius:0 8px 8px 0}
.ptag{display:inline-block;font-weight:700;color:#647084;margin-right:6px}
.options{display:grid;gap:4px;margin-top:6px}
.opt-label{font-weight:600;color:#1f2328;margin-right:4px}
.matrix-table{border-collapse:collapse;margin-top:6px}
.matrix-table td,.matrix-table th{border:1px solid #e3e3e6;padding:4px 8px;text-align:left}
.mwrap{display:inline}
.ktx .katex{font-size:1.05em}
.eq-hidden,.ktx-hidden{display:none}
img.fig{max-width:100%;height:auto}
@media print{.qpaper-item{break-inside:avoid}}
"""

# Self-contained printable. KaTeX (CDN) renders the .ktx[data-tex] spans QX emits
# under math='standalone'; on KaTeX failure/offline each span falls back to QX's
# hidden equation image (un-hidden) — mirrors QX's renderAllMath
# (gpt-extract-ques/gui/qx_browser.py:571). Doubled braces survive str.format.
_PAGE_TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<style>
body{{font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2933;margin:0;padding:32px;background:#fff;line-height:1.5}}
.kicker{{text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:#647084;font-weight:700}}
h1{{font-size:24px;margin:4px 0 2px}}
.sub{{color:#647084;margin:0 0 14px}}
{css}
</style></head>
<body>
<div class="kicker">{kicker}</div>
<h1>{title}</h1>
<p class="sub">{subtitle}</p>
<section class="paper">
{body}
</section>
<script>
window.addEventListener('DOMContentLoaded', function () {{
  var nodes = document.querySelectorAll('.ktx[data-tex]');
  var haveKatex = (typeof katex !== 'undefined');
  nodes.forEach(function (el) {{
    var ok = false;
    if (haveKatex) {{
      try {{
        katex.render(el.getAttribute('data-tex') || '', el,
                     {{throwOnError: true, strict: 'ignore', displayMode: false}});
        ok = true;
      }} catch (e) {{ ok = false; }}
    }}
    if (!ok) {{
      var wrap = el.closest('.mwrap');
      el.classList.add('ktx-hidden');
      if (wrap) {{ var img = wrap.querySelector('img.eq'); if (img) img.classList.remove('eq-hidden'); }}
    }}
  }});
}});
</script>
</body></html>
"""


def _assemble_items_html(results: list[dict]) -> str:
    """Wrap each QX question-only render in a numbered item. The body is QX's HTML
    verbatim (already answer-free) — we add only a number + metadata chrome."""
    parts: list[str] = []
    for i, r in enumerate(results, 1):
        meta = " · ".join(x for x in (r.get("q_type"), r.get("subject"),
                                      r.get("chapter")) if x)
        body = r.get("html") or ""
        parts.append(
            f'<article class="qpaper-item">'
            f'<div class="qpaper-meta"><span class="qpaper-n">Q{i}.</span>{_html.escape(meta)}</div>'
            f'{body}'
            f'</article>'
        )
    return "\n".join(parts)


def build_paper(slug: str, *, variant: str) -> dict:
    """Build an answer-safe question paper (variant='paper', the full page) or drill
    set (variant='drill', the first _DRILL_SIZE) for a chapter slug, from QX. Writes
    <slug>-<variant>.json + <slug>-<variant>.html under config.EXPORT_DIR/<slug>/ and
    returns the factory result dict {variant, html, json, questions}. Raises
    ValueError (BEFORE writing anything) if QX is unreachable."""
    query = slug.replace("-", " ").strip()
    client = QxClient()
    try:
        payload = client.search(q=query, mode="exact", page=1)
    except Exception as exc:   # noqa: BLE001 — QX down / bad URL / timeout / bad JSON
        raise ValueError(
            f"QX engine unreachable — cannot build {variant!r} for {slug!r}: {exc}. "
            f"Is the QX server running on :8783? (no artifact written)") from exc

    results = list(payload.get("results") or [])
    if variant == "drill":
        results = results[:_DRILL_SIZE]
    # Rewrite QX's relative /asset URLs (figures + equation-image fallbacks) to
    # absolute QX-server URLs so they load when the printable is opened elsewhere.
    questions_proxy.absolutize_assets({"results": results}, client.base_url)

    out = config.EXPORT_DIR / slug
    out.mkdir(parents=True, exist_ok=True)

    label = "Question paper" if variant == "paper" else "Drill set"
    title = slug.replace("-", " ").title()

    data = {
        "slug": slug, "variant": variant, "query": query,
        "questions": [{"q_uid": r.get("q_uid"), "q_type": r.get("q_type"),
                       "html": r.get("html")} for r in results],
    }
    json_path = out / f"{slug}-{variant}.json"
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    html_doc = _PAGE_TEMPLATE.format(
        title=_html.escape(title),
        subtitle=_html.escape(f"{label} · {len(results)} question(s) · questions only"),
        kicker=_html.escape(label),
        css=_PAGE_CSS,
        body=_assemble_items_html(results),
    )
    html_path = out / f"{slug}-{variant}.html"
    html_path.write_text(html_doc, encoding="utf-8")

    return {"variant": variant, "html": str(html_path),
            "json": str(json_path), "questions": len(results)}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_factory_paper.py -q`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/paper.py tests/test_factory_paper.py
git commit -m "feat(factory): QX-backed answer-safe paper/drill engine (Phase C2)"
```

---

### Task 3: `dispatch` — route `qx` lanes + make `_assert_no_answer_leak` real

**Files:**
- Modify: `samagra/factory/dispatch.py`
- Test: `tests/test_factory_dispatch.py`

- [ ] **Step 1: Add the failing tests** — append to `tests/test_factory_dispatch.py`:

```python
def test_run_line_routes_paper_to_build_paper(monkeypatch, tmp_path):
    seen = {}
    out = tmp_path / "circular-motion-paper.html"
    out.write_text("<h1>paper</h1>", encoding="utf-8")

    def fake_build_paper(slug, *, variant):
        seen["args"] = (slug, variant)
        return {"variant": variant, "html": str(out),
                "json": str(tmp_path / "circular-motion-paper.json"), "questions": 4}

    monkeypatch.setattr("samagra.factory.paper.build_paper", fake_build_paper)
    result = dispatch.run_line("paper", "circular-motion")
    assert seen["args"] == ("circular-motion", "paper")   # variant from the lane key
    assert result["html"] == str(out)


def test_run_line_routes_drill_to_build_paper_with_drill_variant(monkeypatch, tmp_path):
    seen = {}
    out = tmp_path / "circular-motion-drill.html"
    out.write_text("<h1>drill</h1>", encoding="utf-8")

    def fake_build_paper(slug, *, variant):
        seen["variant"] = variant
        return {"variant": variant, "html": str(out),
                "json": str(tmp_path / "x.json"), "questions": 2}

    monkeypatch.setattr("samagra.factory.paper.build_paper", fake_build_paper)
    dispatch.run_line("drill", "circular-motion")
    assert seen["variant"] == "drill"


def test_validate_product_qx_refuses_answer_marker(tmp_path):
    leaky = tmp_path / "p.html"
    leaky.write_text('<div class="stem">x</div>'
                     '<div class="answer"><span class="answer-label">Ans: 42</span></div>',
                     encoding="utf-8")
    with pytest.raises(ValueError):
        dispatch.validate_product("paper", {"html": str(leaky)})


def test_validate_product_qx_allows_clean_paper_even_with_word_answer(tmp_path):
    # A legitimate stem may contain the WORD "answer"; that must NOT trip the
    # structural marker guard (no class="answer"/answer-label/etc.).
    clean = tmp_path / "p.html"
    clean.write_text('<div class="stem">What is the answer to this question?</div>'
                     '<div class="options"><div class="opt"><span class="opt-label">(A)</span> 5</div></div>',
                     encoding="utf-8")
    dispatch.validate_product("paper", {"html": str(clean)})   # no raise


def test_validate_product_answer_leak_is_noop_for_local_lanes(tmp_path):
    # The guard is qx-only: a local lane artifact that (contrived) carries an
    # answer marker is NOT scanned (lecture/deck carry no answer columns by
    # construction; scanning them would be wrong-layer).
    f = tmp_path / "r.html"
    f.write_text('<div class="answer">Ans: 1</div>', encoding="utf-8")
    dispatch.validate_product("revision", {"html": str(f)})    # no raise (local kind)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_factory_dispatch.py -q`
Expected: FAIL — `test_run_line_routes_paper_to_build_paper` (run_line falls through to the lecture exporter, which is monkeypatched away → KeyError/Exception), and `test_validate_product_qx_refuses_answer_marker` (the no-op guard doesn't raise).

- [ ] **Step 3: Add the qx branch + real answer-leak guard** — in `samagra/factory/dispatch.py`:

(a) add the import near the top (after `from . import deck`):

```python
from . import deck, paper
```

(b) replace `run_line` with:

```python
def run_line(line: str, slug: str) -> dict:
    """Run the lane's engine. Phase-C lane-kind dispatch:
      - deck            -> the pure local flashcard engine (no external write).
      - paper/drill     -> the QX-backed answer-safe paper engine (kind 'qx';
        read-only QX, local write; variant = the lane key sizes paper vs drill).
      - revision/lecture-> the lecture exporter (upload_gdocs=False keeps the
        Phase-1 invariant: local artifacts only, never a Google Docs upload).
    The mcd (seed) branch lands in C3.
    """
    spec = LINES[line]
    if line == "deck":
        return deck.build_deck(slug)
    if spec.kind == "qx":
        return paper.build_paper(slug, variant=line)
    return lex.export_one(slug, spec.variant, upload_gdocs=False)
```

(c) replace `_assert_no_answer_leak` (keep the module-level marker tuple above it) with:

```python
# Structural answer/solution markers QX uses in its AUTHORING views (never in the
# read-only /api/qsearch student render, which stops at stem/options/passage/matrix).
# All are HTML class/attribute tokens — they cannot occur in legitimately rendered
# question PROSE (a stem may contain the word "answer"; it can never contain
# class="answer"), so scanning for them is false-positive-free.
_ANSWER_MARKERS = (
    'class="answer"',
    "answer-label",
    "answer_confidence",
    "data-answer",
    "data-correct",
    'class="solution"',
)


def _assert_no_answer_leak(line: str, result: dict) -> None:
    """For QX (paper/drill) lanes ONLY: re-assert the published artifact carries no
    answer/solution data. Defense in depth — we do not trust the upstream render to
    be answer-free and re-check at our write boundary. Reads the assembled artifact
    and raises ValueError on any structural answer/solution marker. kind in
    {local, mcd} keep the no-op (lecture/deck carry no answer columns; the mcd
    payload is validated by validate_seed_payload, not this guard)."""
    spec = LINES.get(line)
    if spec is None or spec.kind != "qx":
        return
    html = result.get("html")
    text = (Path(html).read_text(encoding="utf-8") if html else "").lower()
    for marker in _ANSWER_MARKERS:
        if marker in text:
            raise ValueError(
                f"line {line!r} artifact carries an answer/solution marker "
                f"({marker!r}) — refusing to publish a paper that may leak answers")
```

(Note: `validate_product` already calls `_assert_no_answer_leak(line, result)` after the file-exists/non-empty checks — no change needed there.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_factory_dispatch.py -q`
Expected: PASS (all — the 4 pre-existing dispatch tests + the 5 new ones).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/dispatch.py tests/test_factory_dispatch.py
git commit -m "feat(factory): run_line routes qx lanes; real answer-leak guard for kind=qx (Phase C2)"
```

---

### Task 4: Fan-out integration — 5 lanes + poisoned-payload + QX-down refusal

**Files:**
- Modify: `tests/test_factory_run.py`
- (No production change — `run.py` is unchanged by design; this task proves the
  lane-kind boundary end-to-end through the real `build()`.)

- [ ] **Step 1: Update + add the failing tests** in `tests/test_factory_run.py`.

(a) Add a `_stub_paper` helper next to `_stub_deck` (writes a real answer-free file so the REAL `validate_product`/answer-leak guard runs over it):

```python
def _stub_paper(monkeypatch, tmp_path):
    def fake_build_paper(slug, *, variant):
        out = tmp_path / f"{slug}-{variant}.html"
        out.write_text(f'<h1>{slug} {variant}</h1><div class="stem">q</div>', encoding="utf-8")
        return {"variant": variant, "html": str(out),
                "json": str(tmp_path / f"{slug}-{variant}.json"), "questions": 3}
    monkeypatch.setattr("samagra.factory.paper.build_paper", fake_build_paper)
```

(b) Update the three lane-count assertions to five:

- In `test_plan_dry_returns_three_proposals_and_writes_nothing` — rename to
  `test_plan_dry_returns_five_proposals_and_writes_nothing` and change the assert to:
  ```python
  assert [p["line"] for p in proposals] == ["revision", "lecture", "deck", "paper", "drill"]
  ```
- In `test_plan_live_records_three_in_review_children` — rename to `..._five_...` and:
  ```python
  assert {r["pipeline"] for r in rows} == {"revision", "lecture", "deck", "paper", "drill"}
  ...
  assert verbs.count("product_proposed") == 5
  ```
- In `test_plan_live_is_idempotent_per_seed_and_line` change `== 3` to `== 5` (and the comment `# not 6` to `# not 10`).
- In `test_approve_seed_batches_all_children` change `len(res["approved"]) == 3` to `== 5`.
- In `test_approve_seed_skips_non_factory_pipeline_with_same_seed_ref` change
  `len(res["approved"]) == 3` to `== 5` (keep the comment intent: only factory lanes).

(c) Replace `test_one_seed_fans_to_three_captured_artifacts` with the five-artifact
version (stubs all three engine entry points so every lane builds locally):

```python
def test_one_seed_fans_to_five_captured_artifacts(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    _stub_deck(monkeypatch, factory_env)
    _stub_paper(monkeypatch, factory_env)
    seed = "textbook:circular-motion"
    run.plan(seed, dry=False)
    run.approve_seed(seed)                       # per-seed batch
    conn = store.connect()
    try:
        ids = [r["id"] for r in store.list_assignments(conn)]
    finally:
        conn.close()
    arts = [run.build(i)["artifact_ref"] for i in ids]
    assert len(arts) == 5 and len(set(arts)) == 5   # revision+lecture+deck+paper+drill, distinct
    conn = store.connect()
    try:
        assert all(r["status"] == "captured" for r in store.list_assignments(conn))
        created = [e for e in store.list_events(conn) if e["verb"] == "product_created"]
        assert len(created) == 5
        pipelines = {r["pipeline"] for r in store.list_assignments(conn)}
        assert pipelines == {"revision", "lecture", "deck", "paper", "drill"}
    finally:
        conn.close()
```

(d) Add the answer-leak end-to-end refusal (the spec §4 poisoned-payload test — the
REAL `build_paper` assembles a QX response carrying an answer marker, the REAL
`validate_product` refuses at the boundary, the assignment stays un-captured):

```python
def _approve_lane(seed, line):
    """plan a seed, approve only the named lane's child, return its id."""
    run.plan(seed, dry=False)
    conn = store.connect()
    try:
        aid = next(r["id"] for r in store.list_assignments(conn) if r["pipeline"] == line)
    finally:
        conn.close()
    run.approve(aid)
    return aid


def test_build_paper_lane_refuses_when_qx_leaks_an_answer(factory_env, monkeypatch):
    class _LeakyQx:
        base_url = "http://127.0.0.1:8783"
        def __init__(self, *a, **k): pass
        def search(self, **kw):
            return {"results": [{"q_uid": "q1", "q_type": "mcq", "subject": "physics",
                                 "chapter": "c", "html":
                '<div class="stem">x</div>'
                '<div class="answer"><span class="answer-label">Ans: 42</span></div>'}],
                    "total": 1, "page": 1, "page_size": 25, "mode": "exact",
                    "degraded": False, "facets": {}}
    monkeypatch.setattr("samagra.factory.paper.QxClient", _LeakyQx)
    aid = _approve_lane("textbook:circular-motion", "paper")
    with pytest.raises(ValueError):
        run.build(aid)                            # answer-leak guard refuses at the boundary
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
        assert row["status"] != "captured"
    finally:
        conn.close()


def test_build_paper_lane_refuses_when_qx_unreachable(factory_env, monkeypatch):
    class _DownQx:
        base_url = "http://127.0.0.1:8783"
        def __init__(self, *a, **k): pass
        def search(self, **kw): raise RuntimeError("connection refused")
    monkeypatch.setattr("samagra.factory.paper.QxClient", _DownQx)
    aid = _approve_lane("textbook:circular-motion", "paper")
    with pytest.raises(ValueError):
        run.build(aid)                            # clean refusal, no partial artifact
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
        assert row["status"] != "captured"
    finally:
        conn.close()


def test_build_paper_lane_captures_answer_free_paper(factory_env, monkeypatch):
    class _CleanQx:
        base_url = "http://127.0.0.1:8783"
        def __init__(self, *a, **k): pass
        def search(self, **kw):
            return {"results": [{"q_uid": "q1", "q_type": "mcq_single", "subject": "physics",
                                 "chapter": "Circular Motion",
                                 "html": '<div class="stem">A wheel spins</div>'}],
                    "total": 1, "page": 1, "page_size": 25, "mode": "exact",
                    "degraded": False, "facets": {}}
    monkeypatch.setattr("samagra.factory.paper.QxClient", _CleanQx)
    aid = _approve_lane("textbook:circular-motion", "paper")
    res = run.build(aid)
    assert res["artifact_ref"].endswith("circular-motion-paper.html")
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
        assert row["status"] == "captured"
    finally:
        conn.close()
```

- [ ] **Step 2: Run the tests to verify the new ones fail / the suite drives the change**

Run: `python -m pytest tests/test_factory_run.py -q`
Expected: the renamed five-lane tests FAIL first if Task 1/3 were not yet applied; with Tasks 1–3 applied they PASS. The poisoned-payload and QX-down tests exercise the real `build_paper` + guard. (If you are running tasks in order, Tasks 1–3 are already committed, so this step is mostly green except where the test text itself changed — confirm the failures are only the intended assertion/count updates, then proceed.)

- [ ] **Step 3: (No production code change)** — `run.py` is unchanged. If any test fails for a reason OTHER than the count/name updates, STOP: the lane-kind boundary is supposed to handle `qx` with no `run.py` edit. A failure here means Task 1 or 3 is wrong, not `run.py`.

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `python -m pytest tests/test_factory_run.py tests/test_factory_lines.py tests/test_factory_dispatch.py tests/test_factory_paper.py -q`
Expected: PASS (all factory tests green).

- [ ] **Step 5: Commit**

```bash
git add tests/test_factory_run.py
git commit -m "test(factory): one seed -> five captured artifacts; answer-leak + QX-down build refusal (Phase C2)"
```

---

### Task 5: Full-suite green + live smoke + adversarial review + finish

**Files:** none (verification + review).

- [ ] **Step 1: Full suite green** — `python -m pytest -q` (authoritative count via
  `--junitxml` if the Windows summary line is suppressed). Expected: the C2 tests add
  to the C1 total; the only red is the pre-existing env `tests/test_gdocs.py` (Google
  API libs). Record the pass count.

- [ ] **Step 2: Live golden-thread smoke (answer-safe).** Drive the real factory loop
  for `textbook:circular-motion` in an ISOLATED temp governance store (never the durable
  `governance.db`), proving the paper/drill lanes capture answer-free artifacts.

  Prefer a **live QX** smoke: if the QX server can be started (`python gui/qx_browser.py`
  from `C:\SandBox\gpt_box\gpt-extract-ques`, serves `:8783`), point `SAMAGRA_QX_SERVER_URL`
  at it and build the `paper` + `drill` children — assert each artifact exists, is
  non-empty, and contains NO answer marker (`class="answer"`, `answer-label`, …). If QX
  cannot be started in this environment, run the smoke with a **recorded real QX payload**
  (a captured `/api/qsearch` response) through the real `build_paper` + the real
  `_assert_no_answer_leak`, and record live-QX verification as an owner follow-up. Either
  way: the durable `governance.db` is untouched (use a tmp `GOVERNANCE_DB`).

- [ ] **Step 3: Adversarial multi-lens final review.** Dispatch an independent review
  (correctness / safety / test-quality / spec-fidelity), each finding independently
  verified/refuted before it counts. Reviewers MUST use `git show <sha>:<file>` / `git diff`
  (NEVER `git checkout` — that detaches HEAD in the shared working tree). Focus lenses:
  - **Safety:** does the answer-leak guard actually run on the qx path at the build
    boundary? Is the marker set free of false-positives (word "answer" in a stem) AND
    false-negatives (a real QX authoring leak)? Does QX-down leave NO partial artifact?
    Are the six load-bearing invariants intact (no new prod write — QX read-only; read-only
    firewall; publish gate; five guards; no migration; no secrets)?
  - **Correctness:** is `build()` genuinely unmodified? Does the printable render QX's
    `.ktx[data-tex]` math (KaTeX loaded + fallback)? Are asset URLs absolutized?
  - **Test quality:** are the poisoned-payload + QX-down refusals asserting un-captured
    state, not just a raise? Is the five-artifact fan-out distinct + all captured?
  - **Spec fidelity:** §3.2 + §4 + §6 C2 acceptance met; non-goals respected (no new
    web endpoint, no CLI scheduling, no second mcd path).
  Fix any confirmed finding TDD (failing test → fix → green), re-review, then proceed.

- [ ] **Step 4: Finish** — use superpowers:finishing-a-development-branch. Verify the
  full suite is green, then present the standard options. (The established pattern for this
  project is merge-to-main-locally + push, but PRESENT the options and honor the user's
  choice.) Update the project trackers (`CLAUDE.md` banner, `STATUS.html`, `SUMMARY.html`,
  `HANDOFF.md`) and the auto-memory (`content-factory-phase-c2-*.md` + `MEMORY.md`) with the
  C2 milestone: 5-lane fan-out, the qx kind activated, the answer-leak guard, the live proof,
  the pass count, and **Next: C3** (the `seed`/mcd bridge fold — prod write, dedicated DEC-7
  Codex pre-merge review).

---

## Known behaviors / notes for the reviewer (not bugs)

- **In-flight after a QX-down build.** `build()` records `product_building` *before*
  calling `run_line` (crash-window safety, inherited unchanged). If QX is down, `build_paper`
  raises before writing, so the build refuses cleanly and nothing is captured — but the
  `product_building` event remains, so a later retry hits guard-3 (in-flight) and also
  refuses until the operator reconciles. This is the **same** safe-fail posture the bridge
  uses for its prod write (review 22 H1) and is consistent with C1's deck/lecture lanes. It
  errs toward refusing, never toward a double or partial artifact. Hardening it (distinguishing
  "failed before any write" from "crashed mid-write") is out of C2 scope — the spec requires
  only "clean refusal, no partial artifact," which is met.
- **Answer-leak guard scans the whole artifact file.** The marker set is structural HTML
  class/attribute tokens, so the chrome (kicker/subtitle/CSS) is safe as long as it never
  names an `.answer`/`.solution` class — the `_PAGE_CSS` deliberately does not, and the
  subtitle says "questions only" (not "answer-free") to keep even the prose marker-free out
  of an abundance of caution.
- **No CLI change.** `samagra factory plan|approve|approve-seed|build` is lane-agnostic
  (`cmd_factory` in `samagra/__main__.py` dispatches through `run.plan`/`classify`/`run.build`).
  `paper`/`drill` flow through automatically.
- **Why `kind == "qx"` not a name check.** `run_line` and `_assert_no_answer_leak` branch on
  `spec.kind`, so adding a future qx lane needs only a registry row — the boundary code is
  written once.
```

