# SAMAGRA (repo & Python package = `samagra`) — project notes

> **Naming:** the working directory is still `TeachingOS/` (legacy), but the **repo, the GitHub remote and the
> Python package are `samagra`** since the Phase-0 rename (2026-06-19). Where the auto-generated memory block
> below still says "TeachingOS", read it as the legacy directory / historical name only.
>
> **▶▶▶▶▶▶ ✅ CONTENT-FACTORY PIVOT — RATIFIED 2026-06-23 by Deepak (Founder & Chairman, carte blanche). NEW TOP
> DIRECTION.** SAMAGRA converts from a **static read-only operator console** into an **active, style-conditioned,
> multi-output content factory** for JEE/NEET **physics**: ONE seed (a lecture/chapter, a question, a captured idea)
> fans out to a wide spread of catalogued/indexed/categorized content types, in Deepak's style, behind the
> never-automated publish gate. **The reframe = activation, not teardown:** the 2026-06-19 spec already designed +
> parked this machinery — A6 (a learner-facing product is a SEPARATE entity consuming the published corpus), the
> dormant DRAFTER + ONE adversarial REVIEWER (anchored only to external ground-truth; catch-rate→0 = red flag), and
> the demand compass. The pivot ACTIVATES those + generalizes the bridge's single write into a many-output dispatch.
> **Decisions (binding):** **DEC-7** bridge → guarded **dispatch** boundary (1 approved seed → N child assignments,
> each board-approved + single-write + terminal; an EXTENSION that strengthens the firewall; needs a Codex pre-merge
> review of the new boundary); **DEC-8** **StyleSeed** = durable owner-curated voice profile from the 59 chapters,
> advisory style-fit scoring (never auto-advances the gate), owner-ratified learning loop over `review_overlay`;
> **DEC-9** **PRATHAM** student twin = the A6 separate entity, DEFERRED (DEC-1 "no audience" scoped to the console
> only). **4 forks ratified:** (1) **dispatch spine first** (throughput; StyleSeed layers after the deterministic
> lanes), (2) **PRATHAM deferred to Phase G**, (3) **publish gate = per-seed batch** (`approve_seed` — never silent
> auto-approve; mandatory adversarial review on LLM lanes), (4) **scope = teaching leverage** (no GTM; multi-seed
> from day one). **PRESERVED & still binding:** the never-automated publish gate; the read-only firewall over the 7
> source subsystems (munshi/mcd/QX/textbook/booklets/INSP/sims); the 5 crash-safety guards; DEC-1 bounded console
> scope. **Plan A–G** (spine → deterministic lanes → StyleSeed → coverage graph → async lanes → deferred PRATHAM).
> **Phase 1 = `samagra/factory/` dispatch spine + 2 deterministic local-write lanes (`revision`/`lecture`) from a
> textbook-chapter seed — NO new prod write path** (strictly safer than the existing bridge); reuses existing
> `assignments` columns (`pipeline`=lane, `seed_ref`, `artifact_ref`) so **no migration**. Spec
> `docs/superpowers/specs/2026-06-23-samagra-content-factory-design.md`; Phase-1 plan
> `docs/superpowers/plans/2026-06-23-samagra-content-factory-phase1-dispatch.md`; Chairman vision
> `CONTENT-FACTORY-VISION.html`. Synthesis from a 16-agent Workflow (run `wf_5fb88c46-838`).
>
> **✅ PHASE 1 (dispatch spine) BUILT TDD + Codex-reviewed + MERGED to `main` + PUSHED to `origin/main` 2026-06-23**
> (ff `67a509c`; HEAD `0758cd6` — durable): `samagra/factory/` (`lines` · `dispatch` · `run` · `outbox`) + CLI
> **`samagra factory plan|approve|approve-seed|build`**. ONE seed fans to 2 deterministic local-write lanes
> (`revision`=thin + `lecture`=thick) via the existing lecture renderer (`lectures.export.export_one`); the guarded
> **`build()`** boundary inherits the bridge's 5 crash-safety guards; **per-seed batch gate** (`approve-seed`, fork 3);
> **4-entry-point workflow firewall** (factory + bridge approve/build refuse cross-workflow pipelines); **NO new prod
> write path** (gdocs-upload opt-out; local artifacts + `governance.db` ledger only); **no migration** (reuses
> `assignments.pipeline`/`seed_ref`/`artifact_ref`). Golden thread **PROVEN LIVE** (`textbook:circular-motion` → 2
> distinct CAPTURED artifacts via the real renderer; durable `governance.db` untouched). **DEC-7 Codex pre-merge
> review:** review 24 **NO-GO** (factory build could trigger the lecture exporter's EXTERNAL Google Docs upload) →
> remediated TDD (H1 gdocs opt-out · M1 factory outbox + workflow firewall · L1 assignment-scoped event query · L2
> seed_ref normalize · I1 guard-2 isolation) → re-review 25 **GO-WITH-CAVEATS** (1 new Low: `approve_seed` firewall)
> → caveat closed → effectively **GO**. Gate **303 pytest**. Reports `docs/codex-reviews/24,25`.
>
> **✅ PHASE C DESIGN — RATIFIED 2026-06-23/24 (Chairman).** Phase C = "more deterministic lanes" (**NOT** StyleSeed —
> that is **Phase D**). Three forks ruled: (F-C1) include all 3 lanes now (`deck` + `paper`/`drill` + `seed`/mcd);
> (F-C2) **fold the bridge** — the factory `seed` lane becomes the canonical munshi→mcd write, `samagra bridge`
> deprecated/delegates, so exactly ONE prod-write path; (F-C3) **three sub-slices, lowest-risk first** (**C1** `deck`
> → **C2** `paper`/`drill` → **C3** `seed`-fold, C3 getting a dedicated DEC-7 Codex pre-merge review). Architecture:
> lanes gain a `kind` (`local|qx|mcd`); the one guarded `build()` boundary branches while the 5 guards stay identical.
> Spec `docs/superpowers/specs/2026-06-23-samagra-content-factory-phase-c-design.md`.
>
> **✅ PHASE C1 (`deck` lane) BUILT subagent-driven TDD + adversarial-multi-lens-reviewed + MERGED to `main` + PUSHED
> to `origin/main` 2026-06-24** (ff `6084952`): new PURE engine `samagra/factory/deck.py` — `build_deck(slug)` projects
> a chapter's **equation + callout** blocks into `{front,back,ref}` flashcards, writing `<slug>-deck.json` + a
> printable MathJax `<slug>-deck.html` under `EXPORT_DIR`. **Zero external-write code** (no-prod-write enforced
> STRUCTURALLY — stronger than the lecture lane's opt-out). The **`Line.kind` seam** (`local|qx|mcd`, default local)
> lands here (consumed by C2/C3); `dispatch.run_line` routes deck→engine; `classify("textbook:<slug>")` now fans to
> **[revision, lecture, deck]** — **one chapter → 3 captured local artifacts**. Golden thread **PROVEN LIVE**
> (`circular-motion` → **50 flashcards** [27 eqn + 23 callout] + 3 distinct artifacts; durable `governance.db`
> untouched). **Adversarial final review** (9-agent Workflow, 4 lenses × independent verify) caught **1 HIGH** the
> per-task reviews missed — equation LaTeX injected UNESCAPED into the printable corrupts ~18 real-corpus formulas
> carrying `<`/`>`/`&` (e.g. gauss-law `E(r<R)=0`: the HTML tokenizer ate the math, MathJax never typeset it) →
> **FIXED** (escape the equation back at the HTML boundary keyed on card kind; the deck JSON keeps RAW tex) +
> regression test, proven on gauss-law (32 cards, zero bogus tags); other 4 findings verified false; the safety lens
> confirmed all 6 load-bearing invariants HELD. **NO new prod write path · no migration · publish gate untouched.**
> Gate **316 pytest** (lone red = pre-existing env `test_gdocs`, Google API libs). Plan
> `docs/superpowers/plans/2026-06-24-samagra-content-factory-phase-c1-deck.md`.
>
> **✅ PHASE C2 (`paper`/`drill` lanes) BUILT TDD + adversarial-multi-lens-reviewed + MERGED to `main` + PUSHED to
> `origin/main` 2026-06-24** (ff `78cf72a`): new PURE engine `samagra/factory/paper.py` — `build_paper(slug, *, variant)`
> reads the **read-only** QX `/api/qsearch` (question-only render — stem/options/passage/matrix with KaTeX `data-tex`
> spans + figures; QX's search route NEVER renders `rj["answer"]`), assembles an **answer-free** printable KaTeX
> `paper` (full page) / `drill` (first `_DRILL_SIZE=8`), absolutizes asset URLs, writes `<slug>-<variant>.{json,html}`
> under `EXPORT_DIR`. **NO new prod write path** (QX is read-only; only local file writes — no gdocs/network). The
> **`Line.kind="qx"` seam** (from C1) is consumed: `run_line` routes `kind=="qx"` → engine; **`classify("textbook:<slug>")`
> now fans to `[revision, lecture, deck, paper, drill]` — one chapter → 5 captured local artifacts**. The real
> **`_assert_no_answer_leak`** guard is ACTIVATED for `kind=="qx"`: a structural-marker scan over BOTH written artifacts
> (html + json) that refuses any answer/solution marker at the guarded `build()` boundary; **false-positive-free**
> (anchors on QX-specific class tokens — `class="answer"`/`answer-label`/`pq-ans`/`pkey` — never the bare word "answer",
> so a stem mentioning "answer" passes). **QX-down ⇒ `ValueError` before any write** (clean refusal, no partial artifact).
> **`build()` is unchanged** — the 5 crash-safety guards are identical for every kind. Golden thread **PROVEN LIVE
> against the live QX engine** (`circular-motion` → **paper 25 q + drill 8 q**, both answer-free, both captured; durable
> `governance.db` untouched). **Adversarial final review** (10-agent Workflow, 4 lenses × independent verify; run
> `wf_3ffe75d5-cc1`): 6 raw → **4 confirmed (0 HIGH, 1 MED, 3 LOW), 2 refuted**. The MED (the load-bearing catch, like
> C1's): the marker set missed QX's **THIRD** answer renderer — its teacher `paper_render` markup (`pq-ans` / the `pkey`
> answer-key appendix) — a **latent defense-in-depth gap** (no live leak: the search render is structurally answer-free)
> → **FIXED** (add `pq-ans`+`pkey` markers + scan the JSON sidecar) + regression. 3 LOWs fixed (json-scan, parametrize
> the `drill` e2e path, assert the drill cap on-disk); 2 findings correctly refuted. **6 load-bearing invariants HELD**
> (no new prod write · read-only firewall · publish gate · 5 guards · no migration · no secrets). Gate **341 pytest**
> (340 green; lone red = pre-existing env `test_gdocs`). Plan
> `docs/superpowers/plans/2026-06-24-samagra-content-factory-phase-c2-paper-drill.md`. **Next: Phase C3** (`seed`/mcd
> **bridge-fold** — the one prod-write path, with a dedicated DEC-7 Codex pre-merge review).
>
> **✅ Direction-coherence decision (ratified 2026-06-21 by Deepak; amended by DEC-6 on 2026-06-22):** a coherence
> audit found execution solid but the strategic direction drifting — "SAMAGRA OS" had re-introduced the OS-sized
> scope the 2026-06-19 vision deliberately retired. **Decided & binding:** SAMAGRA OS is a *bounded operator
> console* (UI metaphor only); a scope firewall is in force (DEC-1/DEC-3); the never-automated publish gate holds;
> Phase 3 (active loop) is the primary value engine (DEC-5). **⚠ DEC-6 (2026-06-22, Chairman): the pre-E3
> attention-ROI gate (DEC-4) is RETIRED** (not deferred), and the **attention-ROI north-star + kill-criterion
> (DEC-2) are relaxed from binding to advisory** — E3 + the public deploy shipped ahead of the gate and the
> bounded console is judged already proven; Phase 3 is now ungated. See `HANDOFF.md` →
> *✅ Direction-coherence DECISION* (DEC-1…DEC-6) and `STATUS.html` → *Direction coherence*.
>
> **✅ DEC-3 AMENDMENT (2026-06-21, Chairman):** the read-only firewall is amended to allow **owner-initiated
> capture** — exactly two **subsystem** write paths, `POST /api/munshi/capture` (munshi item) and `POST /api/mcd/seeds`
> (mcd seed). The human **publish gate stays never-automated**, there is **no munshi→mcd bridge**, and the
> invariant is now *"read-only except owner-initiated capture."* The capture control plane is **live-verified**
> on branch `feature/control-plane-capture` (capture apps read the live workers via `GET /api/munshi/library` +
> `GET /api/mcd/seeds`; Simulations shows the 482 deployed pratyaksh sims; the QX browser facet bug is fixed).
> See `docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md`.
>
> **✅ PHASE 3 — ACTIVE LOOP (the bridge) BUILT + MERGED to `main` + PUSHED to `origin/main` 2026-06-23**
> (ff `88d31e0`; pushed HEAD `1c5ec5d`), per the
> reconciled `docs/superpowers/{specs/2026-06-22-phase3-active-loop-design.md,plans/2026-06-22-phase3-active-loop.md}`.
> `samagra/bridge/` + CLI `samagra bridge scan|approve|submit`: munshi item → classify → propose seed + pointers →
> `in-review` board assignment → **manual `approve`** → **manual `submit`** (creates the mcd seed). **Governance
> consistency:** this is the **board-approved, owner-driven** munshi→seed loop of spec §8/§9.4 — it is **NOT** the
> *automated* munshi→mcd promotion DEC-3 forbade (every seed needs an explicit human approve+submit), it adds **NO
> new subsystem write path** (`submit` reuses the existing `create_seed` behind `POST /api/mcd/seeds`; still exactly
> two write paths) and **no new web endpoint**, and the **never-automated publish gate is untouched**. It was
> **explicitly directed by the Chairman** ("go for phase 3"), the action DEC-3 reserved, and is DEC-5's primary
> value engine (ungated by DEC-6). Golden thread proven live (seed `seed_01KVRFPPT98HJVQ5NRBJ63MKR3`). **Codex
> pre-merge review done:** review 22 returned **NO-GO** (prod double-write robustness) → all findings remediated TDD
> (H3 scan dedups status-blind incl. terminal `captured`; H1 fail-safe `seed_submitting` intent guard refuses a
> crashed/in-flight retry; M1 `validate_seed_payload` at the write boundary; M2 graceful munshi-down; Low
> word-boundary classify + full-id outbox guard) → re-review 23 **GO-WITH-CAVEATS, all 6 resolved** (H2 concurrent
> submit accepted Low under the single-operator manual-CLI threat model). Gate **272 pytest** (was 263).
> Reports `docs/codex-reviews/22,23`.

<!-- scribe:begin v1 -->
## TeachingOS memory — auto-generated by scribe; edit OUTSIDE this block only
_Updated 2026-06-24T02:42. Source: agent session distillation._
- (5) 2026-06-24 claude: SAMAGRA is pivoted to a content factory focused on JEE/NEET physics, conditionally generating multiple output styles. [SAMAGRA, TeachingOS, content factory, JEE/NEET, physics]
- (5) 2026-06-23 codex: Remediation commit 91baeeb resolves H1 (high severity) and M1 (medium severity) completely. [remediation, severity]
- (5) 2026-06-23 claude: Phase 3 scope is backend bridge + CLI, defined during brainstorming. [Phase 3, backend bridge, CLI, SAMAGRA]
- (5) 2026-06-22 claude: TDD is enforced strictly: write test first, watch it fail, then minimal code. [TDD]
- (5) 2026-06-22 claude: User instructed to merge and push changes to make the deployment durable. [Git merge, Git push, deployment]
- (5) 2026-06-22 claude: The autonomous ralph loop is driving SAMAGRA OS to a fully working state. [SAMAGRA OS, ralph loop, autonomous deployment]
- (5) 2026-06-22 claude: The Ralph loop's mission is to drive the SAMAGRA OS app to fully working, served from frontend/dist/ by FastAPI on :8799. [Ralph, SAMAGRA OS, FastAPI]
- (5) 2026-06-21 claude: The session concluded with a plan to improve the app in a custom ralph loop and deploy to Cloudflare with a custom URL pointing to a localhost tunnel. [deployment, Cloudflare, localhost tunnel, ralph loop]
- (5) 2026-06-21 claude: The test-driven-development skill was applied: tests were written before code, and tests were seen to fail before passing. [test-driven-development, TDD, testing]
- (5) 2026-06-21 claude: Munshi auth uses a single shared-secret cookie model: GET /login?k=<secret> sets the cookie; subsequent /api/ calls must carry it. [Munshi, authentication, cookie]
- (5) 2026-06-21 claude: Immediate next step: update handoffs and project trackers plus summary (option B). [planning, project tracking]
- (5) 2026-06-21 claude: Scope firewall and attention-ROI gate were implemented to prevent scope creep and maintain focus. [scope firewall, attention-ROI gate, project management]
- (5) 2026-06-21 claude: Phase E2 requires 11 data/control apps as thin React wrappers over the existing FastAPI /api/* contract plus one new endpoint GET /api/or. [SAMAGRA OS, Phase E2, React, FastAPI]
- (5) 2026-06-21 claude: A bug exists: the Questions app displays simulation IDs instead of the question search interface; this will be addressed in a future session. [bug, sim IDs, question search]
- (5) 2026-06-20 claude: New design direction for TeachingOS based on 'Web OS GUI design.zip' is the immediate next priority. [design, priority, project]
- (5) 2026-06-20 claude: All OS themes must include right-click functionality. [right-click, functionality, themes]
- (5) 2026-06-20 claude: Windows in the OS must be draggable. [draggable, windows, UI]
- (5) 2026-06-19 claude: Phase 0 executed: repo renamed from teachingos to samagra, Python package renamed, catalog rebuilt to 7,044 artifacts, 11/11 tests green, docs rebranded. [SAMAGRA, teachingos, rename, catalog, tests, docs]
- (5) 2026-06-19 claude: Used a subagent team with a judge agent to debate the Samagra vision over two rounds. [subagent team, judge agent, deliberation]
- (5) 2026-06-19 claude: Produced 10 concrete suggestions for improving the future vision direction based on the current intent. [suggestions, vision direction]
- (5) 2026-06-18 claude: The final plan was recorded using `cbm record-plan docs/superpowers/plans/2026-06-19-samagra-evolution.md --title 'SAMAGRA Evolution'`. [cbm, record-plan, plan storage]
- (5) 2026-06-18 claude: TeachingOS is designed to automate the creation of JEE/NEET physics educational content from handwritten notes to multiple output formats including lectures, booklets, and question banks. [TeachingOS, JEE/NEET, content pipeline]
- (4) 2026-06-24 claude: Existing lectures and content serve as the seed for the new cross-linked, catalogued content system. [content reuse, seed data, cross-linking]
- (4) 2026-06-24 claude: Phase C was split into sub-tasks C1 (deck) and C2 for incremental implementation. [phase planning, subtasks, decomposition]
- (4) 2026-06-23 codex: No new critical issues introduced by remediation; code maintains existing test coverage. [regression, test coverage]
- (4) 2026-06-23 codex: The review inspected the diff from commit bb88bd8 to 69cfd51 on the feature/content-factory-phase1 branch. [git diff, code review]
- (4) 2026-06-23 claude: Implementation plan recorded to docs/superpowers/plans/2026-06-22-phase3-active-loop.md via cbm record-plan. [implementation plan, record-plan, cbm]
- (4) 2026-06-23 claude: Subagent-driven development pattern used: each task delegated to a fresh subagent with isolated context. [subagent-driven development, task delegation, isolated context]
- (4) 2026-06-23 claude: Final step: review then merge branch, serve on localhost for checks. [merge, review, localhost, verification]
- (4) 2026-06-22 claude: Use 'cbm snap pre' (or full path) before commit to take snapshot and auto-enroll in cbm registry. [cbm, snapshot]
- (4) 2026-06-22 claude: Post-audit hardening passed all tests: 229 pytest, 559 vitest. [tests, hardening]
- (4) 2026-06-22 claude: Completed adversarial code review and codex analysis of TeachingOS codebase. [code review, adversarial review]
- (4) 2026-06-22 claude: User created an application deployment policy for SAMAGRA OS. [SAMAGRA OS, deployment policy]
- (4) 2026-06-22 claude: User created an access policy for SAMAGRA OS. [SAMAGRA OS, access policy]
- (4) 2026-06-22 claude: The user created an application policy for deployment. [SAMAGRA OS, deployment, policy]
Deep recall: C:\SandBox\claude_box\memboxes\scribe\bin\scribe.cmd q "<topic>"
<!-- scribe:end -->
