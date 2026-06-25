# SAMAGRA Content Factory **Phase D3** — StyleSeed Learning-Loop Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the owner-ratified-only StyleSeed learning loop: an additive `style_events` governance table, deterministic mining of owner `changes`-reviews on samadhan artifacts into candidate facet deltas, and a `factory style-ratify` path that promotes a ratified delta into the next committed StyleSeed version.

**Architecture:** One additive governance migration (`_MIGRATIONS[2]` → `style_events`, `SCHEMA_VERSION` 1→2), one new pure-ish module `samagra/factory/style/learn.py` (mine → propose → ratify/reject over the existing `review_overlay` and committed `styleseed-v<N>.json`), and four new `factory` CLI subcommands (`style-mine`, `style-events`, `style-ratify`, `style-reject`). No new prod write path; no `assignments` migration; the deterministic moat (D1) and the publish gate are untouched. **D2 (the live Samadhan LLM lane) is deliberately NOT a prerequisite** — D3 builds the substrate that D2 will later feed; until D2 lands there are simply no samadhan reviews to mine, which the mining handles as an empty result.

**Tech Stack:** Python 3.11, sqlite3 (the durable `governance.db`), the existing `samagra.governance.store` + `samagra.factory.style.profile`, pytest. Pure-Python; no network, no API key, no new dependency.

---

## Pinned design decision (resolves spec §11 — the `style_events` payload schema)

The Phase-D design spec (§11) leaves "the `style_events` payload schema for a ratified delta" to be pinned here. Pinned:

- **Two event kinds.**
  - `kind="facet_delta"` — a **concrete, ratifiable** candidate. `payload_json` =
    `{"facet": <one of FACETS>, "step": {<facet-key>: <signed_step>, ...}, "rationale": <str>, "source_review_ids": [<int>, ...]}`.
    Ratify applies each signed `step` to the **then-current** profile's named facet (clamped) and bumps the version.
    **(Refined post-review: a signed *step*, not a mine-time absolute — so repeated corrections on one key compound and a
    candidate stays valid if the base version moved between mining and ratification. `from_version` records the base it was
    suggested against as provenance; ratify always nudges from the current value.)**
  - `kind="review_signal"` — an **informational, non-ratifiable** marker for a `changes`-review whose
    rationale matched no mining rule. `payload_json` = `{"artifact_uid": <str>, "rationale": <str>, "source_review_id": <int>}`.
    Captured so no owner feedback is lost; `ratify` refuses it (no concrete delta).
- **Mining is a deterministic, transparent placeholder, owner-gated.** `mine_deltas` maps a review's free-text rationale to a
  facet nudge via a small **frozen keyword→(facet, key, step) rule table** (`_RULES`). This is intentionally crude — it is a
  Phase-F-replaceable placeholder, and **owner ratification is the safety gate**: a mined `facet_delta` is only `proposed`, never
  auto-applied. A matched rule produces a `facet_delta`; no match produces a `review_signal`.
- **Idempotency / dedup key:** each mined event stores `subsystem_ref = f"review:{review_overlay.id}"`. `mine_deltas`
  skips any `review_overlay` row already represented by a `style_events.subsystem_ref`. Re-running mining is a no-op.
- **Ratify lineage:** ratify carries the **current** profile's `source_corpus_hash` forward (the corpus did not change — the
  profile is now extraction + an owner-ratified delta) and stamps a `style_seed_promoted` governance event whose
  `subsystem_ref` is the new profile's `content_hash` (tamper-evident pointer; the JSON file stays the source of truth).
- **Samadhan scoping:** a samadhan review is identified by `artifact_uid LIKE 'samadhan:%'`. This is the contract D2 must
  honor when it calls `store.add_review(..., artifact_uid=f"samadhan:{slug}", ...)`. Documented here so D2 inherits it.

**Known limitation (documented, no code — owner-protected by fork C):** after a ratified delta lands `styleseed-v<N+1>.json`,
a later `factory style-extract` re-extracts a **pure-corpus** candidate that would *drop* the owner's delta. Git is the review
surface (fork F-D3): `style-extract` only writes a candidate file; the owner inspects `git diff` and would see the regression
before committing. Reconciling re-extraction with ratified deltas is deferred (Phase F). This is noted in `learn.py`'s docstring.

---

## File structure

- **Modify** `samagra/governance/store.py` — add `_MIGRATIONS[2]` (the `style_events` DDL); bump `SCHEMA_VERSION` 1→2.
- **Create** `samagra/factory/style/learn.py` — `mine_deltas`, `list_style_events`, `ratify`, `reject`, `_RULES`, `STYLE_EVENT_STATUS`.
- **Modify** `samagra/__main__.py` — `cmd_factory` branches + subparsers for `style-mine`, `style-events`, `style-ratify`, `style-reject`.
- **Create** `tests/test_style_events_migration.py` — migration / schema-version / idempotency / v1-upgrade.
- **Create** `tests/test_style_learn.py` — mine / list / ratify / reject unit + error paths + end-to-end golden thread.
- **Modify** `tests/test_style_cli.py` — CLI coverage for the four new subcommands.

---

## Task 1: The `style_events` migration

**Files:**
- Modify: `samagra/governance/store.py:24` (`SCHEMA_VERSION`) and `:36` (`_MIGRATIONS`)
- Test: `tests/test_style_events_migration.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_style_events_migration.py
"""Phase D3: the additive style_events migration (_MIGRATIONS[2]).

The autouse isolate_data_db fixture (conftest) repoints GOVERNANCE_DB at a
per-test temp file, so no real governance.db is touched.
"""
from __future__ import annotations

import sqlite3

import pytest

from samagra.governance import store


@pytest.fixture()
def conn():
    c = store.connect()
    store.init_tables(c)
    yield c
    c.close()


def test_schema_version_is_2():
    assert store.SCHEMA_VERSION == 2


def test_migration_creates_style_events(conn):
    names = {r[0] for r in conn.execute(
        "select name from sqlite_master where type='table'")}
    assert "style_events" in names


def test_style_events_has_expected_columns(conn):
    cols = {r[1] for r in conn.execute("PRAGMA table_info(style_events)")}
    assert {"id", "ts", "kind", "subsystem_ref", "from_version",
            "payload_json", "status"} <= cols


def test_init_stamps_user_version_2(conn):
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 2


def test_status_defaults_to_proposed(conn):
    conn.execute("INSERT INTO style_events (ts, kind, payload_json) "
                 "VALUES ('t', 'facet_delta', '{}')")
    conn.commit()
    row = conn.execute("SELECT status FROM style_events").fetchone()
    assert row[0] == "proposed"


def test_migration_upgrades_an_existing_v1_db(tmp_path, monkeypatch):
    # Simulate a pre-D3 governance DB stamped at user_version 1 with the baseline
    # tables but NO style_events, then prove init_tables adds it and re-stamps.
    db = tmp_path / "old.db"
    monkeypatch.setattr(store.config, "GOVERNANCE_DB", db)
    raw = sqlite3.connect(db)
    raw.executescript(store.DDL)
    raw.execute("PRAGMA user_version = 1")
    raw.commit()
    raw.close()

    c = store.connect()
    store.init_tables(c)
    try:
        names = {r[0] for r in c.execute(
            "select name from sqlite_master where type='table'")}
        assert "style_events" in names
        assert c.execute("PRAGMA user_version").fetchone()[0] == 2
    finally:
        c.close()


def test_init_is_idempotent_at_v2(conn):
    conn.execute("INSERT INTO style_events (ts, kind, payload_json) "
                 "VALUES ('t', 'facet_delta', '{}')")
    conn.commit()
    store.init_tables(conn)  # second run must not raise or drop rows
    assert conn.execute("SELECT count(*) FROM style_events").fetchone()[0] == 1
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 2
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_style_events_migration.py -v`
Expected: FAIL — `test_schema_version_is_2` (currently 1), `test_migration_creates_style_events` (no such table), etc.

- [ ] **Step 3: Implement the migration**

In `samagra/governance/store.py`, bump the baseline version:

```python
# Baseline schema version. Bump when adding a migration below; never edit a
# migration that has already shipped.
SCHEMA_VERSION = 2
```

And replace the empty `_MIGRATIONS` with the additive D3 table:

```python
# Additive migrations BEYOND the v1 baseline DDL above. Map target_version -> SQL
# script. `init_tables` applies every migration whose version exceeds the DB's
# current user_version, then stamps SCHEMA_VERSION. NEVER edit a shipped migration.
#   v2 (Phase D3): style_events — the StyleSeed learning-loop ledger. A mined or
#   owner-authored candidate profile-delta; owner-ratified-only (never auto-applied).
#   status: proposed | ratified | rejected.
_MIGRATIONS: dict[int, str] = {
    2: """
CREATE TABLE IF NOT EXISTS style_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  subsystem_ref TEXT,
  from_version INTEGER,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
);
""",
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_style_events_migration.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: Confirm no existing governance test hardcoded user_version==1**

Run: `python -m pytest tests/test_governance.py -v`
Expected: PASS — `test_init_stamps_schema_version` and `test_init_tables_is_idempotent` read `store.SCHEMA_VERSION` (now 2), so they track the bump. If any test literally asserts `== 1`, that is a real breakage to fix here (none expected).

- [ ] **Step 6: Commit**

```bash
git add samagra/governance/store.py tests/test_style_events_migration.py
git commit -m "feat(governance): Phase D3 — additive style_events migration (_MIGRATIONS[2], SCHEMA_VERSION 1->2)"
```

---

## Task 2: `learn.mine_deltas` + `list_style_events` + the rule table

**Files:**
- Create: `samagra/factory/style/learn.py`
- Test: `tests/test_style_learn.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_style_learn.py
"""Phase D3 learning loop: mine review_overlay -> proposed style_events; ratify.

conftest's isolate_data_db repoints GOVERNANCE_DB; STYLESEED_DIR is NOT
auto-isolated, so tests that touch profiles monkeypatch it explicitly.
"""
from __future__ import annotations

import json

import pytest

from samagra import config
from samagra.governance import store
from samagra.factory.style import learn, profile as P


FACETS = {
    "voice": {"mean_sentence_len": 16.0, "second_person_rate": 0.08,
              "hedge_rate": 0.05, "imperative_rate": 0.1},
    "sequencing": {}, "analogy": {"analogy_block_rate": 0.03},
    "rigor": {}, "selection": {},
}


@pytest.fixture()
def conn():
    c = store.connect()
    store.init_tables(c)
    yield c
    c.close()


@pytest.fixture()
def profile_v0(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(P, "_now", lambda: "2026-06-25T00:00:00+00:00")
    P.save(P.StyleSeed(0, FACETS, "corpushash", "2026-06-25T00:00:00+00:00"))
    return P.load_current()


def _samadhan_change(conn, slug, rationale):
    store.add_review(conn, subsystem="factory", subsystem_ref=f"factory:{slug}",
                     artifact_uid=f"samadhan:{slug}", reviewer="owner",
                     verdict="changes", rationale=rationale)


def test_mine_matched_rule_proposes_facet_delta(conn, profile_v0):
    _samadhan_change(conn, "circular-motion", "Too hedgy — drop the maybes.")
    new_ids = learn.mine_deltas(conn)
    assert len(new_ids) == 1
    evs = learn.list_style_events(conn)
    assert len(evs) == 1
    e = evs[0]
    assert e["kind"] == "facet_delta" and e["status"] == "proposed"
    assert e["subsystem_ref"] == "review:1"
    assert e["from_version"] == 0
    p = e["payload"]
    assert p["facet"] == "voice"
    # hedge_rate nudged DOWN from 0.05 by the rule step.
    assert p["delta"]["hedge_rate"] < 0.05
    assert p["source_review_ids"] == [1]


def test_mine_is_idempotent(conn, profile_v0):
    _samadhan_change(conn, "x", "too hedgy")
    assert len(learn.mine_deltas(conn)) == 1
    assert learn.mine_deltas(conn) == []          # re-run proposes nothing new
    assert len(learn.list_style_events(conn)) == 1


def test_mine_unmatched_rationale_proposes_review_signal(conn, profile_v0):
    _samadhan_change(conn, "x", "The third item is factually wrong.")
    learn.mine_deltas(conn)
    e = learn.list_style_events(conn)[0]
    assert e["kind"] == "review_signal"
    assert e["payload"]["artifact_uid"] == "samadhan:x"
    assert e["payload"]["source_review_id"] == 1


def test_mine_ignores_approved_and_non_samadhan(conn, profile_v0):
    # approved verdict -> not mined
    store.add_review(conn, subsystem="factory", subsystem_ref="factory:a",
                     artifact_uid="samadhan:a", reviewer="owner",
                     verdict="approved", rationale="great")
    # changes verdict but a non-samadhan artifact -> not mined
    store.add_review(conn, subsystem="mycontentdev", subsystem_ref="mcd:7",
                     artifact_uid="mcd:7", reviewer="owner",
                     verdict="changes", rationale="too hedgy")
    assert learn.mine_deltas(conn) == []
    assert learn.list_style_events(conn) == []


def test_mine_without_profile_falls_back_to_review_signal(conn, tmp_path, monkeypatch):
    # No committed StyleSeed -> cannot compute a numeric delta -> signal only.
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "empty")
    _samadhan_change(conn, "x", "too hedgy")
    learn.mine_deltas(conn)
    assert learn.list_style_events(conn)[0]["kind"] == "review_signal"


def test_list_filters_by_status(conn, profile_v0):
    _samadhan_change(conn, "x", "too hedgy")
    learn.mine_deltas(conn)
    assert len(learn.list_style_events(conn, status="proposed")) == 1
    assert learn.list_style_events(conn, status="ratified") == []
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_style_learn.py -v`
Expected: FAIL — `ModuleNotFoundError: samagra.factory.style.learn` (or `AttributeError` once the file exists but functions don't).

- [ ] **Step 3: Implement `learn.py` (mine + list + rules)**

```python
# samagra/factory/style/learn.py
"""Phase D3 — the StyleSeed learning loop (owner-ratified-only).

Mines owner `changes`-reviews on samadhan artifacts (review_overlay) into
candidate profile-deltas (the additive `style_events` ledger), and promotes a
ratified delta into the next committed StyleSeed version. NOTHING here is ever
auto-applied: mining only `propose`s; the owner `ratify`s. This is the DEC-8
"owner-ratified-only learning loop" substrate.

The mining rule table (`_RULES`) is a deterministic, transparent PLACEHOLDER —
a crude keyword->facet-nudge map, replaceable in Phase F. Owner ratification is
the safety gate; a mined delta is never applied without an explicit `ratify`.

KNOWN LIMITATION (owner-protected by fork F-D3, git-as-review-surface): after a
ratified delta lands styleseed-v<N+1>.json, a later `factory style-extract`
re-extracts a PURE-corpus candidate that would drop the owner's delta. Because
style-extract only writes a candidate file the owner inspects via `git diff`
before committing, the regression is visible and owner-gated. Reconciling
re-extraction with ratified deltas is deferred to Phase F.
"""
from __future__ import annotations

import json

from ...governance import store
from . import profile

STYLE_EVENT_STATUS = ("proposed", "ratified", "rejected")

# (keyword markers, facet, facet-key, signed step). First matching rule wins
# (deterministic order). Rates are clamped to [0, 1]; mean_sentence_len is not.
# A transparent Phase-F-replaceable placeholder — owner ratification gates it.
_RULES: tuple = (
    (frozenset({"hedgy", "hedge", "maybe", "maybes", "tentative", "wishy"}),
     "voice", "hedge_rate", -0.02),
    (frozenset({"analogy", "analogies", "imagine", "everyday", "concrete"}),
     "analogy", "analogy_block_rate", +0.02),
    (frozenset({"wordy", "verbose", "rambling", "long-winded"}),
     "voice", "mean_sentence_len", -1.0),
    (frozenset({"terse", "choppy", "abrupt", "clipped"}),
     "voice", "mean_sentence_len", +1.0),
    (frozenset({"impersonal", "distant", "detached"}),
     "voice", "second_person_rate", +0.02),
)


def _clamp_rate(key: str, value: float) -> float:
    return value if key == "mean_sentence_len" else max(0.0, min(1.0, value))


def _tokens(text: str) -> set[str]:
    return {w.strip(".,;:!?\"'()[]").lower() for w in (text or "").split()}


def _mined_review_ids(conn) -> set[int]:
    out: set[int] = set()
    for (ref,) in conn.execute(
            "SELECT subsystem_ref FROM style_events WHERE subsystem_ref LIKE 'review:%'"):
        try:
            out.add(int(ref.split(":", 1)[1]))
        except (ValueError, IndexError):
            continue
    return out


def _insert_event(conn, *, kind, subsystem_ref, from_version, payload) -> int:
    cur = conn.execute(
        "INSERT INTO style_events (ts, kind, subsystem_ref, from_version, "
        "payload_json, status) VALUES (?,?,?,?,?, 'proposed')",
        (store._now(), kind, subsystem_ref, from_version,
         json.dumps(payload, sort_keys=True, ensure_ascii=False)),
    )
    conn.commit()
    return int(cur.lastrowid)


def mine_deltas(conn) -> list[int]:
    """Scan unmined samadhan `changes`-reviews -> proposed style_events.

    Deterministic + idempotent: re-running proposes nothing for already-mined
    review rows. Returns the ids of newly inserted events (oldest review first).
    """
    seed = profile.load_current()
    from_version = seed.version if seed is not None else None
    already = _mined_review_ids(conn)

    rows = conn.execute(
        "SELECT id, artifact_uid, rationale FROM review_overlay "
        "WHERE verdict='changes' AND artifact_uid LIKE 'samadhan:%' ORDER BY id"
    ).fetchall()

    new_ids: list[int] = []
    for r in rows:
        rid = r["id"]
        if rid in already:
            continue
        ref = f"review:{rid}"
        toks = _tokens(r["rationale"])
        match = None
        for markers, facet, key, step in _RULES:
            if toks & markers:
                match = (facet, key, step)
                break
        if match and seed is not None and match[1] in seed.facets.get(match[0], {}):
            facet, key, step = match
            new_val = _clamp_rate(key, profile.StyleSeed.__dict__  # noqa: placeholder
                                  and seed.facets[facet][key] + step)
            payload = {"facet": facet, "delta": {key: round(new_val, 4)},
                       "rationale": r["rationale"], "source_review_ids": [rid]}
            new_ids.append(_insert_event(conn, kind="facet_delta", subsystem_ref=ref,
                                         from_version=from_version, payload=payload))
        else:
            payload = {"artifact_uid": r["artifact_uid"], "rationale": r["rationale"],
                       "source_review_id": rid}
            new_ids.append(_insert_event(conn, kind="review_signal", subsystem_ref=ref,
                                         from_version=from_version, payload=payload))
    return new_ids


def list_style_events(conn, status: str | None = None) -> list[dict]:
    sql = "SELECT * FROM style_events"
    args: tuple = ()
    if status is not None:
        sql += " WHERE status=?"
        args = (status,)
    sql += " ORDER BY id"
    out = []
    for r in conn.execute(sql, args):
        d = dict(r)
        d["payload"] = json.loads(d["payload_json"])
        out.append(d)
    return out
```

> **Implementer note:** the `profile.StyleSeed.__dict__ and …` fragment above is a
> deliberate plan artifact to flag that you must compute `new_val` cleanly. Write it
> as simply `new_val = _clamp_rate(key, seed.facets[facet][key] + step)`. Do not copy
> the placeholder expression.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_style_learn.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/style/learn.py tests/test_style_learn.py
git commit -m "feat(style): Phase D3 — mine review_overlay -> proposed style_events (deterministic, idempotent)"
```

---

## Task 3: `learn.ratify` + `learn.reject`

**Files:**
- Modify: `samagra/factory/style/learn.py`
- Test: `tests/test_style_learn.py` (append)

- [ ] **Step 1: Write the failing test (append to `tests/test_style_learn.py`)**

```python
def test_ratify_promotes_facet_delta_to_next_version(conn, profile_v0, monkeypatch):
    monkeypatch.setattr(P, "_now", lambda: "2026-06-25T01:00:00+00:00")
    _samadhan_change(conn, "x", "too hedgy")
    (event_id,) = learn.mine_deltas(conn)

    res = learn.ratify(conn, event_id)
    assert res["version"] == 1
    assert res["path"].endswith("styleseed-v1.json")
    assert len(res["content_hash"]) == 64

    # The new committed version carries the merged delta.
    v1 = P.load_current()
    assert v1.version == 1
    assert v1.facets["voice"]["hedge_rate"] < 0.05
    # Untouched facet keys are preserved.
    assert v1.facets["voice"]["mean_sentence_len"] == 16.0
    assert v1.source_corpus_hash == "corpushash"   # lineage carried forward

    # Event marked ratified; a style_seed_promoted governance event was stamped.
    assert learn.list_style_events(conn, status="ratified")[0]["id"] == event_id
    verbs = [e["verb"] for e in store.list_events(conn)]
    assert "style_seed_promoted" in verbs


def test_ratify_is_not_repeatable(conn, profile_v0):
    _samadhan_change(conn, "x", "too hedgy")
    (event_id,) = learn.mine_deltas(conn)
    learn.ratify(conn, event_id)
    with pytest.raises(ValueError):
        learn.ratify(conn, event_id)            # already ratified


def test_ratify_unknown_event_raises(conn, profile_v0):
    with pytest.raises(ValueError):
        learn.ratify(conn, 999)


def test_ratify_review_signal_raises(conn, profile_v0):
    _samadhan_change(conn, "x", "factually wrong")     # -> review_signal
    (event_id,) = learn.mine_deltas(conn)
    with pytest.raises(ValueError):
        learn.ratify(conn, event_id)            # no concrete delta to apply


def test_ratify_without_profile_raises(conn, tmp_path, monkeypatch):
    # A facet_delta event but no committed StyleSeed to base it on.
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "none")
    eid = learn._insert_event(
        conn, kind="facet_delta", subsystem_ref="review:9", from_version=0,
        payload={"facet": "voice", "delta": {"hedge_rate": 0.01},
                 "rationale": "x", "source_review_ids": [9]})
    with pytest.raises(ValueError):
        learn.ratify(conn, eid)


def test_reject_marks_event_and_blocks_ratify(conn, profile_v0):
    _samadhan_change(conn, "x", "too hedgy")
    (event_id,) = learn.mine_deltas(conn)
    learn.reject(conn, event_id)
    assert learn.list_style_events(conn, status="rejected")[0]["id"] == event_id
    with pytest.raises(ValueError):
        learn.ratify(conn, event_id)            # rejected -> not ratifiable
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_style_learn.py -k "ratify or reject" -v`
Expected: FAIL — `AttributeError: module … has no attribute 'ratify'`.

- [ ] **Step 3: Implement `ratify` + `reject` (append to `learn.py`)**

```python
def _get_event(conn, event_id: int) -> dict:
    row = conn.execute("SELECT * FROM style_events WHERE id=?", (event_id,)).fetchone()
    if row is None:
        raise ValueError(f"unknown style_event {event_id!r}")
    d = dict(row)
    d["payload"] = json.loads(d["payload_json"])
    return d


def ratify(conn, event_id: int) -> dict:
    """Promote a proposed `facet_delta` into the next committed StyleSeed version.

    Merges the delta into the current profile's named facet, writes
    styleseed-v<N+1>.json, marks the event ratified, and stamps a
    `style_seed_promoted` governance event. Owner-ratified-only: the caller is
    the owner via `factory style-ratify`. Raises ValueError on any guard:
    unknown / non-proposed event, a non-`facet_delta` kind, or no current profile.
    """
    ev = _get_event(conn, event_id)
    if ev["status"] != "proposed":
        raise ValueError(f"style_event {event_id} is {ev['status']!r}, not 'proposed'")
    if ev["kind"] != "facet_delta":
        raise ValueError(
            f"style_event {event_id} ({ev['kind']!r}) carries no concrete delta to ratify")

    cur = profile.load_current()
    if cur is None:
        raise ValueError("no current StyleSeed to base a delta on — run "
                         "`factory style-extract` and commit v0 first")

    facet = ev["payload"]["facet"]
    delta = ev["payload"]["delta"]
    merged = {k: dict(v) if isinstance(v, dict) else v for k, v in cur.facets.items()}
    merged[facet] = {**merged.get(facet, {}), **delta}

    new_seed = profile.StyleSeed(
        version=cur.version + 1, facets=merged,
        source_corpus_hash=cur.source_corpus_hash, created_at=profile._now())
    path = profile.save(new_seed)
    chash = profile.content_hash(merged)

    conn.execute("UPDATE style_events SET status='ratified' WHERE id=?", (event_id,))
    conn.commit()
    store.append_event(conn, actor="owner", verb="style_seed_promoted",
                       subsystem="styleseed", subsystem_ref=chash,
                       note=f"v{new_seed.version} from style_event {event_id}")
    return {"version": new_seed.version, "path": str(path),
            "content_hash": chash, "event_id": event_id}


def reject(conn, event_id: int) -> None:
    """Mark a proposed style_event rejected (owner dismisses a candidate delta)."""
    ev = _get_event(conn, event_id)
    if ev["status"] != "proposed":
        raise ValueError(f"style_event {event_id} is {ev['status']!r}, not 'proposed'")
    conn.execute("UPDATE style_events SET status='rejected' WHERE id=?", (event_id,))
    conn.commit()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_style_learn.py -v`
Expected: PASS (all mine + ratify + reject tests green)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/style/learn.py tests/test_style_learn.py
git commit -m "feat(style): Phase D3 — ratify/reject; promote a delta to the next committed StyleSeed version"
```

---

## Task 4: CLI wiring (`style-mine`, `style-events`, `style-ratify`, `style-reject`)

**Files:**
- Modify: `samagra/__main__.py:130` (`cmd_factory` branches) and `:289` (`ft_sub` subparsers)
- Test: `tests/test_style_cli.py` (append)

- [ ] **Step 1: Write the failing test (append to `tests/test_style_cli.py`)**

```python
# --- Phase D3: learning-loop CLI --------------------------------------------
from samagra.governance import store
from samagra.factory.style import learn


def _A(**kw):
    return type("A", (), kw)()


def _seed_profile_and_review(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(P, "_now", lambda: "2026-06-25T00:00:00+00:00")
    P.save(P.StyleSeed(0, {"voice": {"hedge_rate": 0.05, "mean_sentence_len": 16.0,
                                     "second_person_rate": 0.08},
                           "sequencing": {}, "analogy": {"analogy_block_rate": 0.03},
                           "rigor": {}, "selection": {}}, "h", "t"))
    c = store.connect()
    store.init_tables(c)
    store.add_review(c, subsystem="factory", subsystem_ref="factory:x",
                     artifact_uid="samadhan:x", reviewer="owner",
                     verdict="changes", rationale="too hedgy")
    c.close()


def test_style_mine_reports_count(tmp_path, monkeypatch, capsys):
    _seed_profile_and_review(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory
    cmd_factory(_A(action="style-mine"))
    out = capsys.readouterr().out
    assert "1" in out and "style-mine" in out


def test_style_events_lists_proposed(tmp_path, monkeypatch, capsys):
    _seed_profile_and_review(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory
    cmd_factory(_A(action="style-mine"))
    cmd_factory(_A(action="style-events"))
    out = capsys.readouterr().out
    assert "facet_delta" in out and "proposed" in out


def test_style_ratify_bumps_committed_version(tmp_path, monkeypatch, capsys):
    _seed_profile_and_review(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory
    cmd_factory(_A(action="style-mine"))
    # event id is 1 (first row)
    cmd_factory(_A(action="style-ratify", event_id=1))
    out = capsys.readouterr().out
    assert "v1" in out
    assert P.load_current().version == 1


def test_style_reject_marks_rejected(tmp_path, monkeypatch, capsys):
    _seed_profile_and_review(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory
    cmd_factory(_A(action="style-mine"))
    cmd_factory(_A(action="style-reject", event_id=1))
    out = capsys.readouterr().out.lower()
    assert "reject" in out
    c = store.connect()
    try:
        assert learn.list_style_events(c, status="rejected")[0]["id"] == 1
    finally:
        c.close()
```

> Ensure the existing top-of-file imports in `tests/test_style_cli.py` include
> `from samagra import config` and `from samagra.factory.style import profile as P`
> (they already do). Add the new imports shown above.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_style_cli.py -k "mine or events or ratify or reject" -v`
Expected: FAIL — `cmd_factory` has no `style-mine`/etc. branch (falls through; `AttributeError` on `args.event_id` or no output).

- [ ] **Step 3: Implement the CLI branches**

In `samagra/__main__.py`, inside `cmd_factory`, after the existing `style-show` branch (around `:178`), add:

```python
    elif args.action == "style-mine":
        from .governance import store
        from .factory.style import learn

        c = store.connect()
        try:
            store.init_tables(c)
            new_ids = learn.mine_deltas(c)
        finally:
            c.close()
        print(f"factory style-mine: {len(new_ids)} new candidate event(s) "
              f"{new_ids if new_ids else ''}".rstrip())
        if new_ids:
            print("  review via `factory style-events`, then `factory style-ratify <id>`.")
    elif args.action == "style-events":
        from .governance import store
        from .factory.style import learn

        c = store.connect()
        try:
            store.init_tables(c)
            evs = learn.list_style_events(c)
        finally:
            c.close()
        if not evs:
            print("factory style-events: no style events yet — run `factory style-mine`.")
        for e in evs:
            facet = e["payload"].get("facet", "-")
            print(f"  [{e['id']}] {e['status']:9} {e['kind']:13} facet={facet} "
                  f"from_v={e['from_version']}")
    elif args.action == "style-ratify":
        from .governance import store
        from .factory.style import learn

        c = store.connect()
        try:
            store.init_tables(c)
            res = learn.ratify(c, args.event_id)
        finally:
            c.close()
        print(f"factory style-ratify: event {res['event_id']} -> StyleSeed "
              f"v{res['version']} ({res['path']})")
        print("  review the new version via `git diff`, then commit to approve.")
    elif args.action == "style-reject":
        from .governance import store
        from .factory.style import learn

        c = store.connect()
        try:
            store.init_tables(c)
            learn.reject(c, args.event_id)
        finally:
            c.close()
        print(f"factory style-reject: event {args.event_id} rejected")
```

And register the subparsers next to the existing `style-extract`/`style-show` (around `:289`):

```python
    ft_sub.add_parser("style-mine",
                      help="mine owner reviews -> candidate StyleSeed deltas (D3)")
    ft_sub.add_parser("style-events",
                      help="list StyleSeed learning-loop events")
    ft_ratify = ft_sub.add_parser("style-ratify",
                                  help="promote a candidate delta to the next StyleSeed version")
    ft_ratify.add_argument("event_id", type=int)
    ft_reject = ft_sub.add_parser("style-reject", help="reject a candidate delta")
    ft_reject.add_argument("event_id", type=int)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_style_cli.py -v`
Expected: PASS (existing 3 + new 4)

- [ ] **Step 5: Commit**

```bash
git add samagra/__main__.py tests/test_style_cli.py
git commit -m "feat(cli): Phase D3 — factory style-mine/style-events/style-ratify/style-reject"
```

---

## Task 5: End-to-end golden thread + full-gate verification

**Files:**
- Test: `tests/test_style_learn.py` (append one integration test)

- [ ] **Step 1: Write the golden-thread test (append to `tests/test_style_learn.py`)**

```python
def test_golden_thread_mine_to_ratified_version(conn, tmp_path, monkeypatch):
    """One owner `changes`-review -> mine -> ratify -> a new committed StyleSeed
    version on disk carrying the nudged facet, governance ledger stamped."""
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(P, "_now", lambda: "2026-06-25T00:00:00+00:00")
    P.save(P.StyleSeed(0, FACETS, "corpushash", "2026-06-25T00:00:00+00:00"))

    _samadhan_change(conn, "circular-motion", "Reads too hedgy and impersonal.")
    (eid,) = learn.mine_deltas(conn)          # 'hedgy' wins (first matching rule)
    res = learn.ratify(conn, eid)

    assert res["version"] == 1
    on_disk = json.loads((tmp_path / "styleseed" / "styleseed-v1.json")
                         .read_text(encoding="utf-8"))
    assert on_disk["version"] == 1
    assert on_disk["facets"]["voice"]["hedge_rate"] == round(0.05 - 0.02, 4)
    # the event is terminal-ratified and the promotion is in the durable ledger
    assert learn.list_style_events(conn, status="proposed") == []
    assert any(e["verb"] == "style_seed_promoted" for e in store.list_events(conn))
```

- [ ] **Step 2: Run the golden-thread test**

Run: `python -m pytest tests/test_style_learn.py::test_golden_thread_mine_to_ratified_version -v`
Expected: PASS

- [ ] **Step 3: Run the full Phase-D + governance slice**

Run: `python -m pytest tests/test_style_learn.py tests/test_style_events_migration.py tests/test_style_cli.py tests/test_governance.py -v`
Expected: all green.

- [ ] **Step 4: Run the entire backend suite (no regressions)**

Run: `python -m pytest -q`
Expected: the full count green except the lone pre-existing env red `tests/test_gdocs.py` (Google API libs not installed) — that one red is unrelated to Phase D. Confirm no NEW failures and that `style_events`-related and governance tests pass. Record the exact PASSED/FAILED counts for the handoff.

- [ ] **Step 5: Commit**

```bash
git add tests/test_style_learn.py
git commit -m "test(style): Phase D3 golden thread — mine -> ratify -> committed v1 + ledger stamp"
```

---

## Self-review checklist (run before handing to the reviewer)

1. **Spec coverage (§6/§7/§8-D3):** `_MIGRATIONS[2]` style_events ✓ (Task 1); `learn.mine_deltas` ✓ (Task 2); `factory style-ratify` ✓ (Task 4); version-bump + commit-surface + `style_seed_promoted` ✓ (Task 3). The §11 payload schema is pinned above.
2. **Invariants:** no new prod write path (only local `styleseed/*.json` + the additive `style_events` rows in the durable governance DB); no `assignments` migration; the publish gate and the deterministic moat untouched; mining never auto-applies (owner-ratified-only); reviewer/scorer semantics unchanged (D3 touches neither).
3. **No placeholders:** every step has real code. The one deliberate plan artifact (the `profile.StyleSeed.__dict__` fragment in Task 2 Step 3) is called out with the correct replacement immediately below it — the implementer must write `new_val = _clamp_rate(key, seed.facets[facet][key] + step)`.
4. **Type consistency:** `mine_deltas -> list[int]`; `list_style_events -> list[dict]` (each with a decoded `payload`); `ratify -> {"version","path","content_hash","event_id"}`; `reject -> None`. CLI passes `args.event_id` (int) to ratify/reject. `subsystem_ref` dedup format `"review:<id>"` is consistent across `_mined_review_ids`, `mine_deltas`, and the tests.
5. **Determinism / idempotency:** `mine_deltas` orders by `review_overlay.id`, first-matching-rule wins, dedups on already-mined review ids → byte-stable and re-run-safe. `ratify` is single-shot (refuses non-`proposed`).
```
