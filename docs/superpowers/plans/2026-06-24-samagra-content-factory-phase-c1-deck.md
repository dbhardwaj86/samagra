# SAMAGRA Content Factory — Phase C1 (`deck` lane) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `deck` (Smriti flashcard) lane — a pure, deterministic projection of a textbook chapter's equation + callout blocks into `{front, back, ref}` flashcards (a `.json` deck + a printable MathJax `.html`), wired through the existing factory dispatch so one `textbook:<slug>` seed now fans to **three** captured local artifacts (revision + lecture + deck).

**Architecture:** A new pure module `samagra/factory/deck.py` (`build_deck(slug) -> dict`) loads a chapter via the existing `lectures.render.load_chapter`, walks `sections[*].blocks[*]`, projects each `equation`/`callout` block to one card, and writes `<slug>-deck.json` + `<slug>-deck.html` under `config.EXPORT_DIR/<slug>/` (reusing `render.DOC_TEMPLATE`/`DOC_CSS` so the printable is MathJax-enabled, Inter-styled, print-friendly). The `Line` dataclass gains a `kind` field (default `"local"`; the Phase-C lane-kind seam) and a `deck` registry entry; `dispatch.run_line` gains a `deck` branch routing to `build_deck`. No new prod write path, no network, no migration — the deck engine has **zero** external-write code, which is structurally stronger than the lecture lane's `upload_gdocs=False` opt-out.

**Tech Stack:** Python 3.11, stdlib `json`, `html`; pytest. Reuses `samagra/lectures/render.py` (`load_chapter`, `DOC_TEMPLATE`, `DOC_CSS`, `_html.escape`), `samagra/config.py` (`EXPORT_DIR`, `TEXTBOOK_CHAPTERS`), `samagra/factory/{lines,dispatch,run}.py`, `samagra/governance/store.py`.

**Spec:** `docs/superpowers/specs/2026-06-23-samagra-content-factory-phase-c-design.md` (§2 lane-`kind`, §3.1 deck lane, §6 C1 acceptance).

**Grounding facts this plan relies on (already verified against the live tree):**
- `render.load_chapter(slug: str) -> dict` reads `config.TEXTBOOK_CHAPTERS / slug / "content.json"`, raises `FileNotFoundError` if absent (`samagra/lectures/render.py:59`). Chapters are plain dicts (no dataclasses), external + read-only, 59 of them; `circular-motion` exists.
- A chapter dict = `{pdf, slug, title, subtitle, status, source_pages, sections}`; a section = `{id, title, source_page_range, blocks, flags, enrichment}`; a block = `{type, ...}`.
- **`equation`** block = `{"type":"equation", "tex":"<LaTeX, no $ delimiters>", "number":"1"}` — `tex` always present; `number` is a **string and OPTIONAL/nullable** (1 of 1199 equations omits it); **no `html` field**.
- **`callout`** block = `{"type":"callout", "variant":"note|key|warn|tip", "html":"<p>… inline $…$ …</p>"}` — `html` always present; `variant` is a closed 4-value set.
- The factory hard-requires `result["html"]` to be a real non-empty file (`dispatch.validate_product`, `samagra/factory/dispatch.py:43`), and `build()` `json.dumps` the **entire** result dict into the governance event note (`samagra/factory/run.py:166`) — so every value in the deck result dict MUST be a `str`/`int`/`None` (never a `Path`).
- `Line` is a `@dataclass(frozen=True)` constructed **positionally** everywhere (`samagra/factory/lines.py:11`), so a new `kind` field must be the **last** field with a default.
- `dispatch.run_line` currently hardcodes `lex.export_one(slug, spec.variant, upload_gdocs=False)` for **every** lane (`samagra/factory/dispatch.py:33`) — the deck lane needs a real branch here.
- Math in the lecture renderer is **MathJax 3 (`$…$` / `$$…$$`), not KaTeX**; the only escaper is stdlib `html.escape` (aliased `_html` in `render.py`).
- Many `tests/test_factory_run.py` cases hard-code exactly two lanes — see Task 4.

---

## File Structure

- **Modify** `samagra/factory/lines.py` — add `kind` field to `Line` (default `"local"`); add the `deck` entry to `LINES`; append `"deck"` to `_ORDER`.
- **Create** `samagra/factory/deck.py` — the pure deck engine `build_deck(slug)` + helpers `_cards_for_chapter`, `_deck_html`.
- **Modify** `samagra/factory/dispatch.py` — `run_line` gains a `deck` branch (top-level `from . import deck`).
- **Modify** `tests/test_factory_lines.py` — update classify + registry expectations to include `deck`; assert `deck.kind == "local"`.
- **Create** `tests/test_factory_deck.py` — engine unit tests over a hermetic tmp-chapter fixture.
- **Modify** `tests/test_factory_dispatch.py` — add a `run_line("deck", …)` routing test.
- **Modify** `tests/test_factory_run.py` — update the 2-lane-assuming tests to 3 lanes; add `_stub_deck` + a 3-artifact fan-out acceptance test.

`dispatch.validate_product`, `factory/run.py`, the CLI (`samagra/__main__.py`), and `tests/test_factory_cli.py` need **no change** — they are lane-agnostic and the deck result carries the required `html` key. The `kind` field is introduced here as the Phase-C seam but is only **read** in C2 (`qx` answer-leak branch) / C3 (`mcd` build branch); in C1 all three lanes are `local`, so no `validate_product`/`build` branch is added (YAGNI).

---

### Task 1: `Line.kind` field + `deck` registry entry + classify

**Files:**
- Modify: `samagra/factory/lines.py`
- Test: `tests/test_factory_lines.py`

- [ ] **Step 1: Update the failing tests**

Replace the whole body of `tests/test_factory_lines.py` with:

```python
from samagra.factory import lines


def test_textbook_seed_fans_to_revision_lecture_and_deck():
    assert lines.classify("textbook:circular-motion") == ["revision", "lecture", "deck"]


def test_unknown_source_fans_to_nothing():
    assert lines.classify("mcd:123") == []
    assert lines.classify("") == []


def test_registry_has_expected_output_labels():
    assert lines.LINES["revision"].expected_output
    assert lines.LINES["lecture"].expected_output
    assert lines.LINES["deck"].expected_output
    assert set(lines.LINES) == {"revision", "lecture", "deck"}


def test_deck_line_is_local_kind_and_textbook_sourced():
    deck = lines.LINES["deck"]
    assert deck.kind == "local"
    assert deck.source_prefixes == ("textbook:",)


def test_existing_lanes_default_to_local_kind():
    assert lines.LINES["revision"].kind == "local"
    assert lines.LINES["lecture"].kind == "local"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_factory_lines.py -v`
Expected: FAIL — `AttributeError: 'Line' object has no attribute 'kind'` and `classify(...) == ["revision","lecture"]` (no `deck`).

- [ ] **Step 3: Implement the registry change**

In `samagra/factory/lines.py`, replace the `Line` dataclass, `LINES`, and `_ORDER` with:

```python
@dataclass(frozen=True)
class Line:
    key: str
    expected_output: str
    variant: str            # the lectures.export variant this lane renders (unused by non-export engines)
    source_prefixes: tuple  # seed_ref prefixes this lane applies to
    kind: str = "local"     # output class: "local" | "qx" | "mcd" (Phase-C lane-kind seam).
                            # Default keeps revision/lecture local; consumed by C2 (qx
                            # answer-leak) / C3 (mcd build). In C1 every lane is "local".


LINES: dict[str, Line] = {
    "revision": Line("revision", "Revision sheet (thin lecture export)",
                     "thin", ("textbook:",)),
    "lecture": Line("lecture", "Full lecture (thick lecture export)",
                    "thick", ("textbook:",)),
    "deck": Line("deck", "Flashcard deck (equation/callout projection)",
                 "deck", ("textbook:",), "local"),
}

# Deterministic lane order so a seed always fans out the same way.
_ORDER = ["revision", "lecture", "deck"]
```

(Leave `classify` unchanged — it already iterates `_ORDER` and matches `source_prefixes`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_factory_lines.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/lines.py tests/test_factory_lines.py
git commit -m "feat(factory): Line.kind seam + deck lane registry (Phase C1)"
```

---

### Task 2: `factory/deck.py` — the pure deck engine

**Files:**
- Create: `samagra/factory/deck.py`
- Test: `tests/test_factory_deck.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_factory_deck.py`:

```python
import json
from pathlib import Path

import pytest

from samagra import config
from samagra.factory import deck


@pytest.fixture
def tmp_chapter(tmp_path, monkeypatch):
    """A hermetic single-chapter corpus so the engine test never touches the
    external read-only textbook repo. Repoints config.TEXTBOOK_CHAPTERS (what
    render.load_chapter reads) and config.EXPORT_DIR (where build_deck writes)."""
    chapters = tmp_path / "chapters"
    monkeypatch.setattr(config, "TEXTBOOK_CHAPTERS", chapters)
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    slug = "circular-motion"
    content = {
        "slug": slug,
        "title": "Circular Motion",
        "subtitle": "Motion along a curved path",
        "sections": [
            {
                "id": "sec-1",
                "title": "Angular position",
                "blocks": [
                    {"type": "prose", "html": "<p>intro</p>"},
                    {"type": "equation", "tex": "\\Delta\\theta = \\theta_f - \\theta_i", "number": "1"},
                    {"type": "figure", "caption": "c", "svg": "<svg></svg>"},
                    {"type": "callout", "variant": "key", "html": "<p>radians are dimensionless</p>"},
                    {"type": "equation", "tex": "v = \\omega R"},
                ],
            }
        ],
    }
    d = chapters / slug
    d.mkdir(parents=True)
    (d / "content.json").write_text(json.dumps(content), encoding="utf-8")
    return slug


def _deck_json(slug):
    return json.loads((config.EXPORT_DIR / slug / f"{slug}-deck.json").read_text(encoding="utf-8"))


def test_build_deck_projects_only_equation_and_callout_in_doc_order(tmp_chapter):
    res = deck.build_deck(tmp_chapter)
    cards = _deck_json(tmp_chapter)["cards"]
    assert [c["kind"] for c in cards] == ["equation", "callout", "equation"]  # prose + figure skipped
    assert res["cards"] == 3


def test_build_deck_equation_card_shape(tmp_chapter):
    deck.build_deck(tmp_chapter)
    cards = _deck_json(tmp_chapter)["cards"]
    eq1, eq2 = cards[0], cards[2]
    assert eq1["front"] == "Equation 1 - Angular position"
    assert eq1["back"] == "$$ \\Delta\\theta = \\theta_f - \\theta_i $$"
    assert eq1["ref"] == "sec-1"
    assert eq2["front"] == "Equation - Angular position"   # numberless equation


def test_build_deck_callout_card_uses_variant_label_and_body(tmp_chapter):
    deck.build_deck(tmp_chapter)
    co = _deck_json(tmp_chapter)["cards"][1]
    assert co["front"] == "Key result - Angular position"   # variant 'key' -> 'Key result'
    assert co["back"] == "<p>radians are dimensionless</p>"
    assert co["ref"] == "sec-1"


def test_build_deck_writes_nonempty_mathjax_html(tmp_chapter):
    res = deck.build_deck(tmp_chapter)
    html_path = Path(res["html"])
    assert html_path.is_file() and html_path.stat().st_size > 0
    html = html_path.read_text(encoding="utf-8")
    assert "MathJax" in html              # reuses render.DOC_TEMPLATE (MathJax 3 CDN)
    assert "$$ \\Delta\\theta" in html    # equation back rendered as display math
    assert "radians are dimensionless" in html
    assert res["html"].endswith(f"{tmp_chapter}-deck.html")
    assert res["json"].endswith(f"{tmp_chapter}-deck.json")


def test_build_deck_result_is_json_serializable(tmp_chapter):
    res = deck.build_deck(tmp_chapter)
    json.dumps(res)   # build() json.dumps the whole result into the event note — must not raise
    assert all(isinstance(v, (str, int)) for v in res.values())


def test_build_deck_html_escapes_card_front(tmp_chapter, monkeypatch):
    # A section title with HTML metacharacters must be escaped in the front cue.
    chapters = config.TEXTBOOK_CHAPTERS
    content = json.loads((chapters / tmp_chapter / "content.json").read_text(encoding="utf-8"))
    content["sections"][0]["title"] = "A <b>&</b> B"
    (chapters / tmp_chapter / "content.json").write_text(json.dumps(content), encoding="utf-8")
    res = deck.build_deck(tmp_chapter)
    html = Path(res["html"]).read_text(encoding="utf-8")
    assert "A &lt;b&gt;&amp;&lt;/b&gt; B" in html   # escaped, not raw


def test_build_deck_missing_chapter_raises(tmp_chapter):
    with pytest.raises(FileNotFoundError):
        deck.build_deck("no-such-chapter")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_factory_deck.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'samagra.factory.deck'`.

- [ ] **Step 3: Implement the engine**

Create `samagra/factory/deck.py`:

```python
"""The deck lane engine: project a chapter's equation + callout blocks into a
flashcard deck. Pure + deterministic — NO LLM, NO network, NO external write.

Phase C / C1 (Smriti). One textbook chapter (seed 'textbook:<slug>') -> a deck:
each EQUATION block -> one card (front = a cue naming the section + equation
label; back = the equation as display math); each CALLOUT block -> one card
(front = the callout's variant label + section; back = the callout body html).
Writes <slug>-deck.json (the deck data) + <slug>-deck.html (a printable,
MathJax-enabled card grid) under config.EXPORT_DIR/<slug>/, and returns a
factory-compatible result dict carrying the printable html path under "html".

There is deliberately NO upload/network/gdocs code here at all — the Phase-1
"no external write path" invariant is enforced structurally, not by an opt-out
flag (stronger than the lecture lane's upload_gdocs=False).
"""
from __future__ import annotations

import html as _html
import json

from .. import config
from ..lectures import render

# Human labels for the closed set of callout variants (data: note/key/warn/tip).
_VARIANT_LABEL = {"note": "Note", "key": "Key result", "warn": "Caution", "tip": "Tip"}

# Minimal card-grid styling appended to the lecture DOC_CSS (kept tiny + print-safe).
_DECK_CSS = """
.deck{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-top:8px}
.card{border:1px solid #e3e3e6;border-radius:10px;padding:14px 16px;background:#fff}
.card-front{font-weight:600;margin-bottom:8px;color:#1f2328}
.card-n{color:#8a8f98;font-weight:600}
.card-back{color:#1f2328}
@media print{.card{break-inside:avoid}}
"""


def _cards_for_chapter(content: dict) -> list[dict]:
    """Deterministically project equation + callout blocks into flashcards.

    Each card = {"front": <plain cue text>, "back": <display math / callout html>,
    "ref": <section id or title>, "kind": "equation" | "callout"}, in document
    order (sections, then blocks). Other block types (prose/figure/subheading/
    image-need) are skipped — equation + callout are the revision-keepable blocks.
    """
    cards: list[dict] = []
    for sec in content.get("sections", []) or []:
        sec_title = sec.get("title", "") or ""
        sec_ref = sec.get("id") or sec_title
        for block in sec.get("blocks", []) or []:
            t = block.get("type")
            if t == "equation":
                tex = (block.get("tex") or "").strip()
                if not tex:
                    continue
                number = block.get("number")
                label = f"Equation {number}" if number else "Equation"
                cards.append({
                    "front": f"{label} - {sec_title}".strip(" -"),
                    "back": f"$$ {tex} $$",
                    "ref": sec_ref,
                    "kind": "equation",
                })
            elif t == "callout":
                body = (block.get("html") or "").strip()
                if not body:
                    continue
                label = _VARIANT_LABEL.get(block.get("variant") or "note", "Note")
                cards.append({
                    "front": f"{label} - {sec_title}".strip(" -"),
                    "back": body,
                    "ref": sec_ref,
                    "kind": "callout",
                })
    return cards


def _deck_html(content: dict, cards: list[dict]) -> str:
    """Render a printable card grid, reusing the lecture DOC_TEMPLATE/DOC_CSS so
    the deck inherits MathJax (display $$..$$ + inline $..$), Inter, print CSS."""
    parts = ['<section class="deck">']
    for i, card in enumerate(cards, 1):
        front = _html.escape(card["front"])          # cue text: escape (author-free)
        back = card["back"]                           # display math / trusted-author callout html
        parts.append(
            f'<article class="card">'
            f'<div class="card-front"><span class="card-n">{i}.</span> {front}</div>'
            f'<div class="card-back">{back}</div>'
            f'</article>'
        )
    parts.append("</section>")
    return render.DOC_TEMPLATE.format(
        title=_html.escape(content.get("title", "Deck")),
        subtitle=_html.escape(content.get("subtitle", "")),
        kicker=_html.escape("Flashcard deck"),
        css=render.DOC_CSS + _DECK_CSS,
        body="\n".join(parts),
    )


def build_deck(slug: str) -> dict:
    """Build the flashcard deck for a chapter slug. Writes <slug>-deck.json +
    <slug>-deck.html under config.EXPORT_DIR/<slug>/ and returns the factory
    result dict {variant, html, json, cards}. Raises FileNotFoundError if the
    chapter has no content.json (propagated from render.load_chapter)."""
    content = render.load_chapter(slug)
    cards = _cards_for_chapter(content)

    out = config.EXPORT_DIR / slug
    out.mkdir(parents=True, exist_ok=True)

    deck_data = {"slug": slug, "title": content.get("title", slug), "cards": cards}
    json_path = out / f"{slug}-deck.json"
    json_path.write_text(json.dumps(deck_data, ensure_ascii=False, indent=2), encoding="utf-8")

    html_path = out / f"{slug}-deck.html"
    html_path.write_text(_deck_html(content, cards), encoding="utf-8")

    return {
        "variant": "deck",
        "html": str(html_path),
        "json": str(json_path),
        "cards": len(cards),
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_factory_deck.py -v`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/deck.py tests/test_factory_deck.py
git commit -m "feat(factory): pure deck engine — equation/callout -> flashcards (Phase C1)"
```

---

### Task 3: `dispatch.run_line` — route the `deck` lane to the deck engine

**Files:**
- Modify: `samagra/factory/dispatch.py`
- Test: `tests/test_factory_dispatch.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_factory_dispatch.py`:

```python
def test_run_line_routes_deck_to_build_deck(monkeypatch, tmp_path):
    seen = {}
    out = tmp_path / "circular-motion-deck.html"
    out.write_text("<h1>deck</h1>", encoding="utf-8")

    def fake_build_deck(slug):
        seen["slug"] = slug
        return {"variant": "deck", "html": str(out),
                "json": str(tmp_path / "circular-motion-deck.json"), "cards": 5}

    monkeypatch.setattr("samagra.factory.deck.build_deck", fake_build_deck)
    result = dispatch.run_line("deck", "circular-motion")
    assert seen["slug"] == "circular-motion"
    assert result["html"] == str(out)


def test_run_line_still_routes_lecture_lanes_to_export(monkeypatch, tmp_path):
    calls = {}
    html = tmp_path / "x.html"; html.write_text("<h1>x</h1>", encoding="utf-8")

    def fake_export_one(slug, variant, **kw):
        calls["args"] = (slug, variant)
        calls["kw"] = kw
        return {"variant": variant, "html": str(html), "docx": None, "gdoc": None}

    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)
    dispatch.run_line("revision", "circular-motion")
    assert calls["args"] == ("circular-motion", "thin")
    assert calls["kw"].get("upload_gdocs") is False   # lecture lanes never upload (H1)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_factory_dispatch.py -k run_line -v`
Expected: FAIL — `test_run_line_routes_deck_to_build_deck` fails (deck currently falls through to `lex.export_one("circular-motion", "deck", …)`, which is the wrong engine and the stub on `build_deck` is never called → `KeyError 'slug'` / assertion error).

- [ ] **Step 3: Implement the branch**

In `samagra/factory/dispatch.py`, add `deck` to the imports and branch in `run_line`:

```python
from ..lectures import export as lex
from . import deck
from .lines import LINES
```

```python
def run_line(line: str, slug: str) -> dict:
    """Run the lane's engine. Phase-C lane-kind dispatch:
      - deck      -> the pure local flashcard engine (no external write).
      - revision/lecture -> the lecture exporter (upload_gdocs=False keeps the
        Phase-1 invariant: local artifacts only, never an external Google Docs
        upload — review 24 H1).
    Later sub-slices add the qx (paper/drill) + mcd (seed) branches.
    """
    spec = LINES[line]
    if line == "deck":
        return deck.build_deck(slug)
    return lex.export_one(slug, spec.variant, upload_gdocs=False)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_factory_dispatch.py -v`
Expected: PASS (all — the new routing tests + the pre-existing dispatch tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/dispatch.py tests/test_factory_dispatch.py
git commit -m "feat(factory): run_line routes deck lane to the deck engine (Phase C1)"
```

---

### Task 4: factory fan-out integration — update the 2-lane tests + 3-artifact acceptance

**Files:**
- Modify: `tests/test_factory_run.py`

The factory `run.py`/`build()` are lane-agnostic and need **no change** — the deck lane flows through the existing guarded boundary because `build_deck` returns the required `html` key. But many `tests/test_factory_run.py` cases hard-code exactly two lanes and will break once `classify` returns three. This task makes them three-lane-correct and adds the 3-artifact fan-out acceptance.

- [ ] **Step 1: Add a deck stub + a 3-artifact fan-out test**

In `tests/test_factory_run.py`, find the existing `_stub_export` helper and add `_stub_deck` directly beneath it:

```python
def _stub_deck(monkeypatch, tmp_path):
    def fake_build_deck(slug):
        out = tmp_path / f"{slug}-deck.html"
        out.write_text(f"<h1>{slug} deck</h1>", encoding="utf-8")
        return {"variant": "deck", "html": str(out),
                "json": str(tmp_path / f"{slug}-deck.json"), "cards": 4}
    monkeypatch.setattr("samagra.factory.deck.build_deck", fake_build_deck)
```

Then locate the existing fan-out acceptance test `test_one_seed_fans_to_two_captured_artifacts` and replace it **in full** with the three-artifact version:

```python
def test_one_seed_fans_to_three_captured_artifacts(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    _stub_deck(monkeypatch, factory_env)
    seed = "textbook:circular-motion"
    run.plan(seed, dry=False)
    run.approve_seed(seed)                       # per-seed batch
    conn = store.connect()
    try:
        ids = [r["id"] for r in store.list_assignments(conn)]
    finally:
        conn.close()
    arts = [run.build(i)["artifact_ref"] for i in ids]
    assert len(arts) == 3 and len(set(arts)) == 3   # revision + lecture + deck, distinct
    conn = store.connect()
    try:
        assert all(r["status"] == "captured" for r in store.list_assignments(conn))
        created = [e for e in store.list_events(conn) if e["verb"] == "product_created"]
        assert len(created) == 3
        assert all(e["subsystem_ref"] for e in created)   # provenance recorded
        pipelines = {r["pipeline"] for r in store.list_assignments(conn)}
        assert pipelines == {"revision", "lecture", "deck"}
    finally:
        conn.close()
```

- [ ] **Step 2: Run the full factory-run suite to surface every 2-lane assumption**

Run: `python -m pytest tests/test_factory_run.py -v`
Expected: several FAILs in the pre-existing tests that assume two lanes. Update each as follows (the failing output names the exact test + line):

| Test (by name) | Change |
|---|---|
| `test_plan_dry_returns_two_proposals_and_writes_nothing` | `assert [p["line"] for p in proposals] == ["revision", "lecture"]` → `== ["revision", "lecture", "deck"]` (and you may rename to `..._three_proposals...`). |
| `test_plan_live_records_two_in_review_children` | `{r["pipeline"] for r in rows} == {"revision", "lecture"}` → `== {"revision", "lecture", "deck"}`; `verbs.count("product_proposed") == 2` → `== 3`. |
| `test_plan_live_is_idempotent_per_seed_and_line` | `assert len(store.list_assignments(conn)) == 2   # not 4` → `== 3   # not 6`. |
| `test_approve_flips_single_child` | `[a, _] = run.plan(...)` → `a = run.plan("textbook:circular-motion", dry=False)[0]`. |
| `test_approve_refuses_non_in_review` | `[a, _] = run.plan(...)` → `a = run.plan("textbook:circular-motion", dry=False)[0]`. |
| `test_approve_seed_batches_all_children` | `assert len(res["approved"]) == 2` → `== 3`. |
| `test_build_runs_engine_and_captures` | `[a, _] = run.plan(...)` → `a = run.plan("textbook:circular-motion", dry=False)[0]`. |
| `test_build_refuses_unapproved` | `[a, _] = run.plan(...)` → `a = run.plan("textbook:circular-motion", dry=False)[0]`. |
| `test_build_refuses_double_build` | `[a, _] = run.plan(...)` → `a = run.plan("textbook:circular-motion", dry=False)[0]`. |
| `test_build_refuses_in_flight` | `[a, _] = run.plan(...)` → `a = run.plan("textbook:circular-motion", dry=False)[0]`. |
| `test_build_validates_output` | `[a, _] = run.plan(...)` → `a = run.plan("textbook:circular-motion", dry=False)[0]`. |

> Rule for the destructures: anywhere a test does `[a, _] = run.plan(seed, dry=False)` (which now raises `ValueError: too many values to unpack`), change it to `a = run.plan(seed, dry=False)[0]`. The first proposal is always the `revision` lane (stable `_ORDER`), so the existing `revision`/`thin` assertions in those tests stay correct. The build-refusal tests build only that first child and never reach the deck lane, so they need no `_stub_deck`.

- [ ] **Step 3: Re-run until green**

Run: `python -m pytest tests/test_factory_run.py -v`
Expected: PASS (all, including the new `test_one_seed_fans_to_three_captured_artifacts`).

- [ ] **Step 4: Commit**

```bash
git add tests/test_factory_run.py
git commit -m "test(factory): one-seed -> three-artifact fan-out incl. deck (Phase C1)"
```

---

### Task 5: full-suite green + live golden-thread smoke + finish the branch

**Files:** none (gate + verification), plus a throwaway smoke script (created, run, deleted — **not** committed).

- [ ] **Step 1: Run the whole backend suite**

Run: `python -m pytest -q`
Expected: PASS — the 303 prior tests + the new C1 tests (~14: 5 lines + 7 deck + 2 dispatch, plus the rewritten fan-out), no regressions. (On Windows the run may print a trailing `PermissionError: [WinError 5] … pytest-current` tmpdir-cleanup traceback **after** the `N passed` line — that is cosmetic teardown noise, not a failure.)

- [ ] **Step 2: Live golden-thread smoke on the REAL `circular-motion` chapter**

Create `c1_deck_smoke.py` at the repo root (throwaway — runs the full factory loop in an **isolated temp governance store** so the durable `governance.db` is untouched, mirroring the Phase-1 smoke):

```python
import json
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from samagra import config
from samagra.governance import store

tmp = pathlib.Path(tempfile.mkdtemp(prefix="c1-deck-smoke-"))
config.GOVERNANCE_DB = tmp / "governance.db"
config.EXPORT_DIR = tmp / "exports"
store._INITIALIZED.clear()
store.ensure_tables()

from samagra.factory import lines, run

seed = "textbook:circular-motion"
print("classify:", lines.classify(seed))                       # expect ['revision','lecture','deck']

# Full factory flow in the temp store: one seed -> three captured artifacts.
proposals = run.plan(seed, dry=False)
run.approve_seed(seed)
built = {}
for p in proposals:
    out = run.build(p["assignment_id"])
    built[p["line"]] = out["artifact_ref"]
    print("built", p["line"], "->", out["artifact_ref"])
assert len(set(built.values())) == 3, "expected 3 distinct artifacts"

# Inspect the REAL deck the factory just produced (the .json sits beside the .html).
deck_html = pathlib.Path(built["deck"])
deck_json = deck_html.with_name(deck_html.name.replace("-deck.html", "-deck.json"))
data = json.loads(deck_json.read_text(encoding="utf-8"))
by_kind = {}
for c in data["cards"]:
    by_kind[c["kind"]] = by_kind.get(c["kind"], 0) + 1
print("deck cards:", len(data["cards"]), "by kind:", by_kind)  # expect an equation + callout mix
print("sample card:", data["cards"][0])
print("OK — 3 distinct artifacts; durable governance.db untouched (temp:", tmp, ")")
```

Run: `python c1_deck_smoke.py`
Expected: prints `classify: ['revision', 'lecture', 'deck']`; a non-zero deck card count split across `equation` + `callout`; a real sample card with a `$$…$$` back; and three `built … -> …` lines. Then delete the script:

```bash
rm c1_deck_smoke.py
```

- [ ] **Step 3: Confirm no stray external/prod writes**

Run: `git status --porcelain` and confirm the only changes are the intended source/test files (no `governance.db`, no `build/` artifacts staged, no `state/`). The deck engine has no network/gdocs code, so this is a belt-and-braces check.

- [ ] **Step 4: Finish the branch**

Use `superpowers:finishing-a-development-branch` to present merge options. After merge, sync `STATUS.html` / `SUMMARY.html` / `HANDOFF.md` (C1 shipped: deck lane live, one chapter now fans to 3 artifacts) and record the plan:

```bash
cbm record-plan docs/superpowers/plans/2026-06-24-samagra-content-factory-phase-c1-deck.md --title "Content Factory Phase C1 (deck)"
```

- [ ] **Step 5: Commit any review fixes**

```bash
git add -A && git commit -m "harden(factory): resolve Phase-C1 review findings"
```

---

## Self-Review

**Spec coverage (§3.1 deck lane, §2 lane-`kind`, §6 C1 acceptance):**
- §2 `Line` gains `kind` (default `local`) → Task 1. §3.1 `build_deck(slug) -> {json, html}`, pure, equation+callout → `{front,back,ref}` cards, reuses the lectures loader, writes under `EXPORT_DIR` → Task 2. Dispatch routing (the §2 `run_line` branch) → Task 3. §6 acceptance: one textbook seed → **3** captured local artifacts; deck json+html exist + non-empty; revision/lecture byte-identical (the `kind` default doesn't alter their `run_line` path); all five guards still hold (unchanged `build()`) → Tasks 4–5. No external dependency / no prod write → structural (no network code) + Task 5 Step 3. No migration → no schema touched. Publish gate untouched → `build` produces an artifact only.

**Placeholder scan:** none — every code step is complete and runnable; the existing-test edits give exact old→new assertions plus the universal destructure rule.

**Type consistency:** `Line(key, expected_output, variant, source_prefixes, kind="local")` is used consistently in `lines.py` and read as `.kind`/`.source_prefixes`/`.variant` in `dispatch.run_line` and the tests. `build_deck(slug) -> {"variant","html","json","cards"}` with all-`str`/`int` values is asserted JSON-serializable (Task 2) and consumed by `run_line` (Task 3) → `validate_product` (reads `result["html"]`, unchanged) → `build()` (`artifact_ref = result["html"]`, `json.dumps(result)`, unchanged). The deck-stub in Task 4 returns the same dict shape as the real engine. `_cards_for_chapter` card shape `{front,back,ref,kind}` matches every test assertion in Tasks 2 and 5.
