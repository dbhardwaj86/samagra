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
            new_val = _clamp_rate(key, seed.facets[facet][key] + step)
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
