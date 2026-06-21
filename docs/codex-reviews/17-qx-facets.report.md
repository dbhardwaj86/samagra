# Adversarial Code Review — Slice 17: QX question-scoped facets (SIM-id chip bugfix)

- **Branch:** `feature/control-plane-capture`
- **Diff range:** `559b11ffbbb1795e2ae9d239af0404de58e9c48e..5ad9f80c945a607084655e750bead07691a2a919`
- **Reviewer:** Independent adversarial review, primary engine = **Codex CLI** (`codex exec`, model `gpt-5.5`, reasoning effort `high`, sandbox `read-only`).
- **Date:** 2026-06-21
- **Verdict:** **GO** (one LOW test-coverage suggestion; non-blocking)

---

## Slice summary

Read-only bugfix. The Questions React app was rendering subject chips from `GET /api/facets`
→ `catalog.facets()` (catalog-wide). The sims adapter writes sim folder-ids as `subject`
(`samagra/adapters/sims.py:37`), so ~498 `SIM0xxx` ids leaked into the Questions subject chips.

The fix introduces a **new question-scoped endpoint** `GET /api/questions/facets` that returns
subjects from `qx.summary()["subjects"]` (a `{subjectName: count}` dict sourced from
`search_index` via `coalesce(ov_subject, subject)` — real subject names, never SIM ids). The
Questions app now reads that path instead of `/api/facets`.

**Files changed (4, +45/-9):**
- `samagra/api/app.py` — new `GET /api/questions/facets` (declared before the SPA catch-all).
- `frontend/src/apps/Questions/index.tsx` — `useApi<Facets>("/api/facets")` → `useApi<QuestionFacets>("/api/questions/facets")`.
- `frontend/src/apps/Questions/index.test.tsx` — retargeted facets mock; asserts new path is called, `/api/facets` is NOT, and `SIM0018` is not in the document.
- `tests/test_api_questions_facets.py` — NEW: happy path (qx.summary subjects, no SIM) + QX-absent empty state.

---

## Independent verification performed (by the human reviewer agent, beyond Codex)

- **Bug source confirmed:** `samagra/api/app.py:69-71` `/api/facets` → `catalog.facets()` (`samagra/catalog.py:191`) is catalog-wide; `samagra/adapters/sims.py:37` writes sim folder-ids into the `subject` field. This is the leak path.
- **Fix grounding confirmed:** `samagra/adapters/qx.py:50-70` `summary()` returns `{"documents", "questions", "subjects": {subj: count}, "online"}`, where `subjects` is grouped over `search_index` `coalesce(ov_subject, subject)` — real subject names. `list(subjects.keys())` therefore yields actual subjects, never SIM ids. **Correct fix.**
- **Frontend no longer consults `/api/facets`:** `frontend/src/apps/Questions/index.tsx` only calls `/api/questions` (line 21) and `/api/questions/facets` (line 22). The old path is fully removed from this component, so the sim-id chips cannot reappear.
- **Contract type matches payload:** `frontend/src/types/contracts.ts:111` `interface QuestionFacets { subjects: string[]; }` matches backend `{"subjects": [...]}`.
- **Empty-state robustness:** the endpoint guards three degradation branches — `not qx`, `not qx.available()`, and `(qx.summary() or {}).get("subjects") or {}` — so a missing adapter, an unavailable QX, a `None` summary, a missing `subjects` key, or an empty dict all collapse to `{"subjects": []}`. No `KeyError`/`AttributeError` path.
- **Route ordering:** new route inserted at `app.py:233-239`, before the SPA catch-all (`# MUST be declared LAST`). Correct — it will not be shadowed.
- **Tests executed:**
  - Frontend `vitest run src/apps/Questions/index.test.tsx` → **6 passed**.
  - Backend `pytest tests/test_api_questions_facets.py` → **2 passed** (an initial run showed a Windows pytest temp-dir teardown `PermissionError` unrelated to the tests; re-running with an isolated `--basetemp` gave a clean `2 passed`).

---

## Findings

| Severity | File | Issue | Suggested fix |
|---|---|---|---|
| LOW | `tests/test_api_questions_facets.py:16` | Backend empty-state coverage only exercises `get_adapter("qx") is None`. The implementation (`samagra/api/app.py:236-239`) also safely handles `available() == False`, `summary() is None`, missing `"subjects"`, and empty `{"subjects": {}}`, but no test locks those regressions down. A future refactor could drop one of those guards without a failing test. | Add a parametrized backend test covering `FakeQx.available() -> False`, `summary() -> None`, `summary() -> {}`, and `summary() -> {"subjects": {}}`, all asserting `{"subjects": []}`. |

No CRITICAL / HIGH / MEDIUM findings. No security / secret-leak concern (read-only GET, no auth surface, no user input reflected).

---

## Codex raw output (model gpt-5.5, effort high, sandbox read-only)

> Transient `rmcp` MCP transport-channel warnings appeared in stderr and an initial run failed
> because `gpt-5.5-codex` is not enabled on this ChatGPT account; the review was re-run on the
> account-default `gpt-5.5`. Neither affected the substance of the review.

```
codex
Using `code-review` guidance for the review format, but I’m keeping the scope manual and diff-only as requested.
I’m reading just the touched files for line numbers, not broadening into unrelated code.

[read frontend/src/apps/Questions/index.tsx, index.test.tsx, tests/test_api_questions_facets.py,
 samagra/api/app.py:220-245, frontend/src/types/contracts.ts:45-115]

**Findings**

No CRITICAL / HIGH / MEDIUM issues found.

LOW: tests/test_api_questions_facets.py:16 only covers `get_adapter("qx") is None` for the empty
state. The implementation at samagra/api/app.py:236 does safely handle `available() == False`,
`summary() is None`, and missing/empty `subjects`, but tests do not lock those regressions down.
Suggested fix: add a small parametrized backend test covering `FakeQx.available() -> False`,
`summary() -> None`, `summary() -> {}`, and `summary() -> {"subjects": {}}`, all expecting
`{"subjects": []}`.

**Verdict**

GO. The diff correctly moves Questions from `/api/facets` to `/api/questions/facets`, the backend
payload shape matches `QuestionFacets { subjects: string[] }`, and the old SIM-id source is no
longer consulted by the Questions app. No security or secret-leak concern in this read-only GET slice.

tokens used: 35,607
```

---

## Conclusion

The fix is correct, complete, and well-scoped. It returns question-scoped subjects from
`qx.summary()` (no SIM0xxx), handles the QX-absent / degraded cases with an empty-state
`{"subjects": []}`, the Questions app reads the new `/api/questions/facets` path and no longer
consults `/api/facets`, and the sim-id chips are genuinely removed (both verified by the new
frontend assertions and by reading the component). The only finding is a LOW, non-blocking
test-coverage suggestion.

**Verdict: GO** (LOW finding optional to address).
