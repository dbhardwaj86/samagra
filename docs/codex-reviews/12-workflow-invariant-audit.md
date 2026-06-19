# Phase 2 — adversarial Workflow invariant audit (CEO-run, 2026-06-19)

After 5 Codex pre-merge rounds converged on the never-downgrade / never-wedge
class, the CEO ran an independent **multi-agent Workflow** (`precommit-invariant-audit`)
to exhaustively probe the two D5 invariants from 6 failure-mode lenses, with an
adversarial verify stage confirming each candidate against the actual code.

- **Probe lenses (6, parallel):** findings-shape · cache-layer · printing/stderr ·
  pathological-objects · criticals-membership · pre-verdict/exit.
- **Verify:** each high/medium candidate re-checked against the real code (default refute).
- **Result:** 1 confirmed real counterexample (the rest refuted), `7` agents, ~381k tokens.

## Confirmed finding (INV-1 downgrade) — fixed

**`samagra/review/precommit.py` — dedup `c not in crits` on the decided-block path.**

The block is decided at `if _criticals(confirm):` — `_criticals` filters by
`isinstance(f, dict) and f.get("severity") == "CRITICAL"`, which admits dict
**subclasses** and does not invoke `__eq__`. The very next line,
`confirmed = crits + [c for c in _criticals(confirm) if c not in crits]`, runs a
list membership test that **does** call `__eq__`. A confirm-pass CRITICAL that is a
`dict` subclass with a raising `__eq__` therefore passes the filter (block decided),
then raises at the dedup — escaping into the outer never-wedge guard, which warns and
returns `0`, silently **downgrading a confirmed-CRITICAL block to allow**.

This was the only unguarded *value comparison* on the decided-block path; all prior
Codex rounds (R1–R5) and their fixes targeted prints / cache / logging / stringify —
none touched a comparison. Verified end-to-end with a `RaisingEqDict` repro.

**Fix:** guard the dedup (`try/except -> confirmed = crits`) so a pathological finding
comparison cannot escape a decided block. Regression:
`test_confirmed_block_survives_pathological_finding_eq`. Suite 97 -> **98 green**.

**Takeaway:** a single-reviewer pass (even xhigh, 5 rounds) can repeatedly miss a
sibling instance of a bug class; an independent multi-lens adversarial fan-out with
verify caught the last one. The decided-block path now has zero unguarded user-code
invocations (comparison, print, cache, or stringify).
