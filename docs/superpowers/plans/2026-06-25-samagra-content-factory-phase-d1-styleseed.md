# Content Factory Phase D1 — StyleSeed Moat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic, read-only StyleSeed moat — a versioned 5-facet voice profile extracted from the 59 textbook chapters, a conditioning interface, and an advisory style-fit scorer — with **no API key, no LLM call, and no new write path**.

**Architecture:** A self-contained `samagra/factory/style/` package. `extract.py` deterministically projects the 59 `content.json` chapters into five facets (voice · sequencing · analogy · rigor · selection); `profile.py` wraps them in a versioned `StyleSeed` persisted as a git-committed `styleseed/styleseed-v<N>.json`; `condition.py` renders the profile into an LLM system prompt (the interface D2 will consume); `score.py` measures any text's style-fit against the profile (advisory — never gates). D1 ships none of the LLM lane — it is the durable, deterministic foundation D2/D3 build on.

**Tech Stack:** Python 3 (stdlib only — `re`, `html`, `json`, `hashlib`, `dataclasses`, `datetime`, `collections`), pytest. Reuses `samagra.lectures.render.load_chapter` and `samagra.config`.

**Spec:** `docs/superpowers/specs/2026-06-24-samagra-content-factory-phase-d-design.md` (§3 — the moat; §7 — CLI; §8 — D1 row).

---

## File Structure

| Path | Responsibility |
|---|---|
| `samagra/factory/style/__init__.py` | Package marker (empty). |
| `samagra/factory/style/text.py` | Shared, pure text helpers + the closed marker vocabularies (single source of truth for `extract` + `score`). |
| `samagra/factory/style/extract.py` | The five deterministic facet functions + `load_corpus()` + `build_profile()`. Pure; the only I/O is reading the read-only corpus. |
| `samagra/factory/style/profile.py` | `StyleSeed` dataclass, content/corpus hashing, versioned JSON save/load, and `extract_candidate()` (build-and-version orchestration). |
| `samagra/factory/style/condition.py` | `to_system_prompt(seed)` — the conditioning interface (the large, stable system block D2 prompt-caches). |
| `samagra/factory/style/score.py` | `style_fit(text, seed)` — deterministic advisory scorer over the prose-measurable facets. |
| `samagra/config.py` (modify) | Add `STYLESEED_DIR = REPO_ROOT / "styleseed"`. |
| `samagra/__main__.py` (modify) | Add `factory style-extract` and `factory style-show` CLI actions. |
| `styleseed/styleseed-v0.json` (generated) | The committed v0 profile (final owner task). |
| `tests/test_style_text.py` … `tests/test_style_cli.py` | One test module per source module. |

DRY note: every text measurement (sentence splitting, tokenizing, marker sets) lives **once** in `text.py`. `extract.py` and `score.py` both import from it so a generated text is scored on exactly the same features the profile was built from.

---

## Task 1: config dir + style package + shared text helpers

**Files:**
- Modify: `samagra/config.py` (add `STYLESEED_DIR`)
- Create: `samagra/factory/style/__init__.py`
- Create: `samagra/factory/style/text.py`
- Test: `tests/test_style_text.py`

- [ ] **Step 1: Add the config dir**

In `samagra/config.py`, immediately after the `STATE_DIR`/`EXPORT_DIR` lines (the `--- generated data ---` block near line 96), add:

```python
# StyleSeed (Phase D): durable, owner-curated, git-COMMITTED style profile(s).
# Unlike state/ (rebuildable) this is version-controlled — git is the review/
# approval surface (fork F-D3). One file per version: styleseed-v<N>.json.
STYLESEED_DIR = REPO_ROOT / "styleseed"
```

- [ ] **Step 2: Create the package marker**

Create `samagra/factory/style/__init__.py`:

```python
"""StyleSeed moat (Phase D): deterministic 5-facet voice profile, conditioning
interface, and advisory style-fit scorer. Read-only; no LLM, no new write path."""
```

- [ ] **Step 3: Write the failing test for the text helpers**

Create `tests/test_style_text.py`:

```python
from samagra.factory.style import text as T


def test_strip_html_removes_tags_and_collapses_whitespace():
    assert T.strip_html("<p>Hello   <b>world</b>.</p>") == "Hello world."
    assert T.strip_html("<p>a&amp;b</p>") == "a&b"        # entities unescaped
    assert T.strip_html("") == ""
    assert T.strip_html(None) == ""


def test_sentences_splits_on_terminal_punctuation():
    assert T.sentences("Imagine you push the ball. It moves.") == [
        "Imagine you push the ball.", "It moves."]
    assert T.sentences("No terminal punctuation") == ["No terminal punctuation"]
    assert T.sentences("") == []


def test_words_lowercases_and_keeps_apostrophes():
    assert T.words("Let's GO, now!") == ["let's", "go", "now"]


def test_marker_vocabularies_are_frozen_sets():
    # closed sets → deterministic membership tests, no accidental mutation
    for vocab in (T.SECOND_PERSON, T.HEDGES, T.IMPERATIVE_STARTERS):
        assert isinstance(vocab, frozenset) and vocab
    assert "you" in T.SECOND_PERSON
    assert "imagine" in T.IMPERATIVE_STARTERS
    assert all(" " not in m or m == m.lower() for m in T.ANALOGY_MARKERS)
```

- [ ] **Step 4: Run it to verify it fails**

Run: `python -m pytest tests/test_style_text.py -q`
Expected: FAIL — `ModuleNotFoundError: samagra.factory.style.text`.

- [ ] **Step 5: Implement `text.py`**

Create `samagra/factory/style/text.py`:

```python
"""Pure text helpers + the closed marker vocabularies. Single source of truth so
the StyleSeed is BUILT and later SCORED on exactly the same features."""
from __future__ import annotations

import html as _html
import re

_TAG = re.compile(r"<[^>]+>")
_SENT = re.compile(r"[^.!?]+[.!?]?")
_WORD = re.compile(r"[a-z']+")

# Second-person / inclusive address (Deepak teaches AT the student).
SECOND_PERSON = frozenset({"you", "your", "yours", "we", "our", "us", "let's"})
# Hedging / approximation markers.
HEDGES = frozenset({"may", "might", "perhaps", "roughly", "approximately", "often",
                    "usually", "tends", "tend", "generally", "typically"})
# Sentence-initial cue words for an imperative/directive opening.
IMPERATIVE_STARTERS = frozenset({"consider", "note", "recall", "imagine", "observe",
                                 "notice", "remember", "suppose", "think", "look"})
# Analogy / everyday-example markers — substring-matched, so all are unambiguous
# as substrings (no bare "like").
ANALOGY_MARKERS = frozenset({"imagine", "picture", "think of", "analogy", "everyday",
                             "real life", "real-world", "as if", "similar to"})


def strip_html(s) -> str:
    """Drop tags, unescape entities, collapse whitespace. None/'' -> ''."""
    return re.sub(r"\s+", " ", _html.unescape(_TAG.sub(" ", s or ""))).strip()


def sentences(text: str) -> list[str]:
    """Split into trimmed sentences on terminal . ! ? (keeps the punctuation)."""
    return [s.strip() for s in _SENT.findall(text or "") if s.strip()]


def words(text: str) -> list[str]:
    """Lowercased word tokens (apostrophes kept, e.g. let's)."""
    return _WORD.findall((text or "").lower())


def round4(x) -> float:
    return round(float(x), 4)
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `python -m pytest tests/test_style_text.py -q`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add samagra/config.py samagra/factory/style/__init__.py samagra/factory/style/text.py tests/test_style_text.py
git commit -m "feat(style): config STYLESEED_DIR + shared text helpers/markers (Phase D1)"
```

---

## Task 2: voice + sequencing facets

**Files:**
- Create: `samagra/factory/style/extract.py`
- Test: `tests/test_style_extract.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_style_extract.py`:

```python
from samagra.factory.style import extract


# A two-chapter, hand-computable corpus (list of content dicts — what
# render.load_chapter returns). No disk, no monkeypatch needed for facet math.
CORPUS = [
    {"slug": "a", "sections": [
        {"id": "s1", "title": "One", "blocks": [
            {"type": "prose", "html": "<p>Imagine you push the ball. It moves.</p>"},
            {"type": "equation", "tex": "v=\\omega R", "number": "1"},
            {"type": "callout", "variant": "key", "html": "<p>key idea</p>"},
        ], "flags": [{"kind": "clarified", "note": "n1"}]},
    ]},
    {"slug": "b", "sections": [
        {"id": "s1", "title": "Two", "blocks": [
            {"type": "prose", "html": "<p>This is generally approximate.</p>"},
            {"type": "callout", "variant": "warn", "html": "<p>careful</p>"},
        ], "flags": []},
    ]},
]


def test_voice_counts_sentences_and_rates():
    v = extract.voice(CORPUS)
    # Sentences: "Imagine you push the ball." / "It moves." / "This is generally approximate."
    assert v["n_sentences"] == 3
    # word lengths 5, 2, 4 -> mean 3.6667
    assert v["mean_sentence_len"] == 3.6667
    # all <= 10 words
    assert v["len_mix"] == {"short": 1.0, "medium": 0.0, "long": 0.0}
    # "you" in sentence 1 only -> 1/3
    assert v["second_person_rate"] == 0.3333
    # "generally" + "approximate" hedge in sentence 3 only -> 1/3
    assert v["hedge_rate"] == 0.3333
    # sentence 1 starts with "imagine" -> 1/3
    assert v["imperative_rate"] == 0.3333


def test_sequencing_bigrams_and_section_count():
    s = extract.sequencing(CORPUS)
    assert s["mean_sections_per_chapter"] == 1.0
    # chapter a bigrams: prose>equation, equation>callout ; chapter b: prose>callout
    bigrams = dict(s["top_block_bigrams"])
    assert set(bigrams) == {"prose>equation", "equation>callout", "prose>callout"}
    assert bigrams["prose>equation"] == 0.3333   # 1 of 3 transitions
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_style_extract.py -q`
Expected: FAIL — `ModuleNotFoundError: samagra.factory.style.extract`.

- [ ] **Step 3: Implement `voice` + `sequencing` (start `extract.py`)**

Create `samagra/factory/style/extract.py`:

```python
"""The five deterministic facet functions + corpus assembly. Pure: a fixed corpus
yields byte-identical facets (sorted aggregates, no randomness)."""
from __future__ import annotations

from collections import Counter

from . import text as T


def _prose_texts(chapters: list[dict]) -> list[str]:
    out = []
    for ch in chapters:
        for sec in ch.get("sections", []) or []:
            for b in sec.get("blocks", []) or []:
                if b.get("type") == "prose":
                    out.append(T.strip_html(b.get("html", "")))
    return out


def voice(chapters: list[dict]) -> dict:
    """Diction/register over all prose: sentence length, person, hedging, openings."""
    sents: list[str] = []
    for txt in _prose_texts(chapters):
        sents.extend(T.sentences(txt))
    n = len(sents) or 1
    lens = [len(T.words(s)) for s in sents]
    short = sum(1 for L in lens if L <= 10)
    med = sum(1 for L in lens if 11 <= L <= 20)
    lng = sum(1 for L in lens if L > 20)

    def first_word(s: str) -> str:
        ws = T.words(s)
        return ws[0] if ws else ""

    return {
        "n_sentences": len(sents),
        "mean_sentence_len": T.round4(sum(lens) / n),
        "len_mix": {"short": T.round4(short / n), "medium": T.round4(med / n),
                    "long": T.round4(lng / n)},
        "second_person_rate": T.round4(
            sum(1 for s in sents if set(T.words(s)) & T.SECOND_PERSON) / n),
        "hedge_rate": T.round4(
            sum(1 for s in sents if set(T.words(s)) & T.HEDGES) / n),
        "imperative_rate": T.round4(
            sum(1 for s in sents if first_word(s) in T.IMPERATIVE_STARTERS) / n),
    }


def sequencing(chapters: list[dict]) -> dict:
    """Block-type rhythm within sections + section-count shape."""
    bigrams: Counter = Counter()
    sec_counts: list[int] = []
    for ch in chapters:
        secs = ch.get("sections", []) or []
        sec_counts.append(len(secs))
        for sec in secs:
            types = [b.get("type") for b in (sec.get("blocks", []) or [])]
            for a, b in zip(types, types[1:]):
                bigrams[f"{a}>{b}"] += 1
    total = sum(bigrams.values()) or 1
    n = len(sec_counts) or 1
    top = sorted(bigrams.items(), key=lambda kv: (-kv[1], kv[0]))[:8]
    return {
        "mean_sections_per_chapter": T.round4(sum(sec_counts) / n),
        "top_block_bigrams": [[k, T.round4(v / total)] for k, v in top],
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_style_extract.py -q`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/style/extract.py tests/test_style_extract.py
git commit -m "feat(style): voice + sequencing facets (Phase D1)"
```

---

## Task 3: analogy + rigor + selection facets

**Files:**
- Modify: `samagra/factory/style/extract.py`
- Test: `tests/test_style_extract.py` (append)

- [ ] **Step 1: Write the failing tests (append to `tests/test_style_extract.py`)**

```python
def test_analogy_rate_over_prose_and_callouts():
    a = extract.analogy(CORPUS)
    # 4 prose/callout blocks; only chapter-a prose ("Imagine ...") has a marker
    assert a["n_blocks"] == 4
    assert a["analogy_block_rate"] == 0.25


def test_rigor_from_section_flags():
    r = extract.rigor(CORPUS)
    # 2 sections, 1 flag (kind "clarified")
    assert r["flags_per_section"] == 0.5
    assert r["kind_mix"] == [["clarified", 1.0]]


def test_selection_callout_variant_mix_and_density():
    s = extract.selection(CORPUS)
    # 5 blocks total: 2 prose, 1 equation, 2 callouts
    assert s["equation_density"] == 0.2
    assert s["callout_density"] == 0.4
    assert s["callout_variant_mix"] == [["key", 0.5], ["warn", 0.5]]
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_style_extract.py -q`
Expected: FAIL — `AttributeError: module ... has no attribute 'analogy'`.

- [ ] **Step 3: Implement `analogy` + `rigor` + `selection` (append to `extract.py`)**

```python
def analogy(chapters: list[dict]) -> dict:
    """Everyday-analogy reach over prose + callouts (substring marker match)."""
    texts: list[str] = []
    for ch in chapters:
        for sec in ch.get("sections", []) or []:
            for b in sec.get("blocks", []) or []:
                if b.get("type") in ("prose", "callout"):
                    texts.append(T.strip_html(b.get("html", "")).lower())
    n = len(texts) or 1
    hits = sum(1 for t in texts if any(m in t for m in T.ANALOGY_MARKERS))
    return {"n_blocks": len(texts), "analogy_block_rate": T.round4(hits / n)}


def rigor(chapters: list[dict]) -> dict:
    """Pedagogical rigor moves from the section-level flags[] array."""
    kinds: Counter = Counter()
    n_sections = 0
    n_flags = 0
    for ch in chapters:
        for sec in ch.get("sections", []) or []:
            n_sections += 1
            for f in sec.get("flags", []) or []:
                n_flags += 1
                kinds[f.get("kind") or "unknown"] += 1
    s = n_sections or 1
    total = n_flags or 1
    dist = sorted(kinds.items(), key=lambda kv: (-kv[1], kv[0]))
    return {
        "flags_per_section": T.round4(n_flags / s),
        "kind_mix": [[k, T.round4(v / total)] for k, v in dist],
    }


def selection(chapters: list[dict]) -> dict:
    """What gets foregrounded: callout-variant mix + equation/callout density."""
    variants: Counter = Counter()
    types: Counter = Counter()
    for ch in chapters:
        for sec in ch.get("sections", []) or []:
            for b in sec.get("blocks", []) or []:
                t = b.get("type")
                types[t] += 1
                if t == "callout":
                    variants[b.get("variant") or "note"] += 1
    n_blocks = sum(types.values()) or 1
    n_co = sum(variants.values()) or 1
    vmix = sorted(variants.items(), key=lambda kv: (-kv[1], kv[0]))
    return {
        "equation_density": T.round4(types.get("equation", 0) / n_blocks),
        "callout_density": T.round4(types.get("callout", 0) / n_blocks),
        "callout_variant_mix": [[k, T.round4(v / n_co)] for k, v in vmix],
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_style_extract.py -q`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/style/extract.py tests/test_style_extract.py
git commit -m "feat(style): analogy + rigor (flags[]) + selection facets (Phase D1)"
```

---

## Task 4: corpus assembly + build_profile + determinism

**Files:**
- Modify: `samagra/factory/style/extract.py`
- Test: `tests/test_style_extract.py` (append)

- [ ] **Step 1: Write the failing tests (append)**

```python
import json

from samagra import config


def _hermetic_corpus(tmp_path, monkeypatch):
    """Write two content.json files + a queue.json, repoint config at them."""
    chapters_dir = tmp_path / "chapters"
    for ch in CORPUS:
        d = chapters_dir / ch["slug"]
        d.mkdir(parents=True)
        (d / "content.json").write_text(json.dumps(ch), encoding="utf-8")
    queue = tmp_path / "queue.json"
    queue.write_text(json.dumps({"chapters": [{"slug": c["slug"]} for c in CORPUS]}),
                     encoding="utf-8")
    monkeypatch.setattr(config, "TEXTBOOK_CHAPTERS", chapters_dir)
    monkeypatch.setattr(config, "TEXTBOOK_QUEUE", queue)


def test_load_corpus_reads_queue_slugs_in_sorted_order(tmp_path, monkeypatch):
    _hermetic_corpus(tmp_path, monkeypatch)
    loaded = extract.load_corpus()
    assert [c["slug"] for c in loaded] == ["a", "b"]   # sorted, all present


def test_build_profile_has_all_five_facets_and_is_deterministic():
    p1 = extract.build_profile(CORPUS)
    p2 = extract.build_profile(list(reversed(CORPUS)))   # facets are corpus-wide aggregates
    assert set(p1) == {"voice", "sequencing", "analogy", "rigor", "selection"}
    # order-independent: same multiset of chapters -> identical facets
    assert p1 == p2
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_style_extract.py -q`
Expected: FAIL — `AttributeError: ... has no attribute 'load_corpus'`.

- [ ] **Step 3: Implement `load_corpus` + `build_profile` (append to `extract.py`)**

```python
import json

FACETS = ("voice", "sequencing", "analogy", "rigor", "selection")


def load_corpus() -> list[dict]:
    """Load every chapter that has a content.json, in stable (sorted) slug order.
    Read-only over the textbook corpus — the firewall holds."""
    from ... import config
    from ...lectures import render

    q = json.loads(config.TEXTBOOK_QUEUE.read_text(encoding="utf-8"))
    slugs = sorted(c["slug"] for c in q.get("chapters", []) if c.get("slug"))
    chapters: list[dict] = []
    for slug in slugs:
        try:
            chapters.append(render.load_chapter(slug))
        except FileNotFoundError:
            continue
    return chapters


def build_profile(chapters: list[dict]) -> dict:
    """Assemble all five facets. Deterministic: order-independent aggregates."""
    return {
        "voice": voice(chapters),
        "sequencing": sequencing(chapters),
        "analogy": analogy(chapters),
        "rigor": rigor(chapters),
        "selection": selection(chapters),
    }
```

Note the triple-dot imports: `style` is `samagra.factory.style`, so `...` resolves to `samagra` (`config`, `lectures`).

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_style_extract.py -q`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/style/extract.py tests/test_style_extract.py
git commit -m "feat(style): load_corpus (read-only) + build_profile determinism (Phase D1)"
```

---

## Task 5: StyleSeed dataclass + hashing + versioned save/load

**Files:**
- Create: `samagra/factory/style/profile.py`
- Test: `tests/test_style_profile.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_style_profile.py`:

```python
import json

from samagra import config
from samagra.factory.style import profile as P


FACETS = {"voice": {"mean_sentence_len": 3.5}, "sequencing": {}, "analogy": {},
          "rigor": {}, "selection": {}}


def test_content_hash_is_order_independent_and_stable():
    h1 = P.content_hash({"a": 1, "b": 2})
    h2 = P.content_hash({"b": 2, "a": 1})   # key order must not matter
    assert h1 == h2 and len(h1) == 64


def test_save_and_load_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    seed = P.StyleSeed(version=0, facets=FACETS, source_corpus_hash="abc",
                       created_at="2026-06-25T00:00:00+00:00")
    path = P.save(seed)
    assert path.name == "styleseed-v0.json"
    on_disk = json.loads(path.read_text(encoding="utf-8"))
    assert on_disk["version"] == 0 and on_disk["facets"] == FACETS
    assert P.load(0) == seed                       # frozen dataclass equality


def test_current_version_and_load_current(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    assert P.current_version() is None             # nothing yet
    assert P.load_current() is None
    P.save(P.StyleSeed(0, FACETS, "h", "t"))
    P.save(P.StyleSeed(2, FACETS, "h", "t"))       # gap is fine -> max wins
    assert P.current_version() == 2
    assert P.load_current().version == 2
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_style_profile.py -q`
Expected: FAIL — `ModuleNotFoundError: samagra.factory.style.profile`.

- [ ] **Step 3: Implement `profile.py`**

Create `samagra/factory/style/profile.py`:

```python
"""The StyleSeed: a durable, versioned, owner-curated voice profile, persisted as
a git-COMMITTED styleseed-v<N>.json (fork F-D3 — git is the review surface)."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

FACETS = ("voice", "sequencing", "analogy", "rigor", "selection")


@dataclass(frozen=True)
class StyleSeed:
    version: int
    facets: dict
    source_corpus_hash: str
    created_at: str


def _canon(obj) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _sha(obj) -> str:
    return hashlib.sha256(_canon(obj).encode("utf-8")).hexdigest()


def content_hash(facets: dict) -> str:
    """Stable, key-order-independent sha256 over the facet payload."""
    return _sha(facets)


def corpus_hash(chapters: list[dict]) -> str:
    """Tamper-evident pointer to the exact corpus a profile was built from."""
    return _sha(sorted([c.get("slug", ""), _sha(c)] for c in chapters))


def _dir() -> Path:
    from ... import config
    return config.STYLESEED_DIR


def path_for(version: int) -> Path:
    return _dir() / f"styleseed-v{version}.json"


def _to_dict(seed: StyleSeed) -> dict:
    return {"version": seed.version, "facets": seed.facets,
            "source_corpus_hash": seed.source_corpus_hash, "created_at": seed.created_at}


def save(seed: StyleSeed) -> Path:
    d = _dir()
    d.mkdir(parents=True, exist_ok=True)
    p = path_for(seed.version)
    p.write_text(json.dumps(_to_dict(seed), sort_keys=True, ensure_ascii=False, indent=2),
                 encoding="utf-8")
    return p


def load(version: int) -> StyleSeed:
    return StyleSeed(**json.loads(path_for(version).read_text(encoding="utf-8")))


def current_version() -> int | None:
    d = _dir()
    if not d.exists():
        return None
    versions = []
    for p in d.glob("styleseed-v*.json"):
        try:
            versions.append(int(p.stem.rsplit("v", 1)[-1]))
        except ValueError:
            continue
    return max(versions) if versions else None


def load_current() -> StyleSeed | None:
    v = current_version()
    return load(v) if v is not None else None
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_style_profile.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/style/profile.py tests/test_style_profile.py
git commit -m "feat(style): StyleSeed dataclass + hashing + versioned save/load (Phase D1)"
```

---

## Task 6: extract_candidate — build, version, change-detect

**Files:**
- Modify: `samagra/factory/style/profile.py`
- Test: `tests/test_style_profile.py` (append)

- [ ] **Step 1: Write the failing tests (append)**

```python
import samagra.factory.style.extract as extract_mod


def test_extract_candidate_writes_v0_then_no_change(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(P, "_now", lambda: "2026-06-25T00:00:00+00:00")
    monkeypatch.setattr(extract_mod, "load_corpus",
                        lambda: [{"slug": "a", "sections": []}])

    path, seed = P.extract_candidate()
    assert seed.version == 0 and path.name == "styleseed-v0.json"

    # Re-run with identical corpus -> facets unchanged -> no new file written.
    path2, seed2 = P.extract_candidate()
    assert path2 is None and seed2.version == 0


def test_extract_candidate_bumps_version_when_facets_change(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(P, "_now", lambda: "t")
    monkeypatch.setattr(extract_mod, "load_corpus",
                        lambda: [{"slug": "a", "sections": []}])
    P.extract_candidate()                                   # v0
    # Corpus now has prose -> different facets -> v1.
    monkeypatch.setattr(extract_mod, "load_corpus", lambda: [
        {"slug": "a", "sections": [{"blocks": [{"type": "prose", "html": "<p>Hi.</p>"}]}]}])
    path, seed = P.extract_candidate()
    assert seed.version == 1 and path.name == "styleseed-v1.json"
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_style_profile.py -q`
Expected: FAIL — `AttributeError: ... has no attribute 'extract_candidate'`.

- [ ] **Step 3: Implement `_now` + `extract_candidate` (append to `profile.py`)**

```python
def _now() -> str:
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def extract_candidate() -> tuple[Path | None, StyleSeed]:
    """Build the profile from the live corpus. If the facets match the current
    committed version, write NOTHING and return (None, current). Otherwise write
    the next version file and return (path, new_seed). Git is the review surface:
    the owner inspects `git diff` and commits (or discards) the written file."""
    from . import extract

    chapters = extract.load_corpus()
    facets = extract.build_profile(chapters)
    cur = load_current()
    if cur is not None and content_hash(cur.facets) == content_hash(facets):
        return None, cur
    version = 0 if cur is None else cur.version + 1
    seed = StyleSeed(version=version, facets=facets,
                     source_corpus_hash=corpus_hash(chapters), created_at=_now())
    return save(seed), seed
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_style_profile.py -q`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/style/profile.py tests/test_style_profile.py
git commit -m "feat(style): extract_candidate build/version/change-detect (Phase D1)"
```

---

## Task 7: condition.to_system_prompt — the conditioning interface

**Files:**
- Create: `samagra/factory/style/condition.py`
- Test: `tests/test_style_condition.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_style_condition.py`:

```python
import json

from samagra.factory.style import condition
from samagra.factory.style.profile import StyleSeed

SEED = StyleSeed(
    version=3,
    facets={
        "voice": {"mean_sentence_len": 12.0, "second_person_rate": 0.8,
                  "hedge_rate": 0.1, "len_mix": {"short": 0.6, "medium": 0.3, "long": 0.1},
                  "imperative_rate": 0.2, "n_sentences": 100},
        "sequencing": {"mean_sections_per_chapter": 9.0, "top_block_bigrams": []},
        "analogy": {"n_blocks": 50, "analogy_block_rate": 0.4},
        "rigor": {"flags_per_section": 1.2, "kind_mix": [["clarified", 1.0]]},
        "selection": {"equation_density": 0.3, "callout_density": 0.2,
                      "callout_variant_mix": [["key", 0.7], ["warn", 0.3]]},
    },
    source_corpus_hash="abc", created_at="t")


def test_prompt_names_the_version_and_all_facets():
    out = condition.to_system_prompt(SEED)
    assert "StyleSeed v3" in out
    for facet in ("voice", "sequencing", "analogy", "rigor", "selection"):
        assert facet in out.lower()


def test_prompt_embeds_the_canonical_facet_json_for_grounding():
    out = condition.to_system_prompt(SEED)
    # The raw facet stats are embedded so the LLM is conditioned on exact numbers,
    # not just prose. The marked block must round-trip to the facets.
    start = out.index("<facets>") + len("<facets>")
    end = out.index("</facets>")
    assert json.loads(out[start:end]) == SEED.facets


def test_prompt_surfaces_high_second_person_as_guidance():
    out = condition.to_system_prompt(SEED)
    assert "second person" in out.lower()   # 0.8 rate -> address-the-student guidance
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_style_condition.py -q`
Expected: FAIL — `ModuleNotFoundError: samagra.factory.style.condition`.

- [ ] **Step 3: Implement `condition.py`**

Create `samagra/factory/style/condition.py`:

```python
"""The conditioning interface: render a StyleSeed into an LLM system prompt. This
is the large, STABLE block D2 prompt-caches across every chapter in a run."""
from __future__ import annotations

import json


def _voice_guidance(v: dict) -> list[str]:
    out = ["Voice:"]
    out.append(f"- Aim for ~{v['mean_sentence_len']:.0f}-word sentences on average; "
               f"keep most sentences short and declarative.")
    if v.get("second_person_rate", 0) >= 0.4:
        out.append("- Address the student directly in the second person "
                   "(\"you\", \"we\") — teach AT the reader.")
    if v.get("hedge_rate", 0) >= 0.2:
        out.append("- Hedge claims where the physics is approximate "
                   "(\"roughly\", \"usually\").")
    if v.get("imperative_rate", 0) >= 0.15:
        out.append("- Open with directive cues (\"Consider\", \"Notice\", "
                   "\"Imagine\") where it helps.")
    return out


def to_system_prompt(seed) -> str:
    """Render the profile to a style guide + the embedded canonical facet stats."""
    f = seed.facets
    parts: list[str] = [
        f"You are writing in a specific physics teacher's voice. Match the "
        f"following StyleSeed v{seed.version} profile.",
        "",
    ]
    parts += _voice_guidance(f["voice"])
    parts += [
        "",
        "Sequencing:",
        f"- Chapters run ~{f['sequencing']['mean_sections_per_chapter']:.0f} "
        f"sections; introduce ideas in prose, then formalize.",
        "",
        "Analogy:",
        f"- Reach for an everyday analogy in roughly "
        f"{f['analogy']['analogy_block_rate']*100:.0f}% of explanatory blocks.",
        "",
        "Rigor:",
        f"- Flag shortcuts and add generality caveats "
        f"(~{f['rigor']['flags_per_section']:.1f} rigor notes per section).",
        "",
        "Selection:",
        f"- Foreground key results in callouts "
        f"(callout density ~{f['selection']['callout_density']*100:.0f}%).",
        "",
        "Exact profile statistics (condition on these numbers, not just the prose):",
        "<facets>" + json.dumps(f, sort_keys=True, ensure_ascii=False) + "</facets>",
    ]
    return "\n".join(parts)
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_style_condition.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/style/condition.py tests/test_style_condition.py
git commit -m "feat(style): condition.to_system_prompt conditioning interface (Phase D1)"
```

---

## Task 8: score.style_fit — advisory scorer

**Files:**
- Create: `samagra/factory/style/score.py`
- Test: `tests/test_style_score.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_style_score.py`:

```python
from samagra.factory.style import score
from samagra.factory.style.profile import StyleSeed

# Profile: short sentences, very second-person, low hedging, frequent analogy.
SEED = StyleSeed(
    version=0,
    facets={
        "voice": {"mean_sentence_len": 6.0, "second_person_rate": 1.0, "hedge_rate": 0.0},
        "sequencing": {}, "analogy": {"analogy_block_rate": 1.0},
        "rigor": {}, "selection": {},
    },
    source_corpus_hash="h", created_at="t")


def test_style_fit_returns_overall_and_per_facet_in_unit_range():
    r = score.style_fit("You push it. You feel it. Imagine that.", SEED)
    assert set(r) == {"overall", "facets"}
    assert set(r["facets"]) == {"voice", "analogy"}
    for val in [r["overall"], *r["facets"].values()]:
        assert 0.0 <= val <= 1.0


def test_on_voice_a_conforming_text_scores_higher_than_a_divergent_one():
    conforming = "You push it. You feel it. You see it."          # short, 2nd-person
    divergent = ("The aforementioned phenomenon may perhaps generally be "
                 "considered approximately analogous to certain idealized regimes.")
    assert (score.style_fit(conforming, SEED)["facets"]["voice"]
            > score.style_fit(divergent, SEED)["facets"]["voice"])


def test_analogy_presence_matches_a_high_analogy_profile():
    with_analogy = score.style_fit("Imagine a ball on a string.", SEED)["facets"]["analogy"]
    without = score.style_fit("The tension equals the centripetal force.", SEED)["facets"]["analogy"]
    assert with_analogy > without
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_style_score.py -q`
Expected: FAIL — `ModuleNotFoundError: samagra.factory.style.score`.

- [ ] **Step 3: Implement `score.py`**

Create `samagra/factory/style/score.py`:

```python
"""Deterministic ADVISORY style-fit scorer. Scores only the facets measurable from
free prose (voice, analogy). Hard-wired never to gate — surfaced for the owner."""
from __future__ import annotations

from . import text as T


def _closeness(a: float, b: float, scale: float) -> float:
    """1.0 when equal, decaying linearly to 0 at `scale` apart."""
    return max(0.0, 1.0 - abs(a - b) / scale)


def _voice_features(text: str) -> dict:
    sents = T.sentences(text)
    n = len(sents) or 1
    lens = [len(T.words(s)) for s in sents]
    return {
        "mean_sentence_len": sum(lens) / n if sents else 0.0,
        "second_person_rate": sum(1 for s in sents if set(T.words(s)) & T.SECOND_PERSON) / n,
        "hedge_rate": sum(1 for s in sents if set(T.words(s)) & T.HEDGES) / n,
    }


def style_fit(text: str, seed) -> dict:
    """Return {"overall": 0..1, "facets": {"voice": 0..1, "analogy": 0..1}}."""
    v = seed.facets["voice"]
    tv = _voice_features(text)
    voice_fit = (
        _closeness(tv["mean_sentence_len"], v["mean_sentence_len"], 20.0)
        + _closeness(tv["second_person_rate"], v["second_person_rate"], 1.0)
        + _closeness(tv["hedge_rate"], v["hedge_rate"], 1.0)
    ) / 3

    target = seed.facets["analogy"]["analogy_block_rate"]
    present = 1.0 if any(m in text.lower() for m in T.ANALOGY_MARKERS) else 0.0
    analogy_fit = 1.0 - abs(present - target)

    overall = (voice_fit + analogy_fit) / 2
    return {"overall": T.round4(overall),
            "facets": {"voice": T.round4(voice_fit), "analogy": T.round4(analogy_fit)}}
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_style_score.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/style/score.py tests/test_style_score.py
git commit -m "feat(style): advisory style-fit scorer (never gates) (Phase D1)"
```

---

## Task 9: CLI — `factory style-extract` + `factory style-show`

**Files:**
- Modify: `samagra/__main__.py` (extend `cmd_factory` + the `factory` subparser)
- Test: `tests/test_style_cli.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_style_cli.py`:

```python
import json

from samagra import config
from samagra.factory.style import profile as P


def _seed_dir(tmp_path, monkeypatch):
    d = tmp_path / "styleseed"
    monkeypatch.setattr(config, "STYLESEED_DIR", d)
    return d


def test_style_extract_writes_v0_and_reports(tmp_path, monkeypatch, capsys):
    _seed_dir(tmp_path, monkeypatch)
    import samagra.factory.style.extract as extract_mod
    monkeypatch.setattr(extract_mod, "load_corpus",
                        lambda: [{"slug": "a", "sections": []}])
    from samagra.__main__ import cmd_factory

    cmd_factory(type("A", (), {"action": "style-extract"})())
    out = capsys.readouterr().out
    assert "styleseed-v0.json" in out
    assert (tmp_path / "styleseed" / "styleseed-v0.json").exists()


def test_style_show_prints_current_version_and_facets(tmp_path, monkeypatch, capsys):
    _seed_dir(tmp_path, monkeypatch)
    P.save(P.StyleSeed(0, {"voice": {"n_sentences": 42}, "sequencing": {},
                           "analogy": {}, "rigor": {}, "selection": {}}, "h", "t"))
    from samagra.__main__ import cmd_factory

    cmd_factory(type("A", (), {"action": "style-show"})())
    out = capsys.readouterr().out
    assert "v0" in out and "voice" in out


def test_style_show_handles_no_profile(tmp_path, monkeypatch, capsys):
    _seed_dir(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory

    cmd_factory(type("A", (), {"action": "style-show"})())
    assert "no StyleSeed" in capsys.readouterr().out.lower()
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_style_cli.py -q`
Expected: FAIL — `cmd_factory` has no `style-extract`/`style-show` branch (prints nothing / KeyError on attribute).

- [ ] **Step 3: Extend `cmd_factory` (in `samagra/__main__.py`)**

In `cmd_factory`, after the existing `elif args.action == "build":` block, add:

```python
    elif args.action == "style-extract":
        from .factory.style import profile as style_profile

        path, seed = style_profile.extract_candidate()
        if path is None:
            print(f"factory style-extract: no change (current StyleSeed v{seed.version})")
        else:
            print(f"factory style-extract: wrote {path} (StyleSeed v{seed.version})")
            print("  review the file via `git diff`, then commit to approve.")
    elif args.action == "style-show":
        from .factory.style import profile as style_profile

        seed = style_profile.load_current()
        if seed is None:
            print("factory style-show: no StyleSeed yet — run `factory style-extract`.")
        else:
            print(f"StyleSeed v{seed.version}  (corpus {seed.source_corpus_hash[:12]}, "
                  f"created {seed.created_at})")
            for facet in style_profile.FACETS:
                print(f"  {facet}: {seed.facets.get(facet)}")
```

- [ ] **Step 4: Register the two subcommands (in `main()`, the `factory` subparser block)**

After the `ft_bld = ft_sub.add_parser("build", ...)` / `ft_bld.add_argument("assignment_id")` lines and before `ft.set_defaults(func=cmd_factory)`, add:

```python
    ft_sub.add_parser("style-extract",
                      help="(re)build the StyleSeed from the 59 chapters (writes next version)")
    ft_sub.add_parser("style-show", help="print the current StyleSeed version + facets")
```

- [ ] **Step 5: Run to verify pass**

Run: `python -m pytest tests/test_style_cli.py -q`
Expected: PASS (3 tests).

- [ ] **Step 6: Full-suite regression check**

Run: `python -m pytest -q`
Expected: all green except the one pre-existing env red (`test_gdocs`, missing Google API libs). New count = prior 360 + the D1 tests.

- [ ] **Step 7: Commit**

```bash
git add samagra/__main__.py tests/test_style_cli.py
git commit -m "feat(style): factory style-extract + style-show CLI (Phase D1)"
```

---

## Task 10: Generate + owner-commit the real v0 StyleSeed

**Files:**
- Create: `styleseed/styleseed-v0.json` (generated from the live 59-chapter corpus)

This task runs the deterministic extractor against the **real** corpus and produces the first committed profile. It is the owner-review gate from spec §8 ("owner reviews v0 StyleSeed"). It writes a real artifact, so a `cbm` snapshot bookends it.

- [ ] **Step 1: Snapshot before generating (owner-driven)**

Suggest to the owner: `/snap-pre "Phase D1 v0 StyleSeed generation"`.

- [ ] **Step 2: Generate v0 from the live corpus**

Run: `python -m samagra factory style-extract`
Expected: `factory style-extract: wrote .../styleseed/styleseed-v0.json (StyleSeed v0)`.

- [ ] **Step 3: Sanity-check the generated profile**

Run: `python -m samagra factory style-show`
Expected: `StyleSeed v0 …` with all five facets populated — non-empty `voice.n_sentences`, a non-empty `rigor.kind_mix` (proves the real `section.flags[]` were read), and a `selection.callout_variant_mix`.

- [ ] **Step 4: Owner reviews + commits the profile (the approval gate)**

The owner inspects `git diff -- styleseed/styleseed-v0.json` (the whole point of fork F-D3 — git is the review surface). The five facets should read as a faithful summary of Deepak's voice. On approval:

```bash
git add styleseed/styleseed-v0.json
git commit -m "feat(style): commit v0 StyleSeed extracted from the 59 chapters (Phase D1)"
```

- [ ] **Step 5: Post-work snapshot (owner-driven)**

Suggest: `/snap-post "Phase D1 complete — v0 StyleSeed committed"`.

---

## Self-Review

**Spec coverage (§3, §7, §8 D1 row):**
- §3.1 corpus/schema → Tasks 2–4 read `sections[].blocks[]` + `sections[].flags[]` via `render.load_chapter`. ✓
- §3.2 five facets (voice/sequencing/analogy/rigor/selection), **rigor from `flags[]`** → Tasks 2, 3 (`rigor()` reads `sec["flags"]`). ✓
- §3.3 `StyleSeed` (version/facets/corpus-hash/created_at) + versioned committed JSON + content-hash → Tasks 5, 6. ✓
- §3.4 `condition.to_system_prompt` (the cached system block) → Task 7. ✓
- §3.5 deterministic advisory scorer, **never auto-advances** → Task 8 (`style_fit` returns advisory numbers only; no gate path exists in D1). ✓
- §7 CLI `factory style-extract` / `style-show` → Task 9. (`style-ratify` is D3.) ✓
- §8 D1 gate: deterministic tests green + owner reviews v0 → Tasks 1–9 green; Task 10 owner-commit. ✓
- §9 invariants: no API key, no LLM, no new write path (only local `styleseed/` file + read-only corpus), no `assignments`/governance migration. D1 touches none of `lines.py`/`dispatch.py`/`store.py`. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step shows real assertions with hand-computed expected values. ✓

**Type consistency:** `StyleSeed(version, facets, source_corpus_hash, created_at)` is constructed identically in Tasks 5, 6, 7, 8, 9. `FACETS` tuple defined in both `extract.py` (Task 4) and `profile.py` (Task 5) with the same five names and consumed by `style-show` (Task 9). `build_profile` returns exactly those five keys (Task 4) — matched by `condition.to_system_prompt` (Task 7) and the `style-show` loop (Task 9). `text.py` helpers (`strip_html/sentences/words/round4` + `SECOND_PERSON/HEDGES/IMPERATIVE_STARTERS/ANALOGY_MARKERS`) defined once (Task 1) and imported by `extract` (Tasks 2–3) and `score` (Task 8). ✓

---

## Forward note: D2 and D3 get their own grounded plans

D1 ends green and produces the committed v0 StyleSeed. **D2** (the Samadhan LLM lane: `clients/llm_client.py`, `samadhan.py`, `Line.kind="llm"`/`auto_fan`, the `_assert_review_clean` gate, mocked-LLM tests + opt-in live smoke + a dedicated DEC-7 Codex pre-merge review) and **D3** (the `style_events` migration + `learn.py` + `factory style-ratify`) are written as separate plans **after** the owner reviews v0 — D2's prompt/scorer behavior is grounded in the *actual* v0 profile, and D2/D3 touch the network and governance schema, which D1 deliberately does not. This mirrors the Phase-C cadence (C1 → C2 → C3, each its own plan).
