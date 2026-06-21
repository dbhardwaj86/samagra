# Code Review — Slice 16: Sims app reads deployed manifest

- **Repo / branch:** `samagra` @ `feature/control-plane-capture`
- **Diff range:** `6632daef25d014314f6444ff92165f2d113f01c4..559b11ffbbb1795e2ae9d239af0404de58e9c48e`
- **Reviewer:** Independent adversarial review, performed with **Codex CLI 0.140.0** (`codex exec --sandbox read-only`, model_reasoning_effort=high) and corroborated by hand against the live repo + the real manifest.
- **Date:** 2026-06-21
- **Verdict:** **GO**

## Slice summary

Replaces the Sims React app's data source. Previously the app called
`GET /api/search?source=sims&limit=2000` and rendered catalog rows + `SIM0xxx`
subject chips. Now it calls a new `GET /api/sims`, which reads
`deployed-sims-by-grade.md` under `config.SIMS_ROOT`, parses it with a new
`samagra/sims_manifest.py`, and returns `{id,title,subject,grade,url}` rows that
link to live `https://pratyakshsims.com` sims. New frontend lib
`frontend/src/lib/sims/deployed.ts` filters + groups by grade. Files touched:

```
 frontend/src/apps/Sims/index.test.tsx  | 26 +++++++++-----
 frontend/src/apps/Sims/index.tsx       | 65 +++++++++++++++++++---------------
 frontend/src/lib/sims/deployed.test.ts | 14 ++++++++
 frontend/src/lib/sims/deployed.ts      | 19 ++++++++++
 samagra/api/app.py                     | 11 +++++-
 samagra/sims_manifest.py               | 33 +++++++++++++++++
 tests/test_api_sims.py                 | 18 ++++++++++
 tests/test_sims_manifest.py            | 23 ++++++++++++
 8 files changed, 171 insertions(+), 38 deletions(-)
```

## Verification performed by the reviewer (independent of Codex)

- **Real manifest sanity:** `deployed-sims-by-grade.md` at `SIMS_ROOT`
  (`CLAUDE_BOX / "pratyaksh-May-deploy"`) has **482 bullet lines**, **4** `## `
  grade headings, **16** `### ` subject headings — matching the "482 deployed
  sims" header.
- **Parser coverage on the real file:** ran the `_ITEM` regex against all 482
  real bullet lines → **0 non-matching**. The em-dash separator (U+2014) is
  consistent; all ids are 3-4 digits.
- **Regex disambiguation (verified live):** `_GRADE.match("### Biology (15)")` →
  **False**; `_SUBJECT.match("## Class 9 (57)")` → **False**;
  `_GRADE.match("## Class 9 (57)")` → **True**. h2/h3 are correctly separated.
- **Multi-dash titles:** `"0128 — Change of State — Heating Curve"` → title
  captured in full ("Change of State — Heating Curve"). Trailing `(NN)` stripped
  even with double-spacing.
- **Zero-pad:** `sim_url("18")` → `.../SIM0018/SIM0018_sim.html`;
  `sim_url("0466")` → `.../SIM0466/...`. `_ITEM` rejects a 5-digit bullet, so the
  unpadded/over-length path is unreachable via the parser.
- **Subject-leak edge (real, confirms Codex L1):** an item under a new `##`
  grade before any `###` inherits the previous grade's subject — reproduced.
- **Tests:** backend `tests/test_sims_manifest.py` + `tests/test_api_sims.py`
  → **4 passed**; frontend `Sims/index.test.tsx` + `lib/sims/deployed.test.ts`
  → **5 passed**. (A Windows pytest atexit `PermissionError` on tmpdir cleanup
  is benign and unrelated to the assertions.)

## Findings

All findings are **LOW**. None block the slice.

### LOW-1 — `subject` not reset on a new grade heading
`samagra/sims_manifest.py` (`parse_deployed_sims`, grade branch). When a `##`
grade heading is parsed, `subject` is left unchanged. If a future manifest
places an item directly under a grade before its first `###` subject, that item
inherits the *previous* grade's subject. Not reachable in the current real
manifest (every grade is immediately followed by a subject), and verified to
leak in a synthetic case. **Fix:** set `subject = None` inside the grade branch.

### LOW-2 — `sim_url()` pads but does not validate; non-conforming ids silently dropped
`samagra/sims_manifest.py` (`sim_url`, `_ITEM`). `sim_url("12345")` /
`sim_url("abc")` produce a malformed canonical URL, but this is unreachable
through `parse_deployed_sims` because `_ITEM` only accepts `\d{3,4}`. The flip
side: a (hypothetical) 5+-digit manifest id silently **fails `_ITEM` and is
dropped entirely** — no row, no error, total just lower than expected.
**Fix:** either document that `sim_url()` assumes a parser-validated numeric id,
or enforce `^\d{1,4}$`; consider widening/guarding `_ITEM` if the id space can
exceed 4 digits, so unknown ids surface rather than vanish.

### LOW-3 — Parser tests miss the robustness edges this slice is about
`tests/test_sims_manifest.py`. Good coverage of normal grouping, a middot title,
and zero-padding, but the headline robustness concerns are untested: explicit
h2-vs-h3 disambiguation, trailing-`(NN)` stripping assertion, an
internal-em-dash title (`Change of State — Heating Curve`), the leading italics /
blank non-data lines being ignored, and the subject-reset-on-grade behavior
(LOW-1). **Fix:** add targeted unit cases; e.g. assert `grade == "Class 9"` /
`subject == "Biology"` (counts stripped) and a multi-dash title round-trips.

### LOW-4 — "No `SIM0xxx` chips" assertion is structurally vacuous
`frontend/src/apps/Sims/index.test.tsx`. The new app renders no `subject-chip`
elements at all, so `queryAllByTestId("subject-chip")` is empty and the
`not.toMatch(/^SIM\d/)` loop never executes a real assertion. The removal is
nonetheless adequately enforced by the sibling assertions
(`useApi` called with `/api/sims`; `not.toHaveBeenCalledWith(...source=sims...)`)
and by the diff removing the `catalogRows`/`subjectsOf`/`buildQuery` imports.
**Fix (optional):** keep the negative-path assertions as the real guard; the
chip loop can stay as documentation but isn't load-bearing.

## Confirmed-fine (explicitly checked, no issue)

- **Contract fidelity:** backend `{sims, total}` matches TS `SimsResponse`; each
  row matches `SimRow { id, title, subject|null, grade|null, url }`. `total ==
  len(sims)`.
- **Old path fully removed:** `index.tsx` no longer imports `buildQuery`,
  `catalogRows`, `subjectsOf`, or `SearchResponse`; the `/api/search?source=sims`
  string and the `subject-chip` UI are gone from the Sims app.
- **Absent-manifest empty state:** `/api/sims` returns `{"sims":[],"total":0}`
  when the file is missing; frontend renders the `catalog-empty` state. Both
  tested.
- **Security / read-only invariant:** no network call, no DB access, no
  filesystem write; the manifest path is fixed under `config.SIMS_ROOT` (no
  user-controlled path → no traversal). URLs are built from a hardcoded origin +
  a `\d{3,4}` id. `title`/`subject` render as React text (auto-escaped); `href`
  is the derived canonical URL, not raw manifest text, so href/DOM injection from
  manifest content is not reachable. `rel="noreferrer"` set on the `target=_blank`
  link.

## Codex raw output

```
codex
I'll keep this constrained to the supplied diff and grounding facts, treating the parser and endpoint behavior as the main risk surface.

**Findings**

- LOW `samagra/sims_manifest.py:23-26`: When a new `##` grade heading is parsed, `subject` is not reset. If a future manifest has an item directly under a grade before the next `###` subject, or a malformed subject heading, those rows inherit the previous grade's subject. Current real manifest is fine per grounding facts, but the parser is less robust than intended. Fix: set `subject = None` inside the grade-heading branch.

- LOW `samagra/sims_manifest.py:11-13`: `sim_url()` pads but does not validate. Through `parse_deployed_sims()` this is safe because `_ITEM` only accepts 3-4 digits, but direct calls like `sim_url("abc")` or `sim_url("12345")` produce invalid canonical URLs. Fix: either document that `sim_url()` assumes a parser-validated numeric id, or enforce `^\d{1,4}$` and raise/return `None` otherwise.

- LOW `tests/test_sims_manifest.py:5-23`: The parser tests cover normal grouping, middot titles, and padding, but not the most important robustness edges named in this slice: h2/h3 disambiguation, exact stripping of trailing `(NN)`, internal em-dash titles such as `0128 — Change of State — Heating Curve`, ignored non-data lines, and subject reset on grade transition. Fix: add targeted unit cases for those; especially assert `grade == "Class 9"` and `subject == "Biology"` without counts.

- LOW `frontend/src/apps/Sims/index.test.tsx:17-29`: The "No SIM0xxx subject chips" assertion is vacuous if no `subject-chip` elements exist, which is currently the implementation. That is acceptable as a removal check only because the test also asserts the new endpoint, but it would not catch a different residual SIM-chip UI rendered under another test id. Fix: prefer explicit assertions that the old `/api/search?source=sims` path is not called and that old catalog helper imports are gone via code review/lint; the diff already removes those imports.

**Confirmed Fine**

- `_GRADE` does not match `###` lines: `^##\s+` already fails on `###` because the third character is `#`, not whitespace. `_SUBJECT` does not steal `##` lines because it requires exactly three leading hashes before whitespace. The subject-before-grade order is safe for those headings.

- `_ITEM` is appropriate for the verified manifest: it captures the first numeric id, accepts em-dash or hyphen as the separator, preserves internal em-dashes/middots in the title, and strips trailing whitespace.

- `/api/sims` has the intended absent-manifest behavior: `{"sims":[],"total":0}`. The frontend maps that to the empty state.

- No visible network call, DB write, path traversal, or secret leak is introduced. The manifest path is fixed under `config.SIMS_ROOT`; URLs are derived from numeric ids and a hardcoded origin. React text rendering protects title/subject from DOM XSS, and `href` injection is not reachable through parsed manifest content.

**Verdict: GO**

The slice is functionally sound against the provided real manifest and removes the old `/api/search?source=sims` coupling in the visible Sims app code. I would take the small parser/test hardening above, but none of it blocks this slice.
```

> Note: Codex emitted benign `rmcp::transport` errors to stderr (its own MCP
> client failing to reach `127.0.0.1:29979`); these are unrelated to the review
> and did not affect the analysis.
