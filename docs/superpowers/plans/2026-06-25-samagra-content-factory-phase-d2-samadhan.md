# SAMAGRA Content Factory **Phase D2** — the Samadhan live LLM lane — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first generative content lane — `samadhan` (a per-chapter misconception brief in the owner's StyleSeed voice) — as an opt-in `Line.kind="llm"` behind a single mockable Anthropic call site, the mandatory adversarial ground-truth reviewer, the advisory style scorer, and the never-automated publish gate.

**Architecture:** Two new layers + thin wiring. `samagra/clients/llm_client.py` is the **only** Anthropic SDK call site (key from the gitignored `.env`, never logged; mockable via an injected SDK; owns request-construction + response-parsing). `samagra/factory/samadhan.py` orchestrates: condition on the StyleSeed → generate → adversarially review against the chapter ground-truth → advisory style-score → write local artifacts. The factory `build()` boundary gains a `kind=="llm"` **preflight before recording intent** (anti-wedge) and a terminal-status branch (`reviewer errors > 0 → changes`, else `captured`); the five crash-safety guards are unchanged. `samadhan` is registered with `auto_fan=False`, so it is excluded from the default `classify("textbook:")` fan-out and is invoked only via `factory plan textbook:<slug> --lane samadhan`.

**Tech Stack:** Python 3.11, the `anthropic` SDK (0.96.0, already installed — add to `requirements.txt`), `claude-opus-4-8` with adaptive thinking + structured output + prompt-cached system block, pytest with a fake LLM client (no network in the standing gate; one opt-in live smoke gated on `ANTHROPIC_API_KEY`).

---

## Pinned design decisions (resolve the spec's deferred D2 details)

1. **Two-layer seam (testability + the DEC-8 reviewer firewall).**
   - `LLMClient.generate_samadhan(chapter, *, system) -> {"items":[{concept,misconception,correction,why}]}` and
     `LLMClient.review_samadhan(items, chapter) -> {"verdicts":[{idx,verdict:"ok"|"error",rationale}]}` own the SDK call **and** the response parsing, returning plain dicts.
   - `review_samadhan` **never receives the StyleSeed or the generation system prompt** — it builds its own ground-truth-only, refute-framed system internally. This **structurally** enforces DEC-8 ("the reviewer is anchored only to external ground-truth, never to style").
   - `samadhan.build_samadhan` injects the client (`client=None → llm_client.LLMClient()`); unit tests pass a `FakeLLM` returning canned dicts; the `llm_client` unit tests inject a fake SDK and assert the request kwargs + parsing. **No standing test calls the network or needs a key.**

2. **Anti-wedge preflight (mirrors C3's validate-before-intent).** `build()` for `kind=="llm"` calls `samadhan.preflight(slug)` **before** recording the `product_building` event. Preflight raises (cleanly, no write) if: the chapter has no `content.json` (`FileNotFoundError`), there is no committed StyleSeed (`RuntimeError`), or the LLM is not configured (`llm_client.configured()` is False → `RuntimeError`). A missing key therefore refuses **before** any in-flight state exists.

3. **The capture gate (`_assert_review_clean`), without wedging.** The artifact is **always written** and transparently records every reviewer verdict. `validate_product` for `kind=="llm"` asserts exists + non-empty + `_assert_review_clean` = the review **ran and was persisted** (the result carries an integer `errors` and a non-empty `verdicts` list, and the written JSON embeds them) — it raises only if the review is **missing/malformed** (a brief whose reviewer was skipped must never be captured). The **errors>0 → `changes`** routing lives in `build()`: a clean brief (`errors==0`) flips to terminal `captured`; an error-flagged brief flips to `changes` (owner review) — never a silent capture. (This is the `llm` analog of C2's `_assert_no_answer_leak`: the artifact records the verdicts; the gate blocks capturing an unreviewed or error-flagged brief.)

4. **Opt-in fan-out (F-D4).** `Line` gains `auto_fan: bool = True`; `classify` filters `LINES[k].auto_fan`. `samadhan = Line(..., kind="llm", source_prefixes=("textbook:",), auto_fan=False)`. `plan(seed_ref, lane="samadhan")` proposes exactly that lane (validated against the seed prefix); without `--lane`, `plan` proposes only the auto-fan lanes.

5. **Secrets posture (PUBLIC repo).** The key is read **only** from `os.environ["ANTHROPIC_API_KEY"]` (config.py already `load_dotenv`s the gitignored `.env`). It is never hardcoded, never logged, never in `__repr__`. `.env.example` gets a blank `ANTHROPIC_API_KEY=` + `SAMAGRA_LLM_MODEL=claude-opus-4-8`. A test asserts `repr()` masks the key. The live smoke is `skipif` no key.

6. **HTML-escaping (the C1 lesson).** Misconception/correction/why are **LLM-generated** text (untrusted), possibly carrying `<`/`>`/`&` and inline `$math$`. The printable HTML **escapes every text field at the boundary** (`html.escape`) so the browser tokenizer can't eat a `<`; MathJax then typesets the `$…$` from the decoded DOM text. The JSON sidecar keeps the **raw** text (escaping is a render concern, not data) — exactly as `deck.py` does for equations.

**Non-goals (unchanged from spec §10):** no second LLM lane; no async lanes (NotebookLM/image-gen = Phase F); no samadhan in the default fan-out; no new web endpoint. **A dedicated DEC-7 Codex pre-merge review of the generation boundary is required before merge** (the controller runs it after Task 5).

---

## File structure

- **Create** `samagra/clients/llm_client.py` — the only Anthropic call site (`configured`, `LLMClient`, `generate_samadhan`, `review_samadhan`, the prompts + schemas).
- **Create** `samagra/factory/samadhan.py` — `build_samadhan(slug, *, client=None)`, `preflight(slug)`, the HTML/JSON writers.
- **Modify** `samagra/factory/lines.py` — add `Line.auto_fan`; register the `samadhan` lane; filter `classify` on `auto_fan`.
- **Modify** `samagra/factory/run.py` — `plan(seed_ref, dry, lane=None)`; `build()` llm preflight + terminal-status branch.
- **Modify** `samagra/factory/dispatch.py` — `run_line` llm branch; `validate_product` + `_assert_review_clean` for `kind=="llm"`.
- **Modify** `samagra/__main__.py` — `factory plan … --lane <lane>`.
- **Modify** `requirements.txt` (add `anthropic>=0.96`) and `.env.example` (add `ANTHROPIC_API_KEY=` + `SAMAGRA_LLM_MODEL=claude-opus-4-8`).
- **Create** tests: `tests/test_llm_client.py`, `tests/test_factory_samadhan.py`, `tests/test_factory_samadhan_wiring.py`, `tests/test_samadhan_live_smoke.py`; **modify** `tests/test_factory_lines.py` (or add) for the `auto_fan`/`classify` change.

---

## Task 1: `clients/llm_client.py` — the single Anthropic boundary

**Files:**
- Create: `samagra/clients/llm_client.py`
- Modify: `requirements.txt`, `.env.example`
- Test: `tests/test_llm_client.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_llm_client.py
"""The single Anthropic call site. No network: a fake SDK is injected; the only
real-network path is the opt-in live smoke (separate file). A missing key raises;
the key is never logged or repr'd."""
from __future__ import annotations

import pytest

from samagra.clients import llm_client


class _FakeMessages:
    def __init__(self, payload_text):
        self._payload_text = payload_text
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        # Mimic the SDK response: an object with .content -> [block.text]
        block = type("B", (), {"type": "text", "text": self._payload_text})()
        return type("R", (), {"content": [block], "stop_reason": "end_turn"})()


class _FakeSDK:
    def __init__(self, payload_text):
        self.messages = _FakeMessages(payload_text)


def test_configured_reflects_env(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert llm_client.configured() is False
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    assert llm_client.configured() is True


def test_missing_key_raises_runtimeerror(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        llm_client.LLMClient()                       # no key, no injected sdk


def test_repr_never_leaks_key(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-SECRET-zzz")
    c = llm_client.LLMClient(sdk=_FakeSDK('{"items": []}'))
    assert "SECRET" not in repr(c)


def test_generate_samadhan_builds_request_and_parses(monkeypatch):
    sdk = _FakeSDK('{"items": [{"concept": "c", "misconception": "m", '
                   '"correction": "k", "why": "w"}]}')
    c = llm_client.LLMClient(sdk=sdk, model="claude-opus-4-8")
    out = c.generate_samadhan({"title": "Circular Motion"}, system="STYLE-BLOCK")
    assert out["items"][0]["concept"] == "c"
    kw = sdk.messages.calls[0]
    assert kw["model"] == "claude-opus-4-8"
    assert kw["thinking"] == {"type": "adaptive"}
    # the StyleSeed system block is the cached prefix
    assert kw["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert "STYLE-BLOCK" in kw["system"][0]["text"]
    # structured output requested
    assert kw["output_config"]["format"]["type"] == "json_schema"


def test_review_samadhan_uses_groundtruth_only_system(monkeypatch):
    sdk = _FakeSDK('{"verdicts": [{"idx": 0, "verdict": "ok", "rationale": "r"}]}')
    c = llm_client.LLMClient(sdk=sdk)
    out = c.review_samadhan([{"concept": "c", "misconception": "m",
                              "correction": "k", "why": "w"}],
                            {"title": "Circular Motion"})
    assert out["verdicts"][0]["verdict"] == "ok"
    sys_text = sdk.messages.calls[0]["system"][0]["text"].lower()
    # the reviewer is anchored to ground truth and prompted to refute; it must NOT
    # carry style guidance (DEC-8 firewall).
    assert "refute" in sys_text or "ground" in sys_text
    assert "styleseed" not in sys_text
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_llm_client.py -v`
Expected: FAIL — `ModuleNotFoundError: samagra.clients.llm_client`.

- [ ] **Step 3: Implement `samagra/clients/llm_client.py`**

```python
"""The ONLY Anthropic SDK call site (mirrors clients/{mcd_client,qx_client}.py as
the single boundary to an external subsystem). Generation + the adversarial
ground-truth reviewer for the samadhan lane.

SAFETY (PUBLIC REPO): the key is read only from ANTHROPIC_API_KEY (config.py
load_dotenv's the gitignored .env). It is NEVER hardcoded, logged, or repr'd. A
missing key raises RuntimeError at construction — callers (build() preflight)
check `configured()` BEFORE recording any build intent so a missing key refuses
without wedging an in-flight assignment.
"""
from __future__ import annotations

import json
import os

_DEFAULT_MODEL = "claude-opus-4-8"
_MAX_TOKENS = 8000

# --- structured-output schemas ------------------------------------------------
_SAMADHAN_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "concept": {"type": "string"},
                    "misconception": {"type": "string"},
                    "correction": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["concept", "misconception", "correction", "why"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["items"],
    "additionalProperties": False,
}

_REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "verdicts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "idx": {"type": "integer"},
                    "verdict": {"type": "string", "enum": ["ok", "error"]},
                    "rationale": {"type": "string"},
                },
                "required": ["idx", "verdict", "rationale"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["verdicts"],
    "additionalProperties": False,
}

# --- prompts (stable -> cacheable system prefix) ------------------------------
_GEN_TASK = (
    "\n\nTASK: From the chapter below, surface the most important student "
    "MISCONCEPTIONS for JEE/NEET physics. For each, give a JSON item with: "
    "`concept` (the idea), `misconception` (the wrong belief, stated plainly), "
    "`correction` (the right physics), and `why` (why the misconception is "
    "tempting and how to see past it). Ground every claim ONLY in the chapter. "
    "Return 4-8 items as strict JSON {\"items\":[...]}."
)

_REVIEW_SYSTEM = (
    "You are a physics ground-truth checker. You are given a chapter and a list "
    "of misconception->correction items. For EACH item, TRY TO REFUTE it: flag "
    "any 'misconception' that is actually correct physics, any 'correction' that "
    "is wrong or imprecise, and any claim not supported by the chapter. Judge "
    "ONLY against physics and the chapter text — NOT writing style. Default to "
    "verdict 'error' when a claim is unsupported or wrong. Return strict JSON "
    "{\"verdicts\":[{\"idx\":<int>,\"verdict\":\"ok\"|\"error\",\"rationale\":<str>}]}."
)


def configured() -> bool:
    """True iff an API key is present in the environment. Cheap; no SDK import,
    no network. build() preflight calls this BEFORE recording intent."""
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _extract_json(response) -> dict:
    """Pull the JSON object out of a Messages response's text blocks."""
    parts = []
    for block in getattr(response, "content", None) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    raw = "".join(parts).strip()
    return json.loads(raw)


class LLMClient:
    def __init__(self, *, sdk=None, model=None):
        self._model = model or os.environ.get("SAMAGRA_LLM_MODEL", _DEFAULT_MODEL)
        if sdk is not None:                    # injected (tests) — no key required
            self._sdk = sdk
            return
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set — add it to the gitignored .env. "
                "Refusing to start an LLM build without a key.")
        import anthropic                        # lazy: keep import off the no-LLM paths
        self._sdk = anthropic.Anthropic(api_key=key)

    def _create(self, *, system_text, user_text, schema):
        return self._sdk.messages.create(
            model=self._model,
            max_tokens=_MAX_TOKENS,
            thinking={"type": "adaptive"},
            system=[{"type": "text", "text": system_text,
                     "cache_control": {"type": "ephemeral"}}],
            output_config={"format": {"type": "json_schema", "name": "out",
                                      "schema": schema}},
            messages=[{"role": "user", "content": user_text}],
        )

    def generate_samadhan(self, chapter: dict, *, system: str) -> dict:
        """Generate the misconception brief. `system` is the conditioned StyleSeed
        block (the large, cached prefix); the chapter ground-truth is the user turn."""
        resp = self._create(
            system_text=system + _GEN_TASK,
            user_text="CHAPTER (ground truth):\n" + json.dumps(chapter, ensure_ascii=False),
            schema=_SAMADHAN_SCHEMA)
        return _extract_json(resp)

    def review_samadhan(self, items: list, chapter: dict) -> dict:
        """Adversarially review items against the chapter ground truth ONLY. Builds
        its own ground-truth-anchored system — never receives the StyleSeed (DEC-8)."""
        resp = self._create(
            system_text=_REVIEW_SYSTEM,
            user_text=("CHAPTER (ground truth):\n"
                       + json.dumps(chapter, ensure_ascii=False)
                       + "\n\nITEMS:\n" + json.dumps(items, ensure_ascii=False)),
            schema=_REVIEW_SCHEMA)
        return _extract_json(resp)

    def __repr__(self) -> str:                 # never leak the key
        return f"LLMClient(model={self._model!r})"
```

Add to `requirements.txt` (one line, with the existing deps): `anthropic>=0.96`.
Add to `.env.example` under a new section:
```
# --- LLM generation (Phase D2, the samadhan lane) ---
# PUBLIC REPO: real key lives only in the gitignored .env — never commit it.
ANTHROPIC_API_KEY=
SAMAGRA_LLM_MODEL=claude-opus-4-8
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_llm_client.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add samagra/clients/llm_client.py tests/test_llm_client.py requirements.txt .env.example
git commit -m "feat(clients): Phase D2 — llm_client, the single Anthropic call site (key from .env, mockable)"
```

---

## Task 2: `factory/samadhan.py` — the lane engine

**Files:**
- Create: `samagra/factory/samadhan.py`
- Test: `tests/test_factory_samadhan.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_factory_samadhan.py
"""The samadhan lane engine: condition -> generate -> adversarially review ->
advisory score -> write local artifacts. The LLM is a FakeLLM (no network)."""
from __future__ import annotations

import json

import pytest

from samagra import config
from samagra.factory import samadhan
from samagra.factory.style import profile as P


FACETS = {"voice": {"mean_sentence_len": 16.0, "second_person_rate": 0.08,
                    "hedge_rate": 0.05, "imperative_rate": 0.1},
          "sequencing": {"mean_sections_per_chapter": 5.0},
          "analogy": {"analogy_block_rate": 0.03},
          "rigor": {"flags_per_section": 0.9}, "selection": {"callout_density": 0.2}}


class FakeLLM:
    def __init__(self, items, verdicts):
        self._items, self._verdicts = items, verdicts
        self.gen_system = None
    def generate_samadhan(self, chapter, *, system):
        self.gen_system = system
        return {"items": self._items}
    def review_samadhan(self, items, chapter):
        return {"verdicts": self._verdicts}


@pytest.fixture()
def styleseed(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(P, "_now", lambda: "t")
    P.save(P.StyleSeed(0, FACETS, "h", "t"))


@pytest.fixture()
def export(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "lectures")


@pytest.fixture()
def fake_chapter(monkeypatch):
    from samagra.lectures import render
    monkeypatch.setattr(render, "load_chapter",
                        lambda slug: {"title": "Circular Motion", "subtitle": "",
                                      "sections": []})


def test_clean_brief_writes_artifacts_and_zero_errors(styleseed, export, fake_chapter):
    client = FakeLLM(items=[{"concept": "centripetal", "misconception": "force outward",
                             "correction": "net force points inward",
                             "why": "you feel pushed out"}],
                     verdicts=[{"idx": 0, "verdict": "ok", "rationale": "correct"}])
    res = samadhan.build_samadhan("circular-motion", client=client)
    assert res["variant"] == "samadhan" and res["items"] == 1 and res["errors"] == 0
    assert res["style_seed_version"] == 0 and "overall" in res["style_score"]
    assert "STYLE" not in (client.gen_system or "") or "voice" in (client.gen_system or "").lower()
    from pathlib import Path
    assert Path(res["html"]).is_file() and Path(res["json"]).is_file()
    data = json.loads(Path(res["json"]).read_text(encoding="utf-8"))
    assert data["items"][0]["verdict"] == "ok"
    assert data["style_seed_version"] == 0


def test_error_verdict_is_counted(styleseed, export, fake_chapter):
    client = FakeLLM(items=[{"concept": "c", "misconception": "m",
                             "correction": "k", "why": "w"}],
                     verdicts=[{"idx": 0, "verdict": "error", "rationale": "wrong"}])
    res = samadhan.build_samadhan("x", client=client)
    assert res["errors"] == 1


def test_html_escapes_untrusted_text_but_json_keeps_raw(styleseed, export, fake_chapter):
    # LLM prose carrying < > & must be escaped in the printable; the JSON keeps raw.
    client = FakeLLM(items=[{"concept": "Gauss", "misconception": "E(r<R) & B>0 always",
                             "correction": "for r<R the field is 0",
                             "why": "symmetry & <flux>"}],
                     verdicts=[{"idx": 0, "verdict": "ok", "rationale": "ok"}])
    res = samadhan.build_samadhan("gauss-law", client=client)
    from pathlib import Path
    html = Path(res["html"]).read_text(encoding="utf-8")
    assert "E(r<R)" not in html and "E(r&lt;R)" in html      # escaped at the boundary
    data = json.loads(Path(res["json"]).read_text(encoding="utf-8"))
    assert data["items"][0]["misconception"] == "E(r<R) & B>0 always"   # raw in json


def test_missing_chapter_raises_before_any_write(styleseed, export, monkeypatch):
    from samagra.lectures import render
    def boom(slug):
        raise FileNotFoundError(slug)
    monkeypatch.setattr(render, "load_chapter", boom)
    with pytest.raises(FileNotFoundError):
        samadhan.build_samadhan("nope", client=FakeLLM([], []))


def test_preflight_raises_without_key(styleseed, fake_chapter, monkeypatch):
    from samagra.clients import llm_client
    monkeypatch.setattr(llm_client, "configured", lambda: False)
    with pytest.raises(RuntimeError):
        samadhan.preflight("circular-motion")


def test_preflight_raises_without_styleseed(export, fake_chapter, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "none")
    from samagra.clients import llm_client
    monkeypatch.setattr(llm_client, "configured", lambda: True)
    with pytest.raises(RuntimeError):
        samadhan.preflight("circular-motion")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_factory_samadhan.py -v`
Expected: FAIL — `ModuleNotFoundError: samagra.factory.samadhan`.

- [ ] **Step 3: Implement `samagra/factory/samadhan.py`**

```python
"""The samadhan lane engine (Phase D2 — the first generative lane).

One textbook chapter (seed 'textbook:<slug>') -> a misconception brief in the
owner's StyleSeed voice: condition on the StyleSeed -> generate items -> an
adversarial reviewer anchored ONLY to the chapter ground truth -> an advisory
style-fit score -> write <slug>-samadhan.{json,html} under EXPORT_DIR/<slug>/.

The publish gate is untouched: this writes a LOCAL artifact only; capturing it
is build()'s job (a clean review -> captured; any reviewer error -> changes).
"""
from __future__ import annotations

import html as _html
import json

from .. import config
from ..clients import llm_client
from ..lectures import render
from .style import condition, profile as style_profile, score

_SAMADHAN_CSS = """
.sam{display:flex;flex-direction:column;gap:14px;margin-top:8px}
.sam-item{border:1px solid #e3e3e6;border-radius:10px;padding:14px 16px;background:#fff}
.sam-concept{font-weight:600;color:#1f2328;margin-bottom:6px}
.sam-row{margin:4px 0}.sam-k{color:#8a8f98;font-weight:600;margin-right:6px}
.sam-bad{color:#9a2a2a}.sam-good{color:#1a6f3c}
.sam-verdict{font-size:12px;font-weight:600;margin-top:6px}
.v-ok{color:#1a6f3c}.v-error{color:#9a2a2a}
@media print{.sam-item{break-inside:avoid}}
"""


def _require_styleseed():
    seed = style_profile.load_current()
    if seed is None:
        raise RuntimeError(
            "no committed StyleSeed — run `factory style-extract` and commit v0 "
            "before generating a samadhan brief")
    return seed


def preflight(slug: str) -> None:
    """Anti-wedge pre-check (called by build() BEFORE recording intent): the
    chapter exists, a StyleSeed is committed, and the LLM is configured. Raises
    FileNotFoundError / RuntimeError without writing anything."""
    render.load_chapter(slug)                  # FileNotFoundError if absent
    _require_styleseed()
    if not llm_client.configured():
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set — refusing an LLM build without a key")


def _prose(item: dict) -> str:
    return " ".join(str(item.get(k, "")) for k in ("misconception", "correction", "why"))


def _html_doc(content: dict, scored: list[dict]) -> str:
    parts = ['<section class="sam">']
    for i, it in enumerate(scored, 1):
        # every field is UNTRUSTED LLM text -> escape at the boundary (the C1 lesson);
        # inline $..$ math is typeset by MathJax from the decoded DOM text node.
        concept = _html.escape(str(it.get("concept", "")))
        misc = _html.escape(str(it.get("misconception", "")))
        corr = _html.escape(str(it.get("correction", "")))
        why = _html.escape(str(it.get("why", "")))
        verdict = it.get("verdict", "ok")
        vcls = "v-error" if verdict == "error" else "v-ok"
        rationale = _html.escape(str(it.get("rationale", "")))
        parts.append(
            f'<article class="sam-item">'
            f'<div class="sam-concept"><span class="sam-k">{i}.</span> {concept}</div>'
            f'<div class="sam-row"><span class="sam-k">Misconception</span>'
            f'<span class="sam-bad">{misc}</span></div>'
            f'<div class="sam-row"><span class="sam-k">Correction</span>'
            f'<span class="sam-good">{corr}</span></div>'
            f'<div class="sam-row"><span class="sam-k">Why</span>{why}</div>'
            f'<div class="sam-verdict {vcls}">reviewer: {_html.escape(verdict)}'
            f'{(" — " + rationale) if rationale else ""}</div>'
            f'</article>')
    parts.append("</section>")
    return render.DOC_TEMPLATE.format(
        title=_html.escape(content.get("title", "Samadhan")),
        subtitle=_html.escape(content.get("subtitle", "")),
        kicker=_html.escape("Misconception brief (Samadhan)"),
        css=render.DOC_CSS + _SAMADHAN_CSS,
        body="\n".join(parts))


def build_samadhan(slug: str, *, client=None) -> dict:
    """Generate, adversarially review, advisory-score, and write the brief. Raises
    FileNotFoundError (no chapter) / RuntimeError (no StyleSeed) BEFORE any write."""
    content = render.load_chapter(slug)             # ground truth (raises if absent)
    seed = _require_styleseed()
    system = condition.to_system_prompt(seed)
    client = client or llm_client.LLMClient()       # constructs real client (key check)

    gen = client.generate_samadhan(content, system=system)
    items = list(gen.get("items", []))
    verdicts = client.review_samadhan(items, content).get("verdicts", [])
    by_idx = {v.get("idx"): v for v in verdicts}

    scored = []
    for i, it in enumerate(items):
        v = by_idx.get(i, {"verdict": "ok", "rationale": ""})
        scored.append({**it, "verdict": v.get("verdict", "ok"),
                       "rationale": v.get("rationale", "")})
    errors = sum(1 for s in scored if s.get("verdict") == "error")

    prose = "\n".join(_prose(it) for it in items)
    style_score = score.style_fit(prose, seed) if items else {"overall": 0.0, "facets": {}}

    out = config.EXPORT_DIR / slug
    out.mkdir(parents=True, exist_ok=True)
    payload = {"slug": slug, "title": content.get("title", slug),
               "model": getattr(client, "_model", None),
               "style_seed_version": seed.version, "style_score": style_score,
               "items": scored, "errors": errors}        # JSON keeps RAW item text
    json_path = out / f"{slug}-samadhan.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    html_path = out / f"{slug}-samadhan.html"
    html_path.write_text(_html_doc(content, scored), encoding="utf-8")

    return {"variant": "samadhan", "html": str(html_path), "json": str(json_path),
            "items": len(items), "errors": errors, "verdicts": verdicts,
            "style_score": style_score, "style_seed_version": seed.version}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_factory_samadhan.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/samadhan.py tests/test_factory_samadhan.py
git commit -m "feat(factory): Phase D2 — samadhan lane engine (condition->generate->review->score->write)"
```

---

## Task 3: lane registration + opt-in `classify` + `plan(--lane)`

**Files:**
- Modify: `samagra/factory/lines.py`
- Modify: `samagra/factory/run.py` (`plan` signature + body)
- Test: `tests/test_factory_lines.py` (create or append), `tests/test_factory_samadhan_wiring.py` (create; plan part)

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_factory_lines.py
from samagra.factory.lines import LINES, classify, Line


def test_samadhan_registered_as_llm_optin():
    s = LINES["samadhan"]
    assert s.kind == "llm" and s.auto_fan is False
    assert s.source_prefixes == ("textbook:",)


def test_classify_excludes_optin_lanes():
    # the default textbook fan-out is unchanged (5 auto-fan lanes), samadhan excluded
    assert classify("textbook:circular-motion") == ["revision", "lecture", "deck",
                                                     "paper", "drill"]


def test_existing_lanes_default_auto_fan_true():
    assert LINES["revision"].auto_fan is True and LINES["deck"].auto_fan is True
```

```python
# tests/test_factory_samadhan_wiring.py  (the plan-half here; build-half in Task 4)
from samagra.factory import run


def test_plan_lane_samadhan_proposes_only_that_lane(monkeypatch):
    props = run.plan("textbook:circular-motion", dry=True, lane="samadhan")
    assert [p["line"] for p in props] == ["samadhan"]


def test_plan_lane_rejects_mismatched_prefix():
    import pytest
    with pytest.raises(ValueError):
        run.plan("munshi:5", dry=True, lane="samadhan")   # samadhan is textbook-only


def test_plan_without_lane_is_unchanged(monkeypatch):
    props = run.plan("textbook:circular-motion", dry=True)
    assert "samadhan" not in [p["line"] for p in props]
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m pytest tests/test_factory_lines.py tests/test_factory_samadhan_wiring.py -v`
Expected: FAIL — no `samadhan` lane / `auto_fan` / `plan(lane=)`.

- [ ] **Step 3a: `samagra/factory/lines.py`**

Add `auto_fan` to the dataclass (after `kind`):

```python
    kind: str = "local"     # output class: "local" | "qx" | "mcd" | "llm".
    auto_fan: bool = True   # included in the default classify() fan-out? F-D4: the
                            # llm samadhan lane is registered but opt-in (False) — it
                            # is proposed only via `factory plan … --lane samadhan`.
```

Register the lane in `LINES` (after `"seed"`), and add it to `_ORDER`:

```python
    "samadhan": Line("samadhan", "Misconception brief (Samadhan, LLM)",
                     None, ("textbook:",), "llm", auto_fan=False),
```

```python
_ORDER = ["revision", "lecture", "deck", "paper", "drill", "seed", "samadhan"]
```

Filter `classify` on `auto_fan`:

```python
def classify(seed_ref: str) -> list[str]:
    """Return the applicable AUTO-FAN product-line keys for a seed_ref, in stable
    order. Opt-in lanes (auto_fan=False, e.g. the llm samadhan lane) are excluded
    from the default fan-out and targeted explicitly via plan(lane=...)."""
    ref = (seed_ref or "").strip()
    if not ref:
        return []
    return [k for k in _ORDER
            if LINES[k].auto_fan
            and any(ref.startswith(p) for p in LINES[k].source_prefixes)]
```

- [ ] **Step 3b: `samagra/factory/run.py` — `plan` gains `lane`**

Change the signature and add the explicit-lane path at the top of `plan` (after the `munshi:` branch, before `classify`):

```python
def plan(seed_ref: str, dry: bool = True, lane: str | None = None) -> list[dict]:
    """Classify a seed into product lines; dry=True writes nothing, dry=False
    records ONE in-review child assignment + outbox + 'product_proposed' per line.

    `lane` (F-D4): target a single named lane explicitly — required for opt-in
    lanes (auto_fan=False) like `samadhan` that classify() omits. The lane must
    exist and accept the seed's prefix.

    A munshi: seed is the mcd `seed` lane — proposed from its LIVE item (payload),
    not a slug fan-out; routed here to _record_seed_proposal."""
    seed_ref = (seed_ref or "").strip()   # normalize ONCE (review 24 L2)
    if seed_ref.startswith("munshi:"):
        conn = None if dry else store.connect()
        try:
            item = _munshi_item_for(seed_ref)
            if item is None:
                return []
            proposal = _record_seed_proposal(conn, item, dry=dry)
            return [proposal] if proposal is not None else []
        finally:
            if conn is not None:
                conn.close()
    if lane is not None:
        spec = LINES.get(lane)
        if spec is None:
            raise ValueError(f"unknown lane {lane!r}")
        if not any(seed_ref.startswith(p) for p in spec.source_prefixes):
            raise ValueError(
                f"lane {lane!r} does not accept seed {seed_ref!r}")
        lines = [lane]
    else:
        lines = classify(seed_ref)        # what we store + validate == what we classify
    pointers = resolve_pointers(seed_ref.split(":", 1)[-1].replace("-", " "), limit=5)
    proposals: list[dict] = []
    conn = None if dry else store.connect()
    try:
        for line in lines:
            spec = LINES[line]
            if spec.kind == "mcd":            # defense in depth: the seed lane is
                continue                       # proposed via scan/munshi-plan, never a
                                               # textbook fan-out (classify excludes it anyway)
            # ... (rest of the loop body is UNCHANGED) ...
```

> The remainder of the `for line in lines:` body (the dedup, outbox, add_assignment, append_event) is **unchanged** — only the `lines = …` selection above it changed.

- [ ] **Step 4: Run to verify they pass**

Run: `python -m pytest tests/test_factory_lines.py tests/test_factory_samadhan_wiring.py -v`
Expected: PASS

- [ ] **Step 5: Run the existing factory suites for regressions**

Run: `python -m pytest tests/test_factory_lines.py tests/test_factory_run.py tests/test_factory_dispatch.py -q`
Expected: all green (classify's contract for textbook is unchanged: the 5 auto-fan lanes).

- [ ] **Step 6: Commit**

```bash
git add samagra/factory/lines.py samagra/factory/run.py tests/test_factory_lines.py tests/test_factory_samadhan_wiring.py
git commit -m "feat(factory): Phase D2 — register opt-in samadhan llm lane (auto_fan) + plan(--lane)"
```

---

## Task 4: `dispatch` llm routing + `build()` preflight + terminal-status branch

**Files:**
- Modify: `samagra/factory/dispatch.py` (`run_line` llm branch; `validate_product` + `_assert_review_clean`)
- Modify: `samagra/factory/run.py` (`build()` llm preflight + terminal status)
- Test: `tests/test_factory_samadhan_wiring.py` (append the build-half)

- [ ] **Step 1: Write the failing tests (append)**

```python
# append to tests/test_factory_samadhan_wiring.py
import json
from pathlib import Path

import pytest

from samagra import config
from samagra.factory import run, samadhan
from samagra.factory.style import profile as P
from samagra.clients import llm_client

FACETS = {"voice": {"mean_sentence_len": 16.0, "second_person_rate": 0.08,
                    "hedge_rate": 0.05, "imperative_rate": 0.1},
          "sequencing": {"mean_sections_per_chapter": 5.0},
          "analogy": {"analogy_block_rate": 0.03},
          "rigor": {"flags_per_section": 0.9}, "selection": {"callout_density": 0.2}}


class FakeLLM:
    def __init__(self, verdicts):
        self._verdicts = verdicts
    def generate_samadhan(self, chapter, *, system):
        return {"items": [{"concept": "c", "misconception": "m",
                           "correction": "k", "why": "w"}]}
    def review_samadhan(self, items, chapter):
        return {"verdicts": self._verdicts}


@pytest.fixture()
def env(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "lectures")
    monkeypatch.setattr(P, "_now", lambda: "t")
    P.save(P.StyleSeed(0, FACETS, "h", "t"))
    from samagra.lectures import render
    monkeypatch.setattr(render, "load_chapter",
                        lambda slug: {"title": "Circular Motion", "subtitle": "",
                                      "sections": []})
    monkeypatch.setattr(llm_client, "configured", lambda: True)


def _approve_and_build(seed_ref):
    props = run.plan(seed_ref, dry=False, lane="samadhan")
    run.approve_seed(seed_ref)
    return run.build(props[0]["assignment_id"])


def test_clean_brief_is_captured(env, monkeypatch):
    monkeypatch.setattr(samadhan.llm_client, "LLMClient",
                        lambda: FakeLLM([{"idx": 0, "verdict": "ok", "rationale": "r"}]))
    res = _approve_and_build("textbook:circular-motion")
    assert res["line"] == "samadhan"
    from samagra.governance import store
    c = store.connect()
    try:
        a = [x for x in store.list_assignments(c) if x["id"] == res["assignment_id"]][0]
    finally:
        c.close()
    assert a["status"] == "captured"


def test_error_brief_lands_in_changes_not_captured(env, monkeypatch):
    monkeypatch.setattr(samadhan.llm_client, "LLMClient",
                        lambda: FakeLLM([{"idx": 0, "verdict": "error", "rationale": "wrong"}]))
    res = _approve_and_build("textbook:x")
    from samagra.governance import store
    c = store.connect()
    try:
        a = [x for x in store.list_assignments(c) if x["id"] == res["assignment_id"]][0]
        # the artifact WAS created (product_created recorded) but it is NOT captured
        assert a["status"] == "changes"
        verbs = [e["verb"] for e in store.list_events_for_assignment(c, res["assignment_id"])]
        assert "product_created" in verbs
    finally:
        c.close()


def test_missing_key_refuses_before_intent_no_wedge(env, monkeypatch):
    monkeypatch.setattr(llm_client, "configured", lambda: False)   # no key
    props = run.plan("textbook:circular-motion", dry=False, lane="samadhan")
    run.approve_seed("textbook:circular-motion")
    aid = props[0]["assignment_id"]
    with pytest.raises(RuntimeError):
        run.build(aid)
    from samagra.governance import store
    c = store.connect()
    try:
        # anti-wedge: NO product_building intent was recorded -> not wedged in-flight
        verbs = [e["verb"] for e in store.list_events_for_assignment(c, aid)]
        a = [x for x in store.list_assignments(c) if x["id"] == aid][0]
    finally:
        c.close()
    assert "product_building" not in verbs and a["status"] == "approved"
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m pytest tests/test_factory_samadhan_wiring.py -k "captured or changes or wedge" -v`
Expected: FAIL — `run_line` has no llm branch / build() doesn't preflight or branch status.

- [ ] **Step 3a: `dispatch.py` — `run_line` llm branch + the review guard**

Add the import at the top (with the other engine imports):

```python
from . import deck, paper, samadhan
```

In `run_line`, add the llm branch (before the final `return lex.export_one(...)`):

```python
    if spec.kind == "llm":
        return samadhan.build_samadhan(slug)
```

In `validate_product`, after the existing `_assert_no_answer_leak(line, result)` line, add the llm review guard:

```python
    _assert_review_clean(line, result)
```

Add `_assert_review_clean` (next to `_assert_no_answer_leak`):

```python
def _assert_review_clean(line: str, result: dict) -> None:
    """For llm (samadhan) lanes ONLY: assert the adversarial review actually RAN and
    was persisted before this artifact can be considered for capture. Raises if the
    result lacks an integer `errors` or a `verdicts` list (a brief whose reviewer was
    skipped/corrupted must never reach `captured`). It does NOT raise on errors>0 —
    an error-flagged brief is a valid artifact that build() routes to `changes`
    (owner review), never silent capture. This is the llm analog of
    _assert_no_answer_leak: the artifact records the verdicts; the capture GATE
    (errors==0) is applied by build()."""
    spec = LINES.get(line)
    if spec is None or spec.kind != "llm":
        return
    if not isinstance(result.get("errors"), int):
        raise ValueError(f"line {line!r} produced no reviewer error count — "
                         f"refusing to capture an unreviewed brief")
    if not isinstance(result.get("verdicts"), list) or not result["verdicts"]:
        raise ValueError(f"line {line!r} produced no reviewer verdicts — "
                         f"refusing to capture an unreviewed brief")
```

- [ ] **Step 3b: `run.py` — `build()` llm preflight + terminal status**

Add the import (with the existing `from . import dispatch`):

```python
from . import samadhan
```

In `build()`, extend the kind-aware PRE-WRITE block (right after the mcd payload pre-load, still BEFORE the `product_building` event):

```python
        payload = None
        if spec.kind == "mcd":
            payload = _load_proposed_payload(conn, assignment_id)
            if payload is None:
                raise ValueError(
                    f"no proposed payload recorded for assignment {assignment_id}")
            validate_seed_payload(payload)
        elif spec.kind == "llm":
            # anti-wedge: chapter exists + StyleSeed committed + LLM configured,
            # asserted BEFORE recording build intent (a missing key refuses without
            # wedging the in-flight state — mirrors the mcd validate-before-intent).
            samadhan.preflight(seed_ref.split(":", 1)[-1])
```

Replace the produce/validate + terminal-status section. Currently:

```python
        if spec.kind == "mcd":
            result = dispatch.run_seed(payload)
            artifact_ref = result["artifact_ref"]
            subsystem_ref = result["seed_id"]
        else:
            result = dispatch.run_line(line, seed_ref.split(":", 1)[-1])
            dispatch.validate_product(line, result)
            artifact_ref = result["html"]
            subsystem_ref = artifact_ref
        store.append_event(conn, actor=_AGENT, verb="product_created", ...)
        store.set_assignment_status(conn, assignment_id, "captured")     # guard 5
```

Change to (compute the terminal status by kind/review):

```python
        if spec.kind == "mcd":
            result = dispatch.run_seed(payload)          # the ONE mcd prod write (+ id-check)
            artifact_ref = result["artifact_ref"]        # "mcd:<seed_id>"
            subsystem_ref = result["seed_id"]
        else:
            result = dispatch.run_line(line, seed_ref.split(":", 1)[-1])
            dispatch.validate_product(line, result)      # guard 4 (+answer-leak/review guard)
            artifact_ref = result["html"]
            subsystem_ref = artifact_ref
        store.append_event(conn, actor=_AGENT, verb="product_created",
                           assignment_id=assignment_id, subsystem="factory",
                           subsystem_ref=subsystem_ref,
                           note=json.dumps({"line": line, "artifact": result},
                                           ensure_ascii=False))
        # Terminal status (guard 5, single write): llm briefs with an unresolved
        # reviewer error land in 'changes' (owner review) — never a silent capture;
        # every deterministic/mcd lane and a clean brief -> terminal 'captured'.
        status = "changes" if (spec.kind == "llm" and result.get("errors", 0) > 0) \
            else "captured"
        store.set_assignment_status(conn, assignment_id, status)
        return {"assignment_id": assignment_id, "line": line,
                "artifact_ref": artifact_ref, "status": status}
```

> Note: `result` for the llm lane embeds `errors`, `verdicts`, etc. The `product_created` note JSON-serializes the whole `result` (a plain dict of strings/ints/lists) — safe.

- [ ] **Step 4: Run to verify they pass**

Run: `python -m pytest tests/test_factory_samadhan_wiring.py -v`
Expected: PASS

- [ ] **Step 5: Regression — the five guards still hold for every kind**

Run: `python -m pytest tests/test_factory_run.py tests/test_factory_dispatch.py -q`
Expected: all green (the mcd/local/qx paths and the five guards are unchanged; only the terminal-status line and an added llm branch are new).

- [ ] **Step 6: Commit**

```bash
git add samagra/factory/dispatch.py samagra/factory/run.py tests/test_factory_samadhan_wiring.py
git commit -m "feat(factory): Phase D2 — build() llm preflight (anti-wedge) + capture/changes gate + run_line llm"
```

---

## Task 5: CLI `--lane` + opt-in live smoke + full-gate verification

**Files:**
- Modify: `samagra/__main__.py` (the `factory plan` subparser + `cmd_factory` plan branch)
- Test: `tests/test_samadhan_live_smoke.py` (create), `tests/test_style_cli.py` or `tests/test_cli_factory.py` (append a `--lane` arg test)

- [ ] **Step 1a: CLI test (append to `tests/test_style_cli.py`)**

```python
def test_factory_plan_accepts_lane_arg():
    # the parser must accept `factory plan <seed> --lane samadhan`
    from samagra.__main__ import build_parser
    args = build_parser().parse_args(
        ["factory", "plan", "textbook:circular-motion", "--lane", "samadhan", "--dry-run"])
    assert args.lane == "samadhan" and args.seed_ref == "textbook:circular-motion"
```

> If the parser entry point is named differently than `build_parser`, read `samagra/__main__.py` and use the real name (the module builds an `argparse` parser and calls `args.func(args)`).

- [ ] **Step 1b: Live smoke (create `tests/test_samadhan_live_smoke.py`)**

```python
"""OPT-IN live smoke: one real Samadhan end-to-end against the Anthropic API.
Skipped unless ANTHROPIC_API_KEY is set AND the chapter corpus is present, so the
standing CI gate never calls the network. Mirrors the existing live QX/mcd smokes."""
from __future__ import annotations

import os

import pytest

from samagra import config
from samagra.factory import samadhan
from samagra.factory.style import profile as P

pytestmark = pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="opt-in live smoke: set ANTHROPIC_API_KEY to run a real Samadhan")


def test_live_samadhan_circular_motion(tmp_path, monkeypatch):
    if P.load_current() is None:
        pytest.skip("no committed StyleSeed (run `factory style-extract`)")
    try:
        from samagra.lectures import render
        render.load_chapter("circular-motion")
    except FileNotFoundError:
        pytest.skip("circular-motion chapter not present in this checkout")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "lectures")
    res = samadhan.build_samadhan("circular-motion")
    assert res["items"] >= 1
    assert isinstance(res["errors"], int)
    from pathlib import Path
    assert Path(res["html"]).is_file() and Path(res["json"]).is_file()
```

- [ ] **Step 2: Run to verify (the CLI test fails; the smoke skips)**

Run: `python -m pytest tests/test_style_cli.py -k lane tests/test_samadhan_live_smoke.py -v`
Expected: the `--lane` test FAILS (no `--lane` arg); the live smoke is SKIPPED.

- [ ] **Step 3: Implement the CLI `--lane`**

In `samagra/__main__.py`, find the factory `plan` subparser (`ft_plan = ft_sub.add_parser("plan", …)`) and add the optional arg:

```python
    ft_plan.add_argument("--lane", default=None,
                         help="target a single lane explicitly (required for opt-in "
                              "lanes like 'samadhan' that the default fan-out omits)")
```

In `cmd_factory`, the `plan` branch, thread `lane` through:

```python
    elif args.action == "plan":
        proposals = run.plan(args.seed_ref, dry=args.dry_run, lane=getattr(args, "lane", None))
        mode = "dry-run" if args.dry_run else "live"
        print(f"factory plan ({mode}): {len(proposals)} line(s) for {args.seed_ref}")
        for p in proposals:
            aid = p.get("assignment_id", "-")
            tag = " (reused)" if p.get("reused") else ""
            print(f"  [{aid}] {p['line']:9} -> {p['expected_output']}{tag}")
```

- [ ] **Step 4: Run the CLI test**

Run: `python -m pytest tests/test_style_cli.py -k lane -v`
Expected: PASS

- [ ] **Step 5: Full backend suite (record exact counts)**

Run (JUnit gives an authoritative count on this Windows/py3.14 box where the final summary line is swallowed by an atexit cleanup print):
```bash
python -m pytest -p no:cacheprovider --junit-xml=/tmp/d2.xml -q --basetemp=/tmp/ptd2 >/dev/null 2>&1; echo "exit=$?"; grep -oE '<testsuite [^>]*>' /tmp/d2.xml | head -1 | grep -oE '(tests|errors|failures|skipped)="[0-9]+"'
```
Expected: `failures="1"` (only the pre-existing env red `tests/test_gdocs.py::test_upload_happy_path_returns_weblink`, Google API libs absent — unrelated), `errors="0"`. Confirm the Phase-D2 tests are green and there are no NEW failures. Record `tests=` / `failures=` / `skipped=` for the handoff. (The live smoke contributes a `skipped` unless a key is set.)

- [ ] **Step 6: Commit**

```bash
git add samagra/__main__.py tests/test_style_cli.py tests/test_samadhan_live_smoke.py
git commit -m "feat(cli): Phase D2 — factory plan --lane; opt-in live samadhan smoke"
```

---

## Self-review checklist (run before the reviewer)

1. **Spec coverage (§4/§5/§7/§8-D2):** the `llm` kind + `auto_fan` opt-in (Task 3) ✓; the single Anthropic call site with key-from-`.env`/never-logged/mockable (Task 1) ✓; `build_samadhan` condition→generate→**ground-truth-only** review→advisory score→local write (Task 2) ✓; the `_assert_review_clean` capture gate + `errors>0→changes` routing + anti-wedge preflight (Task 4) ✓; `factory plan --lane samadhan` + opt-in live smoke (Task 5) ✓.
2. **Secrets (PUBLIC repo):** key only from `os.environ["ANTHROPIC_API_KEY"]`; never hardcoded/logged/repr'd (test asserts repr masks it); `.env.example` blank; live smoke `skipif` no key. No standing test needs a key or the network.
3. **Invariants:** no new prod write path (the Anthropic call is outbound *generation*, not a write to any of the 7 source subsystems; the artifact is a LOCAL file); the publish gate is untouched (a clean brief reaches `captured`; an error brief `changes`; publishing stays a separate human act); the five `build()` guards are unchanged (only the produce/validate step + the terminal-status line branch); the StyleSeed moat + the deterministic lanes are untouched; DEC-8 reviewer firewall is structural (`review_samadhan` never receives the StyleSeed); no `assignments`/governance migration.
4. **No placeholders:** every step has real code. The one place that says "rest of the loop body is UNCHANGED" (Task 3 `plan`) explicitly means leave the existing `for` body intact — only the `lines = …` selection above it changes.
5. **Type consistency:** `LLMClient.generate_samadhan -> {"items":[...]}`, `review_samadhan -> {"verdicts":[...]}`; `build_samadhan -> {variant,html,json,items,errors,verdicts,style_score,style_seed_version}`; `run_line` returns that dict for llm; `validate_product` reads `result["errors"]`/`result["verdicts"]`; `build()` routes on `result.get("errors",0)`. `plan(seed_ref, dry, lane=None)`; CLI passes `args.lane`.
6. **The C1 escaping lesson is applied** (Task 2: untrusted LLM text HTML-escaped in the printable, raw in the JSON; a test proves `E(r<R)` → `E(r&lt;R)` in html, raw in json).

## After Task 5 (controller, before merge)
- **Dedicated DEC-7 Codex pre-merge review of the generation boundary** (required by F-D1/spec §8). Then an adversarial multi-lens pass (as for every prior slice). Remediate any HIGH/MED TDD. Then finishing-a-development-branch (merge/push gated on the owner).
- **Owner action for the live smoke:** run `SAMAGRA_LIVE_LLM_SMOKE=1 ANTHROPIC_API_KEY=… python -m pytest tests/test_samadhan_live_smoke.py -v` once to prove a real Samadhan end-to-end (optional; not part of the standing gate).

## Pre-merge review outcome + remediation (2026-06-25)

Three independent reviews ran over `main...HEAD`: the **dedicated DEC-7 Codex generation-boundary review** (via the codex runtime; reviewed manually as the sandboxed CLI couldn't write temp files) returned **NO-GO**; two Claude lenses (secrets/correctness, safety/invariants) returned **GO-WITH-CAVEATS** with all secrets/firewall/guard invariants PASS. The findings converged; all were **remediated TDD** (+6 tests; gate **437 passing / 439 collected / 1 pre-existing `test_gdocs` red / 1 skipped live smoke**):

- **HIGH — the LLM in-flight window wedged on any post-intent failure.** `product_building` is recorded before the network call; a transient error / empty items / bad JSON before `product_created` left the assignment permanently in-flight (guard 3 refused retry). **FIXED:** `build()` wraps the produce/validate step; a LOCAL-write lane (local/qx/llm) records `product_build_failed` and rolls back the intent on failure → retryable. `_build_in_flight` is now count-based (`building > created + failed`). The **mcd lane keeps its fail-safe wedge** (its produce is the one external prod write — never auto-rolled-back). Regression: a `BoomLLM` produce failure leaves the assignment `approved` + retryable, then a working client captures.
- **MED — partial/missing reviewer verdicts defaulted to `ok`.** **FIXED (fail-closed):** in `build_samadhan`, an item with no explicit `ok` verdict (missing idx, or any non-`ok`) counts as an **error** → routes the brief to `changes`, so an unreviewed item can never reach `captured`.
- **MED — `_extract_json` had no stop_reason/empty/truncated handling.** **FIXED:** raises a concise `RuntimeError` (refusal / empty content / non-JSON), **never echoing the content/prompt/key** (regression asserts no plaintext leak).
- **LOW — stray `"name":"out"` in `output_config.format`** (not in the installed SDK's schema → possible live 400). **FIXED:** dropped.
- **Empty-items brief** now routes to `changes` (owner review), never a wedge or silent capture.

**Deferred fast-follow — ✅ SHIPPED 2026-06-26 (ff `3540f61..8c5b1dc`).** Originally documented as deferred: a brief that lands in `changes` could not be re-generated in-band — `approve` requires `in-review`, and the status-blind dedup returns the same `changes` assignment. **Now closed** by `run.reopen(assignment_id)` + CLI `samagra factory reopen <aid>`: it flips a terminal `changes` factory brief back to `in-review` (re-approve → rebuild; the board gate is re-crossed explicitly so the never-automated publish gate stays intact) and records a `reopened` audit event. **Guard 2 was made reopen-aware (count-based, not delete-based):** `_has_event(product_created)` became `_already_built()`, which refuses a rebuild only when `product_created` count exceeds `reopened` count — so each reopen forgives EXACTLY ONE rebuild and the governance ledger stays append-only (D6 — no event is ever deleted; mirrors the `product_build_failed` reconciliation). Guarded — refuses unknown / non-factory pipeline (workflow firewall) / **the mcd `seed` lane on `kind=='mcd'` grounds (its single prod write stays idempotent — structural, not merely a consequence of mcd never reaching `changes`)** / any status but `changes`. Built TDD (+9 tests: flip+audit+immutable-ledger, the full samadhan `changes`→reopen→re-approve→rebuild loop to a fresh captured brief, and the refusals). Gate **448 passing** (1 skipped = opt-in live smoke; lone red = pre-existing env `test_gdocs`).
