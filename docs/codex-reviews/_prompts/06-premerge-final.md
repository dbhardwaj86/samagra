You are **Codex — Chief Architect & Code-Review Lead** of SAMAGRA, performing the
**final pre-merge confirmation** before the Chairman (Deepak) merges
`phase1-stabilize` into `main`. Read-only access. Be adversarial but decisive.

## History
- Review 04 (`docs/codex-reviews/04-premerge-review.report.md`): BLOCK — H1 (lock race),
  H2 (state lost-update), H3 (sum None crash), LOW (durability), NIT (whitespace).
- Re-review 05 (`docs/codex-reviews/05-premerge-rereview.report.md`): REQUEST-CHANGES —
  H2 RESOLVED, H3 RESOLVED, H1 PARTIALLY-RESOLVED (the steal-based reclaim still had a
  3-acquirer double-holder window), plus a new LOW (state.py temp-cleanup masking the
  real error).
- The Chairman then chose your recommended option for H1: **disable auto-reclaim
  entirely.** Commit `acbefad` implements it.

## What changed in commit `acbefad` (vs b70cb44)

```
git diff b70cb44..acbefad
```

- `samagra/lock.py`: removed `_steal_stale` and ALL staleness-based reclaim.
  `file_lock` is now a single `O_CREAT|O_EXCL` create (stamps an ownership token) or
  raises `LockBusy` immediately if the file exists — present == busy. Token-checked
  release (unlink only if the file still holds our token). `is_busy` retained ONLY to
  read the FOREIGN physics-textbook lock by mtime. New `clear()` helper.
- `samagra/__main__.py`: new `samagra unlock` verb clears `.scheduler.lock`/`.state.lock`.
- `samagra/scheduler.py`: own-lock check is existence-based; a present-but-stale own lock
  is surfaced (notify + "run `samagra unlock`"). Foreign coexistence check unchanged.
- `samagra/state.py`: LOW fix — failed-save temp cleanup catches `OSError` then bare-raises.
- `tests/test_lock.py`: obsolete auto-reclaim tests removed; new present==busy / no-steal /
  clear() / unlock / foreign-is_busy tests added.

## Confirm (be specific, cite file:line)

1. **H1 fully resolved?** Is the 3-acquirer double-holder window GONE? Confirm there is no
   remaining steal/rename/reclaim path, and that `file_lock` is now provably at-most-one-
   holder. Is the docstring now accurate (no overclaim)?
2. **No regressions from removing the `stale` parameter** of `file_lock` (any caller still
   passing it?) or from the existence-based scheduler check (does a normal in-progress tick
   still skip correctly; does the foreign TEXTBOOK_LOCK coexistence still work)?
3. **H2 and H3 still resolved** (unchanged since 05) — spot-check they weren't disturbed.
4. **LOW** (state.py cleanup masking) — resolved? **NIT** (whitespace) — still only in the
   verbatim Codex report files, or now in authored files?
5. **`samagra unlock` correctness:** does it clear only SAMAGRA's own locks, never the
   foreign lock? Safe when none present?
6. **Tests genuine?** Are the new lock tests true RED-before/GREEN-after for the new
   contract, and did removing the old reclaim tests lose any coverage we still need?
7. **New issues** introduced by this change? (e.g. a crashed-holder wedge that is NOT
   surfaced; the existence-check racing the acquire; `clear()` semantics.)

## Output (final message = the report)
1. **Verdict:** `APPROVE` / `APPROVE-WITH-NITS` / `REQUEST-CHANGES` / `BLOCK`, with a
   one-paragraph rationale and an explicit merge recommendation to the Chairman.
2. **Finding ledger:** H1 / H2 / H3 / LOW / NIT — each RESOLVED / OPEN, one line.
3. **New findings** (if any): `[SEVERITY] file:line — title` + fix.
4. **Merge checklist:** must-fix-before-merge (ideally empty) vs. acceptable follow-ups.

Tight and technical. Read by the CEO and the Chairman.
