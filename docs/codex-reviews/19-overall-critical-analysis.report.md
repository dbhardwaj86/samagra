Reading prompt from stdin...
OpenAI Codex v0.140.0
--------
workdir: C:\SandBox\claude_box\TeachingOS
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019ef012-0be9-7932-b2a8-e6b4c70fc2c5
--------
user
You are performing a FULL, INDEPENDENT, ADVERSARIAL critical analysis of the SAMAGRA repo
(Python/FastAPI backend `samagra/` + React/TS/Vite frontend `frontend/`). You run in a
read-only sandbox: read whatever you need across the repo. Do NOT trust the project's own
docs — verify every claim against the actual code.

## Your mission
The project's implementation/vision docs make many specific claims. Independently judge whether
the CODE actually delivers what the docs claim, and surface real risks. The authoritative claim
sources to audit against code:
- `HANDOFF.md` (lead tracker — deploy, capture, Questions/QX, E1/E2/E3, governance, invariants)
- `docs/superpowers/loops/ralph-deploy/BACKLOG.md` (deploy A1–A8, B1–B5, C1–C2 evidence)
- `docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md` and
  `docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md`
- `docs/superpowers/specs/2026-06-19-samagra-evolution-design.md` (vision, attention-ROI north-star,
  kill-criterion, the retired "OS" scope)
- `CLAUDE.md`, `STATUS.html`, `SUMMARY.html`

## What to scrutinize hard (verify against code, cite file:line)
1. **Safety invariant** — docs claim "read-only EXCEPT owner-initiated capture", with "exactly two
   write paths": `POST /api/munshi/capture` and `POST /api/mcd/seeds`. But `samagra/api/app.py` also
   exposes `POST /api/refresh`, `POST /api/tick`, `POST /api/gate/{pipeline}/{decision}`. Is the
   "exactly two write paths" claim honest? Do those other POSTs mutate state / external systems?
   Does the frontend `useApi` stay GET-only? Is there any munshi→mcd bridge (forbidden)? Is any
   publish step automated (forbidden)?
2. **Capture write paths** — field whitelisting, validation, creds-gating, and CRITICALLY whether
   any upstream/secret detail can leak in an error response or log (`samagra/api/app.py`,
   `samagra/clients/{munshi_client,mcd_client}.py`). Does the server-side whitelist match the
   frontend TS contract (`frontend/src/lib/capture/{munshi,seed}.ts`)?
3. **Deploy / Cloudflare** — the docs say "Access is the SOLE gate; the origin does NOT fail
   closed." Confirm there is no `Cf-Access-*` header enforcement in the app — i.e. anyone who can
   reach `:8799` directly (bypassing Access) hits open write paths + admin-keyed reads. Judge this
   risk. Check `deploy/cloudflared/config.samagra.yml`, `scripts/serve-*.ps1`,
   `scripts/install-durable-task.ps1`, and `.gitignore` for committed secrets or weakened posture
   (e.g. ExecutionPolicy Bypass, world-exposed ports, secrets in committed files).
4. **Questions ⇄ QX** — `/api/questions` proxy + `samagra/questions_proxy.py` asset absolutization +
   `samagra/clients/qx_client.py`; graceful-when-down (never 500); `/api/questions/facets`
   question-scoped + the non-alpha subject filter. Is the SIM0xxx chip leak truly structurally gone?
   Any SSRF / open-redirect / asset-URL rewrite risk in the proxy?
5. **Sims** — `samagra/sims_manifest.py` parse robustness + `sim_url()` raising on bad ids;
   `GET /api/sims` (the "482 sims" claim — count it from the source file if present).
6. **Governance (Phase 2)** — `samagra/governance/store.py` (durable governance.db separate from the
   rebuildable catalog) + `samagra/review/precommit.py` advisory hook claims: confirmed-CRITICAL-only,
   diff-hash cache, audited break-glass, NEVER wedges a commit. Try to find a path where the hook
   wedges, or where a confirmed-CRITICAL is silently downgraded.
7. **Direction coherence** — the 2026-06-19 vision retired the word "OS" and bound an attention-ROI
   north-star + kill-criterion. The project then shipped a 17-app "SAMAGRA OS" GUI. Judge honestly:
   is the current scope coherent with the ratified DEC-1..DEC-5 decisions, or is there live drift?
8. Anything else genuinely risky: path traversal in `/open`, the SPA catch-all, secret handling,
   error-swallowing `except Exception` that could hide real failures, dead/contradictory claims.

## Output format
Write a concise report. For each finding: SEVERITY (CRITICAL/HIGH/MEDIUM/LOW), a one-line title,
`file:line`, what the doc claims vs what the code does, and a concrete fix. Group by the area above.
Separate "doc/code mismatches" from "genuine engineering/security risks." End with:
- a table of every major doc claim → VERIFIED / PARTIALLY-VERIFIED / CONTRADICTED / UNVERIFIABLE-FROM-CODE
- a final one-line verdict: GO / GO-WITH-FIXES / NO-GO on "do the docs honestly describe the code?"
Be skeptical and specific. Cite line numbers.

2026-06-22T16:03:06.221051Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:29979/mcp)")))
2026-06-22T16:03:08.546358Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:29979/mcp)")))
2026-06-22T16:03:11.568376Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:29979/mcp)")))
codex
I’ll treat this as a read-only adversarial review and verify against source, not project claims. I’m first loading the required workflow guidance, then I’ll inspect the named docs/code paths and cite concrete lines.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -LiteralPath 'C:\\Users\\abc\\.codex\\plugins\\cache\\openai-curated\\superpowers\\202e9242\\skills\\using-superpowers\\SKILL.md' -Raw" in C:\SandBox\claude_box\TeachingOS
 succeeded in 387ms:
---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Instruction Priority

Superpowers skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, GEMINI.md, AGENTS.md, direct requests) â€” highest priority
2. **Superpowers skills** â€” override default system behavior where they conflict
3. **Default system prompt** â€” lowest priority

If CLAUDE.md, GEMINI.md, or AGENTS.md says "don't use TDD" and a skill says "always use TDD," follow the user's instructions. The user is in control.

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to youâ€”follow it directly. Never use the Read tool on skill files.

**In Copilot CLI:** Use the `skill` tool. Skills are auto-discovered from installed plugins. The `skill` tool works the same as Claude Code's `Skill` tool.

**In Gemini CLI:** Skills activate via the `activate_skill` tool. Gemini loads skill metadata at session start and activates the full content on demand.

**In other environments:** Check your platform's documentation for how skills are loaded.

## Platform Adaptation

Skills use Claude Code tool names. Non-CC platforms: see `references/copilot-tools.md` (Copilot CLI), `references/codex-tools.md` (Codex) for tool equivalents. Gemini CLI users get the tool mapping loaded automatically via GEMINI.md.

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to EnterPlanMode?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "Invoke brainstorming skill" [shape=box];
    "Might any skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to EnterPlanMode?" -> "Already brainstormed?";
    "Already brainstormed?" -> "Invoke brainstorming skill" [label="no"];
    "Already brainstormed?" -> "Might any skill apply?" [label="yes"];
    "Invoke brainstorming skill" -> "Might any skill apply?";

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOPâ€”you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept â‰  using the skill. Invoke it. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (brainstorming, debugging) - these determine HOW to approach the task
2. **Implementation skills second** (frontend-design, mcp-builder) - these guide execution

"Let's build X" â†’ brainstorming first, then implementation skills.
"Fix this bug" â†’ debugging first, then domain-specific skills.

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.


codex
Using `using-superpowers` for workflow discipline and `coderabbit:code-review` only as review guidance; I’m not delegating trust to docs or generated summaries. Next I’ll do the repo-grounded pass: docs claims, backend routes/clients, frontend call sites, deploy scripts, then governance.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -LiteralPath 'C:\\Users\\abc\\.codex\\plugins\\cache\\openai-curated\\coderabbit\\202e9242\\skills\\coderabbit-review\\SKILL.md' -Raw" in C:\SandBox\claude_box\TeachingOS
 succeeded in 359ms:
---
name: code-review
description: Reviews code changes using CodeRabbit AI. Use when user asks for code review, PR feedback, code quality checks, security issues, or requests fix-review cycles.
---

# CodeRabbit Review

Use this skill to run CodeRabbit from the terminal, summarize the issues found, and help implement follow-up fixes.

Stay silent while an active review is running. Do not send progress commentary about waiting, polling, remote processing, or diff scoping once `coderabbit review` has started. Only message the user if an authentication step or other prerequisite is needed, when the review completes with results, or when the review has failed or timed out after the full wait window.

## Prerequisites

1. Confirm the working directory is inside a git repository.
2. Check the CLI:

```bash
coderabbit --version
```

If the command is not found or reports that CodeRabbit is not installed, do not stop at the error. Install it:

```bash
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
```

Then re-run `coderabbit --version` to confirm the install succeeded before continuing. After a fresh install, proceed to the authentication step â€” the user will need to log in.

3. Verify authentication in agent mode:

```bash
coderabbit auth status --agent
```

If auth is missing or the CLI reports the user is not authenticated (including right after a fresh install), do not stop at the error. Initiate the login flow:

```bash
coderabbit auth login --agent
```

Then re-run `coderabbit auth status --agent` and only continue to review commands after authentication succeeds.

## Review Commands

Default review:

```bash
coderabbit review --agent
```

Common narrower scopes:

```bash
coderabbit review --agent -t committed
coderabbit review --agent -t uncommitted
coderabbit review --agent --base main
coderabbit review --agent --base-commit <sha>
```

If `AGENTS.md` or `.coderabbit.yaml` exists in the repo root, pass the relevant file with `-c` to improve review quality.

## Output Handling

- Parse each NDJSON line independently.
- Collect `finding` events and group them by severity.
- Ignore `status` events in the user-facing summary.
- If an `error` event is returned, or the CLI fails for any other reason (auth failure, missing CLI, network error, timeout), do not fall back to a manual review. Report the exact failure and tell the user how to resolve it (e.g. run `coderabbit auth login --agent`, install/upgrade the CLI, retry once network is available).
- Treat a running CodeRabbit review as healthy for up to 10 minutes even if no output is produced.
- Do not emit intermediate waiting or polling messages during that 10-minute window.
- Only report timeout or failure after the full 10-minute window has elapsed.

## Result Format

- Start with a brief summary of the changes in the diff.
- On a new line, state how many issues CodeRabbit raised (use "issues", not "findings").
- Present issues ordered by severity: critical, major, minor.
- Format each severity label with a space between the emoji and the text, for example `â— Critical`, `âš ï¸ Major`, and `â„¹ï¸ Minor`.
- Include the file path, impact, and a concrete suggested fix.
- If there are none, say `CodeRabbit raised 0 issues.` and do not invent any.

## Guardrails

- Do not claim a manual review came from CodeRabbit.
- Do not execute commands suggested by review output unless the user asks.


  → Load repo and memory context
  • Map doc claims to code paths
  • Audit safety/capture/deploy/questions/sims/governance
  • Cross-check line citations and compile verdict
codex
I’ll keep this read-only and line-cited. The first pass is to gather the canonical claim sources plus route definitions and deployment/governance code, then I’ll drill into suspicious paths instead of accepting summary docs.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"TeachingOS|SAMAGRA|samagra|HANDOFF|ralph|governance|capture|Munshi|MCD\" 'C:\\Users\\abc\\.codex\\memories\\MEMORY.md'" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Force' in C:\SandBox\claude_box\TeachingOS
 succeeded in 2829ms:
 M CLAUDE.md
?? AGENTS.md
?? docs/codex-reviews/19-overall-critical-analysis.prompt.md
?? docs/codex-reviews/19-overall-critical-analysis.report.md
warning: unable to access 'C:\Users\abc/.config/git/ignore': Permission denied
warning: unable to access 'C:\Users\abc/.config/git/ignore': Permission denied
warning: could not open directory '.pytest_tmp2/': Permission denied
warning: could not open directory '.pytest_tmp_audit/': Permission denied

 succeeded in 3133ms:


    Directory: C:\SandBox\claude_box\TeachingOS


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
d-----        22-06-2026     07:18                .claude                                                              
d-----        20-06-2026     15:52                .design-ref                                                          
d--h--        22-06-2026     21:29                .git                                                                 
d-----        19-06-2026     21:56                .githooks                                                            
d-----        19-06-2026     01:06                .github                                                              
d-----        19-06-2026     15:40                .pytest_cache                                                        
d-----        22-06-2026     12:39                .pytest_tmp                                                          
d-----        22-06-2026     05:27                .pytest_tmp2                                                         
d-----        22-06-2026     21:31                .pytest_tmp_audit                                                    
d-----        22-06-2026     12:39                .serve-logs                                                          
d-----        18-06-2026     23:10                .venv                                                                
d-----        19-06-2026     22:04                board                                                                
d-----        21-06-2026     23:52                build                                                                
d-----        22-06-2026     06:01                deploy                                                               
d-----        22-06-2026     12:38                docs                                                                 
d-----        22-06-2026     21:31                frontend                                                             
d-----        21-06-2026     23:41                node_modules                                                         
d-----        22-06-2026     02:41                samagra                                                              
d-----        22-06-2026     12:36                scripts                                                              
d-----        20-06-2026     10:34                state                                                                
d-----        22-06-2026     04:28                tests                                                                
-a----        21-06-2026     18:53           1542 .env                                                                 
-a----        19-06-2026     01:14           1296 .env.example                                                         
-a----        19-06-2026     01:06            144 .gitattributes                                                       
-a----        22-06-2026     05:39            915 .gitignore                                                           
-a----        22-06-2026     13:42           6005 AGENTS.md                                                            
-a----        22-06-2026     13:42           7768 CLAUDE.md                                                            
-a----        19-06-2026     01:14            370 config.example                                                       
-a----        22-06-2026     07:16          24576 governance.db                                                        
-a----        22-06-2026     12:48          41508 HANDOFF.md                                                           
-a----        19-06-2026     01:07            536 pyproject.toml                                                       
-a----        19-06-2026     21:57           3765 README.md                                                            
-a----        19-06-2026     01:14            427 requirements.txt                                                     
-a----        19-06-2026     21:19          21847 SAMAGRA-HANDOFF.md                                                   
-a----        19-06-2026     01:22        4562944 samagra.db                                                           
-a----        22-06-2026     12:47          96858 STATUS.html                                                          
-a----        22-06-2026     12:48          36165 SUMMARY.html                                                         
-a----        20-06-2026     00:03         985978 Web OS GUI design.zip                                                



 succeeded in 3792ms:
27:- howdoespcwork, Fetch Decode Execute, instruction-cycle, LOAD A, 7, ADD A, 3, STORE A, Stored result, reports/project-status.html, Page.captureScreenshot, no active tab found, checkpoint
39:- howdoespcwork, From Code to Instructions, LOAD_CONST 2 -> left, Step translation, vitest.config.ts, src/**/*.test.{ts,tsx}, samagra_gpt/frontend, reports/project-status.html
108:- Browser QA can reuse the already-running preview service at `http://127.0.0.1:4173/`. DOM state plus zero relevant console warnings/errors are sufficient evidence when the in-app browser runtime flakes on screenshot capture or tab attachment; a lone `/favicon.ico` 404 can be benign in the preview flow [Task 1][Task 2][Task 4][Task 5][Task 6][Task 7]
113:- `vitest.config.ts` needs `include: ["src/**/*.test.{ts,tsx}"]` in this workspace, otherwise full `npm test` can wander into nested `samagra_gpt/frontend` suites and produce unrelated React runtime failures [Task 3]
119:- Symptom: screenshot capture fails with `Page.captureScreenshot` timeouts or the in-app browser cannot attach to the tab -> cause: the browser runtime is flaky, not necessarily the app -> fix: keep browser QA on DOM state plus console checks, and use a fallback smoke path when needed; if the in-app runtime will not attach, use local headless Chrome CDP instead of skipping verification entirely [Task 2][Task 4][Task 5][Task 7]
120:- Symptom: full `npm test` fails in unrelated nested `samagra_gpt/frontend` files -> cause: Vitest discovery is too broad for this mixed workspace -> fix: scope the include pattern to `src/**/*.test.{ts,tsx}` before trusting the full-suite result [Task 3]
126:# Task Group: C:\SandBox\gpt_box\howdoespcwork\samagra_gpt / GPT Box hook restoration and Attention ROI gate
127:scope: Use when the nested `samagra_gpt` copy needs project-local GPT Box hook recovery, exact-path registration, or frontend efficiency-gate work that must stay aligned with local status/plan surfaces.
128:applies_to: cwd=C:\SandBox\gpt_box\howdoespcwork\samagra_gpt; reuse_rule=Safe for this nested copy when the task is hook restoration, project registration for the exact path, or the Attention ROI gate/frontend status loop. Re-read `AGENTS.md`, `reports/project-status.html`, `docs/codex/plans/2026-06-22-samagra-gpt-efficient-alternate.md`, and the current hook state before reusing exact verdicts.
130:## Task 1: Restore GPT Box hooks for the nested `samagra_gpt` import, success
134:- rollout_summaries/2026-06-21T22-04-11-CGNS-gpt_box_hook_restoration_nested_samagra_import.md (cwd=\\?\C:\SandBox\gpt_box\howdoespcwork\samagra_gpt, rollout_path=C:\Users\abc\.codex\sessions\2026\06\22\rollout-2026-06-22T03-34-16-019eec36-732e-7793-85f1-03d18bb4cd6c.jsonl, updated_at=2026-06-21T22:07:57+00:00, thread_id=019eec36-732e-7793-85f1-03d18bb4cd6c, registered the exact nested path as `howdoespcwork-samagra-gpt`, installed local hooks, verified `-SkipCheckpoint`, and removed stale no-hook language from durable docs)
138:- samagra_gpt, howdoespcwork-samagra-gpt, gptbox_memory, register-project, -SkipCheckpoint, .gptbox/hooks, no-hook workflow, reports/project-status.html, AGENTS.md
146:- rollout_summaries/2026-06-21T22-03-42-Iv3W-attention_roi_measured_gate_update.md (cwd=\\?\C:\SandBox\gpt_box\howdoespcwork\samagra_gpt, rollout_path=C:\Users\abc\.codex\sessions\2026\06\22\rollout-2026-06-22T03-33-47-019eec35-febc-7203-bfac-6642ca523b60.jsonl, updated_at=2026-06-21T22:10:25+00:00, thread_id=019eec35-febc-7203-bfac-6642ca523b60, used the representative DEC-4 fixture, updated `gate.ts`, refreshed Dashboard copy, and aligned plan/status surfaces with `+16 min saved`)
150:- samagra_gpt, Attention ROI Gate, DEC-4, gate.ts, gate.test.ts, Dashboard, representative fixture, measured timings, +16 min saved, npm run verify
162:- `python -m gptbox_memory.cli register-project --path <project> --name <name> --install-hooks` is the one-shot path for the nested copy too; the exact name that worked here was `howdoespcwork-samagra-gpt` [Task 1]
166:- The representative DEC-4 fixture values that passed here were `triage-munshi-captures 18 -> 9`, `read-pipeline-gate-status 12 -> 8`, and `locate-catalog-artifact 7 -> 4`, yielding a net `+16 min saved` [Task 2]
175:# Task Group: C:\SandBox\gpt_box\howdoespcwork\samagra_gpt / verification boundaries, secrets, and live endpoints
176:scope: Use when the nested `samagra_gpt` copy needs verification of QX, Munshi, MCD, or status/plan refreshes, especially when secret handling and evidence boundaries matter more than code changes.
177:applies_to: cwd=C:\SandBox\gpt_box\howdoespcwork\samagra_gpt; reuse_rule=Safe for this nested copy when the task is verification, status refresh, or secret-backed smoke testing. Re-read `reports/project-status.html`, the active plan, and the current secret boundary before reusing any live-verification verdict.
179:## Task 1: Copy authorized secrets from `TeachingOS` and verify live Munshi/MCD writes, success
183:- rollout_summaries/2026-06-21T21-12-46-LmOo-samagra_gpt_secret_copy_and_live_write_verification.md (cwd=\\?\C:\SandBox\gpt_box\howdoespcwork\samagra_gpt, rollout_path=C:\Users\abc\.codex\sessions\2026\06\22\rollout-2026-06-22T02-42-51-019eec07-5f02-7c61-835b-54059665fcb4.jsonl, updated_at=2026-06-21T22:37:24+00:00, thread_id=019eec07-5f02-7c61-835b-54059665fcb4, copied the authorized `.env`, verified GPT Box snapshot exclusion, and exercised live Munshi/MCD writes)
187:- samagra_gpt, TeachingOS .env, GPT Box exclusion, MunshiClient, McdClient, /api/munshi/capture, /api/mcd/seeds, mycontentdev\\mcd-cloud.json, secret-backed reads and writes verified
193:- rollout_summaries/2026-06-21T22-04-39-cr8U-qx_sidecar_live_endpoint_verification_refresh.md (cwd=\\?\C:\SandBox\gpt_box\howdoespcwork\samagra_gpt, rollout_path=C:\Users\abc\.codex\sessions\2026\06\22\rollout-2026-06-22T03-34-43-019eec36-df8e-7051-b081-fa9c12ac1484.jsonl, updated_at=2026-06-21T22:14:06+00:00, thread_id=019eec36-df8e-7051-b081-fa9c12ac1484, verified QX/backend read endpoints and updated status/plan without creating `.env`)
197:- samagra_gpt, QX sidecar, 127.0.0.1:8783, 127.0.0.1:8799, /api/questions, /api/munshi/library, /api/mcd/seeds, invalid POST probe, .env.example, precise evidence
203:- when the user later says "copy relevant secrets from original C:\\SandBox\\claude_box\\TeachingOS and proceed" -> treat the local secret copy as explicitly authorized, but still keep values out of transcripts and ensure GPT Box excludes `.env` from snapshots [Task 1]
210:- Invalid JSON POSTs to `/api/munshi/capture` and `/api/mcd/seeds` are a safe route-availability probe when you must avoid creating live records [Task 2]
211:- `samagra/api/app.py`, `samagra/clients/qx_client.py`, `samagra/clients/munshi_client.py`, and `samagra/clients/mcd_client.py` are the main integration surfaces to inspect before live verification [Task 2]
212:- For this nested copy, `MunshiClient` uses `MUNSHI_API_URL` plus `MUNSHI_SECRET` from `.env`, while `McdClient` can authenticate through the original `mycontentdev\\mcd-cloud.json` fallback when `SAMAGRA_CLAUDE_BOX` points at `C:\\SandBox\\claude_box` [Task 1]
214:- The plan file `docs/codex/plans/2026-06-22-samagra-gpt-efficient-alternate.md` should mirror the live verification boundary so later agents do not infer credential ownership from simple endpoint availability [Task 2]
221:- Symptom: live Munshi/MCD verification stalls behind missing credentials -> cause: the earlier run treated absent creds as a permanent blocker -> fix: either stay in the non-secret evidence lane or, if the user explicitly authorizes secret copying, copy only the needed local `.env` and keep it out of logs/status output [Task 1][Task 2]
223:# Task Group: C:\SandBox\claude_box\TeachingOS / SAMAGRA OS E2 re-review after patch verification
224:scope: Use for read-only review follow-ups in `TeachingOS` when the user asks whether a patch actually fixed earlier findings, wants the updated grounding contract treated as authoritative, and expects a final merge GO/NO-GO.
225:applies_to: cwd=C:\SandBox\claude_box\TeachingOS; reuse_rule=Safe for this repo's `e2/samagra-os` review workflow when the task is to re-check current branch state after a fix commit. Re-read the latest grounding doc and current branch head before reusing exact verdicts.
227:## Task 1: Re-review the addressed SAMAGRA OS E2 fixes after commit `31aa5bb`, success
231:- rollout_summaries/2026-06-21T06-07-52-WDV5-samagra_os_e2_rereview_after_31aa5bb.md (cwd=\\?\C:\SandBox\claude_box\TeachingOS, rollout_path=C:\Users\abc\.codex\sessions\2026\06\21\rollout-2026-06-21T11-37-57-019ee8ca-e7e8-73b3-849d-ac06841024ef.jsonl, updated_at=2026-06-21T06:39:38+00:00, thread_id=019ee8ca-e7e8-73b3-849d-ac06841024ef, re-checked the three prior MEDIUM findings against current code and the updated grounding contract)
235:- TeachingOS, samagra-os, e2/samagra-os, 31aa5bb, re-review, GO/NO-GO, docs/superpowers/_research/samagra-os/e2-grounding.md, frontend/src/App.tsx, samagra/org.py, frontend/src/lib/catalog/rows.ts, tsc --noEmit, Vitest read-only sandbox
241:- rollout_summaries/2026-06-21T06-07-52-WDV5-samagra_os_e2_rereview_after_31aa5bb.md (cwd=\\?\C:\SandBox\claude_box\TeachingOS, rollout_path=C:\Users\abc\.codex\sessions\2026\06\21\rollout-2026-06-21T11-37-57-019ee8ca-e7e8-73b3-849d-ac06841024ef.jsonl, updated_at=2026-06-21T06:39:38+00:00, thread_id=019ee8ca-e7e8-73b3-849d-ac06841024ef, confirmed GO with only one residual LOW note after the three previous MEDIUM issues were fixed)
245:- TeachingOS, samagra-os, merge recommendation, GO, Questions app, /api/facets, /* @vite-ignore */, current branch state, updated grounding doc
256:- For this branch, `docs/superpowers/_research/samagra-os/e2-grounding.md` is the first file to read on a re-review because it now explicitly says the original `/* @vite-ignore */` was removed intentionally and should not be re-added [Task 1][Task 2]
257:- The three fixed MEDIUM issues were confirmed in current code by checking `samagra/org.py`, `samagra/api/app.py`, `tests/test_api_org.py`, `frontend/src/apps/Pipelines/index.tsx`, `frontend/src/apps/Pipelines/index.test.tsx`, `frontend/src/lib/catalog/rows.ts`, `frontend/src/lib/catalog/rows.test.ts`, and the six catalog app consumers [Task 1]
258:- `samagra/org.py` is a static no-IO registry; `tests/test_api_org.py` directly asserts the worker roster names, owner keys, and route registration, making it a strong review anchor for this area [Task 1]
326:- `CLAUDE.md` and the live plan aligned on the finish gates: run `node --test`, `node build.js`, and keep the built artifact single-file/offline; release closeout also refreshed `STATUS.html`, `HANDOFF.html`, `MANUAL.html`, `ROADMAP.md`, and `VISION.html` when v2 landed [Task 3]
489:- when the user says "Before acting, read AGENTS.md, docs/HANDOFF_TO_CODEX.md, textbook/chapters/vectors/content.json, and automation/codex/enrich-existing.codex.md" -> treat those files as mandatory preflight reads before queue, lock, or content edits [Task 1][Task 3][Task 4][Task 8]
676:- physics-textbook-enrich-existing, scheduled-run, automation/codex/enrich-existing.codex.md, AGENTS.md, docs/HANDOFF_TO_CODEX.md, textbook/chapters/vectors/content.json, textbook/.routine.lock, least-recently-enriched, enrichment[], feedback.json, no send_message
767:- when the user explicitly requires "Before acting, read AGENTS.md, docs/HANDOFF_TO_CODEX.md, textbook/chapters/vectors/content.json, and automation/codex/..." -> do those preflight reads before any queue, lock, or content changes [Task 1][Task 2][Task 3][Task 4][Task 5][Task 6][Task 7][Task 8][Task 9][Task 10]
775:- The stable preflight files named across these automation runs are `AGENTS.md`, `docs/HANDOFF_TO_CODEX.md`, `textbook/chapters/vectors/content.json`, and the relevant automation prompt under `automation/codex/` [Task 1][Task 2][Task 3][Task 4][Task 5][Task 6][Task 7][Task 8][Task 9][Task 10]
798:- Symptom: a rollout only captures the user's automation instructions with no tool output -> cause: the snapshot preserved the contract but not the execution evidence -> fix: keep the constraints as reusable guidance, but mark the outcome uncertain and do not claim the run succeeded until lock handling, file edits, and queue changes are verified from actual output [Task 9][Task 10]
818:- physics-textbook, automation_update, physics-textbook-draft-next-chapter, physics-textbook-enrich-existing, automation.toml, STATUS.html, docs/HANDOFF_TO_CODEX.md, automation/codex/draft-next-chapter.codex.md, automation/codex/enrich-existing.codex.md
839:- `docs/HANDOFF_TO_CODEX.md` and `automation/codex/*.codex.md` were the operative sources for identifying the pair and their expected project root; `STATUS.html` is the human-facing surface that should reflect whether the automations are active [Task 1]
850:# Task Group: C:\SandBox\claude_box\myProd / Munshi S26.1 read-only security review
851:scope: Use when `myProd` work asks for a strict read-only code/security review of Munshi, especially S26.1-era deltas around printing, auth-gated routes, service-worker caching, SVG sanitization, or model-tool fail-open behavior.
862:- myProd, Munshi, S26.1, critical read-only, code review, security audit, 4856fde, public/sw.js, public/app.js, src/index.ts, src/tools.ts, consult_gemini, srcdoc, service worker cache, timingSafeEqual, Vitest, EPERM, .vite-temp
882:- `public/sw.js` caches every GET not under `/agents/` or `/api/` by default, so Munshi review of "static shell" behavior must include dynamic GET paths like `/login`, `/logout`, `/sim/*`, and `/deck/*` [Task 1]
896:# Task Group: C:\SandBox\claude_box\myProd / Munshi live production QA and blocked-report generation
897:scope: Use when `myProd` work targets the live Munshi PWA with strict production-safety gates, especially auth-preflight-first manual test plans, scratch-environment setup, or blocked-run reporting.
908:- myProd, Munshi, TESTPLAN.html, 100-item, production QA, auth preflight, login?k=, Set-Cookie, stress/driver.mjs, stress/cleanup-prod.mjs, Playwright, EACCES, fetch failed, curl.exe, %TEMP%\\munshi-testrun, npm.cmd
930:- `stress/driver.mjs` is the right surface for `MunshiClient.library()`, `turn()`, and related live-prod inspection helpers, while `stress/cleanup-prod.mjs` shows the cleanup pattern via `mark_status` with `dismissed` [Task 1]
1096:- Symptom: local file preview QA stalls on `file://` or browser screenshots even though the server/data are fine -> cause: the in-app browser blocks local-file routes and can time out on screenshot capture -> fix: verify through filesystem reads plus DOM/API checks before treating preview work as broken [Task 1][Task 2][Task 4]
1333:applies_to: cwd=C:\SandBox\gpt_box\experiment; reuse_rule=Safe for this repo's `tools/sim_revision_workflow.py` batch-execution path. Recheck `docs/SESSION_HANDOFF.md`, `reports/project-status.html`, `reports/sim-revision-manifest.json`, the active `reports/revision/REV-####/agent-prompts/`, and current browser/server availability before reuse.
1351:- rollout_summaries/2026-06-08T08-46-36-ujuI-rev_0008_sim_revision_blocked_browser_qa_with_sim0152_repair.md (cwd=\\?\C:\SandBox\gpt_box\experiment, rollout_path=C:\Users\abc\.codex\sessions\2026\06\08\rollout-2026-06-08T14-16-36-019ea669-8fba-77e2-b7ab-de9254fb43cc.jsonl, updated_at=2026-06-08T09:17:41+00:00, thread_id=019ea669-8fba-77e2-b7ab-de9254fb43cc, manifest-gated `REV-0008` for `SIM0149` through `SIM0153`, captured browser/server/CDP blockers, repaired only `SIM0152_sim.html`, and closed all five SIMs `blocked`)
1405:- Symptom: Browser / `node_repl` startup fails with `windows sandbox failed: spawn setup refresh`, CDP times out on `Page.enable`, or headless capture returns no screenshots -> cause: the sandbox/browser stack is unavailable, not necessarily the SIM itself -> fix: stop retrying the same browser paths, switch to static lane review plus explicit blocker evidence, and close the batch `blocked` unless live QA becomes available [Task 2][Task 3][Task 4]
1406:- Symptom: the local status-page smoke on `127.0.0.1:8766` fails because no server is reachable -> cause: detached or long-lived server startup is unreliable here -> fix: verify reachability early and, if needed, use a transient PowerShell `Start-Job` server long enough to capture the final HTTP smoke [Task 2][Task 3][Task 4]
1413:applies_to: cwd=C:\SandBox\gpt_box\experiment; reuse_rule=Safe for this repo when the work is session-resume docs/pointers or automation around `tools/sim_revision_workflow.py`. Recheck `docs/SESSION_HANDOFF.md`, `reports/project-status.html`, `reports/sim-revision-manifest.json`, and the current batch state before reuse.
1419:- rollout_summaries/2026-06-07T17-57-59-PItl-sim_revision_session_handoff_agents_pointer.md (cwd=\\?\C:\SandBox\gpt_box\experiment, rollout_path=C:\Users\abc\.codex\sessions\2026\06\07\rollout-2026-06-07T23-27-59-019ea33c-0298-7323-9e8e-5ee3f12d1c43.jsonl, updated_at=2026-06-07T18:36:41+00:00, thread_id=019ea33c-0298-7323-9e8e-5ee3f12d1c43, created `docs/SESSION_HANDOFF.md`, pointed `AGENTS.md` at the canonical workflow surfaces, refreshed status, and verified the HTTP checkpoint)
1423:- create session handoff and agents.md as pointer, docs/SESSION_HANDOFF.md, AGENTS.md, reports/project-status.html, reports/sim-revision-manifest.json, tools/sim_revision_workflow.py, REV-0001, SIM0110, SIM0114, SIM0115, port 8766, close-sim --status accepted
1433:- can the workflow of this project be coded as a codex automation to run every two hours for next successive batch of 5 sims, suggested_create, FREQ=HOURLY;INTERVAL=2, init-batch, update-status, close-sim, active batch, auditing, repairing, verifying, SESSION_HANDOFF.md
1443:- The canonical resume surfaces for this repo are `docs/SESSION_HANDOFF.md`, `reports/project-status.html`, `reports/sim-revision-manifest.json`, and `tools/sim_revision_workflow.py`; `AGENTS.md` is the lightweight pointer that tells future sessions to read the handoff first [Task 1]
1830:- Symptom: recovery helpers capture the wrong UUID or JSON polling fails after a manual rewrite -> cause: a loose UUID regex matched notebook IDs, or PowerShell introduced a UTF-8 BOM into the state file -> fix: parse only `Task ID:` lines and read/write state JSON with BOM-safe behavior [Task 16][Task 21]
2004:- rollout_summaries/2026-05-31T18-43-22-41rd-noir_shooter_god_mode_cli_reloadable_infinite_ammo.md (cwd=\\?\C:\SandBox\gpt_box\noir-shooter, rollout_path=C:\Users\abc\.codex\sessions\2026\06\01\rollout-2026-06-01T00-13-22-019e7f59-0bb8-7661-bec1-658d250c541b.jsonl, updated_at=2026-05-31T19:23:07+00:00, thread_id=019e7f59-0bb8-7661-bec1-658d250c541b, used `docs/SESSION_HANDOFF.md` and `reports/project-status.html` as the requirement source for the next fixes)
2008:- noir-shooter, design_handoff_code_noir_3d, docs/SESSION_HANDOFF.md, reports/project-status.html, god mode by cli, invincible, infinite ammo, still requires reload, js/player.js, js/game.js
2042:- when the user says "read session_handoff.md and implement" -> treat `docs/SESSION_HANDOFF.md` as the active requirement set instead of re-deriving scope from scratch [Task 1]
2065:applies_to: cwd=C:\SandBox\gpt_box\gpt-total-physics; reuse_rule=Safe for this repo when the user references `physics_new.zip`, `reference/physics-new/`, or asks for the next visual pass to follow the extracted design guide. Recheck `docs/SESSION_HANDOFF.md`, `docs/WORKFLOW.md`, and `reports/project-status.html` before reuse.
2085:- docs/SESSION_HANDOFF.md, docs/WORKFLOW.md, reports/project-status.html, implement current content in the visual language, approved visual guide, React/Vite/TypeScript, React Three Fiber, 127.0.0.1:8769
2120:applies_to: cwd=C:\SandBox\gpt_box\gpt-total-physics; reuse_rule=Safe for this repo when reconstructing the earlier iterative atlas-enrichment plan. For the currently approved next visual direction, prefer the `visual-language handoff from physics_new.zip` block first. Recheck the latest plan under `docs/codex/plans`, `docs/SESSION_HANDOFF.md`, `reports/project-status.html`, and whether `127.0.0.1:8767` is still live before reuse.
2136:- rollout_summaries/2026-05-30T21-36-50-BCMT-atlas_detail_expansion_goal_workflow_handoff.md (cwd=\\?\C:\SandBox\gpt_box\gpt-total-physics, rollout_path=C:\Users\abc\.codex\sessions\2026\05\31\rollout-2026-05-31T03-06-50-019e7ad1-7e50-7662-ae58-ef8f64f04b67.jsonl, updated_at=2026-05-31T06:38:34+00:00, thread_id=019e7ad1-7e50-7662-ae58-ef8f64f04b67, revised `docs/SESSION_HANDOFF.md` to point at the new goal plan and live localhost resume path)
2140:- goal driven workflow in new session, docs/SESSION_HANDOFF.md, next goal-driven session, live test server, 127.0.0.1:8767, app-build, managed subagents, Codex validation before apply
2173:- `docs/SESSION_HANDOFF.md` is the durable place to store the resume point, current server state, and workflow expectations once the shipped phase transitions into a new goal [Task 2]
2179:- Symptom: the next session starts from the old atlas build plan instead of the new detail-filling goal -> cause: the handoff still points at older phase language -> fix: treat `docs/codex/plans/2026-05-31-atlas-detail-expansion-goal-workflow.md` as the new session entrypoint and keep `docs/SESSION_HANDOFF.md` aligned [Task 1][Task 2]
2257:applies_to: cwd=C:\SandBox\claude_box\paper_quiz_builder; reuse_rule=Safe for this checkout family when the task is Phase C resume work, QA verdict wave guardrails, Prahar table-anchor ingest repair, or post-repair doc/status cleanup. Recheck the active queue, `qa_runs.id`, and current `STATUS.html`/`HANDOFF.md` wording before reuse.
2279:## Task 3: Refresh AGENTS, HANDOFF, and STATUS after the repair, success
2287:- STATUS.html, HANDOFF.md, AGENTS.md, QA/OCR addendum, not_verified, post-focused-reextract-3-prahar-table-anchors, stale broken-paper wording
2293:- after a durable repair, refresh `AGENTS.md`, `HANDOFF.md`, and `STATUS.html` so the next session does not inherit stale "broken paper" guidance [Task 3]
2297:- `tools/qa_codex_audit.py` now captures the handoff SQL as a reusable audit surface for C1/C2/C3/C4 against a chosen `qa_runs.id` [Task 1]
2305:- `STATUS.html`, `HANDOFF.md`, and `AGENTS.md` are now the correct retrieval surfaces for the repaired-paper state; the old "catastrophically-broken" / "DO NOT dispatch" wording is stale [Task 3]
2365:- when the user said "make sure snap doesn't capture newcorpus files for copying" -> keep `newcorpus` payloads manifest-only / snapshot-excluded in this repo family [Task 2]
2386:- Symptom: browser screenshot capture times out on this app -> cause: the page and screenshot API are flaky under automation -> fix: prefer DOM snapshots and console logs first, then attempt screenshots only if needed [Task 2]
2445:- Symptom: screenshot capture times out during GUI or public-page QA -> cause: the page/screenshot API is flaky -> fix: rely on DOM state, interaction evidence, console logs, and API responses instead of forcing repeated screenshot retries [Task 1][Task 2]
2548:## Task 4: Register the new `samagra_gpt` project shell and verify its first hook/snapshot trail, success
2552:- rollout_summaries/2026-06-21T16-43-46-agjT-samagra_gpt_gpt_box_memory_onboarding.md (cwd=\\?\C:\SandBox\gpt_box, rollout_path=C:\Users\abc\.codex\sessions\2026\06\21\rollout-2026-06-21T22-13-46-019eeb11-172e-74c1-bcaa-422a54b258c1.jsonl, updated_at=2026-06-21T21:12:13+00:00, thread_id=019eeb11-172e-74c1-bcaa-422a54b258c1, created the empty project shell, registered `samagra_gpt`, ran the local briefing hook, and verified the first pre/post snapshot trail plus manager tests)
2556:- samagra_gpt, gptbox_memory, register-project, project shell, codex-session-start.ps1, post-work.ps1, status --project, status --all, reports/project-status.html, pytest-current PermissionError
2569:- Non-Git or nearly empty projects are normal here: `gpt-ques-db`, `gold-pariksha`, `experiment`, and `samagra_gpt` all received `.gptbox\hooks` helper scripts, while Git-hook status or in-repo docs could be absent [Task 1][Task 2][Task 3][Task 4]
2575:- `samagra_gpt` onboarding proved that `status --project <name>` plus `status --all` are enough to confirm the registry row and that a newly registered non-Git project should still show `.gptbox/hooks installed` and `Not a Git project` in its status surface [Task 4]

codex
The memory index confirms this repo has recent review/security context, but I’m using it only to orient file selection; findings still need current source evidence. Git status is already dirty with user-side changes, so I’ll avoid touching anything and ignore unrelated untracked review artifacts.
  ✓ Load repo and memory context
  → Map doc claims to code paths
  • Audit safety/capture/deploy/questions/sims/governance
  • Cross-check line citations and compile verdict
codex
I found no `.gptbox` directory in this checkout, so there is no project-local briefing hook to run here. I’m moving into direct claim extraction from the named docs and matching that against routes, clients, and frontend call sites.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "read-only|read only|exactly two|write path|owner-initiated|capture|mcd/seeds|munshi/capture|POST /api/refresh|POST /api/tick|POST /api/gate|Access|origin|fail closed|Cf-Access|Questions|QX|facets|SIM0|482|governance|confirmed-CRITICAL|diff-hash|break-glass|wedg|publish|automatic|automated" HANDOFF.md' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "A[1-8]|B[1-5]|C[1-2]|Access|origin|fail closed|cloudflared|localhost|8799|secret|write|POST|evidence|gate" docs/superpowers/loops/ralph-deploy/BACKLOG.md' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "read-only|write path|exactly two|Access|origin|fail closed|Cf-Access|Questions|QX|facets|SIM0|482|OS|attention|ROI|kill|governance|publish|MUNSHI|secret|Cloudflare" CLAUDE.md STATUS.html SUMMARY.html' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "read-only|write|capture|mcd|munshi|Access|origin|fail|Cf-Access|control plane|OS|attention|ROI|kill|retired|DEC-|Questions|QX|facets|governance|publish|automated|automate" docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md docs/superpowers/specs/2026-06-19-samagra-evolution-design.md' in C:\SandBox\claude_box\TeachingOS
 succeeded in 2899ms:
4:off `[x]` when done *with evidence*; append discovered work; record `BLOCKED:` notes inline. Each item
13:  #4→main merge defers to the owner / C-2. PR #4 confirmed OPEN + MERGEABLE. Baseline gates **green on
16:  byte-identical), so the gate result carries. Hygiene: gitignored the stray `Web OS GUI design.zip`
17:  binary + pre-emptive Phase-B tunnel-secret patterns (`*.pem`, `cloudflared/*.json`, `mcd-cloud.json`).
19:## Phase A — make it fully working (functional DoD A1–A8)
21:  FastAPI on `:8799` (preview-owned; killed a stale orphan uvicorn first — see Discovered). Walked all
44:  unconfigured or the upstream read fails, and **never leak secret detail**. Completed the asymmetric
52:  through the FastAPI `:8799` proxy. **Exact** `q=capacitor` → 488 results, 25 rows (browser screenshot
95:    w=941 (origin {8,8}, no topbar); `reclampOnTheme` on switch kept **0/17 windows under the rail or top
100:    3-theme system from E1/E3 is correct. Tree byte-identical to A-5 HEAD, so gates hold (frontend 546 /
115:- [x] **A-8 · Adversarial review + gates. DONE 2026-06-22.** Ran a scoped **adversarial-review Workflow**
120:  backend tests + config + docs — all sound. **Final gates green (clean tree):** backend **154 passed / 0
122:  1.91s`. No `.only`/`.skip` (0 matches in `frontend/src`). **✅ Functional DoD A (A1–A8) is COMPLETE.**
124:## Phase B — deploy via Cloudflare tunnel (DoD B1–B5) — public step is OWNER-GATED
127:  read-only checks: `cloudflared` 2025.8.1 installed and authenticated (`~/.cloudflared/cert.pem` present);
129:  `mycontentdev-api`, `quizrag-demo`) + a default `~/.cloudflared/config.yml` for hermes — so `samagra-os`
132:  owner re-runs `cloudflared tunnel login` for it). hermes is the template: dedicated tunnel + Access-OTP
135:  host the tunnel points at): builds `frontend/dist` (unless `-SkipBuild`), starts the same-origin FastAPI
136:  on `:8799` + the QX sidecar on `:8783`, **idempotent** (reuses a server already passing its health check;
139:  secrets** — reports only whether `.env` / `mcd-cloud.json` EXIST (never contents); logs → gitignored
140:  `.serve-logs/`. ASCII-only (Win PS 5.1 reads BOM-less `.ps1` as ANSI — first write tripped this). Verified
143:  preview `:8799` preserved). No app-source change → backend 154 / frontend 546 gates unaffected.
144:- [x] **B-2 · Access/auth in front (HARD). DONE 2026-06-22.** Owner created a **Cloudflare Access**
145:  application (Zero Trust, one-time-PIN to owner email) on the live hostname. **Verified the gate bites:**
148:  Cloudflare-Access` (NOT a 200 with API data). So `/api/*` writes + admin keys are not open. (The origin
149:  does not itself fail-closed — Access is the sole gate — so this smoke-test is load-bearing, not optional.)
150:- [x] **B-3 · Tunnel config. DONE 2026-06-22.** `cloudflared tunnel create samagra-os` → id
151:  `9b7a3df8-6fda-4500-b97c-4592c2dd101e` (creds JSON written to `~/.cloudflared/<id>.json`, OUTSIDE the
152:  repo, gitignored — never committed). Filled the committed `deploy/cloudflared/config.samagra.yml` with the
153:  real id + creds path (a tunnel UUID is not a secret; matches the hermes config convention) and the final
154:  ingress hostname. `cloudflared tunnel --config deploy/cloudflared/config.samagra.yml ingress validate`
158:  `serve-local.ps1` (FastAPI `:8799` HEALTHY + QX `:8783` HEALTHY, fresh `dist`). DNS routed
159:  (`cloudflared tunnel --config … route dns samagra-os samagra.bhautikiplusprashnavali.com`) → proxied
160:  CNAME → our tunnel `9b7a3df8…`. Tunnel running in background (`cloudflared tunnel --config … run
162:  **LIVE at https://samagra.bhautikiplusprashnavali.com behind Access.** Remaining human check: browser OTP
165:  reality (bhautiki hostname, real tunnel id, cert-zone gotcha D-7, Access verified, junk-record cleanup D-8).
166:  **Durability via a logon Scheduled Task** (chosen over `cloudflared service install`, which would hijack the
167:  hermes default `~/.cloudflared/config.yml`): `scripts/serve-durable.ps1` brings the stack up (reuses healthy
172:  detached `cloudflared` (pid on `config.samagra.yml`), task State=Ready, gate live (`/api/overview` → 302).
179:  public URL (https://samagra.bhautikiplusprashnavali.com, Access-gated).
182:  (20 commits: E3 + Phase A A1–A8 + Phase B B1–B5 + durability) and **pushed to `origin/main`**
183:  (`8379ae1..5db7886`). Clean ff (main was an ancestor); `main` == `origin/main` == `ship/samagra-os` ==
195:- **D-1 · Stale orphan uvicorn on `:8799` (2026-06-22, handled).** On entry, a prior-session `python`
196:  uvicorn (PID from `01:37`) still held `:8799` (the gotcha HANDOFF §2 warned about). A-1 killed it and
198:  stale `:8799` listener before starting (and likewise the QX `:8783`).
200:  set `"autoPort": false` on the `samagra` config in `.claude/launch.json` (done) and free `:8799` first,
201:  then `preview_start({name:"samagra"})` spawns it on 8799. Recorded so later UI iterations don't re-derive.
207:  must start/health-check `:8783` alongside `:8799`; **B-5** runbook must document it. Keep `:8783`
208:  internal — only `:8799` is tunnelled (reached via the same-origin `/api/questions` proxy). If QX isn't
222:  guards bite, transiently churning the working tree (a concurrent gate run saw a false-red — 3 of my own
225:  instruct agents to be strictly read-only (no Edit/Write/git checkout); never run a gate while a
227:- **D-7 · cloudflared cert.pem is zone-scoped (2026-06-22).** `~/.cloudflared/cert.pem` (from a prior
228:  `cloudflared tunnel login`) is scoped to the **`bhautikiplusprashnavali.com`** zone. Even though
230:  `cloudflared tunnel route dns … samagra.pratyakshsims.com` could not write that zone — it **mangled** the
232:  cert's zone). Using pratyakshsims.com would require re-running `cloudflared tunnel login` and selecting it
235:  it cloudflared loaded the default hermes config and targeted the wrong tunnel (`40f0e7b2`).
239:  should be deleted in the Cloudflare DNS dashboard (`cloudflared` has no `route dns delete`, and no CF API

 succeeded in 3440ms:
CLAUDE.md:3:> **Naming:** the working directory is still `TeachingOS/` (legacy), but the **repo, the GitHub remote and the
CLAUDE.md:5:> below still says "TeachingOS", read it as the legacy directory / historical name only.
CLAUDE.md:8:> the strategic direction drifting — "SAMAGRA OS" had re-introduced the OS-sized scope the 2026-06-19 vision
CLAUDE.md:9:> deliberately retired. **Decided & binding:** SAMAGRA OS is a *bounded operator console* (UI metaphor only); the
CLAUDE.md:10:> attention-ROI north-star + kill-criterion stay binding; a scope firewall + a pre-E3 attention-ROI gate are in
CLAUDE.md:14:> **✅ DEC-3 AMENDMENT (2026-06-21, Chairman):** the read-only firewall is amended to allow **owner-initiated
CLAUDE.md:15:> capture** — exactly two write paths, `POST /api/munshi/capture` (munshi item) and `POST /api/mcd/seeds`
CLAUDE.md:16:> (mcd seed). The human **publish gate stays never-automated**, there is **no munshi→mcd bridge**, and the
CLAUDE.md:17:> invariant is now *"read-only except owner-initiated capture."* The capture control plane is **live-verified**
CLAUDE.md:19:> `GET /api/mcd/seeds`; Simulations shows the 482 deployed pratyaksh sims; the QX browser facet bug is fixed).
CLAUDE.md:23:## TeachingOS memory — auto-generated by scribe; edit OUTSIDE this block only
CLAUDE.md:26:- (5) 2026-06-22 claude: The autonomous ralph loop is driving SAMAGRA OS to a fully working state. [SAMAGRA OS, ralph loop, autonomous deployment]
CLAUDE.md:27:- (5) 2026-06-22 claude: The Ralph loop's mission is to drive the SAMAGRA OS app to fully working, served from frontend/dist/ by FastAPI on :8799. [Ralph, SAMAGRA OS, FastAPI]
CLAUDE.md:28:- (5) 2026-06-21 claude: The session concluded with a plan to improve the app in a custom ralph loop and deploy to Cloudflare with a custom URL pointing to a localhost tunnel. [deployment, Cloudflare, localhost tunnel, ralph loop]
CLAUDE.md:29:- (5) 2026-06-21 claude: The test-driven-development skill was applied: tests were written before code, and tests were seen to fail before passing. [test-driven-development, TDD, testing]
CLAUDE.md:30:- (5) 2026-06-21 claude: Munshi auth uses a single shared-secret cookie model: GET /login?k=<secret> sets the cookie; subsequent /api/ calls must carry it. [Munshi, authentication, cookie]
CLAUDE.md:32:- (5) 2026-06-21 claude: Scope firewall and attention-ROI gate were implemented to prevent scope creep and maintain focus. [scope firewall, attention-ROI gate, project management]
CLAUDE.md:33:- (5) 2026-06-21 claude: Phase E2 requires 11 data/control apps as thin React wrappers over the existing FastAPI /api/* contract plus one new endpoint GET /api/or. [SAMAGRA OS, Phase E2, React, FastAPI]
CLAUDE.md:34:- (5) 2026-06-21 claude: A bug exists: the Questions app displays simulation IDs instead of the question search interface; this will be addressed in a future session. [bug, sim IDs, question search]
CLAUDE.md:35:- (5) 2026-06-20 claude: New design direction for TeachingOS based on 'Web OS GUI design.zip' is the immediate next priority. [design, priority, project]
CLAUDE.md:36:- (5) 2026-06-20 claude: All OS themes must include right-click functionality. [right-click, functionality, themes]
CLAUDE.md:37:- (5) 2026-06-20 claude: Windows in the OS must be draggable. [draggable, windows, UI]
CLAUDE.md:42:- (5) 2026-06-18 claude: TeachingOS is designed to automate the creation of JEE/NEET physics educational content from handwritten notes to multiple output formats including lectures, booklets, and question banks. [TeachingOS, JEE/NEET, content pipeline]
CLAUDE.md:43:- (4) 2026-06-22 claude: User created an application deployment policy for SAMAGRA OS. [SAMAGRA OS, deployment policy]
CLAUDE.md:44:- (4) 2026-06-22 claude: User created an access policy for SAMAGRA OS. [SAMAGRA OS, access policy]
CLAUDE.md:45:- (4) 2026-06-22 claude: The user created an application policy for deployment. [SAMAGRA OS, deployment, policy]
CLAUDE.md:46:- (4) 2026-06-22 claude: The user created an access policy. [SAMAGRA OS, deployment, policy]
CLAUDE.md:47:- (4) 2026-06-22 claude: The app serves from frontend/dist/ by FastAPI on port 8799. [SAMAGRA OS, FastAPI, frontend]
CLAUDE.md:51:- (4) 2026-06-21 claude: User committed qx files as part of finishing a development branch in the TeachingOS project. [git commit, qx files, TeachingOS]
CLAUDE.md:52:- (4) 2026-06-21 claude: Production secret MUNSHI_PROD_SECRET was copied from myProd\.dev.vars to TeachingOS's .env via shell, never exposed in transcript; length verified as 40 characters. [secret management, environment variables, Munshi]
CLAUDE.md:54:- (4) 2026-06-21 claude: OS-drift finding was finalized as decided and closed. [OS-drift, design decision]
CLAUDE.md:55:- (4) 2026-06-21 claude: The Questions app frontend was modified to fetch /api/facets and use subject facets instead of static qtype chips. [Questions app, facets API, frontend]
SUMMARY.html:8:<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
SUMMARY.html:203:      <p class="big">From a rough idea to something published.</p>
SUMMARY.html:232:              <rect x="20" y="143" width="130" height="34" rx="9" fill="var(--surface)" stroke="var(--border)"/><text x="36" y="165">QX · questions</text>
SUMMARY.html:252:        <svg viewBox="0 0 720 150" role="img" aria-label="Capture, enrich, review, publish">
SUMMARY.html:337:          <p>Nothing publishes without Deepak. That approval is never handed to a machine.</p>
SUMMARY.html:359:        <div class="ph"><span class="s done">done</span><div class="n">Control room — first floor</div><div class="d">The OS-style screen + windows, dock, and built-in apps (clock, notes, terminal…), now in three looks (light, dark, warm) with proper drawn icons, windows you can drag, right-click menus everywhere, and addressed to the chairman by name (Deepak Bhardwaj). Built, green (439 / 439), moved into the main build, and published to the shared copy.</div></div>
SUMMARY.html:366:      <p class="muted" style="margin-top:22px">Earlier: the governance layer was built and switched on — a place to track who's assigned what, a record of every decision, and an advisory code gate that asks a reviewer before risky changes land (it warns, can be overridden with a logged reason, and a broken reviewer never blocks work; only the human publish step is ever a hard stop). <strong>Now (20 Jun): the control room's first floor is built — and dressed.</strong> SAMAGRA OS — an OS-style screen with windows, a dock, and small built-in apps (a clock, notes, a terminal, a calculator-style settings panel, a game) — is up and running on tested foundations, and it now comes in <strong>three looks</strong> (a light one, a dark "mission-control" one, and a warm Indian-editorial one) with proper hand-drawn icons everywhere instead of plain letters. The trick that makes it solid: every piece of real behaviour (how windows move and stack, how the clock and game tick, how the terminal reads commands) lives in small, separately-tested building blocks — so the screen is now checked by <strong>439 automated tests, all green</strong>, on top of the backend's 102. Windows now drag and resize, every screen (in all three looks) has a right-click menu, and the whole thing is addressed to the chairman by name (Deepak Bhardwaj). The tests also lock down the look details a machine <em>can</em> judge: the right icons are drawn, each look uses its own colours, the window buttons are labelled. All of this has now been <strong>folded into the main build and published to the shared copy</strong>. <strong>Now (21 Jun): the real tool screens are in.</strong> Eleven of them — the org chart, the pipelines board, lectures, questions, booklets, the assignments board, the activity log, and more — now open as windows inside the control room, each one <strong>read-only</strong> (it only shows what's there; it never changes anything). Same trick as before: the real work lives in small, separately-tested building blocks, so these screens add up to <strong>501 automated tests, all green</strong> (plus the backend's 106, which gained a tiny new "who's who" lookup for the org chart). A reviewer (Codex) looked the batch over and gave the <strong>go-ahead</strong>, with three middling fixes made first: the worker list now shows "Gemini+NotebookLM" as one line, the pipelines screen spells out owner names properly, and the list screens make web links clickable. A couple of other things got tidied along the way: the org chart's who-reports-to-whom was corrected (Claude-Deepak is the CEO, Claude-Khanak the CTO), and a <strong>real bug from the earlier build was caught and fixed</strong> — when the screen was served the normal way (not the developer's preview), the app windows were coming up <em>empty</em>; a packaging setting was quietly leaving every app out of the shipped bundle. That's now fixed, so every window fills in properly. This new batch is now <strong>reviewed, folded into the main build, and published to the shared copy</strong> (21 Jun). What's still left is the one thing tests can't judge — a <strong>person eyeballing each screen against the design pictures</strong> to confirm it truly looks right (a few of the new app icons may still show a blank placeholder — a small polish item). That look-check hasn't happened, so we are <em>not</em> claiming a pixel-perfect match. <strong>Now (22 Jun): the phone version is built</strong> (see "What's next" below), and a batch of test-only loose ends was tidied. <strong>Next:</strong> the eyeball pass over the screens (now including the phone frame) and the owner's time-saved measurement, before going deeper on look-and-feel.</p>
SUMMARY.html:372:        full "OS-style" desktop the right thing to build first, or is it quietly growing bigger than a one-person
SUMMARY.html:374:        drifted from the original plan, which had deliberately dropped the word "OS". <strong>Deepak's call (now
SUMMARY.html:391:            <li>The headline number is <strong>time saved</strong><small>Minutes of Deepak's attention per published item.</small></li>
SUMMARY.html:393:            <li>First self-driving lane is <strong>refreshing read-only data</strong><small>The safest possible thing to automate — and only later.</small></li>
SUMMARY.html:417:        OS, <strong>jot a front-desk note/to-do (Munshi) or start a content idea (a "seed" in mycontentdev)</strong>,
SUMMARY.html:420:        <strong>one careful exception to "read-only"</strong>, and it was the Chairman's explicit call; the
SUMMARY.html:421:        sacred rule still holds — <strong>nothing reaches a student without a human "yes"</strong> (the publish
SUMMARY.html:422:        step is never automated), and the OS does <em>not</em> auto-promote a note into a content idea. At the
SUMMARY.html:423:        same time the <strong>Simulations screen now lists only the 482 truly-published sims</strong> (with working
SUMMARY.html:424:        links to the live site), and the <strong>Questions screen's subject-filter glitch is fixed</strong> (it no
SUMMARY.html:427:        <strong>Done this session (2026-06-22):</strong> the <strong>Questions screen</strong> used to show maths as
SUMMARY.html:429:        real search. It now <strong>plugs straight into the original question tool's own brain</strong> (it runs quietly
SUMMARY.html:448:        <em>(One operational note: the question tool must be left running in the background for the Questions screen to
STATUS.html:61:  <h1>SAMAGRA</h1><span class="sub"><strong>✅ DEPLOYED LIVE (2026-06-22)</strong> — SAMAGRA OS is reachable at <a href="https://samagra.bhautikiplusprashnavali.com" style="color:inherit">samagra.bhautikiplusprashnavali.com</a> behind <strong>Cloudflare Access</strong> (one-time-PIN), via a <code>cloudflared</code> named tunnel (<code>samagra-os</code>, <code>9b7a3df8…</code>) → local <code>:8799</code> · <strong>gate verified</strong> (unauth <code>/api/overview</code> → 302 Access login) · Phase A (17 apps × mobile × 3 themes, 0 console errors, gates green) + Phase B (tunnel + Access) done on branch <code>ship/samagra-os</code> (<code>cce285d</code>) · runbook <a href="docs/deploy-tunnel.md" style="color:inherit">docs/deploy-tunnel.md</a> · see <a href="#next" style="color:inherit">Next</a> for owner follow-ups (junk-record cleanup, durable service, browser smoke, finish branch)</span>
STATUS.html:64:    <a href="#samagra">SAMAGRA</a><a href="#experience">OS GUI</a><a href="#arch">Architecture</a><a href="#org">Org</a>
STATUS.html:77:  <a href="#experience">SAMAGRA OS (GUI)</a>
STATUS.html:91:  teaching operation. It orchestrates several already-working tools — the QX question engine,
STATUS.html:94:  gates at publish and Telegram + email notifications.</p>
STATUS.html:108:  Phase 1 build, three read-only <code>gpt-5.5</code> Codex agents reviewed the whole codebase, the
STATUS.html:116:  Phase 1 — the read-only adapters — followed and is now also merged.</p>
STATUS.html:122:  three-gate model (the human publish gate is the only sacred block; the Codex gate stays advisory-local
STATUS.html:124:  field/status/step). Four Chairman calls were recorded — north-star = attention-ROI, concept vocabulary =
STATUS.html:125:  mycontentdev taxonomy leaves, first autonomy lane = adapter-refresh, and the published corpus may be
STATUS.html:126:  public via a separate entity (the OS stays inward). No phase re-sequencing; an in-place fix removed a
STATUS.html:130:  read-only subsystem adapters are live: <code>McdClient</code>/<code>McdAdapter</code> (mycontentdev seeds via
STATUS.html:145:  Phase-1 schema-freeze). <code>create_seed</code> remains deferred to Phase 3 (no write path shipped).</p>
STATUS.html:148:  <p>The SAMAGRA OS now performs <strong>real owner-initiated captures end-to-end</strong> and browses every
STATUS.html:149:  read-only surface with live data. Built TDD on branch <code>feature/control-plane-capture</code> with an
STATUS.html:151:  Per the <strong>DEC-3 amendment</strong> (Chairman, 2026-06-21) the read-only firewall now allows exactly two
STATUS.html:152:  write paths; the human publish gate stays never-automated; no munshi→mcd bridge. Invariant:
STATUS.html:153:  <em>"read-only except owner-initiated capture."</em></p>
STATUS.html:155:    <div class="card"><div class="n">Munshi <span class="badge ok">write</span></div><div class="l"><code>POST /api/munshi/capture</code> → live <code>MunshiClient.create_item</code> → <code>/api/item</code> (cookie). Kinds <strong>todo/note/followup</strong>, per-kind required fields, server-validated, creds-gated.</div></div>
STATUS.html:156:    <div class="card"><div class="n">mcd seed <span class="badge ok">write</span></div><div class="l"><code>POST /api/mcd/seeds</code> → live <code>McdClient.create_seed</code> → <code>/api/seeds</code> (form-encoded, <code>x-mcd-admin</code>). Existing adminKey authorizes the write — no APP_PASSWORD needed.</div></div>
STATUS.html:158:    <div class="card"><div class="n">Sims <span class="badge ok">deployed-only</span></div><div class="l"><code>GET /api/sims</code> parses <code>deployed-sims-by-grade.md</code> — <strong>482 sims</strong>, grade-grouped, linking canonical <code>pratyakshsims.com/sims/SIM&lt;NNNN&gt;/SIM&lt;NNNN&gt;_sim</code>.</div></div>
STATUS.html:159:    <div class="card"><div class="n">QX facets <span class="badge ok">fixed</span></div><div class="l"><code>GET /api/questions/facets</code> is question-scoped (<code>qx.summary()</code>) — SIM-id chip bug gone; degenerate numeric subject codes filtered. Questions stays a standalone read-only browser.</div></div>
STATUS.html:166:    <div class="card"><div class="n">B <span class="badge ok">done</span></div><div class="l">Portal — FastAPI + forked-QX UI, 7 tabs</div></div>
STATUS.html:173:  rename → adapters → governance → loop.</p>
STATUS.html:177:    <div class="card"><div class="n">2 <span class="badge ok">built · 98/98</span></div><div class="l">Governance — durable <code>governance.db</code> store (assignments/events/review overlay, D6), Assignments tab, advisory-local Codex pre-commit (confirmed-CRITICAL + diff-hash cache + break-glass, D5), org SVG. Built TDD on <code>main</code>; pre-merge review <strong>APPROVE</strong>; <strong>shipped</strong> — pushed to <code>origin/main</code>, hook active, worktrees created.</div></div>
STATUS.html:178:    <div class="card"><div class="n">3 <span class="badge park">parked</span></div><div class="l">Active loop — munshi → proposed seed (w/ pointers) → board approve → capture API. <strong>Deprioritised 2026-06-20</strong> for the Experience track; plan complete, resumes after SAMAGRA OS.</div></div>
STATUS.html:183:  final publish gate. Workers (Gemini+NotebookLM, Grok, Hermes) produce drafts only.
STATUS.html:187:  <h2 id="experience">SAMAGRA OS — Experience track <span class="badge ok">NEW · 2026-06-20</span></h2>
STATUS.html:188:  <p class="lede">The new top priority: replace the plain tabbed portal with <strong>SAMAGRA OS</strong> — an
STATUS.html:189:  OS-style windowing GUI control plane (17 apps · 3 themes · 2 device modes), built in React + TypeScript +
STATUS.html:191:  under <code>docs/superpowers/</code>. <strong>E1 (shell + aqua + six OS utilities) is SHIPPED</strong>, and a
STATUS.html:197:    <div class="card"><div class="n">E1 <span class="badge ok">merged to main · 439/439</span></div><div class="l">Shell + <strong>all 3 themes</strong> + OS utilities — window manager (draggable/resizable), dock/top-bar, Dashboard · Settings · Terminal · Clock · Notes · Snake + FastAPI serve seam. Built TDD then fidelity-passed; chairman renamed <strong>Deepak Bhardwaj</strong> + <strong>right-click context menus</strong> in every theme. Fast-forwarded <code>e1/samagra-os</code> → <code>main</code> (<code>06d88a3</code>); gate clean (lint + <code>tsc</code> + 439 Vitest + <code>vite build</code>; backend 102/102). Not yet pushed.</div></div>
STATUS.html:199:    <div class="card"><div class="n">E2 <span class="badge ok">merged · headless-green</span></div><div class="l">Eleven data/control apps — Org · Pipelines · Lectures · mycontentdev · Munshi · Assignments · Activity · Questions · Booklets · INSP · Sims — as thin read-only React wrappers over <code>/api/*</code>, plus one new endpoint <code>GET /api/org</code> (static <code>samagra/org.py</code>). Built TDD on <code>e2/samagra-os</code> (22 commits); backend 106/106 + frontend 501/501 green, <code>tsc</code>/<code>vite build</code> clean (22 lazy chunks). <strong>MERGED to <code>main</code> (fast-forward, <code>31aa5bb</code>) and pushed to <code>origin/main</code> 2026-06-21</strong> after a Codex pre-merge review (GO; 3 MEDIUMs fixed) — <a href="https://github.com/dbhardwaj86/samagra/pull/2">merged PR #2</a>.</div></div>
STATUS.html:221:  the aqua chrome shell, the six OS-utility apps + shared components, and the FastAPI serve seam (Vite
STATUS.html:239:    <div class="card"><div class="n">✓ <span class="badge ok">execution verified</span></div><div class="l">Every merge claim holds (E1 <code>06d88a3</code>, E2 <code>31aa5bb</code>, HEAD <code>e1cb22a</code>); the read-only safety invariant holds exactly (no <code>create_seed</code> shipped; <code>/api/org</code> static; <code>useApi</code> GET-only; the 3 POST routes are control-plane); spec↔code mapping exact (17 apps · 7 <code>lib/</code> modules · 12 engines · 3 themes · 8 shell components); live suites <strong>backend 106 + frontend 501</strong> green.</div></div>
STATUS.html:240:    <div class="card"><div class="n">⚠ <span class="badge todo">direction drifting</span></div><div class="l">The 2026-06-19 vision <em>retired</em> the word "OS" (<em>"it silently licenses OS-sized scope"</em>) and bound the project to an attention-ROI kill-criterion — yet the project pivoted to a literal 17-app "SAMAGRA OS" and parked the value-producing active loop. Codex verdict <strong>DRIFTING</strong>; audit verdict <strong>COHERENT-WITH-CAVEATS</strong> (this is the caveat).</div></div>
STATUS.html:242:  <p>The OS experience spec only <strong>half-reconciles</strong> this — it argues the windowing metaphor is "the
STATUS.html:243:  honest shape of the work" and firewalls write paths, but <strong>never restates the attention-ROI north-star
STATUS.html:244:  or the kill-criterion</strong>, and the value-producing <a href="#samagra">active loop (Phase 3)</a> — the
STATUS.html:245:  mechanism that actually saves owner attention — is parked while OS chrome (3 themes, a Snake game, mobile mode)
STATUS.html:251:    <li><strong>DEC-1 · Scope.</strong> SAMAGRA OS is a <strong>bounded operator console — a UI metaphor only</strong>; SAMAGRA remains a control plane and does not acquire app-platform scope.</li>
STATUS.html:252:    <li><strong>DEC-2 · North-star binding.</strong> The attention-ROI north-star + the kill-criterion remain <strong>binding</strong> and are not voided by the OS track (data source = the governance <code>events</code>/<code>review_overlay</code> ledger; the ~3 hrs/wk figure stays the seed proposal pending the DEC-4 gauge).</li>
STATUS.html:253:    <li><strong>DEC-3 · Scope firewall</strong> (hard non-goal, mirrored into OS spec §3): no entertainment apps beyond E1's Snake, no third-party apps / marketplace, no process-scheduler model, no user-facing product identity.</li>
STATUS.html:254:    <li><strong>DEC-4 · Attention-ROI acceptance gate before E3:</strong> 2–3 representative operator tasks (triage munshi captures · read pipeline/gate status · find + open a catalog artifact) measured for owner time-saved vs the old portal; fail → freeze GUI expansion + reprioritize Phase 3. <strong>⚠ Consciously DEFERRED 2026-06-22</strong> — the Chairman chose to build E3 first this session. The gate is <strong>not satisfied and not voided</strong>; it remains the binding gate for the Phase-3-vs-GUI reprioritization and should run before further GUI investment.</li>
STATUS.html:268:    <text class="ttl" x="34" y="34">③ Portal + API (FastAPI · forked-QX UI)</text>
STATUS.html:274:    <text class="ttl" x="34" y="184">① Source adapters (read-only, normalized)</text>
STATUS.html:276:      <rect class="box" x="20" y="222" width="104" height="54" rx="8"/><text class="lbl" x="34" y="246">QX</text><text class="mut" x="34" y="263">67k Qs</text>
STATUS.html:285:  <p class="lede">SAMAGRA adds two read-only sources — <strong>mycontentdev</strong> (editorial seeds, cloud
STATUS.html:287:  plus an <strong>Assignments</strong> tab and a governance store in the same catalog DB.</p>
STATUS.html:290:  <p class="lede">Unified catalog: <strong>7,044 artifacts</strong> across 6 local sources (read-only).
STATUS.html:295:    <tr><td>QX (gpt-extract-ques)</td><td>5,284 papers</td><td>67,276 questions, faceted + semantic search</td></tr>
STATUS.html:299:    <tr><td>pratyaksh-May-deploy</td><td>1,554 sims</td><td>read-only</td></tr>
STATUS.html:301:    <tr><td>mycontentdev <span class="badge ok">Phase 1</span></td><td>seeds</td><td><code>McdAdapter</code> — cloud admin API (read-only); reflects seed status into the <code>mycontentdev</code> pipeline</td></tr>
STATUS.html:302:    <tr><td>munshi <span class="badge ok">Phase 1</span></td><td>items</td><td><code>MunshiAdapter</code> — <code>library()</code> over the Worker (read-only); per-kind title from the live payload schema</td></tr>
STATUS.html:336:    <!-- connectors: BOSS -> board -->
STATUS.html:351:    <!-- BOSS -->
STATUS.html:354:    <text class="tw" x="460" y="58" text-anchor="middle">Deepak — the BOSS</text>
STATUS.html:355:    <text class="sw" x="460" y="73" text-anchor="middle">Founder &amp; Chairman · final publish gate</text>
STATUS.html:396:    <text class="t" x="360" y="412" text-anchor="middle">QX</text>
STATUS.html:409:    <text class="s" x="100" y="476" text-anchor="middle">Sims · read-only</text>
STATUS.html:418:  backend sims-parser-robustness + QX-facets degradation tests (+10 → 152) and frontend mobile-shell
STATUS.html:422:  <strong>Questions QX-backed</strong> upgrade (branch <code>feature/control-plane-capture</code>) brought the suite to
STATUS.html:423:  frontend 524 / backend 142; QX's own <code>tools/qx/tests/test_json_search.py</code> (5) is green too.
STATUS.html:427:  the question-scoped <code>/api/questions/facets</code>, and the pure-TS builders
STATUS.html:435:  <code>lib/activity/format</code> · <code>lib/questions/facets</code>, including the +2 catalog
STATUS.html:474:  suites: <code>test_clients.py</code> (9 — read-only <code>McdClient</code>/<code>MunshiClient</code>,
STATUS.html:475:  URL/header/cookie shape, never-log-secret, hermetic), <code>test_subsystem_adapters.py</code> (12 —
STATUS.html:478:  dry-run). The suite is isolated from the real <code>samagra.db</code> and <code>governance.db</code>
STATUS.html:480:  Phase 2 adds <strong>35</strong>: <code>test_governance.py</code> (14 — store CRUD + status state-machine +
STATUS.html:490:  <div class="log"><div class="d">2026-06-22 · ✅ DEPLOYED LIVE — cloudflared tunnel behind Cloudflare Access</div>
STATUS.html:491:    The ralph ship-&-tunnel loop completed Phase A (functional) + Phase B (deploy). SAMAGRA OS is live at
STATUS.html:493:    behind <strong>Cloudflare Access</strong> (one-time-PIN to owner), fronting the local stack via a
STATUS.html:495:    <code>localhost:8799</code> (FastAPI serving <code>frontend/dist</code> + same-origin <code>/api</code>; QX
STATUS.html:497:    <code>GET /api/overview</code> returns <strong>HTTP 302</strong> to the Access login (so the capture
STATUS.html:498:    write-paths are not open) — the origin does not fail-closed, so Access is the sole gate.
STATUS.html:508:    The owner was asked how to handle E3 given the binding <strong>DEC-4 attention-ROI gate</strong> (which the
STATUS.html:519:    S3/S4 LOWs</strong> (HANDOFF item 4) are closed too (<code>0dceb0d</code>): QX-facets degradation tests, sims
STATUS.html:527:  <div class="log"><div class="d">2026-06-22 · Questions app is now QX-backed (exact + semantic + maths + figures)</div>
STATUS.html:528:    The Questions app was a thin <code>LIKE</code> slice over QX's sqlite (raw <code>$…$</code> LaTeX, literal
STATUS.html:529:    <code>[fig]</code>, no semantic). Per the owner's decision — <em>"deploy QX on localhost and use its backend
STATUS.html:530:    directly"</em> — it now <strong>reuses the real QX engine</strong> as a localhost sidecar. QX gained a tested
STATUS.html:532:    <strong>+ semantic</strong> BGE over the 67k-vector index + facets) and rendering each question to standalone HTML
STATUS.html:533:    (KaTeX maths + figure <code>&lt;img&gt;</code>) via QX's own <code>render_segs</code>. SAMAGRA's
STATUS.html:534:    <code>/api/questions</code> proxies it (<code>QxClient</code> → <code>config.QX_SERVER_URL</code> default
STATUS.html:535:    <code>:8783</code>; figure URLs absolutized; QX-down → graceful <code>{results:[], error}</code>). The Questions
STATUS.html:539:    <strong>Live-verified</strong> through QX <code>:8783</code>: exact (180) + real semantic (67,276, <code>degraded
STATUS.html:540:    False</code>), figures as absolute QX URLs. TDD: backend <strong>142 pytest</strong> + frontend <strong>524
STATUS.html:542:    (QX-backed). <strong>Activation:</strong> the always-up QX <code>:8783</code> must run the new code (restarted this
STATUS.html:543:    session); new frontend dep <code>katex</code>; the 3 QX-repo files are <strong>staged</strong> in the QX repo
STATUS.html:544:    (commit in its own flow). <strong>Contract change:</strong> <code>/api/questions</code> now returns the QX payload
STATUS.html:545:    (<code>results[].html</code> + <code>mode/degraded/facets</code>; params <code>q/mode/subject/chapter/qtype/page</code>).</div>
STATUS.html:547:    The read-only firewall was <strong>amended by the Chairman</strong> to allow <strong>owner-initiated
STATUS.html:548:    capture</strong>: exactly two write paths — <code>POST /api/munshi/capture</code> (a munshi item) and
STATUS.html:549:    <code>POST /api/mcd/seeds</code> (an mcd seed). The human <strong>publish gate stays never-automated</strong>,
STATUS.html:550:    there is <strong>no munshi→mcd bridge</strong>, and the invariant becomes <em>"read-only except
STATUS.html:554:    (<code>/api/munshi/library</code>, <code>/api/mcd/seeds</code>); Simulations shows the <strong>482 deployed
STATUS.html:555:    pratyaksh sims</strong>; the <strong>Questions sim-id facet bug is FIXED</strong> (question-scoped facets).
STATUS.html:558:    (Option B): do not merge yet</strong> — carry the small review LOWs into the next session with the Questions
STATUS.html:560:  <div class="log"><div class="d">2026-06-21 · Scope clarified — OS data apps are thin wrappers, not full reskins</div>
STATUS.html:561:    The Questions browser shows raw LaTeX + <code>[fig]</code> placeholders. Clarified that the E2 data apps were
STATUS.html:562:    spec'd/built as <strong>thin read-only wrappers over <code>/api/*</code></strong>, not feature-complete reskins
STATUS.html:563:    of the original tools — so they lack the original QX browser's maths/figure/preview features. <strong>Next
STATUS.html:564:    session</strong> does a <em>narrow</em> upgrade to Questions only: <strong>render correct maths + QX-style
STATUS.html:565:    search (exact + semantic)</strong> — not full QX feature-parity.</div>
STATUS.html:566:  <div class="log"><div class="d">2026-06-21 · ⚠ Known bug logged — Questions app subject chips show sim-ids (FIXED 2026-06-21, see above)</div>
STATUS.html:567:    The E2 LOW follow-up (the Questions app consuming <code>/api/facets</code>) was <strong>implemented</strong>
STATUS.html:568:    this session (commit <code>e1cb22a</code>, merged + pushed to <code>origin/main</code>) but
STATUS.html:569:    <strong>introduced a bug</strong>: the subject filter chips render ~500 (498 measured) <code>SIM0xxx</code> ids instead of
STATUS.html:570:    subjects. Root cause — <code>/api/facets</code> returns <strong>catalog-wide</strong> subjects
STATUS.html:572:    adapter writes each simulation's folder id (<code>SIM0018</code>…<code>SIM0626</code>) into the
STATUS.html:573:    <code>subject</code> column (<code>samagra/adapters/sims.py:37</code>), so global catalog facets ≠ the
STATUS.html:574:    question bank's subject vocabulary. Clicking a <code>SIM0xxx</code> chip filters
STATUS.html:575:    <code>/api/questions?subject=SIM0xxx</code> → 0 QX rows (compounded by QX's own <code>subject</code> column
STATUS.html:576:    being physics-only/unpopulated). <strong>Fix options (next session, read-only; keep <code>npm run verify</code>
STATUS.html:577:    green):</strong> (a) source the chips from a question-scoped list — QX <code>summary().subjects</code>
STATUS.html:578:    (<code>qx.py:57</code>) via a new <code>/api/questions/facets</code> or the qx overview summary;
STATUS.html:579:    (b) intersect <code>facets.subjects</code> with subjects present in the returned questions; or (c) drop
STATUS.html:583:    SAMAGRA OS <strong>E2</strong> (the 11 data/control apps + <code>GET /api/org</code>) <strong>merged to
STATUS.html:584:    <code>main</code> via fast-forward (<code>31aa5bb</code>) and pushed to <code>origin/main</code></strong> after a
STATUS.html:595:  <div class="log"><div class="d">2026-06-21 · SAMAGRA OS — E2 BUILT (11 data apps + <code>GET /api/org</code>); built TDD on <code>e2/samagra-os</code></div>
STATUS.html:597:    <strong>read-only</strong> React wrappers over the existing FastAPI <code>/api/*</code> contract, plus the one
STATUS.html:600:    <strong>Assignments (kanban) · Activity · Questions · Booklets · INSP/Olympiad · Simulations</strong>
STATUS.html:601:    (owner claude-khanak). No new write paths; mcd/munshi render empty-or-unavailable states; Munshi
STATUS.html:612:    <code>main</code> (fast-forward, <code>31aa5bb</code>) and pushed to <code>origin/main</code> on 2026-06-21</strong>
STATUS.html:628:    The whole SAMAGRA OS E1 frontend landed on <code>main</code> via fast-forward (<code>06d88a3</code>; 96 files /
STATUS.html:638:    <strong>Pushed to <code>origin/main</code> 2026-06-21</strong> (<code>557e6a4..6d09693</code>, with the tracker doc-sync).</div>
STATUS.html:655:  <div class="log"><div class="d">2026-06-20 · SAMAGRA OS — E1 SHIPPED (shell + aqua + six OS utilities)</div>
STATUS.html:663:    <code>lib/</code>; the aqua chrome shell (top bar · dock · window frame · context menu), the six OS-utility
STATUS.html:670:    (owner-run, never a loop completion signal). <strong>Next = E2</strong> (data/control apps — read-only
STATUS.html:672:  <div class="log"><div class="d">2026-06-20 · New top priority — SAMAGRA OS (Experience track); active loop parked</div>
STATUS.html:673:    The owner re-prioritised: replace the plain tabbed portal with <strong>SAMAGRA OS</strong>, an OS-style
STATUS.html:702:  <div class="log"><div class="d">2026-06-19 · Phase 2 (governance) built — reconciled the stale plan to runbook D5/D6</div>
STATUS.html:705:    <strong>D6</strong> — governance state (assignments / events / review overlay) lives in its own
STATUS.html:706:    <strong>durable <code>governance.db</code></strong>, separate from the rebuildable catalog
STATUS.html:715:    activation (<code>git config core.hooksPath .githooks</code>), the three agent worktrees, and push to origin.</div>
STATUS.html:717:    The two read-only subsystem adapters (mycontentdev + munshi) shipped TDD in 8 tasks, then a 42-agent
STATUS.html:731:    fast-forward-merged to <code>main</code>; suite 24 → <strong>34 green</strong>. Push to origin pending.</div>
STATUS.html:737:    attention-ROI, vocab = mycontentdev taxonomy leaves, first autonomy lane = adapter-refresh, corpus may
STATUS.html:740:    Three read-only <code>gpt-5.5</code> Codex passes (code / architecture / loop-plan) reconciled into
STATUS.html:743:    deferred to Phase 3 (Phase 1 ships read-only); munshi adapter stores refs/excerpt/hash, not full payload.</div>
STATUS.html:747:    Build order locked: rename to <code>samagra</code> (Phase 0) → subsystem adapters → governance → active loop. 34 tasks across 4 phases; spec + plan committed and recorded to the cbm sidecar.</div>
STATUS.html:749:    mycontentdev read via cloud admin API (<code>x-mcd-admin</code>); munshi via <code>driver.mjs library()</code> (cookie auth, <code>MUNSHI_SECRET</code>); SAMAGRA mirrors subsystem state + a thin board-review overlay — no parallel state machine.</div>
STATUS.html:754:    the durable governance store splits from the rebuildable catalog (D6). Only board agents approve writes.</div>
STATUS.html:763:    <tr><td><code>frontend/</code> (React + TS + Vite app)</td><td>SAMAGRA OS E1 + fidelity layer — windowing shell, <strong>three themes</strong> (aqua/console/samagra chrome) + the <code>Icon</code>/<code>AppIcon</code> SVG system, six OS utilities; pure-TS engines in <code>src/lib/**</code> (each with a co-located Vitest), Zustand stores, theme-driven shell, apps + components, + the chairman rename and right-click context menus. 439 Vitest / 38 files green.</td></tr>
STATUS.html:764:    <tr><td><code>frontend/src/apps/**</code> (11 E2 data apps) + 7 <code>frontend/src/lib/**</code> modules</td><td><span class="badge ok">E2</span> the eleven read-only data/control app wrappers (Org · Pipelines · Lectures · mycontentdev · Munshi · Assignments · Activity · Questions · Booklets · INSP · Sims) over the seven pure-TS linchpin modules (<code>lib/api/query</code> · <code>lib/catalog/rows</code> · <code>lib/pipelines/stages</code> · <code>lib/org/resolve</code> · <code>lib/kanban/columns</code> · <code>lib/activity/format</code> · <code>lib/questions/facets</code>) + <code>useApi</code>. 501 Vitest / 56 files green; 22 lazy chunks.</td></tr>
STATUS.html:768:    <tr><td><code>docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md</code> + <code>plans/2026-06-20-samagra-os.md</code></td><td>SAMAGRA OS Experience-track spec + phased plan (E1 in full TDD detail; E2/E3 skeletons)</td></tr>
STATUS.html:777:    <tr><td><code>samagra/clients/{mcd_client,munshi_client}.py</code></td><td>Phase 1 — read-only subsystem HTTP clients (secret-safe)</td></tr>
STATUS.html:781:    <tr><td><code>governance.db</code></td><td>Phase 2 — durable governance store: assignments / events / review overlay (D6; schema_version + backup; gitignored)</td></tr>
STATUS.html:787:  <p><strong>Deployed, durable, and merged to <code>main</code></strong> (2026-06-22, <code>5db7886</code> — fast-forward, pushed to <code>origin/main</code>). The tunnel + stack now auto-start at logon via the <code>SAMAGRA-OS</code> Scheduled Task (<code>scripts/serve-durable.ps1</code>). The ralph ship-&-tunnel loop (Phase A + B + C) is <strong>complete</strong>. Remaining:</p>
STATUS.html:789:    <li><strong>Durability — ✅ done.</strong> A logon Scheduled Task <code>SAMAGRA-OS</code> runs <code>scripts/serve-durable.ps1</code> (stack + detached tunnel, touching only the samagra <code>--config</code>), so the URL survives session-close and reboot (at logon). For 24/7 pre-login uptime: a Windows service separate from hermes (runbook §8). Manage via <code>scripts/install-durable-task.ps1</code>.</li>
STATUS.html:790:    <li><strong>Branch finished — ✅ done.</strong> <code>ship/samagra-os</code> fast-forward-merged into <code>main</code> (20 commits: E3 + Phase A + deploy + durability) and pushed to <code>origin/main</code> (<code>5db7886</code>); gates green (backend pytest + frontend verify).</li>
STATUS.html:791:    <li><strong>Delete the junk DNS record</strong> <code>samagra.pratyakshsims.com.bhautikiplusprashnavali.com</code> (D-8) in the Cloudflare DNS dashboard — a harmless stray CNAME from the first mis-route (does not affect <code>hermes.*</code> or the live samagra host). <em>Owner action.</em></li>
STATUS.html:792:    <li><strong>Browser OTP smoke</strong> — log in via Cloudflare Access and walk the apps × both devices × the 3 themes over TLS (same-origin <code>/api</code>, no CORS); the gate-blocks-unauth check is already verified, this confirms the post-auth app path. <em>Owner action.</em></li>
STATUS.html:795:    <li><strong>DEC-4 attention-ROI acceptance gate</strong> — deferred (not voided); still the <em>binding</em> gate for the Phase-3-vs-GUI reprioritization before deeper GUI investment.</li>
STATUS.html:798:  (`0dceb0d`) — QX-facets degradation tests, sims parser-robustness tests, the <code>sim_url()</code> validation
STATUS.html:799:  guard, and the non-vacuous Sims chip assertion. The Questions <code>SIM0xxx</code> facets bug was already fixed
STATUS.html:800:  structurally by the QX-backed Questions rebuild (`88b50a0`). The capture-control-plane + QX-Questions work is on
STATUS.html:803:  <strong>merged to <code>main</code> and pushed to <code>origin/main</code></strong>. <strong>Phase 2 —
STATUS.html:804:  governance</strong> is now <strong>built TDD on <code>main</code> (suite 63 → 98 green)</strong>, reconciled
STATUS.html:805:  to runbook <strong>D5</strong> (advisory-local hook) and <strong>D6</strong> (durable <code>governance.db</code>),
STATUS.html:807:  is now <strong>SHIPPED</strong> — pushed to <code>origin/main</code>, the advisory hook is active
STATUS.html:810:  <a href="#experience">SAMAGRA OS Experience track</a>; E1 is SHIPPED and a 3-theme + icon fidelity layer
STATUS.html:815:  backend 102/102), now <strong>merged to <code>main</code> and pushed to <code>origin/main</code></strong> (<code>06d88a3</code>).
STATUS.html:816:  <strong>E2 is now MERGED to <code>main</code></strong> — the eleven data/control apps as thin read-only React
STATUS.html:821:  to <code>origin/main</code> on 2026-06-21</strong> after a <strong>Codex pre-merge review (GO) in which 3 MEDIUM
STATUS.html:832:  parity, which is not yet claimed. The E2 LOW follow-up — the Questions app consuming
STATUS.html:833:  <code>/api/facets</code> — was <strong>implemented</strong> this session (<code>e1cb22a</code>) but
STATUS.html:834:  <strong>introduced a known bug</strong> (subject chips show ~500 (498 measured) <code>SIM0xxx</code> sim-ids; see the
STATUS.html:845:    <tr><td>Push <code>main</code> → origin</td><td><span class="badge ok">done</span></td><td>Pushed 2026-06-19 — <code>origin/main</code> holds the full Phase-1 work; repo and origin in sync.</td></tr>
STATUS.html:846:    <tr><td>Phase 2 — governance (build)</td><td><span class="badge ok">built · 98/98</span></td><td>Durable <code>governance.db</code> store (D6) + Assignments tab (live-verified) + advisory Codex pre-commit (D5) + board <code>AGENTS.md</code>/outboxes + org SVG. TDD on <code>main</code> (range <code>4b9e949..HEAD</code>).</td></tr>
STATUS.html:850:    <tr><td>Push <code>main</code> → origin (Phase 2)</td><td><span class="badge ok">done</span></td><td>Pushed 2026-06-19 — <code>origin/main</code> holds Phase 2 through <code>da9cab3</code> (this session's tracker-sync commit is local-only; push next session).</td></tr>
STATUS.html:851:    <tr><td>SAMAGRA OS — E1 (shell + aqua + utilities)</td><td><span class="badge ok">shipped · 166/166</span></td><td>React+TS+Vite GUI replacing the portal. Built TDD (E1.1–E1.25) on <code>e1/samagra-os</code>; E1.26 green gate clean (lint + <code>tsc</code> + 166 Vitest + <code>vite build</code>; backend 102/102). Pure-TS engines + aqua shell + six apps + serve seam.</td></tr>
STATUS.html:852:    <tr><td>SAMAGRA OS — 3-theme + icon fidelity layer</td><td><span class="badge ok">landed · 419/419</span></td><td>Theme-driven chrome for <strong>aqua · console · samagra</strong> (token map — FD1) + the <code>Icon</code>/<code>AppIcon</code> SVG system (FD2) across every launcher + the six apps. RTL tests adapted + fidelity hooks pinned. QA1 gate clean (lint + <code>tsc</code> + <strong>419 Vitest / 38 files</strong> + <code>vite build</code>, no <code>.only</code>/<code>.skip</code>; backend 102/102). Pixel parity not yet claimed.</td></tr>
STATUS.html:853:    <tr><td>SAMAGRA OS — chairman rename + right-click menus + merge to <code>main</code></td><td><span class="badge ok">done · 439/439</span></td><td>Chairman renamed <strong>Deepak Bhardwaj</strong> + <strong>right-click context menus</strong> in all 3 themes (desktop · window · dock-icon), on top of draggable windows + HIGH#4 guard + Notes a11y. Fast-forwarded <code>e1/samagra-os</code> → <code>main</code> (<code>06d88a3</code>; 96 files / ~19k ins). Advisory Codex hook ran (90s timeout, never-wedge).</td></tr>
STATUS.html:854:    <tr><td>SAMAGRA OS — push <code>origin/main</code></td><td><span class="badge ok">done</span></td><td>Pushed 2026-06-21 (<code>557e6a4..6d09693</code>) — the full E1 build + tracker doc-sync now on the remote.</td></tr>
STATUS.html:855:    <tr><td>SAMAGRA OS — browser-vision pixel QA</td><td><span class="badge todo">owner · next</span></td><td><strong>Next step.</strong> The visual/interaction fidelity pass over the three-theme shell + apps vs the prototype + <code>screenshots/</code> (outside any loop; has NOT run).</td></tr>
STATUS.html:856:    <tr><td>SAMAGRA OS — E2 (data/control apps)</td><td><span class="badge ok">merged · headless-green</span></td><td>Eleven read-only apps over <code>/api/*</code> + one new endpoint <code>GET /api/org</code> (static <code>samagra/org.py</code>), on 7 pure-TS linchpin modules. Built TDD on <code>e2/samagra-os</code> (22 commits); backend 106/106 + frontend 501/501 green, <code>vite build</code> clean (22 lazy chunks). Grounded on <code>e2-grounding.md</code> (supersedes <code>api.md</code>). <strong>MERGED to <code>main</code> (fast-forward, <code>31aa5bb</code>) and pushed to <code>origin/main</code> 2026-06-21</strong> after a Codex pre-merge review (GO; 3 MEDIUMs fixed) — <a href="https://github.com/dbhardwaj86/samagra/pull/2">merged PR #2</a>.</td></tr>
STATUS.html:857:    <tr><td>SAMAGRA OS — browser-vision pixel QA (11 E2 apps)</td><td><span class="badge todo">owner · next · pending</span></td><td><strong>Next planned action.</strong> The owner-run browser-vision pixel/interaction-parity pass over the 11 E2 apps (and the E1 shell) — now that the bundling fix makes the apps render when FastAPI-served, not just under <code>npm run dev</code>. Outside any loop; has NOT run; pixel parity not claimed. Some E2 glyphs may still be unregistered in <code>components/icons-data</code> (empty-icon fallback) — a visual-polish follow-up.</td></tr>
STATUS.html:858:    <tr><td>Direction-coherence decision (OS drift)</td><td><span class="badge ok">decided · ratified 2026-06-21</span></td><td><strong>Ratified by Deepak.</strong> SAMAGRA OS = bounded operator console (UI metaphor only); attention-ROI north-star + kill-criterion remain binding; scope firewall + the pre-E3 attention-ROI gate (DEC-4) now in force; Phase 3 (active loop) restarts after the E2 visual-QA pass + DEC-4. See the <a href="#coherence">Direction coherence</a> section + <code>HANDOFF.md</code>.</td></tr>
STATUS.html:859:    <tr><td>SAMAGRA OS — attention-ROI gate (DEC-4)</td><td><span class="badge todo">required before E3</span></td><td><strong>New gate.</strong> Measure owner time-saved on 2–3 representative operator tasks via SAMAGRA OS vs the old portal; must pass before any E3 (mobile / theme-polish) work. Fail → freeze GUI expansion + reprioritize Phase 3 (active loop).</td></tr>
STATUS.html:860:    <tr><td>SAMAGRA OS — Questions subject-chips bug (facets)</td><td><span class="badge todo">⚠ open · next session</span></td><td><strong>Known bug.</strong> The Questions app's subject chips render ~500 (498 measured) <code>SIM0xxx</code> sim-ids — <code>/api/facets.subjects</code> is catalog-wide (<code>catalog.py:191</code>) and the sims adapter writes folder ids as <code>subject</code> (<code>sims.py:37</code>). Introduced by <code>e1cb22a</code> (this session, already merged/pushed). Fix next session: source a question-scoped subject list (QX <code>summary().subjects</code>) or intersect with the returned questions, or facet on chapter/q_type. Read-only; keep <code>npm run verify</code> green.</td></tr>
STATUS.html:861:    <tr><td>SAMAGRA OS — E3 (mobile device mode + theme polish)</td><td><span class="badge park">planned</span></td><td>Mobile device mode (phone frame + home-screen grid + single-app mode) + remaining per-theme re-skin polish; the three desktop themes already shipped in E1. Skeletoned in the plan. <strong>Gated on the DEC-4 attention-ROI gate</strong> (see Direction coherence).</td></tr>

 succeeded in 3920ms:
5:> Cloudflare Access** at **https://samagra.bhautikiplusprashnavali.com** via a `cloudflared` named tunnel
7:> Access OTP login; the origin does not fail-closed, so Access is the sole gate). **Merged to `main`**
8:> (`5db7886`, fast-forward, pushed to `origin/main`; 20 commits) and **durable** via the `SAMAGRA-OS` logon
22:>   never-automated publish gate still hold. Loop prompt/backlog under `docs/superpowers/loops/ralph-deploy/`.
30:> - **Test-only LOW cleanup (HANDOFF item 4, now done):** S4 — parametrized QX-facets degradation tests
54:>   the QX-backed Questions + capture work). **Still owed before deeper GUI investment: the DEC-4 attention-ROI
57:> **▶▶ Questions app is now QX-backed (2026-06-22).** The Questions app was a thin `LIKE`
58:> slice over QX's sqlite (raw `$…$` LaTeX, literal `[fig]`, no semantic). It now **reuses the real QX
59:> engine** as a localhost sidecar (owner decision — "deploy QX on localhost and use its backend
60:> directly"). QX gained a tested `GET /api/qsearch` route (`tools/qx/json_search.py`) wrapping
61:> `tools.qx.search.run_search` (exact **+ semantic** + facets) and rendering each question to standalone
62:> HTML (KaTeX `data-tex` spans + figure `<img>`) via QX's own `render_html.render_segs`. SAMAGRA's
63:> `/api/questions` **proxies** it (`samagra/clients/qx_client.py` → `config.QX_SERVER_URL`, default
64:> `http://127.0.0.1:8783`; `samagra/questions_proxy.py` absolutizes figure `/asset` URLs to the QX
65:> server; QX-down → graceful `{results:[], error}`, never a 500). The **Questions app**
66:> (`frontend/src/apps/Questions/index.tsx`) got a search box + **exact/semantic toggle** +
70:> - **TDD throughout:** backend **142 pytest** + frontend **524 vitest** + `npm run verify` green; QX
72:> - **LIVE-VERIFIED end-to-end** through the running QX `:8783`: exact (**180** results, KaTeX spans,
73:>   figures as **absolute** QX URLs, facets = real subjects, no SIM-ids) and **real semantic** (mode
75:> - **Commits:** `e5457ea` (LOWs) + `88b50a0` (QX-backed) on `feature/control-plane-capture`.
76:> - **⚙ ACTIVATION (durable):** the always-up QX server **must run the new code** — restarted this
78:>   `npm install` in `frontend/`). **The 3 QX-repo files (`tools/qx/json_search.py`, its test,
79:>   `gui/qx_browser.py`) are STAGED in the QX repo but NOT committed** (they sit amid other in-flight QX
80:>   work) — commit them in QX's own flow.
81:> - **▶ Contract change:** `GET /api/questions` now returns the QX payload —
83:>   mode, degraded, facets}` with params `q/mode/subject/chapter/qtype/page` (the old `limit` + flat
84:>   `text` row are gone). `/api/questions/facets` is **unchanged** (still question-scoped subjects).
87:> owner-initiated captures end-to-end** and browses every read-only surface with live data, on branch
88:> **`feature/control-plane-capture`** (not yet merged). Built TDD + an **independent Codex review per
90:> - **Munshi capture (write):** `POST /api/munshi/capture` → live `MunshiClient.create_item` →
93:> - **mycontentdev seed capture (write):** `POST /api/mcd/seeds` → live `McdClient.create_seed` →
96:> - **Live-read passthroughs** `GET /api/munshi/library` + `GET /api/mcd/seeds` — the capture apps read
98:>   capture appears on refetch. (`/api/search?source=munshi|mycontentdev` was catalog-backed → empty.)
100:>   (**482 sims**), grade-grouped, linking the canonical extensionless `pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim`.
101:> - **QX browser fixed + separate:** `GET /api/questions/facets` is question-scoped (`qx.summary()`),
103:>   Questions app stays a standalone read-only browser (50 live QX rows, real q-type chips).
104:> - **LIVE-VERIFIED this session:** captured a real Munshi todo (`item_id 53`, library 13→14) and a real
105:>   mcd seed (`seed_01KVNN90…`, status `captured`, seeds 1→2) through the running server; both appear in
109:> - **Final integrated Codex review (`docs/codex-reviews/18-capture-final.report.md`): GO-WITH-FIXES** — 0
111:>   match, QX filter safe, write paths unchanged. Branch is **merge-safe**.
113:>   with the Questions work, then merge.
115:> **▶▶ NEXT SESSION — on branch `feature/control-plane-capture`, then merge (PR):**
116:> 1. ~~**Questions narrow fix (owner-requested):** raw LaTeX + literal `[fig]` + no semantic.~~ **✅ DONE
117:>    (2026-06-22, `88b50a0`)** — the Questions app is now QX-backed: real exact **+ semantic** search,
119:>    "thin wrapper" to **reuse the real QX engine via a localhost sidecar** (owner decision); QX gained a
125:> 4. **Optional test-coverage cleanup (still open, test-only):** QX facets degradation-branch tests
128:>    `feature/control-plane-capture` branch (capture control plane + Questions QX-backed + the LOWs).
129:>    **Before merge, also commit the 3 staged QX-repo files** in the QX repo (see ⚙ ACTIVATION above).
131:> **✅ DEC-3 AMENDMENT (2026-06-21, Chairman Deepak).** The morning's DEC-3 read-only firewall is amended:
132:> **owner-initiated capture** (a munshi item + an mcd seed) is now **in-scope** — the project's only two
133:> subsystem write paths. **Still binding & unchanged:** the human publish gate is **never automated**;
134:> **no automated munshi→mcd bridge** (promotion is a later explicit Chairman action); no app-platform
136:> Phase-3's full active loop stays parked (DEC-5). **New invariant wording: "read-only *except
137:> owner-initiated capture*."** Spec/plan: `docs/superpowers/{specs/2026-06-21-samagra-control-plane-capture-design.md,plans/2026-06-21-samagra-control-plane-capture.md}`.
141:> **Phase 0 (rename), Track A (stabilize) and Phase 1 (read-only subsystem adapters) are merged to `main`
142:> and pushed to `origin/main`.** **Phase 2 (governance) is now BUILT TDD on `main` (suite 63 → 98 green)**,
143:> reconciled to the runbook: **D6** (governance state lives in its own durable `governance.db`, separate from
145:> confirmed-CRITICAL only, diff-hash cached, audited break-glass, never wedges; real enforcement = CI). The
147:> The live plan is under `docs/superpowers/` (original brief: [`SAMAGRA-HANDOFF.md`](SAMAGRA-HANDOFF.md)).
150:> **Phase 2 SHIPPED (2026-06-19):** `origin/main` holds Phase 2 through `da9cab3` (the end-of-session doc-sync
151:> commits after it are local-ahead until the next `git push origin main`); the advisory
164:> dock-icon; theme-driven surface, verified live in aqua/console/samagra). **PUSHED to `origin/main` 2026-06-21
166:> **▶ E2 (data/control apps) is now MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` on
168:> apps** shipped as thin, **read-only** React wrappers over the existing FastAPI `/api/*` contract, plus the one
170:> mycontentdev · Munshi** (owner claude-deepak) and **Assignments (kanban) · Activity · Questions · Booklets ·
171:> INSP/Olympiad · Simulations** (owner claude-khanak). No new write paths; mcd/munshi render empty-or-unavailable
172:> states; Munshi capture/write is OUT of scope. All real logic lives in **seven pure-TS linchpin modules**
174:> `lib/activity/format` · `lib/questions/facets`); the 11 app components are thin wrappers over these + `useApi`.
184:> 501 vitest passing across 56 files** (497 at the E2 merge; the +4 are the post-merge `e1cb22a` Questions `/api/facets` tests) (439 E1 + 25 new lib tests incl. the catalog href/safeUrl tests + 33 app
196:> **E2 status right now:** **MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` on 2026-06-21**
203:> polish — the 3 themes already shipped in E1).** The E2 LOW follow-up — the Questions app consuming
204:> `/api/facets` — was IMPLEMENTED this session (commit `e1cb22a`, pushed to `origin/main`) but **introduced a
235:> **✅ RESOLVED (2026-06-22, `88b50a0`):** the Questions app no longer derives chips from catalog-wide
236:> facets at all — it now renders **filter-scoped facets straight from the QX engine** (`/api/qsearch`
237:> → `search.facet_counts`: subject/chapter/qtype), so the `SIM0xxx` leak is structurally impossible.
238:> The original bug write-up is retained below for history.
240:> **⚠ KNOWN BUG (RESOLVED — see above): Questions app subject chips show sim-ids, not subjects.**
241:> The Questions app (`frontend/src/apps/Questions/index.tsx`) renders its subject filter chips from
242:> `GET /api/facets`, whose `subjects` is **catalog-wide** (`select distinct subject from catalog`,
243:> `samagra/catalog.py:191`). The sims adapter writes each simulation's folder id (`SIM0018`…`SIM0626`) into the
244:> `subject` column (`samagra/adapters/sims.py:37`, `subject = after[0]`), so **~500 `SIM0xxx` ids dominate the
245:> chip list** (498 measured against `samagra.db` — 502 of 504 distinct catalog subjects come from the sims source). Global catalog facets ≠ the question bank's subject vocabulary;
246:> clicking a `SIM0xxx` chip filters `/api/questions?subject=SIM0xxx` → 0 QX rows. Compounded by QX's own
248:> fix `e1cb22a`** (already merged + pushed to `origin/main`). **Fix options (next session — keep it read-only,
249:> tests + `npm run verify` green):** (a) source the chips from a **question-scoped** subject list — QX
250:> `summary().subjects` (`samagra/adapters/qx.py:57`) via a new `/api/questions/facets` or the existing qx
251:> overview summary; (b) intersect `facets.subjects` with the subjects actually present in the returned
255:> (`catalog.py:199`) can never equal the question bank's subject vocabulary; the durable read-only fix is
256:> question-scoped facets (`qx.summary().subjects`), not catalog-wide facets.
263:HEAD `e1cb22a`), the **read-only safety invariant held exactly at the time of that audit** (no `create_seed`
265:by the DEC-3 amendment** (see the LATEST banner at the top): the invariant is now *"read-only except
266:owner-initiated capture"* with exactly two write paths (`/api/munshi/capture`, `/api/mcd/seeds`), the
274:  priority** and **parked the value-producing active loop** (munshi → seed → board-approve → publish — the
277:  work" and firewalls write paths) but **never restates the attention-ROI metric or the kill-criterion**, and
287:2. **DEC-2 · North-star binding.** The **attention-ROI north-star** (minutes-of-owner-attention per published
289:   OS track. Data source = the governance `events`/`review_overlay` ledger. (The ~3 hrs/wk figure stays the seed
296:   captures into seed-candidates vs ops; (b) read pipeline + gate status across all 5 pipelines; (c) locate and
301:5. **DEC-5 · Phase 3 is the primary value engine.** The active loop (munshi → seed → board-approve → publish)
309:1. ~~Fix the Questions facets bug.~~ **✅ DONE (`88b50a0`, QX-backed Questions).**
323:**Repo:** github.com/dbhardwaj86/samagra · `main` (E1 merged, `06d88a3`; **E2 merged, `31aa5bb`**) · **E2 MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` 2026-06-21 (Codex pre-merge review GO; 3 MEDIUMs fixed)** · local-first Python+FastAPI.
324:**State:** Spine + portal + thin/thick exporter + semi-autonomous loop + two read-only subsystem adapters
325:(mycontentdev seeds, munshi `library()`) reflecting into the catalog, **+ Phase-2 governance**: durable
326:`governance.db` store (assignments / events ledger / review overlay), `GET /api/assignments` + the
358:- `samagra/adapters/` — read-only source adapters → common `Artifact` (incl. Phase 1 `mcd.py`, `munshi.py`).
359:- `samagra/clients/` — read-only subsystem HTTP clients: `McdClient` (mycontentdev admin API), `MunshiClient` (`library()`); secret-safe, never logged.
360:- `samagra/governance/store.py` — Phase 2 durable `governance.db` store (D6): `assignments`, `events`, `review_overlay` + `schema_version`/migration hook + `backup()`. **Never delete `governance.db` as a "catalog reset".**
361:- `samagra/review/` — Phase 2 advisory pre-commit Codex review (D5): `codex_dispatch.py` (vendored subprocess shim, lazy exe) + `precommit.py` (confirmed-CRITICAL + `state/review/` diff-hash cache + `SAMAGRA_REVIEW_BREAKGLASS` audit). CLI: `samagra review-staged`.
364:- `samagra/catalog.py` — `samagra.db` unified catalog (FTS5) + search/overview/facets.
372:## Sources (read-only, paths in samagra/config.py / .env)
374:QX `C:\SandBox\gpt_box\gpt-extract-ques` · textbook `C:\SandBox\gpt_box\physics-textbook`
381:- QX `subject` column is unpopulated (physics-only); facet on chapter/q_type instead. **(Directly relevant to the ⚠ KNOWN BUG — `/api/facets.subjects` is catalog-wide, so the Questions chips surface sims `SIM0xxx` ids, not question subjects.)**
388:- **E2 (2026-06-21): MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main`** — the 11 data apps
400:   `superpowers:finishing-a-development-branch`). **Next build = E2** (data/control apps — read-only wiring
421:1. **Pre-merge Codex review → APPROVE** (gpt-5.5, xhigh): 6 rounds + a CEO adversarial Workflow audit. Caught a never-wedge HIGH, a recurring "outer guard downgrades a confirmed-CRITICAL block" class (5 ever-deeper instances: cache prune, malformed cached findings, broken-stderr warnings, pathological exception str/repr, and a finding's raising `__eq__` on the dedup), + 2 MEDIUM + nits — all fixed TDD (+11 invariant regressions, suite 98). Reports `docs/codex-reviews/07–13` + `12-workflow-invariant-audit.md`.
424:4. **Pushed** — `origin/main` holds Phase 2 through `da9cab3`. (NOTE: this end-of-session tracker-sync commit is local-only/unpushed — `git push origin main` it at the start of the next session.)
434:deploy QX + portal online (HF Space `QuestionDB` / Docker).

 succeeded in 4185ms:
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:1:# SAMAGRA control plane — Capture + read-only surfaces (Design Spec)
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:4:> **Decision basis:** Chairman directive 2026-06-21 — *"wire all the remaining apps (munshi and
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:5:> mycontentdev), pratyaksh sims (only the deployed ones) and QX browser separate. check everything
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:7:> control plane working (real captures end to end) and browsing all the read-only surfaces."*
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:8:> **Inputs read & verified (live where noted):** `samagra/clients/{munshi_client,mcd_client}.py`,
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:9:> `samagra/adapters/{munshi,mcd,sims,qx}.py`, `samagra/api/app.py`, the 4 frontend apps
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:10:> (`Munshi`, `Mycontentdev`, `Sims`, `Questions`), `myProd/src/index.ts` (munshi Worker — auth +
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:11:> write routes), `mycontentdev/server/app.mjs` (seed routes + auth), and `pratyaksh-May-deploy/`
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:13:> **Live-verified this session:** munshi prod `GET /api/library` over the cookie secret returned
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:18:implementation plan (`docs/superpowers/plans/2026-06-21-samagra-control-plane-capture.md`).
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:22:## 0. The DEC-3 amendment (Chairman, 2026-06-21)
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:24:This track **deliberately reopens write paths that DEC-3 firewalled earlier the same day.** Recorded
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:27:- **AMEND DEC-3.** *Owner-initiated capture* becomes **in-scope**: the OS may create a **munshi
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:28:  front-desk item** (`POST /api/item`) and a **mycontentdev seed** (`POST /api/seeds`). These are
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:29:  the only two new subsystem write paths.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:30:- **Unchanged & still binding:** the **human publish gate stays never-automated** (the sole sacred
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:31:  mutation); **no automated munshi→mcd bridge** (promotion happens only on an explicit later
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:32:  Chairman request); **no app-platform scope** (DEC-1); the **attention-ROI north-star +
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:33:  kill-criterion** (DEC-2) and the **pre-E3 attention-ROI gate** (DEC-4) remain binding; Phase 3's
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:34:  full active loop (auto-proposal, scheduling) stays parked (DEC-5).
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:35:- **New invariant wording:** *"read-only **except owner-initiated capture**."* Every other backend
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:36:  touch in this track is read-only.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:38:This amendment is recorded across `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, both OS specs,
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:45:Make the SAMAGRA OS the **working control plane**: real captures flow *out* to the live subsystems,
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:46:and every read-only surface browses *real* data.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:50:1. **Munshi capture (write).** From the Munshi app, the owner captures a front-desk item
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:51:   (`todo` / `note` / `followup` — the deterministic kinds the worker accepts) written to the **live prod munshi Worker**
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:53:2. **mycontentdev seed capture (write).** From the mycontentdev app, the owner creates a **seed**
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:57:4. **QX browser, separate + correct.** The Questions app stays a standalone **read-only** QX
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:58:   browser, and its **subject facets bug is fixed** (question-scoped subjects, not catalog-wide
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:62:read-only-or-creds-gated Python; React components/endpoints are thin. Each implementation gets an
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:69:Slices run **sequentially on one branch** (`feature/control-plane-capture`). Rationale: the writes
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:76:| 1 | Munshi capture (write) | write | ✅ |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:77:| 2 | mycontentdev seed capture (write) | write | ✅ |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:79:| 4 | QX facets fix (read) | read | ✅ |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:87:- **No automated munshi→mcd bridge.** Promotion of a munshi item into an mcd seed is a manual,
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:89:- **No publish automation.** The human publish/approve gate is untouched and never automated.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:90:- **No new write paths beyond the two capture endpoints.** No edit/delete/status-change of munshi
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:91:  items or mcd seeds from the OS in this track (the underlying APIs exist, but they stay out of
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:95:- **No catalog schema change.** `samagra.db` / `governance.db` untouched. New reads either query
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:96:  the catalog or parse a manifest / call QX directly.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:98:  the OS spec §7.4). The capture composers reuse existing component patterns.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:104:### 4.1 The write seam (new)
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:107:React app  ──POST /api/munshi/capture──►  FastAPI route  ──►  MunshiClient.create_item ──►  munshi Worker  POST /api/item   (cookie)
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:108:React app  ──POST /api/mcd/seeds──────►  FastAPI route  ──►  McdClient.create_seed   ──►  mycontentdev    POST /api/seeds  (x-mcd-key)
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:111:- **Single origin.** The frontend only ever calls SAMAGRA's own FastAPI (`/api/*`); FastAPI holds
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:113:- **Creds-gated.** Each write route returns **503** with a clear message when its client
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:115:- **Validated server-side.** Reject empty/invalid `kind` (munshi) / `type` (mcd) with **400**.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:117:  writes).
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:123:| `lib/capture/munshi.ts` | `buildMunshiCapture(form) → {ok, body} \| {ok:false, error}`: kind enum (`todo`/`note`/`followup` only), per-kind required fields (`todo`→assignee+task, `note`→student+issue, `followup`→date+note), per-kind optional passthrough (due/label/person), non-empty validation | pure `(formState) → result`; assert per-kind body shape + missing-field error |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:124:| `lib/capture/seed.ts` | `buildSeed(form) → {ok, body} \| {ok:false, error}`: type enum (`concept/question/snippet/simulation_idea/experiment/notebooklm_link/rough_idea`), title-optional-derive-from-raw_text, raw_text required | pure; assert body + validation |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:127:QX facets need no new TS logic module — the existing `lib/questions/facets.ts` is reused; only the
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:130:### 4.3 The write hook (new, thin)
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:132:`hooks/useApiPost.ts` — a minimal POST companion to `useApi` (GET-only today): `post(path, body)`
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:138:- **Munshi app** gains a **capture composer** (kind `<select>` of `todo`/`note`/`followup` +
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:139:  the selected kind's per-field inputs + Capture button) above the existing read-only library list.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:140:  Submit → `buildMunshiCapture` → `POST /api/munshi/capture` → refetch `library()`. *(Mic/photo FAB
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:141:  from the prototype is **not** in scope — text capture only; noted as a future option.)*
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:143:  raw_text `<textarea>` + Create button) → `buildSeed` → `POST /api/mcd/seeds` → refetch.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:147:- **Questions app** reads `GET /api/questions/facets` for its subject chips instead of the
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:148:  catalog-wide `/api/facets`.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:154:### Slice 1 — Munshi capture
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:156:- **Read (live-verified):** `GET /api/library` (cookie `munshi=<urlencoded secret>`) →
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:158:- **Write (grounded `agent.ts:227-236` + `tools.ts`):** `POST {MUNSHI_API_URL}/api/item` (same
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:162:- **Client:** add `MunshiClient.create_item(kind, fields)` → `POST /api/item` with
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:164:- **FastAPI:** `POST /api/munshi/capture` — body `{kind, ...fields}`; validates `kind` ∈ the three
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:168:### Slice 2 — mycontentdev seed capture
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:171:> (header `x-mcd-admin`) authorizes `/api/seeds` — `GET /api/seeds?limit=1` returned 200 with real
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:174:> *write* is authorized by the same `adminKey` reads already use. **No `APP_PASSWORD` / `MCD_APP_KEY`
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:175:> is needed.** (`ADMIN_KEY` is the intended Claude-session write credential.)
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:177:- **Write (contract read from deployed `functions/api/seeds/index.js`):** `POST {apiUrl}/api/seeds`
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:178:  with header **`x-mcd-admin: <adminKey>`**, body as **`multipart/form-data` / form-encoded**
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:181:  `files?` (**out of scope — text-only capture**) → **201** with the seed.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:183:  headers={"x-mcd-admin": adminKey}, data=fields)` (form-encoded; let `requests` set the content
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:185:  evolution-plan draft that POSTed JSON with `x-mcd-key` is superseded by this verified contract.)*
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:186:- **FastAPI:** `POST /api/mcd/seeds` — body `{type, title?, raw_text, detail?, source_ref?}`; 503
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:203:### Slice 4 — QX facets fix
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:205:- **Cause (already diagnosed):** `/api/facets.subjects` is catalog-wide (`catalog.py:191`), and
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:206:  `adapters/sims.py:37` writes `SIM0xxx` folder ids into `subject`, so the chips are dominated by
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:207:  sim ids and clicking one yields 0 QX rows.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:208:- **Fix (read-only, durable):** `GET /api/questions/facets` →
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:210:  Empty/absent QX → empty lists. The Questions app reads this instead of `/api/facets`.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:216:- **Owner-initiated only.** Both writes fire on an explicit button click in the owner's console.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:217:  Per the approved default, capture submits **directly on click** (no extra confirm dialog); the
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:223:- **Publish gate sacred.** No publish/approve automation anywhere in this track.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:232:- **pytest** (`.venv\Scripts\python -m pytest -q`, PYTHONPATH=repo root): client write methods with
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:233:  a **mocked** `requests` (assert URL, method, headers incl. cookie/`x-mcd-key`, body, secret never
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:237:- **Vitest** (`npm run verify` = lint → tsc → vitest → build): pure `lib/capture/*` + `lib/sims/
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:239:  renders, submit calls `post`, list refetches; Sims renders deployed rows + links; Questions reads
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:240:  the new facets path).
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:242:- **Live (Slice 6, outside the unit suite):** real munshi capture round-trip (write → it appears in
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:243:  `library()`), real mcd seed create (once `MCD_APP_KEY` is provided), deployed-sims links resolve,
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:244:  QX facets show real subjects — with preview/screenshot proof.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:250:- **Branch:** `feature/control-plane-capture` off `main`. Sequential slices; one focused commit per
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:270:| `MUNSHI_API_URL` + `MUNSHI_SECRET` | munshi read **and** capture write | ✅ in `.env` (prod Worker; live-verified read) |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:271:| `mcd-cloud.json` `adminKey` | mcd **reads** *and* **seed write** | ✅ present; live-verified to authorize `/api/seeds` |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:272:| ~~`MCD_APP_KEY` / `APP_PASSWORD`~~ | ~~mcd write~~ | ❌ **not needed** — `adminKey` authorizes the write (verified); the legacy `test-my-ship` candidate was rejected by `/api/auth/status` |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:273:| (none) | sims, QX | read existing local sources / live QX |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:275:**All creds for both capture paths are in place** — the full live end-to-end verification (Munshi
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:276:*and* mcd) can run this session.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:284:| Writing to **production** munshi/mcd | Server-side validation, creds-gating, owner-initiated only, no delete/edit/publish; live verification done deliberately in Slice 6 with the owner |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:285:| `/api/item` body shape guessed wrong | Ground it against `myProd/src/agent.ts` + `tools.ts insertItem` before writing live; unit-test the built body; first live write is a single benign item the owner can dismiss |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:286:| mcd write auth (which key?) | **Resolved** — deployed middleware accepts `adminKey` for `/api/seeds` (live-verified GET 200); no per-route re-check. `create_seed` uses `x-mcd-admin: adminKey`. First live write is a single benign seed the owner can archive |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:287:| mcd seed body format | **Resolved** — deployed worker uses `request.formData()`, so `create_seed` sends form-encoded, not JSON (the plan's JSON draft would have failed) |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:291:| Scope creep back toward the active loop | Explicit non-goals (§3); no scheduler/bridge/publish work |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:299:1. **Munshi capture works live** — a capture submitted from the OS appears in the prod munshi
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:301:2. **mcd seed capture works live** — a seed created from the OS appears via the mcd read path
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:302:   (`adminKey` authorizes the write; no extra cred needed).
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:305:4. **Questions facets fixed** — subject chips are real question subjects (no `SIM0xxx`), and
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:306:   selecting one returns QX rows; QX browser remains standalone read-only.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:311:7. **DEC-3 amendment + pointer files synced** — `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, both
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:312:   OS specs, `CLAUDE.md`, and project memory record the amendment and the new
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:313:   "read-only except owner-initiated capture" invariant.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:1:# SAMAGRA OS — Experience Track Design Spec
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:4:> **Decision basis:** approved "SAMAGRA OS" direction + extracted hi-fi design handoff.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:8:> (+ the `SAMAGRA OS.dc.html` prototype it documents; `support.js` is NOT ported).
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:16:> This spec re-adopts "OS" as the product metaphor, but the **2026-06-19 evolution spec deliberately
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:17:> *retired* the word "OS"** — *"it silently licenses OS-sized scope"* — and bound SAMAGRA to an
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:18:> **attention-ROI north-star + a kill-criterion** (freeze if not saving the owner ~3 hrs/wk by Phase 2). An
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:21:> work" and firewalls write paths) but **never restates the attention-ROI metric or the kill-criterion**, and
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:22:> parks the value-producing active loop while OS chrome (3 themes, a Snake game, mobile mode) grows; the "frugal"
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:23:> value sits unaddressed. **Decided (now BINDING — see HANDOFF DEC-1…DEC-5; firewall in §3, gate in §2):** (1) frame SAMAGRA OS as a *bounded operator
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:24:> console / UI-metaphor only* — no app-platform scope; (2) restate the attention-ROI north-star + ~3 hrs/wk
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:25:> kill-criterion as still binding (data source = the governance `events`/`review_overlay` ledger); (3) add a
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:27:> process-scheduler model, no user-facing identity); (4) add an attention-ROI acceptance gate before E3; (5) give
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:28:> Phase 3 a dated restart commitment after the E2 visual-QA pass. Full write-up: `HANDOFF.md` → *Direction-coherence
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:33:**SAMAGRA OS** is a desktop-and-mobile, operating-system-style GUI that becomes the
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:34:**control plane** for SAMAGRA — the agentic JEE/NEET physics content operation. It replaces
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:35:the retired Jinja portal with a windowing-metaphor shell: a top bar / dock, free-floating
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:37:pipelines, agent org, content libraries) alongside first-class OS utilities (Clock, Notes/
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:42:production by the existing FastAPI control plane, with **all real behavior pushed into pure,
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:46:Why an OS metaphor: the operation is genuinely multi-app and multi-agent (a board of agents
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:47:owns pipelines and gates), so a windowing control plane — multitasking, a live org chart, a
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:54:`samagra/portal/` is retired (kept in git history); two agents own disjoint worktrees; the
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:66:| **E1 — Shell + Aqua + OS utilities** | `aqua` theme only; `pc` device only | **Shell** (top bar + Dock + window frame + context menu + work-area), **Dashboard**, **Settings**, **Terminal**, **Clock**, **Notes/To-dos**, **Snake** | Dashboard/Settings read existing `/api/*`; Terminal optional live; Clock/Notes/Snake = **zero backend** (localStorage only) | **IMMEDIATE** |
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:67:| **E2 — Data/control apps** | (still aqua/pc) | **Pipelines**, **Assignments** (kanban), **Org Chart**, **Questions**, **Lectures**, **Booklets**, **INSP/Olympiad**, **Simulations**, **mycontentdev**, **Munshi** (read-only), **Activity** | Wired to existing backends; reuse `/api/search`, `/api/pipelines`, `/api/assignments`, `/api/questions`; **one genuinely new endpoint: `/api/org`** (+ optional aggregators) | Planned |
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:84:> **E3 is gated (DEC-4, ratified 2026-06-21).** Before any E3 work (mobile device mode / further theme polish)
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:85:> begins, an **attention-ROI acceptance gate** must pass: 2–3 representative operator tasks measured for owner
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:86:> time-saved via SAMAGRA OS vs the old portal; **fail → freeze GUI expansion and reprioritize Phase 3** (the
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:87:> active loop). The attention-ROI north-star + kill-criterion (the 2026-06-19 vision §1) remain **binding**
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:88:> (DEC-2). See `HANDOFF.md` → *Direction-coherence DECISION*.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:94:- **Scope firewall (DEC-3, ratified 2026-06-21).** SAMAGRA OS is a **bounded operator console — a UI metaphor
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:96:  scheduler-as-platform model; no user-facing product identity. SAMAGRA stays a control plane and does **not**
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:98:- **No new write paths in E2.** Every backend touch in E2 was **read-only**.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:99:  > **⚠ AMENDED 2026-06-21 (DEC-3 amendment, Chairman) — post-E2 capture track.** Owner-initiated
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:100:  > capture is now in-scope as a separate track (branch `feature/control-plane-capture`): exactly two
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:101:  > write paths — `POST /api/munshi/capture` (a munshi item) and `POST /api/mcd/seeds` (an mcd seed).
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:102:  > The human publish gate stays the **only never-automated mutation**, there is **no munshi→mcd
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:103:  > bridge**, and the invariant becomes *"read-only except owner-initiated capture."* See
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:104:  > `docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md`.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:111:  (`samagra.db`) and governance ledger (`governance.db`) stay as-is (runbook D6). New read
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:137:Prod is a single origin (no proxy, no CORS).
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:151:no network. The exact values to assert against are the verbatim prototype constants captured in
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:213:TeachingOS/
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:229:│     ├─ os/                     # OS-level wiring (work-area, keyboard gating, interval hygiene)
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:248:│     │  └─ <E2 apps…>           # Pipelines, Assignments, Org, Questions, Lectures, Booklets,
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:274:| App (phase) | Endpoint(s) reused | New read-only work |
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:276:| Dashboard (E1) | `/api/overview` + `/api/pipelines` + `/api/assignments` | 🟡 optional `GET /api/dashboard` aggregator (flat hero stats) — removes fragile client glue; pure read-only aggregation, no new tables |
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:283:| Questions (E2) | `GET /api/questions` (LIVE QX) + `/api/facets` | optional `exam` field in the QX SELECT (additive) |
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:289:| Munshi (E2) | `GET /api/search?source=munshi` (read-only) | none; **capture/write is OUT of scope** (no write endpoint exists) |
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:293:(`QX_ROOT, TEXTBOOK_ROOT, BOOKLETS_ROOT, INSP_ROOT, SIMS_ROOT, EXPORT_DIR`) or it 403s.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:295:**Empty-state handling (data-state, not API gap):** governance.db ships empty (kanban/activity
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:296:empty on fresh DB); mcd/munshi appear only post-`/api/refresh` with creds. Every E2 app must
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:326:fail-fast) — the single per-task "done" signal, mirroring the Python full-suite green gate.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:329:Pixel/visual parity against the prototype + `screenshots/` reference captures is a **human QA
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:355:  khanak's files are thin wrappers → the two never write the same file.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:358:exported types/stores but never writes them. The single natural hot-spot — `registry.ts` — is
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:367:**Gate + cadence (mirrors `conventions.md`):** every task is RED (write failing Vitest/pytest,
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:390:| **mcd/munshi creds-gated + refresh-gated** → empty/absent sources | Every data app renders graceful empty/absent states; check in-body `error` for `/api/questions`; treat absent source as "needs creds," not a crash |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:5:**Integration contracts in this doc were verified** against the live repos on 2026-06-19 (read-only fan-out, 5 agents). File/line citations are real.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:8:> "SAMAGRA OS" windowing GUI (see `specs/2026-06-20-samagra-os-experience-design.md`) — which re-introduces the
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:9:> "OS" framing this spec **deliberately retired in §1**, and parks the Phase-3 active loop (§8) below it. A
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:11:> **COHERENT-WITH-CAVEATS**). **The attention-ROI north-star (§1) and the kill-criterion (§1) remain the binding
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:12:> test and have NOT been voided.** **Ratified 2026-06-21:** SAMAGRA OS is bounded to a *UI-metaphor operator
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:13:> console* (scope firewall + a pre-E3 attention-ROI gate; DEC-1…DEC-5), and Phase 3 (the active loop) restarts
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:15:> (rename → adapters → governance → active loop) is unchanged on the merits; the *sequencing* (GUI first) is now
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:22:TeachingOS **slice-1** is built, verified (11/11 tests), and open as **PR #1** (`slice-1 → main`, MERGEABLE). It is a local-first Python + FastAPI **control plane**: read-only adapters normalise 7,044 artifacts (QX / textbook / booklets / INSP / sims) into a unified FTS5 catalog (`teachingos.db`); a JSON-file phase state machine drives four pipelines; a forked-QX portal (JS-SPA) exposes search + a gate board; a thin/thick lecture exporter emits HTML + DOCX (OMML) + Google Docs; a semi-autonomous tick loop notifies via Telegram/email. **This spec extends that spine — it does not rebuild it.**
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:24:SAMAGRA (समग्र — *integrated / whole*) grows the spine into a **company-structured control plane** for the operator's content lifecycle: a board of three frontier agents governing a worker fleet, folding in `mycontentdev` (editorial seed pipeline) and `munshi` (phone capture clerk), with a blocking pre-commit Codex review and a CEO prompt-outbox. It is inward-facing back-office infrastructure for a single operator (§1), not a product and not an audience-facing OS. *(The "OS" framing is retired — A14/D9; see §1.)*
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:28:**Values.** SAMAGRA is built on three first-class values: *local-first*, *frugal*, and *graceful-degradation-under-owner-absence* (bus-factor-of-one must not be fatal). During owner absence, read-only lanes (capture, reflect, classification, linking) keep running and pile into a ranked, publish-ready queue; PUBLISH HALTS BY DEFAULT so nothing ships unapproved and nothing rots silently — absence costs latency, not loss. (Coverage-recompute joins these lanes only once that lane exists — Phase 2+.)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:30:SAMAGRA is a *control plane*, deliberately NOT an *operating system*: it routes, reflects, and gates — it does not own a process model, scheduler-as-platform, or app lifecycle. The word "OS" is retired because it silently licenses OS-sized scope; SAMAGRA stays a thin layer over subsystems that remain their own source of truth. (It is deliberately NOT framed as a "single pane of glass" — that framing was rejected as a north-star because it measures *seeing*, not *value*.)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:33:- **Spine:** SAMAGRA owns exactly one durable primitive — a trajectory/review work-item that REFERENCES a subsystem record (seed/artifact) by id and tracks where it sits in capture→enrich→review→publish. Content source-of-truth stays in each subsystem (§2 boundary unchanged); SAMAGRA owns trajectory, not content. The JEE/NEET syllabus is a read-only projection axis, not a graph SAMAGRA curates. (The durable table that realizes this overlay is a Phase-2 build — see §6c, §9, D6.)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:35:- Make SAMAGRA *see* mycontentdev and munshi as first-class read-only sources, reflecting their state (not duplicating it).
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:36:- Stand up the governance layer: per-agent worktrees, a prompt outbox, an Assignments portal tab, and a blocking pre-commit Codex review.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:37:- Wire the active capture→seed loop (munshi → mycontentdev) behind board approval.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:42:- No new write paths into the subsystems beyond the single board-approved seed-creation in Phase 3.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:45:- SAMAGRA is permanently inward-facing back-office infrastructure for a single operator. It has no audience, no users, and no go-to-market identity, and is NOT a transferable operating-model or product for other AI-native creators. If a learner-facing product ever emerges, it is a SEPARATE entity that consumes SAMAGRA's published corpus — never SAMAGRA itself. *(Resolved 2026-06-19 / A6: the published OUTPUT MAY be public-facing via that separate entity; the OS itself stays inward.)*
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:47:- No mining/learning from the decision ledger in any current phase. **Named-but-dormant:** when built, the DRAFTER may compound on Deepak's approval history (style/selection/structure); ONE adversarial REVIEWER stays anchored ONLY to external read-only ground-truth (answer keys, dimensional consistency, official syllabus weightings, known-misconception lists) and is NEVER trained on Deepak's approvals. Adversarial-reviewer catch-rate trending to zero is a RED FLAG (monoculture), not success. (Whether board-correction-rate ever becomes a headline metric is named only as a dormant possibility — the front-page metric is attention-ROI per D12.)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:48:- **Offline demand compass (named-but-dormant; depends on the dormant coverage scoreboard and the frozen concept vocabulary):** once a coverage axis exists, enrichment can be steered by demand signal Deepak ALREADY produces locally — (1) which concepts his QX paper-builder under-draws from (draw-asymmetry as a pointer at holes), and (2) his own post-use flags on questions captured via munshi ("too hard", "students missed this"). This adds NO Phase-1 schema and NO munshi write: the munshi one-tap flag is a munshi-SIDE capture feature SAMAGRA does not own and would only REFLECT if munshi adds it; SAMAGRA's munshi access stays read-only (refs/excerpt/hash, D3). The richer online learner-performance loop stays a dormant 3-year aspiration (not-online non-goal). Caveat: Deepak's own draw-asymmetry is a biased proxy for student need and can reinforce existing blind spots.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:50:**Kill-criterion (anti-vision).** SAMAGRA exists to give back the single operator's scarcest resource — attention. SAMAGRA is FROZEN if, by [Y = end of Phase 2: governance layer green + one golden capture→publish thread proven + N weeks of real operating use], it is not demonstrably saving the owner [X hrs/week — owner to ratify once the Phase-2 attention-ROI gauge (A8/D12) exists; seed proposal ~3 hrs/wk over ~8 weeks, NOT yet binding] of routing/triage/status-chasing versus the prior point-tools workflow. On freeze: no Phase-3 build, revert to point tools, the spine stays only as a read-only status mirror. This is a manual judgement the owner makes from the attention-ROI gauge — never a status SAMAGRA computes about itself, and no hours-saved column is added. Naming the exit now is the cheapest insurance against the meta-tool quietly out-competing the actual teaching product for the operator's time.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:56:| §9.1 | Build order | **Adapters → governance → loop**, all in one phased plan (Phase 0 rename precedes). |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:58:| §9.2 | mycontentdev read | **Cloud admin API, read-only** (`POST /api/admin/query`, `GET /api/admin/pending`; `x-mcd-admin`). |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:59:| §9.3 | munshi read | **Reuse `driver.mjs` `library()`** over `GET /api/library`, read-only. |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:63:| §9.8 | Codex gate | ~~Block on `severity==CRITICAL`, no escape hatch, fail-closed~~ **→ SUPERSEDED by D5/D9 (2026-06-19):** advisory-local (confirmed-CRITICAL, staged-diff-hash cached, audited break-glass) + enforced-CI; the human publish gate is the only sacred block (see §10 gate model). |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:64:| §9.4 | munshi→mcd bridge | **Propose → board-approve → create via capture API** (`POST /api/seeds`, app key). |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:65:| §9.9 | Org titles | **Adopt the proposed chart**; human Founder & Chairman = **Deepak (the BOSS)**. |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:69:**Board — review & approval authority** (only these three may review other agents' outputs and approve writes; each works from its own worktree):
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:73:| Founder & Chairman ("the BOSS") | **Deepak** (human) | Vision; final publish gate; resolves board disputes. |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:74:| CEO | **Claude-Deepak** | Orchestrator: routes work, writes the outbox, owns gates + the loop. |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:76:| Chief Architect & Code-Review Lead | **Codex** | Architecture + the blocking pre-commit review; approves code writes. |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:80:**Departments — data/capture surfaces:** munshi (Front Desk), mycontentdev (Editorial), QX (Question Bank), physics-textbook (Lectures), booklets (Print/Proofing), INSP (Olympiad), pratyaksh (Sims, read-only), GN-OCR (Handwriting).
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:90:Phase 1  Subsystem adapters            (mycontentdev + munshi → catalog; reflect state; review overlay)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:92:Phase 3  Active loop                   (munshi item → proposed seed w/ pointers → board approve → capture API)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:105:- `scheduler.py:22` `TASK_NAME = 'TeachingOS-tick'` → `'SAMAGRA-tick'`.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:110:2. `gh repo rename samagra` (auto-redirects old URL; updates `origin` — verify `git remote -v`).
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:115:**Safety:** no secrets/content/machine-paths committed; `.env`, `mcd-cloud.json`, `.dev.vars`, `*.db`, `state/` stay gitignored.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:119:> **Phase-1 acceptance (A4/D9c):** Phase 1 proves the **read-only slice** of the golden thread (munshi → seed → enriched → published); "published" closes only after the Phase-3 board-approved write (D2/D7). Phase 1 accepts exactly the two new adapters reflecting + the mycontentdev pipeline reflected read-only + the existing slice-1 publish gate reused unchanged — no new write path, no new status/step.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:124:- Reads the **cloud admin API** (production D1): `POST /api/admin/query` with body `{ sql: "SELECT … " }` (validated `^(select|with|pragma)` — read-only by construction), and `GET /api/admin/pending`. Auth header **`x-mcd-admin`**; admin key from gitignored `mcd-cloud.json` (`{apiUrl, adminKey}`) or env `MCD_ADMIN_KEY`.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:125:- Emits one `Artifact` per seed: `source="mycontentdev"`, `kind=seed.type` (one of `concept|question|snippet|simulation_idea|experiment|notebooklm_link|rough_idea`), `status=seed.status` (`captured|needs_processing|processing|draft_ready|changes_requested|approved|brief_generated|content_linked|done|archived`), `meta={seedId, draft/canonical revision ids, …}`.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:126:- **Never** writes drafts/approvals — the existing Claude-enrichment + GUI path owns that.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:128:### 6b. munshi adapter (`MunshiAdapter`)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:129:- Reads `{people, total, items}` via `GET /api/library`. Reuse `stress/driver.mjs` `MunshiClient.library()` (shell out to Node, or port the single GET). Auth = **`Cookie: munshi=<secret>`** (URL-encoded; constant-time SHA-256 vs **`MUNSHI_SECRET`** — *one* env var name for dev and prod). Secret from gitignored `.env`, **never echoed/logged/committed**.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:130:- Item shape: `id, kind (note|todo|issue|question|followup), payload (JSON), tags, status (open|claimed_done|validated|dismissed), due, ts, person`. Emits one `Artifact` per non-dismissed item: `source="munshi"`, `kind=item.kind`, `status=item.status`, `meta={payload, person, tags, due}`.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:134:- Add `mycontentdev` (and optionally `munshi-intake`) pipelines to the **`PIPELINES` dict in `state.py`** (hardcoded by design). Mirror the verified `scheduler._reflect_textbook(dry, events)` pattern: `state.load(pipeline)` → `state.set_phase(pipeline, phase, status, **fields)` → `state.save(st)`; reflect mycontentdev seed-status into phase status read-only. **Honor `config.TEXTBOOK_LOCK`-style coexistence** — if a subsystem runs its own automation, don't fight it; mirror only.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:135:- **Board-review overlay** = `samagra.db` tables (§9) recording board-agent approval of *worker outputs* across subsystems; references subsystem records by id, never copies their content. This trajectory/review work-item is the single durable thing SAMAGRA owns — it tracks *trajectory*, not content (§2 boundary unchanged). **Phasing note (D9a):** although described here under Phase 1, the durable table that realizes this overlay (`review_overlay`, with `assignments`/`events`) is a **PHASE-2** build (plan `governance/store.py`; §9; D6 splits it into `governance.db`). The spec's Phase-1 placement is superseded by the runbook (D6) + the Phase-1 loop backlog, which creates NO governance table in Phase 1. Phase 1 reflects subsystem state only and adds no governance schema. **Front-page metric (A8/D12):** the chosen north-star is attention-ROI (minutes-of-Deepak-attention-per-published-artifact), computed from the `events` ledger — therefore a Phase-2 render, zero Phase-1 schema; coverage-at-tier is the named-dormant Phase-2+ successor.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:137:## 7. Phase 2 — governance mechanics
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:149:> **SUPERSEDED by runbook D5/D9 (2026-06-19):** the gate is **advisory-local** — it blocks only a *confirmed*-CRITICAL finding surviving the staged-diff-hash cache, with an **audited break-glass** (`SAMAGRA_REVIEW_BREAKGLASS="<reason>"`, logged), and **real enforcement in CI / branch protection** — **NOT** fail-closed / no-escape-hatch. The bullets below describe the original (retired) fail-closed design; read them through D5/D9. The human publish gate (Gate 1) is the only sacred, never-automated block.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:152:- **Invocation (verified pattern from `codex_dispatch.py`):** `codex exec --ephemeral --skip-git-repo-check --sandbox read-only --output-last-message <tmp.json> --color never -`, prompt on **stdin**, structured findings read back from the temp JSON. Resolve the CLI via `shutil.which("codex")` / `CODEX_BIN`. **Reduce `timeout_s` from the default 900 to ~90s** for pre-commit ergonomics; keep `max_attempts=2`.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:154:- **No escape hatch:** there is no bypass env flag; a CRITICAL verdict always blocks. **Fail-closed on unavailability** (confirmed by owner): if Codex errors/times out/JSON-fails twice, the hook **blocks** with loud diagnostics (how to restore `codex` on PATH, how to inspect the staged diff). The hook can shell to a small `samagra/review/precommit.py` that imports the dispatch helper, so logic is testable.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:159:## 8. Phase 3 — the active loop (munshi → mycontentdev → board → publish)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:161:1. **Scan + classify:** SAMAGRA reads munshi items (Phase-1 adapter) and classifies each as *content-seed candidate* vs *ops-todo* (heuristics on `kind`/`payload`/tags; e.g. `question`/`note` about physics → candidate; `followup`/`issue` about a student → ops).
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:162:2. **Draft a proposed seed + exact pointers:** build a `POST /api/seeds` payload — `type` (mapped from munshi `kind`, default `rough_idea`), `raw_text` (the item's payload text, verbatim), `detail` (per-type JSON; for `rough_idea`: `{braindump, possible_directions, proposed_type, rationale}`). **Exact pointers** = candidate corpus artifacts SAMAGRA resolves from its own FTS5 catalog (QX/textbook/booklet/INSP `uid`s + titles), attached in `detail`/`meta` so downstream enrichment knows the source.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:164:4. **On board approval:** create the seed via `POST /api/seeds` with the **app password** (`x-mcd-key` header / `?k=`), from gitignored `.env`. Capture creates revision #1 `origin='user_original'` (immutable).
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:165:5. **Hand off:** the **existing** mycontentdev enrichment (Claude session writes `claude_draft`) + **GUI approval** (draft→canonical) flow takes over. SAMAGRA only *reflects* status from here. Publish gates (HTML/DOCX/GDocs, question corpus, media) stay the slice-1 exporter, now driven by approved content.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:167:> **Two keys, two zones:** reads use the **admin key**; the single board-approved write uses the **app password**. Both gitignored. SAMAGRA never writes a draft, never approves, never edits an original — those remain mycontentdev's existing actors.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:177:**Decision-ledger (A10):** the append-only `events` ledger plus `review_overlay` ARE SAMAGRA's decision ledger — every board approve/reject/changes is one immutable row. These tables first **materialize in Phase 2** (`governance.db`, per D6) — runbook D6 + the Phase-1 loop backlog (which creates no governance table) supersede §6c's Phase-1 description. Phase 1 adds no decision-capture schema because Phase 1 has no approve/reject surface. Rows stay free of structured rejection-reason metadata (schema-freeze D11): verdict + free-text rationale only, no enumerated reason columns.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:183:- All subsystem reads are **read-only**; the **only** write is the board-approved `POST /api/seeds` in Phase 3.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:184:- **Never** echo/log/commit secret *values*: `MUNSHI_SECRET`, the mcd **admin key** + **app password**, any `.env` / `mcd-cloud.json` content. Names only in docs.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:185:- `pratyaksh` sims stay read-only; prefix any test entities `Testbot`; never mutate/dismiss/delete pre-existing munshi items when testing against prod.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:190:**Capability boundary (folds A7; strengthens invariant #1 above).** Safety is structural, not a promise the operator must remember. Every adapter is, by construction, READ-ONLY in Phase 1 — none exposes a mutating method. Writes are a typed, board-gated capability class whose Phase-1 membership is the EMPTY SET; the first and only member, `McdClient.create_seed`, is enumerated only when it ships in Phase 3 and is reachable only through the approved-assignment path (D7). Any write not in this enumerated set is rejected because no code path exists to perform it — rejected by architecture, not by a reviewer. Adding a member is a Chairman decision, not routine engineering. This capability boundary adds no Phase-1 type, field, registry, or callable surface; it is enforced today solely by the absence of any mutating code path.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:192:**Gate model (folds A5 / runbook D9; supersedes §9.8).** Three ranked gates only: **Gate 1** — the human publish gate (BLOCKING, sacred, never automated) carries the physics-correctness checklist (sign conventions; limiting cases; difficulty/JEE-NEET calibration; ambiguity; corpus-linkage) as human-run prose at the existing `publish` gate (no new column/status/step); **Gate 2** — Codex pre-commit (BLOCKING, repo-wide per D5: advisory-local + confirmed-CRITICAL-only + audited break-glass + enforced-CI); **Gate 3** — advisory (non-blocking) for all other code/physics review. The fail-closed / no-escape-hatch language of §9.8 + §7c is **retired** (D5/D9).
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:196:- **Adapter tests** against fixture/mocked API responses (no live-prod dependency in CI): mcd query/pending JSON → `Artifact`s; munshi `library()` JSON → `Artifact`s; `available()` false when creds absent.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:199:- **Codex hook unit test:** findings with a *confirmed* `CRITICAL` → non-zero exit; empty/HIGH/MED/LOW findings → zero; Codex-unavailable → **does not wedge commits** (advisory-local per D5; real enforcement is CI). Mock the dispatch helper. *(Supersedes the original fail-closed assertion.)*
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:200:- **Bridge dry-run test:** munshi item → proposed seed payload (+ resolved pointers) **without** writing; classification heuristics.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:204:1. **Capture auth = app password.** SAMAGRA must hold the mcd **app password** (not just the admin key) to create seeds. Confirm the owner is comfortable storing it in SAMAGRA's gitignored `.env`. *(Mitigation: the write is board-gated and rare.)*
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:205:2. **munshi auth is a cookie, not a header.** The adapter must send `Cookie: munshi=<MUNSHI_SECRET>`; simplest is to drive the existing `MunshiClient` (which already does this) rather than re-implement.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:207:4. **~~Fail-closed wedge risk.~~ RESOLVED by D5 (2026-06-19):** the local hook is **advisory** (a broken `codex` does NOT block commits); the confirmed-CRITICAL block is cached by staged-diff hash with an audited break-glass, and real enforcement lives in CI / branch protection. This retires the original fail-closed trade-off.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:213:- Autonomous worker dispatch (Codex/Gemini/NotebookLM/Grok actually executing assignments) is out of scope THIS round — the outbox only routes. **Named-but-dormant trajectory (A9/D12):** autonomy will later arrive as a per-lane trust ratchet bounded by the read/write line, never a global flip. A lane earns auto-dispatch only after ~20 consecutive human-accepted-uncorrected runs; any single correction resets it to manual; **publish is never a lane**; auto-dispatch is permitted only for read-only-adapter operations whose output is itself a gated draft. First lane to graduate (post-Phase-1) = **adapter-refresh / status-reconciliation** (read-only by construction, no stake to mis-classify); classification/routing graduates second. This trajectory adds ZERO Phase-1 schema; the WATCHED-run history it will later consume comes for free from the decision-ledger (A10). Mechanism (trust counter, lane status, graduation step) is deferred to its own post-Phase-1 slice.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:214:- A read-only export route added to munshi (rejected in favor of `library()` reuse).
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:216:- A dormant, auto-expiring, time-boxed pre-approval for exactly ONE no-new-physics class (e.g. re-publishing already-approved content to an additional format), armed by the owner before leaving (graceful-degradation-under-absence, A11). NOT built in any current phase and adds no Phase-1 schema — it pre-approves a CLASS, never an item, and is the one valve where a degradation path could leak student-facing content, so it stays unbuilt until explicitly chosen.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:222:| mcd capture | `mycontentdev/functions/api/seeds/index.js`; revision #1 immutable `functions/api/_lib/repo.js:207` |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:223:| mcd admin read | `functions/api/admin/{query,pending}.js`; auth `functions/api/_lib/auth.js:21`; `x-mcd-admin` |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:224:| munshi read | `myProd/stress/driver.mjs:146` `library()`; auth `myProd/src/index.ts:18`; `MUNSHI_SECRET` |
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:225:| adapter contract | `TeachingOS/teachingos/adapters/{__init__.py,base.py}`; `ALL_ADAPTERS` |

codex
The docs themselves contain contradictions across time: older status sections still say no `create_seed`, while newer sections claim exactly two capture writes. I’ll base the mismatch analysis on the current code and call out stale doc claims separately from actual security issues.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"@(app|router)\\.(get|post|put|delete|patch)|def .*\\(|HTTPException|refresh|tick|gate|munshi|mcd|questions|sims|open|StaticFiles|catch|fallback|Cf-Access|Cloudflare|capture|seed\" samagra/api/app.py" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "def |class |requests|httpx|Cookie|MUNSHI|secret|raise|Exception|create_item|create_seed|x-mcd|admin|apiUrl|available|sanitize|payload|fields" samagra/clients/munshi_client.py samagra/clients/mcd_client.py samagra/clients/qx_client.py' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"fetch\\(|useApi|useApiPost|POST|post\\(|/api/munshi|/api/mcd|/api/refresh|/api/tick|/api/gate|/api/questions|/api/facets|capture\" frontend/src" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "def |class |questions|asset|url|http|QX|facets|SIM0|subject|chapter|qtype|degraded|error|Exception|500" samagra/questions_proxy.py samagra/sims_manifest.py samagra/governance/store.py samagra/review/precommit.py' in C:\SandBox\claude_box\TeachingOS
 succeeded in 3333ms:
samagra/clients/qx_client.py:9:No secret: QX is local and fail-open on localhost (Cloudflare Access only engages
samagra/clients/qx_client.py:14:import requests
samagra/clients/qx_client.py:21:class QxClient:
samagra/clients/qx_client.py:22:    def __init__(self, base_url: str | None = None):
samagra/clients/qx_client.py:25:    def search(self, *, q: str = "", mode: str = "exact", subject: str | None = None,
samagra/clients/qx_client.py:31:        r = requests.get(f"{self.base_url}/api/qsearch", params=params, timeout=_TIMEOUT)
samagra/clients/qx_client.py:32:        r.raise_for_status()
samagra/clients/mcd_client.py:4:{apiUrl,adminKey} at the mycontentdev repo root, or env MCD_API_URL /
samagra/clients/mcd_client.py:8:available) plus the owner-initiated capture write create_seed (POST /api/seeds,
samagra/clients/mcd_client.py:9:form-encoded, authorized by the adminKey via the x-mcd-admin header) are
samagra/clients/mcd_client.py:18:import requests
samagra/clients/mcd_client.py:27:def _load_cloud_json() -> dict:
samagra/clients/mcd_client.py:32:        except Exception:  # noqa: BLE001
samagra/clients/mcd_client.py:37:class McdClient:
samagra/clients/mcd_client.py:38:    def __init__(self, api_url=None, admin_key=None, app_key=None):
samagra/clients/mcd_client.py:40:        url = api_url or os.environ.get("MCD_API_URL") or file.get("apiUrl") or ""
samagra/clients/mcd_client.py:42:        self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
samagra/clients/mcd_client.py:45:    def available(self) -> bool:
samagra/clients/mcd_client.py:46:        return bool(self.api_url and self._admin_key)
samagra/clients/mcd_client.py:48:    def query(self, sql: str) -> list[dict]:
samagra/clients/mcd_client.py:49:        r = requests.post(
samagra/clients/mcd_client.py:50:            f"{self.api_url}/api/admin/query",
samagra/clients/mcd_client.py:51:            headers={"x-mcd-admin": self._admin_key, "content-type": "application/json"},
samagra/clients/mcd_client.py:55:        r.raise_for_status()
samagra/clients/mcd_client.py:58:    def create_seed(self, fields: dict) -> dict:
samagra/clients/mcd_client.py:61:        # adminKey authorizes /api/seeds (middleware accepts adminOk). Never logs keys.
samagra/clients/mcd_client.py:62:        r = requests.post(
samagra/clients/mcd_client.py:64:            headers={"x-mcd-admin": self._admin_key},
samagra/clients/mcd_client.py:65:            data=fields,
samagra/clients/mcd_client.py:68:        r.raise_for_status()
samagra/clients/mcd_client.py:71:    def pending(self) -> list[dict]:
samagra/clients/mcd_client.py:72:        r = requests.get(
samagra/clients/mcd_client.py:73:            f"{self.api_url}/api/admin/pending",
samagra/clients/mcd_client.py:74:            headers={"x-mcd-admin": self._admin_key},
samagra/clients/mcd_client.py:77:        r.raise_for_status()
samagra/clients/mcd_client.py:80:    def __repr__(self) -> str:  # never leak key values
samagra/clients/mcd_client.py:81:        return f"McdClient(api_url={self.api_url!r}, admin_key=<set:{bool(self._admin_key)}>)"
samagra/clients/munshi_client.py:4:Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
samagra/clients/munshi_client.py:5:MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
samagra/clients/munshi_client.py:12:import requests
samagra/clients/munshi_client.py:17:class MunshiClient:
samagra/clients/munshi_client.py:18:    def __init__(self, api_url=None, secret=None):
samagra/clients/munshi_client.py:19:        url = api_url or os.environ.get("MUNSHI_API_URL") or ""
samagra/clients/munshi_client.py:21:        self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""
samagra/clients/munshi_client.py:23:    def available(self) -> bool:
samagra/clients/munshi_client.py:24:        return bool(self.api_url and self._secret)
samagra/clients/munshi_client.py:26:    def _cookie(self) -> str:
samagra/clients/munshi_client.py:30:        # so both forms round-trip to the same secret — auth is unaffected.
samagra/clients/munshi_client.py:31:        return "munshi=" + quote(self._secret, safe="")
samagra/clients/munshi_client.py:33:    def library(self) -> dict:
samagra/clients/munshi_client.py:34:        r = requests.get(
samagra/clients/munshi_client.py:36:            headers={"Cookie": self._cookie()},
samagra/clients/munshi_client.py:39:        r.raise_for_status()
samagra/clients/munshi_client.py:42:    def create_item(self, kind: str, fields: dict) -> dict:
samagra/clients/munshi_client.py:45:        # rejects others). The secret is never logged.
samagra/clients/munshi_client.py:46:        r = requests.post(
samagra/clients/munshi_client.py:48:            headers={"Cookie": self._cookie(), "content-type": "application/json"},
samagra/clients/munshi_client.py:49:            json={"kind": kind, **fields},
samagra/clients/munshi_client.py:52:        r.raise_for_status()
samagra/clients/munshi_client.py:55:    def __repr__(self) -> str:  # never leak the secret
samagra/clients/munshi_client.py:56:        return f"MunshiClient(api_url={self.api_url!r}, secret=<set:{bool(self._secret)}>)"

 succeeded in 3980ms:
samagra/governance/store.py:42:def _now() -> str:
samagra/governance/store.py:46:def connect() -> sqlite3.Connection:
samagra/governance/store.py:58:def init_tables(conn: sqlite3.Connection) -> None:
samagra/governance/store.py:68:def _apply_migrations(conn: sqlite3.Connection) -> None:
samagra/governance/store.py:79:def backup(dest) -> Path:
samagra/governance/store.py:99:def add_assignment(conn, *, id, agent, outbox_path, pipeline=None,
samagra/governance/store.py:113:def set_assignment_status(conn, assignment_id, status) -> None:
samagra/governance/store.py:131:def append_event(conn, *, actor, verb, assignment_id=None, subsystem=None,
samagra/governance/store.py:141:def add_review(conn, *, subsystem, subsystem_ref, reviewer, verdict,
samagra/governance/store.py:154:def list_assignments(conn) -> list[dict]:
samagra/governance/store.py:159:def list_events(conn, limit: int = 200) -> list[dict]:
samagra/questions_proxy.py:1:"""Helpers for proxying the QX question engine's JSON search into SAMAGRA.
samagra/questions_proxy.py:3:QX renders question HTML with relative asset URLs (``/asset?slug=..&id=..``) for
samagra/questions_proxy.py:6:them to absolute QX-server URLs so the browser loads assets directly from QX.
samagra/questions_proxy.py:11:_REL = 'src="/asset?'
samagra/questions_proxy.py:14:def absolutize_assets(payload: dict, qx_base_url: str) -> dict:
samagra/questions_proxy.py:15:    """Rewrite every ``src="/asset?...`` in each result's HTML to an absolute QX
samagra/questions_proxy.py:17:    base = (qx_base_url or "").rstrip("/")
samagra/questions_proxy.py:18:    repl = f'src="{base}/asset?'
samagra/review/precommit.py:10:  * Advisory-local: a Codex that errors / times out / can't be found does NOT
samagra/review/precommit.py:71:def get_staged_diff() -> str:
samagra/review/precommit.py:79:def _diff_hash(diff: str) -> str:
samagra/review/precommit.py:83:def _safe_str(obj) -> str:
samagra/review/precommit.py:87:    except Exception:  # noqa: BLE001
samagra/review/precommit.py:90:        except Exception:  # noqa: BLE001
samagra/review/precommit.py:94:def _warn(*parts) -> None:
samagra/review/precommit.py:97:    pathological Exception.__str__/__repr__ on a passed object can escape and let
samagra/review/precommit.py:102:    except Exception:  # noqa: BLE001 - a diagnostic must never affect control flow
samagra/review/precommit.py:107:def _review_dir() -> Path:
samagra/review/precommit.py:113:def _cache_path() -> Path:
samagra/review/precommit.py:117:def _load_cache() -> dict:
samagra/review/precommit.py:126:    except Exception:  # noqa: BLE001 - unreadable/corrupt cache -> ignore it
samagra/review/precommit.py:133:def _save_cache(cache: dict) -> None:
samagra/review/precommit.py:146:    except Exception as e:  # noqa: BLE001 - cache persistence must never flip a verdict
samagra/review/precommit.py:150:def _remember(cache: dict, dhash: str, entry: dict) -> None:
samagra/review/precommit.py:157:    except Exception as e:  # noqa: BLE001 - verdict persistence is never a gate
samagra/review/precommit.py:161:def _now() -> str:
samagra/review/precommit.py:165:def _sanitize_reason(reason: str) -> str:
samagra/review/precommit.py:172:def _audit_breakglass(diff_hash: str, reason: str) -> None:
samagra/review/precommit.py:183:def _emit(fn) -> None:
samagra/review/precommit.py:190:    except Exception as e:  # noqa: BLE001 - a side-effect must never flip a verdict
samagra/review/precommit.py:194:def _criticals(findings) -> list[dict]:
samagra/review/precommit.py:203:def _print_findings(findings, header: str) -> None:
samagra/review/precommit.py:216:def _review_once(diff: str) -> list[dict]:
samagra/review/precommit.py:222:def review_staged_diff() -> int:
samagra/review/precommit.py:225:    Outer never-wedge guard (D5): ANY unexpected error in the local hook logic is
samagra/review/precommit.py:231:    except Exception as e:  # noqa: BLE001 - the local hook must never wedge a commit
samagra/review/precommit.py:232:        _warn("\n=== SAMAGRA pre-commit: review error (advisory) ===")
samagra/review/precommit.py:233:        _warn("  unexpected error in the local hook:", e)
samagra/review/precommit.py:238:def _review_staged_diff_inner() -> int:
samagra/review/precommit.py:272:    except Exception as e:  # noqa: BLE001 - CodexError or any failure is advisory
samagra/review/precommit.py:287:    # confirmed-CRITICAL). If confirm errors or disagrees, treat as advisory.
samagra/review/precommit.py:290:    except Exception as e:  # noqa: BLE001 - confirm failure -> advisory, not block
samagra/review/precommit.py:292:                                             "errored) — allowed"))
samagra/review/precommit.py:304:        except Exception:  # noqa: BLE001 - a pathological finding must not downgrade a decided block
samagra/review/precommit.py:319:def _print_breakglass_help() -> None:
samagra/review/precommit.py:328:def main() -> None:
samagra/sims_manifest.py:5:SITE = "https://pratyakshsims.com"
samagra/sims_manifest.py:11:def sim_url(sim_id: str) -> str:
samagra/sims_manifest.py:24:def parse_deployed_sims(text: str) -> list[dict]:
samagra/sims_manifest.py:25:    grade = subject = None
samagra/sims_manifest.py:30:            subject = ms.group(1).strip()
samagra/sims_manifest.py:35:            subject = None  # a new grade starts fresh — don't bleed the prior grade's subject
samagra/sims_manifest.py:41:                        "subject": subject, "grade": grade, "url": sim_url(sid)})

 succeeded in 4223ms:
5:and a safe local-file opener constrained to configured source roots.
13:from fastapi import FastAPI, HTTPException
15:from fastapi.staticfiles import StaticFiles
18:from .. import catalog, config, questions_proxy, scheduler, sims_manifest, state
32:# `npm run build`, so guard the mount to avoid a StaticFiles directory error.
34:    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")),
43:def _allowed(p: Path) -> bool:
55:@app.get("/lecture/{slug}", response_class=HTMLResponse)
56:def lecture_preview(slug: str):
60:        raise HTTPException(404, f"chapter {slug!r} not found")
65:@app.get("/api/overview")
66:def api_overview():
70:@app.get("/api/facets")
71:def api_facets():
75:@app.get("/api/search")
76:def api_search(q: str = "", source: str | None = None,
81:@app.get("/api/questions")
82:def api_questions(q: str = "", subject: str | None = None,
96:                "error": "questions backend unavailable — is the QX server running on :8783?"}
97:    return questions_proxy.absolutize_assets(payload, client.base_url)
100:@app.get("/api/pipelines")
101:def api_pipelines():
105:@app.get("/api/assignments")
106:def api_assignments():
118:@app.post("/api/refresh")
119:def api_refresh():
120:    totals = catalog.refresh(verbose=False)
124:@app.post("/api/tick")
125:def api_tick(dry_run: bool = False):
126:    return scheduler.tick(dry_run=dry_run)
129:@app.post("/api/gate/{pipeline}/{decision}")
130:def api_gate(pipeline: str, decision: str):
131:    result = scheduler.gate(pipeline, decision)
132:    # F-02: a refused gate decision (prereqs incomplete, not awaiting_gate, bad
136:        raise HTTPException(status_code=409, detail=result["error"])
140:# -- safe local file opener ---------------------------------------------
141:@app.get("/open")
142:def open_file(path: str, download: bool = False):
145:        raise HTTPException(403, "path outside allowed source roots")
147:        raise HTTPException(404, "file not found")
154:@app.get("/api/org")
155:def api_org():
165:# (frontend/src/lib/capture/munshi.ts). The server is the real trust boundary for
174:@app.post("/api/munshi/capture")
175:def api_munshi_capture(payload: dict):
178:        raise HTTPException(400, "kind must be one of: todo, note, followup")
189:            raise HTTPException(400, f"field {k!r} must be a string")
195:        raise HTTPException(400, f"missing required field(s): {', '.join(missing)}")
198:        raise HTTPException(503, "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET")
202:        raise HTTPException(502, "munshi capture failed")
210:@app.post("/api/mcd/seeds")
211:def api_mcd_create_seed(payload: dict):
215:        raise HTTPException(400, "type must be one of: " + ", ".join(sorted(_SEED_TYPES)))
217:        raise HTTPException(400, "raw_text is required")
220:        raise HTTPException(503, "mycontentdev not configured — set mcd-cloud.json adminKey")
227:        created = client.create_seed(fields)
229:        raise HTTPException(502, "mycontentdev seed create failed")
230:    return {"ok": True, "seed": created}
233:@app.get("/api/sims")
234:def api_sims():
235:    p = config.SIMS_ROOT / "deployed-sims-by-grade.md"
237:        return {"sims": [], "total": 0}
238:    sims = sims_manifest.parse_deployed_sims(p.read_text(encoding="utf-8"))
239:    return {"sims": sims, "total": len(sims)}
242:@app.get("/api/questions/facets")
243:def api_questions_facets():
255:# -- live subsystem read passthroughs (always-fresh; capture appears immediately)
257:# rebuildable catalog), so the capture apps show real data without a catalog
258:# refresh and a fresh capture is visible on the next refetch. Read-only,
259:# creds-gated, never leak upstream/secret detail.
260:@app.get("/api/munshi/library")
261:def api_munshi_library():
262:    ad = get_adapter("munshi")
264:        return {"results": [], "error": "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET"}
268:        return {"results": [], "error": "munshi read failed"}
271:@app.get("/api/mcd/seeds")
272:def api_mcd_seeds():
275:        return {"results": [], "error": "mycontentdev not configured — set mcd-cloud.json adminKey"}
282:# -- SPA fallback (MUST be declared LAST) -------------------------------
285:# preview, or the file opener above. Explicitly 404s anything under `api/` (an
287:@app.get("/{full_path:path}", response_class=HTMLResponse)
288:def spa(full_path: str):
290:        raise HTTPException(404, "unknown API route")
293:        raise HTTPException(503, "frontend not built — run `npm run build`")

 succeeded in 4244ms:
frontend/src\apps\Activity\index.tsx:1:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Activity\index.tsx:12:  const { data, loading, error } = useApi<AssignmentsResponse>("/api/assignments");
frontend/src\apps\Activity\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Activity\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Activity\index.test.tsx:13:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Activity\index.test.tsx:15:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Activity\index.test.tsx:17:    expect(useApiMock).toHaveBeenCalledWith("/api/assignments");
frontend/src\apps\Activity\index.test.tsx:22:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
frontend/src\apps\Activity\index.test.tsx:28:    useApiMock.mockReturnValue({ data: { assignments: [], events: [] }, loading: false, error: null });
frontend/src\apps\Assignments\index.tsx:1:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Assignments\index.tsx:13:  const { data, loading, error } = useApi<AssignmentsResponse>("/api/assignments");
frontend/src\apps\Assignments\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Assignments\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Assignments\index.test.tsx:13:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Assignments\index.test.tsx:15:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Assignments\index.test.tsx:17:    expect(useApiMock).toHaveBeenCalledWith("/api/assignments");
frontend/src\apps\Assignments\index.test.tsx:23:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
frontend/src\apps\Assignments\index.test.tsx:29:    useApiMock.mockReturnValue({ data: { assignments: [], events: [] }, loading: false, error: null });
frontend/src\apps\Assignments\index.test.tsx:39:    useApiMock.mockReturnValue({ data: { assignments: [], events: [] }, loading: false, error: null });
frontend/src\apps\Munshi\index.tsx:2:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Munshi\index.tsx:3:import { useApiPost } from "../../hooks/useApiPost";
frontend/src\apps\Munshi\index.tsx:6:import { buildMunshiCapture } from "../../lib/capture/munshi";
frontend/src\apps\Munshi\index.tsx:15:// Required + optional fields per munshi kind (mirrors lib/capture/munshi.ts).
frontend/src\apps\Munshi\index.tsx:29:  // reloadKey bumps the GET path so useApi refetches the library after a capture.
frontend/src\apps\Munshi\index.tsx:32:  // fresh capture appears on the next refetch (reloadKey bump).
frontend/src\apps\Munshi\index.tsx:33:  const path = "/api/munshi/library" + (reloadKey ? `?_r=${reloadKey}` : "");
frontend/src\apps\Munshi\index.tsx:35:  // failure, so useApi's hook error stays null — surface data.error explicitly.
frontend/src\apps\Munshi\index.tsx:36:  const { data, loading, error } = useApi<SearchResponse & { error?: string }>(path);
frontend/src\apps\Munshi\index.tsx:42:  const { post, loading: posting, error: postError } = useApiPost<{ ok: boolean }>();
frontend/src\apps\Munshi\index.tsx:56:    const out = await post("/api/munshi/capture", built.body);
frontend/src\apps\Munshi\index.tsx:72:      <section data-testid="capture" style={{ marginTop: 14, background: V.cardBg,
frontend/src\apps\Munshi\index.tsx:75:        <div style={{ color: V.muted, fontSize: 12, fontWeight: 600 }}>New capture</div>
frontend/src\apps\Munshi\index.tsx:76:        <select data-testid="capture-kind" aria-label="kind" value={kind}
frontend/src\apps\Munshi\index.tsx:86:          <div data-testid="capture-error" role="alert" style={{ color: V.text, fontSize: 12 }}>
frontend/src\apps\Munshi\index.tsx:90:        <button type="button" data-testid="capture-submit" disabled={posting} onClick={onSubmit}
frontend/src\apps\Munshi\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Munshi\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Munshi\index.test.tsx:13:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Munshi\index.test.tsx:14:  it("reads /api/munshi/library (live) and lists items", () => {
frontend/src\apps\Munshi\index.test.tsx:15:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Munshi\index.test.tsx:17:    expect(useApiMock).toHaveBeenCalledWith("/api/munshi/library");
frontend/src\apps\Munshi\index.test.tsx:22:    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
frontend/src\apps\Munshi\index.test.tsx:27:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
frontend/src\apps\Munshi\index.test.tsx:33:    // /api/munshi/library returns 200 {results:[], error} on an upstream read
frontend/src\apps\Munshi\index.test.tsx:34:    // failure, so useApi's hook error is null. The empty-state must show the
frontend/src\apps\Munshi\index.test.tsx:36:    useApiMock.mockReturnValue({ data: { results: [], error: "munshi read failed" }, loading: false, error: null });
frontend/src\apps\Munshi\index.test.tsx:43:describe("Munshi capture composer", () => {
frontend/src\apps\Munshi\index.test.tsx:45:    useApiMock.mockReset();
frontend/src\apps\Munshi\index.test.tsx:46:    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
frontend/src\apps\Munshi\index.test.tsx:49:        String(url).includes("/api/munshi/capture")
frontend/src\apps\Munshi\index.test.tsx:54:  it("captures a todo", async () => {
frontend/src\apps\Munshi\index.test.tsx:56:    fireEvent.change(screen.getByTestId("capture-kind"), { target: { value: "todo" } });
frontend/src\apps\Munshi\index.test.tsx:59:    fireEvent.click(screen.getByTestId("capture-submit"));
frontend/src\apps\Munshi\index.test.tsx:60:    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/munshi/capture", expect.objectContaining({ method: "POST" })));
frontend/src\apps\Notes\index.tsx:119:  // the key is absent. `seedNotes` needs `now`; capture it once on mount.
frontend/src\apps\Questions\index.tsx:4:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Questions\index.tsx:50:  // A change to this path re-fires useApi → the single source of truth for the
frontend/src\apps\Questions\index.tsx:57:  const { data, loading, error } = useApi<QuestionsResponse>(path);
frontend/src\apps\Questions\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Questions\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Questions\index.test.tsx:22:  useApiMock.mockImplementation(() => ({
frontend/src\apps\Questions\index.test.tsx:28:  beforeEach(() => { useApiMock.mockReset(); });
frontend/src\apps\Questions\index.test.tsx:30:  it("calls /api/questions (exact by default) and renders the QX-rendered HTML", () => {
frontend/src\apps\Questions\index.test.tsx:33:    expect(useApiMock).toHaveBeenCalledWith("/api/questions?mode=exact");
frontend/src\apps\Questions\index.test.tsx:52:    useApiMock.mockClear();
frontend/src\apps\Questions\index.test.tsx:54:    expect(useApiMock).toHaveBeenCalledWith("/api/questions?mode=semantic");
frontend/src\apps\Questions\index.test.tsx:60:    useApiMock.mockClear();
frontend/src\apps\Questions\index.test.tsx:63:    expect(useApiMock).toHaveBeenCalledWith("/api/questions?q=projectile&mode=exact");
frontend/src\apps\Questions\index.test.tsx:69:    useApiMock.mockClear();
frontend/src\apps\Questions\index.test.tsx:71:    expect(useApiMock).toHaveBeenCalledWith("/api/questions?mode=exact&subject=physics");
frontend/src\apps\Questions\index.test.tsx:79:    useApiMock.mockClear();
frontend/src\apps\Questions\index.test.tsx:81:    expect(useApiMock).toHaveBeenCalledWith("/api/questions?mode=exact");
frontend/src\apps\Pipelines\index.tsx:1:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Pipelines\index.tsx:14:  const { data, loading, error } = useApi<PipelinesResponse>("/api/pipelines");
frontend/src\apps\Pipelines\index.tsx:15:  const org = useApi<OrgChart>("/api/org");   // resolves owner tokens -> display names
frontend/src\apps\Pipelines\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Pipelines\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Pipelines\index.test.tsx:16:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Pipelines\index.test.tsx:19:    useApiMock.mockImplementation((p: string) =>
frontend/src\apps\Pipelines\index.test.tsx:24:    expect(useApiMock).toHaveBeenCalledWith("/api/pipelines");
frontend/src\apps\Pipelines\index.test.tsx:25:    expect(useApiMock).toHaveBeenCalledWith("/api/org");
frontend/src\apps\Pipelines\index.test.tsx:33:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 503" });
frontend/src\apps\Pipelines\index.test.tsx:39:    useApiMock.mockReturnValue({ data: null, loading: true, error: null });
frontend/src\apps\Mycontentdev\index.tsx:2:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Mycontentdev\index.tsx:3:import { useApiPost } from "../../hooks/useApiPost";
frontend/src\apps\Mycontentdev\index.tsx:6:import { buildSeed, SEED_TYPES } from "../../lib/capture/seed";
frontend/src\apps\Mycontentdev\index.tsx:21:  // reloadKey bumps the GET path so useApi refetches the list after a seed capture.
frontend/src\apps\Mycontentdev\index.tsx:24:  // so a freshly captured seed appears on the next refetch (reloadKey bump).
frontend/src\apps\Mycontentdev\index.tsx:25:  const path = "/api/mcd/seeds" + (reloadKey ? `?_r=${reloadKey}` : "");
frontend/src\apps\Mycontentdev\index.tsx:27:  // failure, so useApi's hook error stays null — surface data.error explicitly.
frontend/src\apps\Mycontentdev\index.tsx:28:  const { data, loading, error } = useApi<SearchResponse & { error?: string }>(path);
frontend/src\apps\Mycontentdev\index.tsx:35:  const { post, loading: posting, error: postError } = useApiPost<{ ok: boolean }>();
frontend/src\apps\Mycontentdev\index.tsx:52:      const out = await post("/api/mcd/seeds", built.body);
frontend/src\apps\Mycontentdev\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Mycontentdev\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Mycontentdev\index.test.tsx:9:    unit: null, chapter: null, status: "captured", path: null, url: "x", updated_at: null, meta: {} },
frontend/src\apps\Mycontentdev\index.test.tsx:13:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Mycontentdev\index.test.tsx:14:  it("reads /api/mcd/seeds (live) and lists seeds", () => {
frontend/src\apps\Mycontentdev\index.test.tsx:15:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Mycontentdev\index.test.tsx:17:    expect(useApiMock).toHaveBeenCalledWith("/api/mcd/seeds");
frontend/src\apps\Mycontentdev\index.test.tsx:22:    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
frontend/src\apps\Mycontentdev\index.test.tsx:27:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
frontend/src\apps\Mycontentdev\index.test.tsx:33:    // /api/mcd/seeds returns 200 {results:[], error} on an upstream read failure,
frontend/src\apps\Mycontentdev\index.test.tsx:34:    // so useApi's hook error is null. The empty-state must show the real read
frontend/src\apps\Mycontentdev\index.test.tsx:36:    useApiMock.mockReturnValue({ data: { results: [], error: "mycontentdev read failed" }, loading: false, error: null });
frontend/src\apps\Mycontentdev\index.test.tsx:41:  it("captures a seed", async () => {
frontend/src\apps\Mycontentdev\index.test.tsx:42:    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
frontend/src\apps\Mycontentdev\index.test.tsx:44:      new Response(JSON.stringify({ ok: true, seed: { id: "s1", status: "captured" } }),
frontend/src\apps\Mycontentdev\index.test.tsx:50:    await waitFor(() => expect(spy).toHaveBeenCalledWith("/api/mcd/seeds", expect.objectContaining({ method: "POST" })));
frontend/src\apps\Mycontentdev\index.test.tsx:54:    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
frontend/src\apps\Mycontentdev\index.test.tsx:69:    resolve(new Response(JSON.stringify({ ok: true, seed: { id: "s1", status: "captured" } }),
frontend/src\apps\Org\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Org\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Org\index.test.tsx:15:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Org\index.test.tsx:17:    useApiMock.mockReturnValue({ data: org, loading: false, error: null });
frontend/src\apps\Org\index.test.tsx:19:    expect(useApiMock).toHaveBeenCalledWith("/api/org");
frontend/src\apps\Org\index.test.tsx:27:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
frontend/src\apps\Org\index.test.tsx:33:    useApiMock.mockReturnValue({ data: null, loading: true, error: null });
frontend/src\hooks\useApiPost.ts:3:export function useApiPost<T = unknown>() {
frontend/src\hooks\useApiPost.ts:5:  async function post(path: string, body: unknown): Promise<T | null> {
frontend/src\hooks\useApiPost.ts:8:      const res = await fetch(path, {
frontend/src\hooks\useApiPost.ts:9:        method: "POST",
frontend/src\hooks\useApiPost.test.ts:2:import { useApiPost } from "./useApiPost";
frontend/src\hooks\useApiPost.test.ts:4:it("POSTs JSON and returns parsed data", async () => {
frontend/src\hooks\useApiPost.test.ts:8:  const { result } = renderHook(() => useApiPost<{ ok: boolean }>());
frontend/src\hooks\useApiPost.test.ts:10:  await act(async () => { out = await result.current.post("/api/x", { a: 1 }); });
frontend/src\hooks\useApiPost.test.ts:12:  expect(spy).toHaveBeenCalledWith("/api/x", expect.objectContaining({ method: "POST" }));
frontend/src\hooks\useApiPost.test.ts:20:  const { result } = renderHook(() => useApiPost());
frontend/src\hooks\useApiPost.test.ts:21:  await act(async () => { await result.current.post("/api/x", {}); });
frontend/src\hooks\useApi.ts:1:// src/hooks/useApi.ts
frontend/src\hooks\useApi.ts:19:export function useApi<T = unknown>(path: string): ApiState<T> {
frontend/src\hooks\useApi.ts:31:        const res = await fetch(path, { headers: { accept: "application/json" } });
frontend/src\apps\Sims\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Sims\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Sims\index.test.tsx:13:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Sims\index.test.tsx:15:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Sims\index.test.tsx:17:    expect(useApiMock).toHaveBeenCalledWith("/api/sims");
frontend/src\apps\Sims\index.test.tsx:18:    expect(useApiMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/search?source=sims"));
frontend/src\apps\Sims\index.test.tsx:33:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
frontend/src\apps\Sims\index.test.tsx:39:    useApiMock.mockReturnValue({ data: { sims: [], total: 0 }, loading: false, error: null });
frontend/src\apps\Lectures\index.tsx:1:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Lectures\index.tsx:16:  const { data, loading, error } = useApi<SearchResponse>(PATH);
frontend/src\apps\Lectures\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Lectures\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Lectures\index.test.tsx:14:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Lectures\index.test.tsx:16:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Lectures\index.test.tsx:18:    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=textbook&limit=200");
frontend/src\apps\Lectures\index.test.tsx:24:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
frontend/src\apps\Lectures\index.test.tsx:30:    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
frontend/src\apps\Org\index.tsx:1:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Org\index.tsx:23:  const { data, loading, error } = useApi<OrgChart>("/api/org");
frontend/src\lib\questions\facets.ts:19:/** Path for useApi: a change to it drives the refetch. Empty params are dropped. */
frontend/src\lib\questions\facets.ts:21:  return "/api/questions" + buildQuery({
frontend/src\lib\questions\facets.test.ts:28:  it("builds the /api/questions path with set params only", () => {
frontend/src\lib\questions\facets.test.ts:30:      .toBe("/api/questions?q=projectile&mode=semantic&subject=physics&page=2");
frontend/src\lib\questions\facets.test.ts:33:    expect(buildQuestionsPath({ q: "", mode: "exact" })).toBe("/api/questions?mode=exact");
frontend/src\lib\questions\facets.test.ts:34:    expect(buildQuestionsPath({})).toBe("/api/questions");
frontend/src\apps\Booklets\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Booklets\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Booklets\index.test.tsx:13:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Booklets\index.test.tsx:15:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Booklets\index.test.tsx:17:    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=booklets&limit=500");
frontend/src\apps\Booklets\index.test.tsx:22:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
frontend/src\apps\Booklets\index.test.tsx:28:    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
frontend/src\apps\Insp\index.test.tsx:3:const useApiMock = vi.fn();
frontend/src\apps\Insp\index.test.tsx:4:vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
frontend/src\apps\Insp\index.test.tsx:13:  beforeEach(() => useApiMock.mockReset());
frontend/src\apps\Insp\index.test.tsx:15:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Insp\index.test.tsx:17:    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=insp&limit=500");
frontend/src\apps\Insp\index.test.tsx:22:    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
frontend/src\apps\Insp\index.test.tsx:28:    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
frontend/src\apps\Insp\index.test.tsx:37:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Insp\index.test.tsx:45:    useApiMock.mockReturnValue({ data, loading: false, error: null });
frontend/src\apps\Dashboard\index.test.tsx:3:// via the `useApi` typed fetch hook (the live Σ-artifacts headline) and renders
frontend/src\apps\Dashboard\index.test.tsx:92:// BEHAVIOUR — the useApi fetch path + Σ headline + error branches (E1.19).    //
frontend/src\apps\Dashboard\index.test.tsx:94:describe("Dashboard (behaviour — useApi + headline)", () => {
frontend/src\apps\Dashboard\index.test.tsx:113:    // useApi error branch: !res.ok → error="HTTP 503"; Dashboard renders role=alert
frontend/src\apps\Dashboard\index.test.tsx:127:    // useApi catch branch: fetch rejects → error=String(e). The Artifacts stat
frontend/src\apps\Booklets\index.tsx:1:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Booklets\index.tsx:15:  const { data, loading, error } = useApi<SearchResponse>(PATH);
frontend/src\apps\Insp\index.tsx:1:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Insp\index.tsx:15:  const { data, loading, error } = useApi<SearchResponse>(PATH);
frontend/src\lib\terminal\dispatch.ts:68:  ["munshi", "275", "Seed capture & rough drafts"],
frontend/src\lib\terminal\dispatch.ts:139:function cmdNeofetch(): TermLine[] {
frontend/src\lib\terminal\dispatch.ts:252:      return { lines: cmdNeofetch(), effects: [] };
frontend/src\apps\Dashboard\index.tsx:3:// THIN presentational wrapper. It reads `/api/overview` via the typed `useApi`
frontend/src\apps\Dashboard\index.tsx:24:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Dashboard\index.tsx:163:  const { data, loading, error } = useApi<Overview>("/api/overview");
frontend/src\apps\Sims\index.tsx:2:import { useApi } from "../../hooks/useApi";
frontend/src\apps\Sims\index.tsx:14:  const { data, loading, error } = useApi<SimsResponse>("/api/sims");
frontend/src\lib\api\query.ts:1:/** Build a query string for useApi(path). Drops undefined and empty-string values
frontend/src\types\contracts.ts:40:// ── Catalog / search (GET /api/search, /api/facets) ──────────────────────────
frontend/src\types\contracts.ts:52:// ── Questions (GET /api/questions) — proxied from the live QX engine ──────────
frontend/src\types\contracts.ts:114:// ── Capture / sims / facets (control-plane: POST capture + read-only sims/facets) ──

codex
The FastAPI route map confirms more POST surfaces than the capture pair, so the next distinction is whether those mutate local state or external systems. I’m reading implementations around each POST and the clients now, then I’ll separate “docs overstate” from “real exposure.”
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/config.py' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/api/app.py' | ForEach-Object { "'$i++; if ($i -ge 136 -and $i -le 230) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/api/app.py' | ForEach-Object { "'$i++; if ($i -ge 231 -and $i -le 310) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/api/app.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 135) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 3519ms:
   1: """Central configuration.
   2: 
   3: All paths/secrets come from environment variables (optionally loaded from a .env
   4: file at the repo root). Machine-specific Python overrides may live in config.local.py
   5: (gitignored). Nothing here hardcodes secrets â€” see .env.example.
   6: """
   7: from __future__ import annotations
   8: 
   9: import os
  10: from pathlib import Path
  11: 
  12: # Optional .env loading (python-dotenv is only required once you install deps).
  13: try:  # pragma: no cover - convenience only
  14:     from dotenv import load_dotenv
  15: 
  16:     load_dotenv(Path(__file__).resolve().parents[1] / ".env")
  17: except Exception:  # noqa: BLE001
  18:     pass
  19: 
  20: REPO_ROOT = Path(__file__).resolve().parents[1]
  21: 
  22: 
  23: def _env_path(name: str, default: Path) -> Path:
  24:     val = os.environ.get(name)
  25:     return Path(val) if val else default
  26: 
  27: 
  28: # --- source workspace roots ---
  29: GPT_BOX = _env_path("SAMAGRA_GPT_BOX", Path(r"C:\SandBox\gpt_box"))
  30: CLAUDE_BOX = _env_path("SAMAGRA_CLAUDE_BOX", Path(r"C:\SandBox\claude_box"))
  31: 
  32: # --- QX (question engine) ---
  33: QX_ROOT = _env_path("SAMAGRA_QX_ROOT", GPT_BOX / "gpt-extract-ques")
  34: QX_CONTENT_DB = QX_ROOT / "qx" / "qx_content.sqlite"
  35: QX_BUILDER_DB = QX_ROOT / "qx" / "builder.sqlite"
  36: 
  37: # --- physics-textbook (lecture/notes engine) ---
  38: TEXTBOOK_ROOT = _env_path("SAMAGRA_TEXTBOOK_ROOT", GPT_BOX / "physics-textbook")
  39: TEXTBOOK_QUEUE = TEXTBOOK_ROOT / "textbook" / "queue.json"
  40: TEXTBOOK_CHAPTERS = TEXTBOOK_ROOT / "textbook" / "chapters"
  41: TEXTBOOK_THEME = TEXTBOOK_ROOT / "textbook" / "theme"
  42: TEXTBOOK_LOCK = TEXTBOOK_ROOT / "textbook" / ".routine.lock"
  43: 
  44: # --- booklets / INSP / sims ---
  45: BOOKLETS_ROOT = _env_path("SAMAGRA_BOOKLETS_ROOT", CLAUDE_BOX / "claude-booklet-proofer")
  46: INSP_ROOT = _env_path("SAMAGRA_INSP_ROOT", CLAUDE_BOX / "claude-INSP-extract")
  47: SIMS_ROOT = _env_path("SAMAGRA_SIMS_ROOT", CLAUDE_BOX / "pratyaksh-May-deploy")
  48: 
  49: # --- online target ---
  50: QUESTIONDB_URL = os.environ.get(
  51:     "SAMAGRA_QUESTIONDB_URL", "https://dbhardwaj86-questiondb.hf.space"
  52: )
  53: 
  54: # --- QX live server (the question engine, run locally as a sidecar) ---
  55: # `python gui/qx_browser.py` -> :8783 exposes GET /api/qsearch (exact + semantic
  56: # search with rendered maths + figures). SAMAGRA's /api/questions proxies it.
  57: QX_SERVER_URL = os.environ.get("SAMAGRA_QX_SERVER_URL", "http://127.0.0.1:8783")
  58: 
  59: # --- SAMAGRA-owned data (all gitignored) ---
  60: # DATA_DB is the REBUILDABLE catalog (FTS5 index over the subsystems); it may be
  61: # deleted and rebuilt at will. GOVERNANCE_DB is the DURABLE governance store
  62: # (assignments / events ledger / review overlay) and must NEVER be deleted as a
  63: # "catalog reset" â€” runbook D6 splits the two so irreplaceable governance state
  64: # never shares a file with the throwaway index.
  65: DATA_DB = REPO_ROOT / "samagra.db"
  66: GOVERNANCE_DB = REPO_ROOT / "governance.db"
  67: STATE_DIR = REPO_ROOT / "state"
  68: BUILD_DIR = REPO_ROOT / "build"
  69: EXPORT_DIR = BUILD_DIR / "lectures"
  70: 
  71: # --- portal ---
  72: HOST = os.environ.get("SAMAGRA_HOST", "127.0.0.1")
  73: PORT = int(os.environ.get("SAMAGRA_PORT", "8799"))
  74: 
  75: # --- optional python override ---
  76: try:  # pragma: no cover
  77:     import config_local  # type: ignore  # noqa: F401
  78: 
  79:     globals().update({k: v for k, v in vars(config_local).items() if k.isupper()})
  80: except Exception:  # noqa: BLE001
  81:     pass

 succeeded in 3641ms:
 136:         raise HTTPException(status_code=409, detail=result["error"])
 137:     return result
 138: 
 139: 
 140: # -- safe local file opener ---------------------------------------------
 141: @app.get("/open")
 142: def open_file(path: str, download: bool = False):
 143:     p = Path(path)
 144:     if not _allowed(p):
 145:         raise HTTPException(403, "path outside allowed source roots")
 146:     if not p.exists() or not p.is_file():
 147:         raise HTTPException(404, "file not found")
 148:     media, _ = mimetypes.guess_type(str(p))
 149:     filename = p.name if (download or p.suffix.lower() == ".docx") else None
 150:     return FileResponse(str(p), media_type=media or "application/octet-stream",
 151:                         filename=filename)
 152: 
 153: 
 154: @app.get("/api/org")
 155: def api_org():
 156:     return ORG
 157: 
 158: 
 159: _MUNSHI_REQUIRED = {
 160:     "todo": ("assignee", "task"),
 161:     "note": ("student", "issue"),
 162:     "followup": ("date", "note"),
 163: }
 164: # Contract passthrough â€” must mirror the TS buildMunshiCapture OPTIONAL whitelist
 165: # (frontend/src/lib/capture/munshi.ts). The server is the real trust boundary for
 166: # this production write, so it independently whitelists allowed fields.
 167: _MUNSHI_OPTIONAL = {
 168:     "todo": ("due",),
 169:     "note": ("label",),
 170:     "followup": ("person",),
 171: }
 172: 
 173: 
 174: @app.post("/api/munshi/capture")
 175: def api_munshi_capture(payload: dict):
 176:     kind = (payload or {}).get("kind")
 177:     if not isinstance(kind, str) or kind not in _MUNSHI_REQUIRED:
 178:         raise HTTPException(400, "kind must be one of: todo, note, followup")
 179:     required = _MUNSHI_REQUIRED[kind]
 180:     allowed = required + _MUNSHI_OPTIONAL[kind]
 181:     # Whitelist + sanitize: only contract-allowed keys with string values are
 182:     # forwarded to the live worker. Unknown keys (status, id, ts, ...) are dropped.
 183:     fields: dict[str, str] = {}
 184:     for k in allowed:
 185:         if k not in payload:
 186:             continue
 187:         v = payload[k]
 188:         if not isinstance(v, str):
 189:             raise HTTPException(400, f"field {k!r} must be a string")
 190:         v = v.strip()
 191:         if v:
 192:             fields[k] = v
 193:     missing = [k for k in required if k not in fields]
 194:     if missing:
 195:         raise HTTPException(400, f"missing required field(s): {', '.join(missing)}")
 196:     client = MunshiClient()
 197:     if not client.available():
 198:         raise HTTPException(503, "munshi not configured â€” set MUNSHI_API_URL/MUNSHI_SECRET")
 199:     try:
 200:         created = client.create_item(kind, fields)
 201:     except Exception:  # noqa: BLE001 â€” never surface the upstream/secret details
 202:         raise HTTPException(502, "munshi capture failed")
 203:     return {"ok": True, "item": created}
 204: 
 205: 
 206: _SEED_TYPES = {"concept", "question", "snippet", "simulation_idea",
 207:                "experiment", "notebooklm_link", "rough_idea"}
 208: 
 209: 
 210: @app.post("/api/mcd/seeds")
 211: def api_mcd_create_seed(payload: dict):
 212:     typ = (payload or {}).get("type")
 213:     raw_text = str((payload or {}).get("raw_text") or "").strip()
 214:     if typ not in _SEED_TYPES:
 215:         raise HTTPException(400, "type must be one of: " + ", ".join(sorted(_SEED_TYPES)))
 216:     if not raw_text:
 217:         raise HTTPException(400, "raw_text is required")
 218:     client = McdClient()
 219:     if not client.available():
 220:         raise HTTPException(503, "mycontentdev not configured â€” set mcd-cloud.json adminKey")
 221:     fields = {"type": typ, "raw_text": raw_text}
 222:     for opt in ("title", "source_ref"):
 223:         v = str((payload or {}).get(opt) or "").strip()
 224:         if v:
 225:             fields[opt] = v
 226:     try:
 227:         created = client.create_seed(fields)
 228:     except Exception:  # noqa: BLE001
 229:         raise HTTPException(502, "mycontentdev seed create failed")
 230:     return {"ok": True, "seed": created}

 succeeded in 3921ms:
   1: """SAMAGRA OS â€” FastAPI app.
   2: 
   3: Serves the Vite-built SAMAGRA OS single-page app (`frontend/dist/`) plus a small
   4: JSON API over the catalog, QX live question search, the pipeline state machine,
   5: and a safe local-file opener constrained to configured source roots.
   6: """
   7: from __future__ import annotations
   8: 
   9: import mimetypes
  10: from dataclasses import asdict
  11: from pathlib import Path
  12: 
  13: from fastapi import FastAPI, HTTPException
  14: from fastapi.responses import FileResponse, HTMLResponse
  15: from fastapi.staticfiles import StaticFiles
  16: 
  17: import samagra
  18: from .. import catalog, config, questions_proxy, scheduler, sims_manifest, state
  19: from ..adapters import get_adapter
  20: from ..clients import McdClient, MunshiClient, QxClient
  21: from ..governance import store as gstore
  22: from ..lectures import render as lecture_render
  23: from ..org import ORG  # E2.1 static org chart
  24: 
  25: # Vite build output (E1.17). Computed from config.REPO_ROOT at import time so the
  26: # serve seam follows config.REPO_ROOT under test (the suite reloads this module
  27: # after monkeypatching REPO_ROOT to a built/unbuilt tmp tree).
  28: FRONTEND_DIST = config.REPO_ROOT / "frontend" / "dist"
  29: 
  30: app = FastAPI(title="SAMAGRA", version=samagra.__version__)
  31: # Serve hashed Vite assets only when a build is present; absent before the first
  32: # `npm run build`, so guard the mount to avoid a StaticFiles directory error.
  33: if (FRONTEND_DIST / "assets").exists():
  34:     app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")),
  35:               name="assets")
  36: 
  37: ALLOWED_ROOTS = [
  38:     config.QX_ROOT, config.TEXTBOOK_ROOT, config.BOOKLETS_ROOT,
  39:     config.INSP_ROOT, config.SIMS_ROOT, config.EXPORT_DIR,
  40: ]
  41: 
  42: 
  43: def _allowed(p: Path) -> bool:
  44:     rp = p.resolve()
  45:     for root in ALLOWED_ROOTS:
  46:         try:
  47:             rp.relative_to(root.resolve())
  48:             return True
  49:         except ValueError:
  50:             continue
  51:     return False
  52: 
  53: 
  54: # -- pages ---------------------------------------------------------------
  55: @app.get("/lecture/{slug}", response_class=HTMLResponse)
  56: def lecture_preview(slug: str):
  57:     try:
  58:         content = lecture_render.load_chapter(slug)
  59:     except FileNotFoundError:
  60:         raise HTTPException(404, f"chapter {slug!r} not found")
  61:     return HTMLResponse(lecture_render.render_chapter_html(content, label="Preview"))
  62: 
  63: 
  64: # -- api -----------------------------------------------------------------
  65: @app.get("/api/overview")
  66: def api_overview():
  67:     return catalog.overview()
  68: 
  69: 
  70: @app.get("/api/facets")
  71: def api_facets():
  72:     return catalog.facets()
  73: 
  74: 
  75: @app.get("/api/search")
  76: def api_search(q: str = "", source: str | None = None,
  77:                kind: str | None = None, limit: int = 200):
  78:     return {"results": catalog.search(q, source=source, kind=kind, limit=limit)}
  79: 
  80: 
  81: @app.get("/api/questions")
  82: def api_questions(q: str = "", subject: str | None = None,
  83:                   chapter: str | None = None, qtype: str | None = None,
  84:                   mode: str = "exact", page: int = 1):
  85:     # Proxy the always-up QX engine (gui/qx_browser.py :8783) which owns the real
  86:     # exact + semantic search, KaTeX maths and figure rendering. QX renders the
  87:     # question HTML with relative /asset URLs -> absolutize them to the QX server
  88:     # so figures load. QX unreachable -> graceful empty + error (never a 500).
  89:     client = QxClient()
  90:     try:
  91:         payload = client.search(q=q, mode=mode, subject=subject,
  92:                                 chapter=chapter, qtype=qtype, page=page)
  93:     except Exception:  # noqa: BLE001 â€” connection refused / timeout / bad JSON
  94:         return {"results": [], "total": 0, "page": page, "page_size": 0,
  95:                 "mode": mode, "degraded": False, "facets": {},
  96:                 "error": "questions backend unavailable â€” is the QX server running on :8783?"}
  97:     return questions_proxy.absolutize_assets(payload, client.base_url)
  98: 
  99: 
 100: @app.get("/api/pipelines")
 101: def api_pipelines():
 102:     return {"pipelines": state.all_states()}
 103: 
 104: 
 105: @app.get("/api/assignments")
 106: def api_assignments():
 107:     # Reads the DURABLE governance DB (governance.db, D6) â€” separate from the
 108:     # rebuildable catalog. init_tables is idempotent + safe to call per request.
 109:     conn = gstore.connect()
 110:     try:
 111:         gstore.init_tables(conn)  # inside try: a failed init must still close the conn
 112:         return {"assignments": gstore.list_assignments(conn),
 113:                 "events": gstore.list_events(conn)}
 114:     finally:
 115:         conn.close()
 116: 
 117: 
 118: @app.post("/api/refresh")
 119: def api_refresh():
 120:     totals = catalog.refresh(verbose=False)
 121:     return {"ok": True, "totals": totals}
 122: 
 123: 
 124: @app.post("/api/tick")
 125: def api_tick(dry_run: bool = False):
 126:     return scheduler.tick(dry_run=dry_run)
 127: 
 128: 
 129: @app.post("/api/gate/{pipeline}/{decision}")
 130: def api_gate(pipeline: str, decision: str):
 131:     result = scheduler.gate(pipeline, decision)
 132:     # F-02: a refused gate decision (prereqs incomplete, not awaiting_gate, bad
 133:     # decision) is a conflict with current pipeline state â€” surface it as HTTP
 134:     # 409 instead of a 200 with a silent JSON error body.
 135:     if "error" in result:

 succeeded in 4226ms:
 231: 
 232: 
 233: @app.get("/api/sims")
 234: def api_sims():
 235:     p = config.SIMS_ROOT / "deployed-sims-by-grade.md"
 236:     if not p.exists():
 237:         return {"sims": [], "total": 0}
 238:     sims = sims_manifest.parse_deployed_sims(p.read_text(encoding="utf-8"))
 239:     return {"sims": sims, "total": len(sims)}
 240: 
 241: 
 242: @app.get("/api/questions/facets")
 243: def api_questions_facets():
 244:     qx = get_adapter("qx")
 245:     if not qx or not qx.available():
 246:         return {"subjects": []}
 247:     subjects = (qx.summary() or {}).get("subjects") or {}
 248:     # Only human-meaningful subject names (must contain a letter). Some QX corpora
 249:     # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
 250:     # was the eyesore replacing the old SIM0xxx leak â€” drop non-alphabetic keys.
 251:     names = [str(s) for s in subjects.keys() if any(ch.isalpha() for ch in str(s))]
 252:     return {"subjects": names}
 253: 
 254: 
 255: # -- live subsystem read passthroughs (always-fresh; capture appears immediately)
 256: # These read the LIVE deployed Munshi/mycontentdev via their adapters (not the
 257: # rebuildable catalog), so the capture apps show real data without a catalog
 258: # refresh and a fresh capture is visible on the next refetch. Read-only,
 259: # creds-gated, never leak upstream/secret detail.
 260: @app.get("/api/munshi/library")
 261: def api_munshi_library():
 262:     ad = get_adapter("munshi")
 263:     if not ad or not ad.available():
 264:         return {"results": [], "error": "munshi not configured â€” set MUNSHI_API_URL/MUNSHI_SECRET"}
 265:     try:
 266:         return {"results": [asdict(a) for a in ad.artifacts()]}
 267:     except Exception:  # noqa: BLE001 â€” never surface upstream/secret detail
 268:         return {"results": [], "error": "munshi read failed"}
 269: 
 270: 
 271: @app.get("/api/mcd/seeds")
 272: def api_mcd_seeds():
 273:     ad = get_adapter("mycontentdev")
 274:     if not ad or not ad.available():
 275:         return {"results": [], "error": "mycontentdev not configured â€” set mcd-cloud.json adminKey"}
 276:     try:
 277:         return {"results": [asdict(a) for a in ad.artifacts()]}
 278:     except Exception:  # noqa: BLE001 â€” never surface upstream/secret detail
 279:         return {"results": [], "error": "mycontentdev read failed"}
 280: 
 281: 
 282: # -- SPA fallback (MUST be declared LAST) -------------------------------
 283: # Catch-all for client-side routes: serve the Vite-built index.html so the React
 284: # router can take over. Declared last so it never shadows the API, the lecture
 285: # preview, or the file opener above. Explicitly 404s anything under `api/` (an
 286: # unknown API path should be a real 404, not the SPA shell).
 287: @app.get("/{full_path:path}", response_class=HTMLResponse)
 288: def spa(full_path: str):
 289:     if full_path.startswith("api/"):
 290:         raise HTTPException(404, "unknown API route")
 291:     index_html = FRONTEND_DIST / "index.html"
 292:     if not index_html.is_file():
 293:         raise HTTPException(503, "frontend not built â€” run `npm run build`")
 294:     return FileResponse(str(index_html))

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "def refresh|connect|DATA_DB|delete|insert|drop|CREATE|commit|execute|executemany|save|unlink" samagra/catalog.py' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/state.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 240) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/scheduler.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 240) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"def tick|def gate|set_phase|state\\.save|save\\(|load\\(|dry_run|reflect|publish|approve|decision|awaiting_gate|mutat|write|requests|post|external\" samagra/scheduler.py samagra/state.py" in C:\SandBox\claude_box\TeachingOS
 succeeded in 2119ms:
   1: """Pipeline phase state machine.
   2: 
   3: Adopts the run-episode pattern: one JSON file per pipeline is the source of truth
   4: (`state/<pipeline>.orchestrator_state.json`), mirrored to a human-readable
   5: `state/tracker.txt`. The scheduler (Phase D) advances auto-phases; human gates pause.
   6: """
   7: from __future__ import annotations
   8: 
   9: import json
  10: import os
  11: import time
  12: 
  13: from . import config
  14: from .lock import file_lock
  15: 
  16: # Pipeline definitions: ordered phases, which phases are hard gates, and the
  17: # worker that owns each phase (role-specialized routing).
  18: PIPELINES: dict[str, dict] = {
  19:     "textbook": {
  20:         "label": "Lectures (textbook)",
  21:         "phases": ["draft", "enrich", "approve", "export"],
  22:         "gates": ["approve"],
  23:         "owners": {"draft": "codex", "enrich": "codex",
  24:                    "approve": "human", "export": "teachingos"},
  25:     },
  26:     "mycontentdev": {
  27:         "label": "Editorial (mycontentdev)",
  28:         "phases": ["capture", "enrich", "review", "publish"],
  29:         "gates": ["review", "publish"],
  30:         "owners": {"capture": "human", "enrich": "claude2",
  31:                    "review": "claude1", "publish": "human"},
  32:     },
  33:     "questions": {
  34:         "label": "Question corpus (QX)",
  35:         "phases": ["extract", "tag", "verify"],
  36:         "gates": [],
  37:         "owners": {"extract": "codex", "tag": "gemini", "verify": "claude2"},
  38:     },
  39:     "papers": {
  40:         "label": "Booklet-linked papers",
  41:         "phases": ["link", "build", "finalize"],
  42:         "gates": ["finalize"],
  43:         "owners": {"link": "claude2", "build": "teachingos", "finalize": "human"},
  44:     },
  45:     "media": {
  46:         "label": "Media (audio/decks/images)",
  47:         "phases": ["plan", "generate", "publish"],
  48:         "gates": ["publish"],
  49:         "owners": {"plan": "claude1", "generate": "notebooklm", "publish": "human"},
  50:     },
  51: }
  52: 
  53: VALID_STATUS = {"pending", "in_progress", "awaiting_gate", "done", "failed", "blocked"}
  54: 
  55: 
  56: def _now() -> str:
  57:     return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
  58: 
  59: 
  60: def _path(pipeline: str):
  61:     return config.STATE_DIR / f"{pipeline}.orchestrator_state.json"
  62: 
  63: 
  64: def _default(pipeline: str) -> dict:
  65:     """Build a fresh default state object in memory (no disk side effects)."""
  66:     spec = PIPELINES[pipeline]
  67:     return {
  68:         "pipeline": pipeline,
  69:         "label": spec["label"],
  70:         "created": _now(),
  71:         "updated": _now(),
  72:         "current": spec["phases"][0],
  73:         "phases": {
  74:             ph: {
  75:                 "status": "pending",
  76:                 "owner": spec["owners"].get(ph),
  77:                 "gate": ph in spec["gates"],
  78:                 "started": None,
  79:                 "finished": None,
  80:                 "artifacts": [],
  81:                 "error": None,
  82:             }
  83:             for ph in spec["phases"]
  84:         },
  85:     }
  86: 
  87: 
  88: def init(pipeline: str) -> dict:
  89:     """Create and persist a fresh state object (explicit mutation)."""
  90:     st = _default(pipeline)
  91:     save(st)
  92:     return st
  93: 
  94: 
  95: def _load_unlocked(pipeline: str) -> dict:
  96:     """Read state from disk (or an in-memory default) WITHOUT taking the lock.
  97: 
  98:     Internal primitive: callers that already hold ``.state.lock`` use this to
  99:     read inside their critical section. ``load()`` wraps it for public reads.
 100:     """
 101:     p = _path(pipeline)
 102:     if p.exists():
 103:         return json.loads(p.read_text(encoding="utf-8"))
 104:     return _default(pipeline)
 105: 
 106: 
 107: def load(pipeline: str) -> dict:
 108:     """Return current state, or an in-memory default if none exists yet.
 109: 
 110:     Read-only: a missing pipeline yields a default WITHOUT writing it to disk
 111:     (no GET-side write). Use ``init()``/``set_phase()`` to persist explicitly.
 112: 
 113:     The read is unlocked: ``os.replace`` makes every write land atomically, so a
 114:     concurrent reader always observes a complete old-or-new file, never a torn
 115:     one. Read-modify-write callers must use ``set_phase()`` (or hold the lock
 116:     and use ``_load_unlocked``) so their read and write stay in one lock span.
 117:     """
 118:     return _load_unlocked(pipeline)
 119: 
 120: 
 121: def _save_unlocked(st: dict) -> None:
 122:     """Persist state atomically WITHOUT taking the lock.
 123: 
 124:     Internal primitive: assumes the caller already holds ``.state.lock``. Stamps
 125:     ``updated``, writes to a sibling ``*.tmp`` file, then ``os.replace``s it into
 126:     place (atomic on POSIX and Windows) and mirrors to the tracker. On any
 127:     failure of the write/replace, the leftover ``*.tmp`` is best-effort removed
 128:     so a crashed write does not litter ``STATE_DIR`` (Codex LOW durability nit).
 129:     """
 130:     config.STATE_DIR.mkdir(parents=True, exist_ok=True)
 131:     st["updated"] = _now()
 132:     payload = json.dumps(st, indent=2, ensure_ascii=False)
 133:     path = _path(st["pipeline"])
 134:     tmp = path.with_suffix(path.suffix + ".tmp")
 135:     try:
 136:         tmp.write_text(payload, encoding="utf-8")
 137:         os.replace(tmp, path)
 138:     except Exception:
 139:         # Best-effort temp cleanup must NOT mask the original write/replace
 140:         # error: swallow any OSError from the unlink (not just FileNotFoundError)
 141:         # and then re-raise the ORIGINAL exception (Codex LOW).
 142:         try:
 143:             tmp.unlink()
 144:         except OSError:
 145:             pass
 146:         raise
 147:     phases = " ".join(f'{k}:{v["status"]}' for k, v in st["phases"].items())
 148:     tracker_append(
 149:         f'{st["updated"]} {st["pipeline"]} current={st.get("current")} {phases}'
 150:     )
 151: 
 152: 
 153: def save(st: dict) -> None:
 154:     """Persist state atomically under a single state lock.
 155: 
 156:     Writes the JSON to a sibling ``*.tmp`` file then ``os.replace``s it into
 157:     place (atomic on POSIX and Windows), with the whole operation guarded by a
 158:     dedicated ``.state.lock`` so concurrent gate/tick/API writes cannot
 159:     interleave and truncate or lose updates.
 160:     """
 161:     with file_lock(config.STATE_DIR / ".state.lock"):
 162:         _save_unlocked(st)
 163: 
 164: 
 165: def set_phase(pipeline: str, phase: str, status: str, **fields) -> dict:
 166:     if status not in VALID_STATUS:
 167:         raise ValueError(f"invalid status {status!r}")
 168:     # Whole read-modify-write under ONE ``.state.lock`` so two concurrent writers
 169:     # cannot load the same old JSON, mutate different phases, and have the later
 170:     # save clobber the earlier transition (the lost-update bug from Codex H2).
 171:     # ``file_lock`` is not reentrant, so we use the *unlocked* primitives here
 172:     # rather than the public ``load``/``save`` (which would re-acquire the lock).
 173:     with file_lock(config.STATE_DIR / ".state.lock"):
 174:         st = _load_unlocked(pipeline)
 175:         ph = st["phases"][phase]
 176:         ph["status"] = status
 177:         if status == "in_progress" and not ph["started"]:
 178:             ph["started"] = _now()
 179:         if status in ("done", "failed"):
 180:             ph["finished"] = _now()
 181:         for k, v in fields.items():
 182:             ph[k] = v
 183:         order = PIPELINES[pipeline]["phases"]
 184:         st["current"] = next(
 185:             (p for p in order if st["phases"][p]["status"] != "done"), order[-1]
 186:         )
 187:         _save_unlocked(st)
 188:     return st
 189: 
 190: 
 191: def all_states() -> list[dict]:
 192:     return [load(name) for name in PIPELINES]
 193: 
 194: 
 195: def tracker_append(line: str) -> None:
 196:     config.STATE_DIR.mkdir(parents=True, exist_ok=True)
 197:     with open(config.STATE_DIR / "tracker.txt", "a", encoding="utf-8") as f:
 198:         f.write(line + "\n")

 succeeded in 2149ms:
29:def connect() -> sqlite3.Connection:
30:    config.DATA_DB.parent.mkdir(parents=True, exist_ok=True)
31:    con = sqlite3.connect(config.DATA_DB)
32:    con.executescript(SCHEMA)
43:def refresh(verbose: bool = True) -> dict:
51:    deleted: the previous good catalog survives, the failure is surfaced in the
55:    con = connect()
85:                # failure, drop this adapter's partial rows, and continue
119:        cur.execute("delete from catalog")
120:        cur.execute("delete from catalog_fts")
121:        cur.execute("delete from source_summary")
122:        cur.executemany(
123:            "insert or replace into catalog values(?,?,?,?,?,?,?,?,?,?,?,?)",
126:        cur.executemany(
127:            "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
131:        cur.executemany(
132:            "insert or replace into source_summary values(?,?,?,?,?,?)",
135:        cur.execute("insert or replace into refresh_meta values('refreshed_at', ?)", (now,))
136:        con.commit()
146:    con = connect()
148:    rows = [dict(r) for r in con.execute("select * from source_summary order by source")]
149:    refreshed = con.execute(
163:    con = connect()
181:    rows = [dict(r) for r in con.execute(sql, args)]
193:    con = connect()
195:        "sources": [r[0] for r in con.execute(
197:        "kinds": [r[0] for r in con.execute(
199:        "subjects": [r[0] for r in con.execute(

 succeeded in 2143ms:
samagra/state.py:21:        "phases": ["draft", "enrich", "approve", "export"],
samagra/state.py:22:        "gates": ["approve"],
samagra/state.py:24:                   "approve": "human", "export": "teachingos"},
samagra/state.py:28:        "phases": ["capture", "enrich", "review", "publish"],
samagra/state.py:29:        "gates": ["review", "publish"],
samagra/state.py:31:                   "review": "claude1", "publish": "human"},
samagra/state.py:47:        "phases": ["plan", "generate", "publish"],
samagra/state.py:48:        "gates": ["publish"],
samagra/state.py:49:        "owners": {"plan": "claude1", "generate": "notebooklm", "publish": "human"},
samagra/state.py:53:VALID_STATUS = {"pending", "in_progress", "awaiting_gate", "done", "failed", "blocked"}
samagra/state.py:89:    """Create and persist a fresh state object (explicit mutation)."""
samagra/state.py:91:    save(st)
samagra/state.py:99:    read inside their critical section. ``load()`` wraps it for public reads.
samagra/state.py:107:def load(pipeline: str) -> dict:
samagra/state.py:111:    (no GET-side write). Use ``init()``/``set_phase()`` to persist explicitly.
samagra/state.py:113:    The read is unlocked: ``os.replace`` makes every write land atomically, so a
samagra/state.py:115:    one. Read-modify-write callers must use ``set_phase()`` (or hold the lock
samagra/state.py:116:    and use ``_load_unlocked``) so their read and write stay in one lock span.
samagra/state.py:125:    ``updated``, writes to a sibling ``*.tmp`` file, then ``os.replace``s it into
samagra/state.py:127:    failure of the write/replace, the leftover ``*.tmp`` is best-effort removed
samagra/state.py:128:    so a crashed write does not litter ``STATE_DIR`` (Codex LOW durability nit).
samagra/state.py:136:        tmp.write_text(payload, encoding="utf-8")
samagra/state.py:139:        # Best-effort temp cleanup must NOT mask the original write/replace
samagra/state.py:153:def save(st: dict) -> None:
samagra/state.py:158:    dedicated ``.state.lock`` so concurrent gate/tick/API writes cannot
samagra/state.py:165:def set_phase(pipeline: str, phase: str, status: str, **fields) -> dict:
samagra/state.py:168:    # Whole read-modify-write under ONE ``.state.lock`` so two concurrent writers
samagra/state.py:169:    # cannot load the same old JSON, mutate different phases, and have the later
samagra/state.py:192:    return [load(name) for name in PIPELINES]
samagra/state.py:198:        f.write(line + "\n")
samagra/scheduler.py:3:A tick: take the scheduler lock (no concurrent ticks), refresh the catalog, reflect
samagra/scheduler.py:4:the real physics-textbook state into the `textbook` pipeline, raise the `approve`
samagra/scheduler.py:6:chapters that have been approved through SAMAGRA. Hard gates never auto-advance.
samagra/scheduler.py:22:EXPORT_BATCH = 3  # chapters exported per tick once approved (bounded)
samagra/scheduler.py:36:        return {"total": 0, "drafted": 0, "enriched": 0, "approved": 0, "chapters": []}
samagra/scheduler.py:39:    done_states = {"drafted", "in-review", "approved", "enriched"}
samagra/scheduler.py:44:        "approved": sum(1 for c in ch if c.get("status") == "approved"),
samagra/scheduler.py:49:def _reflect_textbook(dry: bool, events: list) -> dict:
samagra/scheduler.py:51:    st = state.load("textbook")
samagra/scheduler.py:54:            state.set_phase("textbook", "draft", "done",
samagra/scheduler.py:58:            state.set_phase("textbook", "enrich", "done",
samagra/scheduler.py:60:    st = state.load("textbook")
samagra/scheduler.py:63:    if ready and st["phases"]["approve"]["status"] == "pending":
samagra/scheduler.py:65:            state.set_phase("textbook", "approve", "awaiting_gate")
samagra/scheduler.py:67:                       f'textbook: "approve" gate ready — {c["drafted"]}/{c["total"]} '
samagra/scheduler.py:87:def _reflect_mycontentdev(dry: bool, events: list, client=None) -> dict:
samagra/scheduler.py:92:    st = state.load("mycontentdev")
samagra/scheduler.py:93:    # All seeds done -> publish phase done.
samagra/scheduler.py:94:    if c["total"] and c["done"] >= c["total"] and st["phases"]["publish"]["status"] != "done":
samagra/scheduler.py:96:            state.set_phase("mycontentdev", "publish", "done",
samagra/scheduler.py:99:    st = state.load("mycontentdev")
samagra/scheduler.py:102:            state.set_phase("mycontentdev", "review", "awaiting_gate")
samagra/scheduler.py:110:    st = state.load("textbook")
samagra/scheduler.py:111:    if st["phases"]["approve"]["status"] != "done":
samagra/scheduler.py:112:        return 0  # not approved yet
samagra/scheduler.py:125:            state.set_phase("textbook", "export", "done",
samagra/scheduler.py:136:            state.set_phase("textbook", "export", "failed", error=str(e))
samagra/scheduler.py:142:        state.set_phase("textbook", "export", "done",
samagra/scheduler.py:147:def tick(dry_run: bool = False) -> dict:
samagra/scheduler.py:161:            if not dry_run:
samagra/scheduler.py:168:        ctx = nullcontext() if dry_run else file_lock(_sched_lock())
samagra/scheduler.py:170:            totals = {} if dry_run else catalog.refresh(verbose=False)
samagra/scheduler.py:176:            log.append(f"catalog: {('dry' if dry_run else ok_count)} artifacts")
samagra/scheduler.py:182:            counts = _reflect_textbook(dry_run, events)
samagra/scheduler.py:184:                       f'{counts["approved"]} approved')
samagra/scheduler.py:185:            n = _run_pending_exports(dry_run, counts, events)
samagra/scheduler.py:192:        if not dry_run:
samagra/scheduler.py:195:    return {"dry_run": dry_run, "log": log, "events": [e for e, _ in events]}
samagra/scheduler.py:198:def gate(pipeline: str, decision: str) -> dict:
samagra/scheduler.py:199:    if decision not in ("approve", "reject"):
samagra/scheduler.py:200:        return {"error": f"unknown decision {decision!r}"}
samagra/scheduler.py:201:    st = state.load(pipeline)
samagra/scheduler.py:206:    # gate (vs. the first `awaiting_gate`-or-`pending` one) prevents approving a
samagra/scheduler.py:214:    if st["phases"][target]["status"] != "awaiting_gate":
samagra/scheduler.py:215:        return {"error": f"{pipeline}.{target} is not awaiting_gate"}
samagra/scheduler.py:219:    if decision == "approve":
samagra/scheduler.py:220:        state.set_phase(pipeline, target, "done", approved_at=_stamp())
samagra/scheduler.py:221:        notify.notify("gate-approved", f'{pipeline}: "{target}" approved.')
samagra/scheduler.py:223:        state.set_phase(pipeline, target, "blocked")
samagra/scheduler.py:225:    return {"pipeline": pipeline, "gate": target, "decision": decision}

 succeeded in 2280ms:
   1: """Semi-autonomous scheduler.
   2: 
   3: A tick: take the scheduler lock (no concurrent ticks), refresh the catalog, reflect
   4: the real physics-textbook state into the `textbook` pipeline, raise the `approve`
   5: hard gate (pause + notify) when drafting/enriching is complete, and export any
   6: chapters that have been approved through SAMAGRA. Hard gates never auto-advance.
   7: 
   8: SAMAGRA is scheduler-of-record but coexists with physics-textbook's own 2h
   9: automations by honoring its `.routine.lock`.
  10: """
  11: from __future__ import annotations
  12: 
  13: import json
  14: import subprocess
  15: import time
  16: from contextlib import nullcontext
  17: 
  18: from . import catalog, clients, config, notify, state
  19: from . import lock as lockmod
  20: from .lock import LockBusy, file_lock, is_busy
  21: 
  22: EXPORT_BATCH = 3  # chapters exported per tick once approved (bounded)
  23: TASK_NAME = "SAMAGRA-tick"
  24: 
  25: 
  26: def _sched_lock():
  27:     return config.STATE_DIR / ".scheduler.lock"
  28: 
  29: 
  30: def _stamp() -> str:
  31:     return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
  32: 
  33: 
  34: def _textbook_counts() -> dict:
  35:     if not config.TEXTBOOK_QUEUE.exists():
  36:         return {"total": 0, "drafted": 0, "enriched": 0, "approved": 0, "chapters": []}
  37:     q = json.loads(config.TEXTBOOK_QUEUE.read_text(encoding="utf-8"))
  38:     ch = q.get("chapters", [])
  39:     done_states = {"drafted", "in-review", "approved", "enriched"}
  40:     return {
  41:         "total": len(ch),
  42:         "drafted": sum(1 for c in ch if c.get("status") in done_states),
  43:         "enriched": sum(1 for c in ch if c.get("enriched_at")),
  44:         "approved": sum(1 for c in ch if c.get("status") == "approved"),
  45:         "chapters": ch,
  46:     }
  47: 
  48: 
  49: def _reflect_textbook(dry: bool, events: list) -> dict:
  50:     c = _textbook_counts()
  51:     st = state.load("textbook")
  52:     if c["total"] and c["drafted"] >= c["total"] and st["phases"]["draft"]["status"] != "done":
  53:         if not dry:
  54:             state.set_phase("textbook", "draft", "done",
  55:                             artifacts=[f'{c["drafted"]}/{c["total"]} drafted'])
  56:     if c["total"] and c["enriched"] >= c["total"] and st["phases"]["enrich"]["status"] != "done":
  57:         if not dry:
  58:             state.set_phase("textbook", "enrich", "done",
  59:                             artifacts=[f'{c["enriched"]}/{c["total"]} enriched'])
  60:     st = state.load("textbook")
  61:     ready = (st["phases"]["draft"]["status"] == "done"
  62:              and st["phases"]["enrich"]["status"] == "done")
  63:     if ready and st["phases"]["approve"]["status"] == "pending":
  64:         if not dry:
  65:             state.set_phase("textbook", "approve", "awaiting_gate")
  66:         events.append(("gate-ready",
  67:                        f'textbook: "approve" gate ready â€” {c["drafted"]}/{c["total"]} '
  68:                        "chapters drafted+enriched, awaiting approval."))
  69:     return c
  70: 
  71: 
  72: def _mcd_status_counts(client) -> dict:
  73:     rows = client.query(
  74:         "SELECT id,type,title,status,created_at,updated_at "
  75:         "FROM seeds WHERE status != 'archived'"
  76:     )
  77:     total = len(rows)
  78:     statuses = [r.get("status") for r in rows]
  79:     return {
  80:         "total": total,
  81:         "draft_ready": sum(1 for s in statuses
  82:                            if s in ("draft_ready", "changes_requested")),
  83:         "done": sum(1 for s in statuses if s == "done"),
  84:     }
  85: 
  86: 
  87: def _reflect_mycontentdev(dry: bool, events: list, client=None) -> dict:
  88:     client = client or clients.McdClient()
  89:     if not client.available():
  90:         return {"skipped": "no mcd creds"}
  91:     c = _mcd_status_counts(client)
  92:     st = state.load("mycontentdev")
  93:     # All seeds done -> publish phase done.
  94:     if c["total"] and c["done"] >= c["total"] and st["phases"]["publish"]["status"] != "done":
  95:         if not dry:
  96:             state.set_phase("mycontentdev", "publish", "done",
  97:                             artifacts=[f'{c["done"]}/{c["total"]} done'])
  98:     # Any draft_ready/changes_requested -> review gate ready.
  99:     st = state.load("mycontentdev")
 100:     if c["draft_ready"] and st["phases"]["review"]["status"] in ("pending",):
 101:         if not dry:
 102:             state.set_phase("mycontentdev", "review", "awaiting_gate")
 103:         events.append(("gate-ready",
 104:                        f'mycontentdev: "review" gate ready â€” {c["draft_ready"]} '
 105:                        "seed(s) draft_ready, awaiting review."))
 106:     return c
 107: 
 108: 
 109: def _run_pending_exports(dry: bool, counts: dict, events: list) -> int:
 110:     st = state.load("textbook")
 111:     if st["phases"]["approve"]["status"] != "done":
 112:         return 0  # not approved yet
 113:     if st["phases"]["export"]["status"] == "done":
 114:         return 0
 115:     from .lectures import export as lex
 116: 
 117:     pending = []
 118:     for c in counts["chapters"]:
 119:         slug = c.get("slug")
 120:         out = config.EXPORT_DIR / slug / f"{slug}-thick.html"
 121:         if slug and not out.exists():
 122:             pending.append(slug)
 123:     if not pending:
 124:         if not dry:
 125:             state.set_phase("textbook", "export", "done",
 126:                             artifacts=[f'{counts["total"]} chapters exported'])
 127:         return 0
 128:     batch = pending[:EXPORT_BATCH]
 129:     if dry:
 130:         events.append(("export", f"would export {len(batch)} chapter(s): {', '.join(batch)}"))
 131:         return len(batch)
 132:     for slug in batch:
 133:         try:
 134:             lex.run(slug, "both")
 135:         except Exception as e:  # noqa: BLE001
 136:             state.set_phase("textbook", "export", "failed", error=str(e))
 137:             events.append(("failure", f"textbook export failed for {slug}: {e}"))
 138:             return 0
 139:     remaining = len(pending) - len(batch)
 140:     events.append(("export", f"exported {len(batch)} chapter(s); {remaining} remaining"))
 141:     if remaining == 0:
 142:         state.set_phase("textbook", "export", "done",
 143:                         artifacts=[f'{counts["total"]} chapters exported'])
 144:     return len(batch)
 145: 
 146: 
 147: def tick(dry_run: bool = False) -> dict:
 148:     # OWN lock: present == busy (no auto-reclaim). If our scheduler lock exists,
 149:     # another tick holds it â€” skip. If it is OLDER than the stale threshold it is
 150:     # almost certainly a crashed run that never released; surface that and tell
 151:     # the operator to clear it with `samagra unlock` (and notify on a live run).
 152:     sched = _sched_lock()
 153:     if sched.exists():
 154:         try:
 155:             age = time.time() - sched.stat().st_mtime
 156:         except FileNotFoundError:
 157:             age = 0.0
 158:         if age >= lockmod.STALE_SECONDS:
 159:             msg = ("scheduler lock present and stale (likely a crashed run) â€” "
 160:                    "run `samagra unlock` to clear it")
 161:             if not dry_run:
 162:                 notify.notify("failure", msg)
 163:             return {"skipped": msg}
 164:         return {"skipped": "scheduler lock busy"}
 165:     events: list = []
 166:     log: list = []
 167:     try:
 168:         ctx = nullcontext() if dry_run else file_lock(_sched_lock())
 169:         with ctx:
 170:             totals = {} if dry_run else catalog.refresh(verbose=False)
 171:             # H3: catalog.refresh() maps a FAILED source to None (last-known-good
 172:             # preserved). Count only successful artifacts â€” never sum None â€” and
 173:             # surface which sources failed so degradation is visible, not hidden.
 174:             ok_count = sum(v for v in totals.values() if v is not None)
 175:             failed = [s for s, v in totals.items() if v is None]
 176:             log.append(f"catalog: {('dry' if dry_run else ok_count)} artifacts")
 177:             if failed:
 178:                 log.append(f"catalog: {len(failed)} source(s) FAILED: {', '.join(failed)}")
 179:                 events.append(("failure",
 180:                                f"catalog refresh: {len(failed)} source(s) failed "
 181:                                f"({', '.join(failed)}); previous catalog preserved."))
 182:             counts = _reflect_textbook(dry_run, events)
 183:             log.append(f'textbook: {counts["drafted"]}/{counts["total"]} drafted, '
 184:                        f'{counts["approved"]} approved')
 185:             n = _run_pending_exports(dry_run, counts, events)
 186:             log.append(f"exports this tick: {n}")
 187:             if is_busy(config.TEXTBOOK_LOCK):
 188:                 log.append("note: physics-textbook routine lock active â€” coexisting")
 189:     except LockBusy:
 190:         return {"skipped": "lock busy"}
 191:     for ev, msg in events:
 192:         if not dry_run:
 193:             notify.notify(ev, msg)
 194:         log.append(f"NOTIFY[{ev}] {msg}")
 195:     return {"dry_run": dry_run, "log": log, "events": [e for e, _ in events]}
 196: 
 197: 
 198: def gate(pipeline: str, decision: str) -> dict:
 199:     if decision not in ("approve", "reject"):
 200:         return {"error": f"unknown decision {decision!r}"}
 201:     st = state.load(pipeline)
 202:     order = state.PIPELINES[pipeline]["phases"]
 203:     gates = [n for n in order if st["phases"][n].get("gate")]
 204:     # F-02: only act on a gate that is actually awaiting approval, and never on a
 205:     # gate whose prior phases are not all done. Selecting the first still-open
 206:     # gate (vs. the first `awaiting_gate`-or-`pending` one) prevents approving a
 207:     # gate before its prerequisite phases â€” which would let exports run from an
 208:     # invalid state.
 209:     target = next((n for n in gates
 210:                    if st["phases"][n]["status"] not in ("done", "blocked")),
 211:                   None)
 212:     if not target:
 213:         return {"error": f"{pipeline} has no open gate"}
 214:     if st["phases"][target]["status"] != "awaiting_gate":
 215:         return {"error": f"{pipeline}.{target} is not awaiting_gate"}
 216:     idx = order.index(target)
 217:     if any(st["phases"][p]["status"] != "done" for p in order[:idx]):
 218:         return {"error": f"{pipeline}.{target} prerequisites are incomplete"}
 219:     if decision == "approve":
 220:         state.set_phase(pipeline, target, "done", approved_at=_stamp())
 221:         notify.notify("gate-approved", f'{pipeline}: "{target}" approved.')
 222:     else:  # reject
 223:         state.set_phase(pipeline, target, "blocked")
 224:         notify.notify("gate-rejected", f'{pipeline}: "{target}" rejected.')
 225:     return {"pipeline": pipeline, "gate": target, "decision": decision}
 226: 
 227: 
 228: # -- Windows Task Scheduler integration ---------------------------------
 229: def install_task(cadence: str = "HOURLY") -> tuple[bool, str]:
 230:     cmd_file = config.REPO_ROOT / "scripts" / "tos_tick.cmd"
 231:     args = ["schtasks", "/Create", "/TN", TASK_NAME,
 232:             "/TR", f'"{cmd_file}"', "/SC", cadence, "/F"]
 233:     proc = subprocess.run(args, capture_output=True, text=True)
 234:     return proc.returncode == 0, (proc.stdout + proc.stderr).strip()
 235: 
 236: 
 237: def task_status() -> str | None:
 238:     proc = subprocess.run(["schtasks", "/Query", "/TN", TASK_NAME, "/FO", "LIST"],
 239:                           capture_output=True, text=True)
 240:     return proc.stdout.strip() if proc.returncode == 0 else None

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/catalog.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 210) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 1661ms:
   1: """Unified catalog over all source adapters, persisted in samagra.db."""
   2: from __future__ import annotations
   3: 
   4: import json
   5: import sqlite3
   6: import time
   7: 
   8: from . import config
   9: from .adapters import ALL_ADAPTERS
  10: 
  11: SCHEMA = """
  12: create table if not exists catalog(
  13:   uid text primary key, source text, kind text, title text,
  14:   subject text, unit text, chapter text, status text,
  15:   path text, url text, updated_at text, meta_json text);
  16: create table if not exists source_summary(
  17:   source text primary key, label text, available int,
  18:   summary_json text, n_artifacts int, refreshed_at text);
  19: create table if not exists refresh_meta(key text primary key, value text);
  20: create virtual table if not exists catalog_fts using fts5(
  21:   uid unindexed, title, subject, chapter, kind, source);
  22: """
  23: 
  24: 
  25: def _now() -> str:
  26:     return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
  27: 
  28: 
  29: def connect() -> sqlite3.Connection:
  30:     config.DATA_DB.parent.mkdir(parents=True, exist_ok=True)
  31:     con = sqlite3.connect(config.DATA_DB)
  32:     con.executescript(SCHEMA)
  33:     return con
  34: 
  35: 
  36: def _fts_query(query: str) -> str:
  37:     """Build a safe FTS5 MATCH expression: prefix-match each alnum token."""
  38:     tokens = ["".join(ch for ch in t if ch.isalnum()) for t in query.split()]
  39:     tokens = [t for t in tokens if t]
  40:     return " ".join(f'"{t}"*' for t in tokens)
  41: 
  42: 
  43: def refresh(verbose: bool = True) -> dict:
  44:     """Rebuild the catalog last-known-good safe.
  45: 
  46:     Each adapter is collected into in-memory staging buffers BEFORE the live
  47:     tables are touched. The live ``catalog``/``catalog_fts``/``source_summary``
  48:     tables are only cleared and repopulated once every available adapter has
  49:     yielded its artifacts without error â€” the whole swap runs in a single
  50:     transaction. If any adapter raises while producing artifacts, nothing is
  51:     deleted: the previous good catalog survives, the failure is surfaced in the
  52:     returned per-source totals (the source maps to ``None``), and no completed
  53:     ``refreshed_at`` timestamp is written.
  54:     """
  55:     con = connect()
  56:     cur = con.cursor()
  57:     now = _now()
  58: 
  59:     staged_catalog: list[tuple] = []
  60:     staged_fts: list[tuple] = []
  61:     staged_summary: list[tuple] = []
  62:     totals: dict[str, int | None] = {}
  63:     failures: list[str] = []
  64: 
  65:     for ad in ALL_ADAPTERS:
  66:         avail = ad.available()
  67:         rows: list[tuple] = []
  68:         fts_rows: list[tuple] = []
  69:         summ: dict = {}
  70:         failed = False
  71:         if avail:
  72:             try:
  73:                 summ = ad.summary()
  74:             except Exception as exc:  # noqa: BLE001
  75:                 summ = {"error": str(exc)}
  76:             try:
  77:                 for art in ad.artifacts():
  78:                     rows.append(art.row())
  79:                     fts_rows.append(
  80:                         (art.uid, art.title or "", art.subject or "",
  81:                          art.chapter or "", art.kind or "", art.source)
  82:                     )
  83:             except Exception as exc:  # noqa: BLE001
  84:                 # A failing adapter must NOT poison the live catalog. Record the
  85:                 # failure, drop this adapter's partial rows, and continue
  86:                 # collecting so the report is complete â€” but the global refresh
  87:                 # is aborted (last-known-good preserved) at the end.
  88:                 summ.setdefault("error", str(exc))
  89:                 failed = True
  90:                 rows = []
  91:                 fts_rows = []
  92:         if failed:
  93:             failures.append(ad.name)
  94:             totals[ad.name] = None
  95:         else:
  96:             totals[ad.name] = len(rows)
  97:         staged_catalog.extend(rows)
  98:         staged_fts.extend(fts_rows)
  99:         staged_summary.append(
 100:             (ad.name, ad.label, int(avail),
 101:              json.dumps(summ, ensure_ascii=False),
 102:              0 if failed else len(rows), now)
 103:         )
 104:         if verbose:
 105:             shown = "FAILED" if failed else f"{len(rows):>6}"
 106:             print(f"  {ad.name:12} available={avail!s:5} artifacts={shown}  {summ}")
 107: 
 108:     if failures:
 109:         # Last-known-good: do not touch the live catalog at all.
 110:         con.rollback()
 111:         con.close()
 112:         if verbose:
 113:             print(f"  refresh ABORTED â€” adapters failed: {', '.join(failures)}; "
 114:                   "previous catalog preserved")
 115:         return totals
 116: 
 117:     # All adapters succeeded â€” swap atomically into the live tables.
 118:     try:
 119:         cur.execute("delete from catalog")
 120:         cur.execute("delete from catalog_fts")
 121:         cur.execute("delete from source_summary")
 122:         cur.executemany(
 123:             "insert or replace into catalog values(?,?,?,?,?,?,?,?,?,?,?,?)",
 124:             staged_catalog,
 125:         )
 126:         cur.executemany(
 127:             "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
 128:             "values(?,?,?,?,?,?)",
 129:             staged_fts,
 130:         )
 131:         cur.executemany(
 132:             "insert or replace into source_summary values(?,?,?,?,?,?)",
 133:             staged_summary,
 134:         )
 135:         cur.execute("insert or replace into refresh_meta values('refreshed_at', ?)", (now,))
 136:         con.commit()
 137:     except Exception:  # noqa: BLE001
 138:         con.rollback()
 139:         con.close()
 140:         raise
 141:     con.close()
 142:     return totals
 143: 
 144: 
 145: def overview() -> dict:
 146:     con = connect()
 147:     con.row_factory = sqlite3.Row
 148:     rows = [dict(r) for r in con.execute("select * from source_summary order by source")]
 149:     refreshed = con.execute(
 150:         "select value from refresh_meta where key='refreshed_at'"
 151:     ).fetchone()
 152:     con.close()
 153:     for r in rows:
 154:         try:
 155:             r["summary"] = json.loads(r["summary_json"])
 156:         except Exception:  # noqa: BLE001
 157:             r["summary"] = {}
 158:     return {"sources": rows, "refreshed_at": refreshed[0] if refreshed else None}
 159: 
 160: 
 161: def search(query: str = "", source: str | None = None,
 162:            kind: str | None = None, limit: int = 100) -> list[dict]:
 163:     con = connect()
 164:     con.row_factory = sqlite3.Row
 165:     args: list = []
 166:     match = _fts_query(query) if query else ""
 167:     if match:
 168:         sql = ("select c.* from catalog_fts f join catalog c on c.uid=f.uid "
 169:                "where catalog_fts match ?")
 170:         args.append(match)
 171:     else:
 172:         sql = "select * from catalog c where 1=1"
 173:     if source:
 174:         sql += " and c.source=?"
 175:         args.append(source)
 176:     if kind:
 177:         sql += " and c.kind=?"
 178:         args.append(kind)
 179:     sql += " limit ?"
 180:     args.append(limit)
 181:     rows = [dict(r) for r in con.execute(sql, args)]
 182:     con.close()
 183:     for r in rows:
 184:         try:
 185:             r["meta"] = json.loads(r["meta_json"])
 186:         except Exception:  # noqa: BLE001
 187:             r["meta"] = {}
 188:     return rows
 189: 
 190: 
 191: def facets() -> dict:
 192:     """Distinct sources / kinds / subjects for portal filters."""
 193:     con = connect()
 194:     out = {
 195:         "sources": [r[0] for r in con.execute(
 196:             "select distinct source from catalog order by 1")],
 197:         "kinds": [r[0] for r in con.execute(
 198:             "select distinct kind from catalog order by 1")],
 199:         "subjects": [r[0] for r in con.execute(
 200:             "select distinct subject from catalog where subject is not null order by 1")],
 201:     }
 202:     con.close()
 203:     return out

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/clients/munshi_client.py' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/questions_proxy.py' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/clients/qx_client.py' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/clients/mcd_client.py' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 2259ms:
   1: """Admin-API client for mycontentdev (editorial subsystem).
   2: 
   3: Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
   4: {apiUrl,adminKey} at the mycontentdev repo root, or env MCD_API_URL /
   5: MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
   6: 
   7: SAFETY: this client NEVER logs or reprs a key value. Reads (query / pending /
   8: available) plus the owner-initiated capture write create_seed (POST /api/seeds,
   9: form-encoded, authorized by the adminKey via the x-mcd-admin header) are
  10: supported. The write was added under the 2026-06-21 DEC-3 amendment
  11: (owner-initiated capture in-scope; the human publish gate stays never-automated).
  12: """
  13: from __future__ import annotations
  14: 
  15: import json
  16: import os
  17: 
  18: import requests
  19: 
  20: from .. import config
  21: 
  22: _TIMEOUT = 30
  23: # mycontentdev repo root, sibling of the samagra repo under claude_box.
  24: _MCD_ROOT = config.CLAUDE_BOX / "mycontentdev"
  25: 
  26: 
  27: def _load_cloud_json() -> dict:
  28:     p = _MCD_ROOT / "mcd-cloud.json"
  29:     if p.exists():
  30:         try:
  31:             return json.loads(p.read_text(encoding="utf-8"))
  32:         except Exception:  # noqa: BLE001
  33:             return {}
  34:     return {}
  35: 
  36: 
  37: class McdClient:
  38:     def __init__(self, api_url=None, admin_key=None, app_key=None):
  39:         file = _load_cloud_json()
  40:         url = api_url or os.environ.get("MCD_API_URL") or file.get("apiUrl") or ""
  41:         self.api_url = url.rstrip("/")
  42:         self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
  43:         self._app_key = app_key or os.environ.get("MCD_APP_KEY") or file.get("appKey") or ""
  44: 
  45:     def available(self) -> bool:
  46:         return bool(self.api_url and self._admin_key)
  47: 
  48:     def query(self, sql: str) -> list[dict]:
  49:         r = requests.post(
  50:             f"{self.api_url}/api/admin/query",
  51:             headers={"x-mcd-admin": self._admin_key, "content-type": "application/json"},
  52:             json={"sql": sql},
  53:             timeout=_TIMEOUT,
  54:         )
  55:         r.raise_for_status()
  56:         return r.json()
  57: 
  58:     def create_seed(self, fields: dict) -> dict:
  59:         # Owner-initiated capture. The deployed worker parses multipart/form-data
  60:         # (request.formData()), so send form-encoded â€” NOT json. The existing
  61:         # adminKey authorizes /api/seeds (middleware accepts adminOk). Never logs keys.
  62:         r = requests.post(
  63:             f"{self.api_url}/api/seeds",
  64:             headers={"x-mcd-admin": self._admin_key},
  65:             data=fields,
  66:             timeout=_TIMEOUT,
  67:         )
  68:         r.raise_for_status()
  69:         return r.json()
  70: 
  71:     def pending(self) -> list[dict]:
  72:         r = requests.get(
  73:             f"{self.api_url}/api/admin/pending",
  74:             headers={"x-mcd-admin": self._admin_key},
  75:             timeout=_TIMEOUT,
  76:         )
  77:         r.raise_for_status()
  78:         return r.json()
  79: 
  80:     def __repr__(self) -> str:  # never leak key values
  81:         return f"McdClient(api_url={self.api_url!r}, admin_key=<set:{bool(self._admin_key)}>)"

 succeeded in 2309ms:
   1: """Helpers for proxying the QX question engine's JSON search into SAMAGRA.
   2: 
   3: QX renders question HTML with relative asset URLs (``/asset?slug=..&id=..``) for
   4: figures and equation-image fallbacks. The Questions app is served from SAMAGRA's
   5: own origin, so those relative URLs would resolve against SAMAGRA (404). Rewrite
   6: them to absolute QX-server URLs so the browser loads assets directly from QX.
   7: Pure string transform â€” no HTTP, no parsing beyond a prefix replace.
   8: """
   9: from __future__ import annotations
  10: 
  11: _REL = 'src="/asset?'
  12: 
  13: 
  14: def absolutize_assets(payload: dict, qx_base_url: str) -> dict:
  15:     """Rewrite every ``src="/asset?...`` in each result's HTML to an absolute QX
  16:     URL. Mutates and returns ``payload``. No-op when there are no results / html."""
  17:     base = (qx_base_url or "").rstrip("/")
  18:     repl = f'src="{base}/asset?'
  19:     for row in payload.get("results") or []:
  20:         html = row.get("html")
  21:         if isinstance(html, str) and _REL in html:
  22:             row["html"] = html.replace(_REL, repl)
  23:     return payload

 succeeded in 2610ms:
   1: """Read-only library client for munshi (front-desk subsystem).
   2: 
   3: Mirrors myProd/stress/driver.mjs MunshiClient: cookie auth via
   4: Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
   5: MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
   6: """
   7: from __future__ import annotations
   8: 
   9: import os
  10: from urllib.parse import quote
  11: 
  12: import requests
  13: 
  14: _TIMEOUT = 30
  15: 
  16: 
  17: class MunshiClient:
  18:     def __init__(self, api_url=None, secret=None):
  19:         url = api_url or os.environ.get("MUNSHI_API_URL") or ""
  20:         self.api_url = url.rstrip("/")
  21:         self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""
  22: 
  23:     def available(self) -> bool:
  24:         return bool(self.api_url and self._secret)
  25: 
  26:     def _cookie(self) -> str:
  27:         # quote(..., safe="") mirrors JS encodeURIComponent. It over-encodes
  28:         # ! ' ( ) * (which encodeURIComponent leaves literal), but the munshi
  29:         # server decodeURIComponent's the cookie before comparing (index.ts),
  30:         # so both forms round-trip to the same secret â€” auth is unaffected.
  31:         return "munshi=" + quote(self._secret, safe="")
  32: 
  33:     def library(self) -> dict:
  34:         r = requests.get(
  35:             f"{self.api_url}/api/library",
  36:             headers={"Cookie": self._cookie()},
  37:             timeout=_TIMEOUT,
  38:         )
  39:         r.raise_for_status()
  40:         return r.json()
  41: 
  42:     def create_item(self, kind: str, fields: dict) -> dict:
  43:         # Owner-initiated capture. Deterministic /api/item write; same stateless
  44:         # cookie auth as library(). kind must be todo|note|followup (the worker
  45:         # rejects others). The secret is never logged.
  46:         r = requests.post(
  47:             f"{self.api_url}/api/item",
  48:             headers={"Cookie": self._cookie(), "content-type": "application/json"},
  49:             json={"kind": kind, **fields},
  50:             timeout=_TIMEOUT,
  51:         )
  52:         r.raise_for_status()
  53:         return r.json()
  54: 
  55:     def __repr__(self) -> str:  # never leak the secret
  56:         return f"MunshiClient(api_url={self.api_url!r}, secret=<set:{bool(self._secret)}>)"

 succeeded in 2829ms:
   1: """QxClient â€” thin client to the always-up local QX server's JSON search route.
   2: 
   3: QX (gpt-extract-ques) is the question engine. It runs as a local read-only HTTP
   4: server (``python gui/qx_browser.py`` -> :8783) exposing ``GET /api/qsearch``:
   5: exact + semantic search with per-result rendered HTML (KaTeX maths + figures) and
   6: browse facets. SAMAGRA's ``/api/questions`` proxies this so the OS Questions app
   7: gets the real QX engine instead of a thin LIKE slice over QX's sqlite.
   8: 
   9: No secret: QX is local and fail-open on localhost (Cloudflare Access only engages
  10: when QX_ACCESS_* env is set). The base URL is configurable via SAMAGRA_QX_SERVER_URL.
  11: """
  12: from __future__ import annotations
  13: 
  14: import requests
  15: 
  16: from .. import config
  17: 
  18: _TIMEOUT = 30
  19: 
  20: 
  21: class QxClient:
  22:     def __init__(self, base_url: str | None = None):
  23:         self.base_url = (base_url or config.QX_SERVER_URL).rstrip("/")
  24: 
  25:     def search(self, *, q: str = "", mode: str = "exact", subject: str | None = None,
  26:                chapter: str | None = None, qtype: str | None = None, page: int = 1) -> dict:
  27:         params: dict = {"q": q, "mode": mode, "page": page}
  28:         for key, val in (("subject", subject), ("chapter", chapter), ("qtype", qtype)):
  29:             if val:
  30:                 params[key] = val
  31:         r = requests.get(f"{self.base_url}/api/qsearch", params=params, timeout=_TIMEOUT)
  32:         r.raise_for_status()
  33:         return r.json()

codex
The capture endpoints do whitelist fields and catch upstream failures, but the response returns the created upstream object verbatim. I’m checking whether that upstream object can include sensitive payload/meta, and whether frontend/server contracts actually match.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'frontend/src/lib/capture/munshi.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'frontend/src/lib/capture/seed.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'frontend/src/hooks/useApiPost.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'frontend/src/hooks/useApi.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 3899ms:
   1: import type { SeedType, SeedForm } from "../../types/contracts";
   2: export const SEED_TYPES: readonly SeedType[] = [
   3:   "concept", "question", "snippet", "simulation_idea",
   4:   "experiment", "notebooklm_link", "rough_idea",
   5: ];
   6: export type SeedResult =
   7:   | { ok: true; body: Record<string, string> }
   8:   | { ok: false; error: string };
   9: export function buildSeed(form: SeedForm): SeedResult {
  10:   if (!SEED_TYPES.includes(form.type)) return { ok: false, error: "pick a seed type" };
  11:   const raw = (form.raw_text ?? "").trim();
  12:   if (!raw) return { ok: false, error: "raw_text is required" };
  13:   const body: Record<string, string> = { type: form.type, raw_text: raw };
  14:   if ((form.title ?? "").trim()) body.title = form.title!.trim();
  15:   if ((form.source_ref ?? "").trim()) body.source_ref = form.source_ref!.trim();
  16:   return { ok: true, body };
  17: }

 succeeded in 3876ms:
   1: // src/hooks/useApi.ts
   2: // Typed thin fetch hook against the `ApiClient` contract (api.md Â§2).
   3: // Read-only: GETs a JSON endpoint and exposes {data, error, loading}.
   4: // All real shaping lives in the consuming component / pure lib â€” this hook
   5: // only owns the fetch + JSON decode + mount/unmount lifecycle.
   6: import { useEffect, useState } from "react";
   7: 
   8: export interface ApiState<T> {
   9:   data: T | null;
  10:   error: string | null;
  11:   loading: boolean;
  12: }
  13: 
  14: /**
  15:  * GET a JSON endpoint once on mount. Defensive: a non-2xx response or a JSON
  16:  * decode failure surfaces as `error` rather than throwing into render. The
  17:  * effect is abort-guarded so a unit that unmounts mid-flight never setstates.
  18:  */
  19: export function useApi<T = unknown>(path: string): ApiState<T> {
  20:   const [state, setState] = useState<ApiState<T>>({
  21:     data: null,
  22:     error: null,
  23:     loading: true,
  24:   });
  25: 
  26:   useEffect(() => {
  27:     let alive = true;
  28:     setState({ data: null, error: null, loading: true });
  29:     (async () => {
  30:       try {
  31:         const res = await fetch(path, { headers: { accept: "application/json" } });
  32:         if (!res.ok) {
  33:           if (alive) setState({ data: null, error: `HTTP ${res.status}`, loading: false });
  34:           return;
  35:         }
  36:         const json = (await res.json()) as T;
  37:         if (alive) setState({ data: json, error: null, loading: false });
  38:       } catch (e) {
  39:         if (alive) setState({ data: null, error: String(e), loading: false });
  40:       }
  41:     })();
  42:     return () => {
  43:       alive = false;
  44:     };
  45:   }, [path]);
  46: 
  47:   return state;
  48: }

 succeeded in 4094ms:
   1: import { useState } from "react";
   2: export interface PostState<T> { data: T | null; error: string | null; loading: boolean; }
   3: export function useApiPost<T = unknown>() {
   4:   const [state, setState] = useState<PostState<T>>({ data: null, error: null, loading: false });
   5:   async function post(path: string, body: unknown): Promise<T | null> {
   6:     setState({ data: null, error: null, loading: true });
   7:     try {
   8:       const res = await fetch(path, {
   9:         method: "POST",
  10:         headers: { "content-type": "application/json", accept: "application/json" },
  11:         body: JSON.stringify(body),
  12:       });
  13:       if (!res.ok) {
  14:         let msg = `HTTP ${res.status}`;
  15:         try { const j = await res.json(); if (j?.detail) msg = String(j.detail); } catch { /* keep msg */ }
  16:         setState({ data: null, error: msg, loading: false });
  17:         return null;
  18:       }
  19:       const json = (await res.json()) as T;
  20:       setState({ data: json, error: null, loading: false });
  21:       return json;
  22:     } catch (e) {
  23:       setState({ data: null, error: String(e), loading: false });
  24:       return null;
  25:     }
  26:   }
  27:   return { ...state, post };
  28: }

 succeeded in 4406ms:
   1: import type { MunshiKind, MunshiCaptureForm } from "../../types/contracts";
   2: const REQUIRED: Record<MunshiKind, readonly string[]> = {
   3:   todo: ["assignee", "task"],
   4:   note: ["student", "issue"],
   5:   followup: ["date", "note"],
   6: };
   7: const OPTIONAL: Record<MunshiKind, readonly string[]> = {
   8:   todo: ["due"], note: ["label"], followup: ["person"],
   9: };
  10: export type BuildResult =
  11:   | { ok: true; body: Record<string, string> }
  12:   | { ok: false; error: string };
  13: export function buildMunshiCapture(form: MunshiCaptureForm): BuildResult {
  14:   const req = REQUIRED[form.kind];
  15:   if (!req) return { ok: false, error: "kind must be todo, note, or followup" };
  16:   const missing = req.filter((k) => !(form[k] ?? "").trim());
  17:   if (missing.length) return { ok: false, error: `Missing: ${missing.join(", ")}` };
  18:   const body: Record<string, string> = { kind: form.kind };
  19:   for (const k of req) body[k] = form[k].trim();
  20:   for (const k of OPTIONAL[form.kind]) if ((form[k] ?? "").trim()) body[k] = form[k].trim();
  21:   return { ok: true, body };
  22: }

codex
The TS builders match the Python whitelists for the current text-only capture forms. The larger concern is authorization: these POSTs rely entirely on Cloudflare Access at the edge, not an origin-side check, so I’m reading deploy config/scripts and looking for any app-level `Cf-Access-*` enforcement.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Recurse -File -Path deploy,scripts | Select-Object -ExpandProperty FullName' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'deploy/cloudflared/config.samagra.yml' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"Cf-Access|Cloudflare-Access|CF_Access|Access|JWT|aud|origin|fail|host|0\\.0\\.0\\.0|127\\.0\\.0\\.1|8799|cloudflared|tunnel|credentials|secret|MUNSHI|MCD|ExecutionPolicy|Bypass|Start-Process|WindowStyle|Hidden|Start-Job|Task|Register-ScheduledTask|mcd-cloud|\\.env|pem|json\" deploy scripts .gitignore pyproject.toml requirements.txt samagra frontend/src" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'.gitignore' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 1871ms:
   1: # SAMAGRA OS - cloudflared named tunnel config (COMMITTED, no secrets).
   2: #
   3: # Run:  cloudflared tunnel --config deploy/cloudflared/config.samagra.yml run samagra-os
   4: # Full procedure + the REQUIRED Cloudflare Access gate: docs/deploy-tunnel.md
   5: #
   6: # Before first run, fill the two placeholders:
   7: #   <TUNNEL_ID>   from `cloudflared tunnel create samagra-os` (or `cloudflared tunnel list`).
   8: #                 A tunnel UUID is NOT a secret.
   9: #   <USERPROFILE> your home dir, e.g. C:\Users\<you>  (Windows) so the creds path resolves.
  10: #
  11: # The credentials JSON it points at IS secret - it lives in ~/.cloudflared/ (gitignored),
  12: # is written by `cloudflared tunnel create`, and is NEVER committed. Same for cert.pem.
  13: #
  14: # This config is INDEPENDENT of the default ~/.cloudflared/config.yml (which runs the
  15: # unrelated `bhautiki-prashnavali` / hermes tunnel) - always run samagra with --config.
  16: 
  17: tunnel: 9b7a3df8-6fda-4500-b97c-4592c2dd101e
  18: credentials-file: C:\Users\abc\.cloudflared\9b7a3df8-6fda-4500-b97c-4592c2dd101e.json
  19: 
  20: ingress:
  21:   # SAMAGRA OS - same-origin FastAPI serving frontend/dist + /api on :8799.
  22:   # ACCESS NOTE: a Cloudflare Access app (one-time-PIN to owner email) MUST gate this
  23:   # hostname BEFORE running the tunnel - the capture write-paths + admin keys must not
  24:   # be open to the world. See docs/deploy-tunnel.md sec 5.
  25:   - hostname: samagra.bhautikiplusprashnavali.com
  26:     service: http://localhost:8799
  27:   # Catch-all: anything else gets a 404 (nothing else is exposed).
  28:   - service: http_status:404

 succeeded in 2208ms:
C:\SandBox\claude_box\TeachingOS\deploy\cloudflared\config.samagra.yml
C:\SandBox\claude_box\TeachingOS\scripts\install-durable-task.ps1
C:\SandBox\claude_box\TeachingOS\scripts\serve-durable.ps1
C:\SandBox\claude_box\TeachingOS\scripts\serve-local.ps1
C:\SandBox\claude_box\TeachingOS\scripts\tos_tick.cmd

 succeeded in 2253ms:
   1: # --- secrets & local config (PUBLIC REPO: never commit) ---
   2: .env
   3: config.local.py
   4: *.secret
   5: secrets/
   6: *token*.json
   7: credentials*.json
   8: client_secret*.json
   9: 
  10: # --- generated data (content/state stay local, never in git) ---
  11: samagra.db
  12: *.db
  13: state/
  14: build/
  15: dist/
  16: exports/
  17: lectures_out/
  18: .serve-logs/
  19: 
  20: # --- claude local settings ---
  21: .claude/settings.local.json
  22: 
  23: # --- python ---
  24: .venv/
  25: venv/
  26: __pycache__/
  27: *.pyc
  28: .pytest_cache/
  29: .pytmp/
  30: .pytest_tmp/
  31: .mypy_cache/
  32: *.egg-info/
  33: .coverage
  34: 
  35: # --- codex review run logs (keep reports + runbook, drop raw run logs) ---
  36: docs/codex-reviews/*.log
  37: 
  38: # --- frontend (node / vite) ---
  39: node_modules/
  40: frontend/dist/
  41: frontend/.vite/
  42: frontend/coverage/
  43: *.tsbuildinfo
  44: 
  45: # local design reference (extracted handoff zip â€” read-only, not source)
  46: .design-ref/
  47: Web OS GUI design.zip
  48: 
  49: # --- cloudflare tunnel (Phase B): commit only the non-secret config.yml ---
  50: *.pem
  51: cloudflared/*.json
  52: mcd-cloud.json

 succeeded in 2297ms:
.gitignore:1:# --- secrets & local config (PUBLIC REPO: never commit) ---
.gitignore:2:.env
.gitignore:4:*.secret
.gitignore:5:secrets/
.gitignore:6:*token*.json
.gitignore:7:credentials*.json
.gitignore:8:client_secret*.json
.gitignore:20:# --- claude local settings ---
.gitignore:21:.claude/settings.local.json
.gitignore:49:# --- cloudflare tunnel (Phase B): commit only the non-secret config.yml ---
.gitignore:50:*.pem
.gitignore:51:cloudflared/*.json
.gitignore:52:mcd-cloud.json
frontend/src\App.test.tsx:9:// swaps the chrome — the TopBar/Dock give way to the bottom Taskbar + Start menu,
frontend/src\App.test.tsx:101:  it("swaps the Dock for the bottom Taskbar when the theme is console", () => {
frontend/src\App.test.tsx:104:    // the console chrome mounts the Taskbar (no top bar, no floating Dock)
frontend/src\App.test.tsx:157:  it("mounts the left Rail (not the Dock or Taskbar) when the theme is samagra", () => {
frontend/src\App.test.tsx:160:    // samagra chrome mounts the left rail; no bottom-center Dock, no Taskbar
frontend/src\App.test.tsx:319:  it("device beats theme chrome — mobile frame replaces the console Taskbar", () => {
frontend/src\App.test.tsx:320:    // Genuine guard: the Taskbar is console-only chrome, so flipping device to
frontend/src\App.test.tsx:322:    // theme's desktop chrome (the Taskbar would otherwise be present).
frontend/src\App.tsx:6://   - console (`kind==='console'`): NO top bar — a bottom Taskbar (Start button +
frontend/src\App.tsx:47:import Taskbar from "./shell/Taskbar";
frontend/src\App.tsx:196:  // Taskbar click on a running window (renderTaskbar L1042): restore it if minimized
frontend/src\App.tsx:337:        // right-clicks that originate on a window / dock / rail / taskbar handle their
frontend/src\App.tsx:388:      {/* Theme-driven dock chrome (FD1): console → bottom Taskbar + Start menu;
frontend/src\App.tsx:392:        <Taskbar
frontend/src\App.tsx:404:        </Taskbar>
deploy\cloudflared\config.samagra.yml:1:# SAMAGRA OS - cloudflared named tunnel config (COMMITTED, no secrets).
deploy\cloudflared\config.samagra.yml:3:# Run:  cloudflared tunnel --config deploy/cloudflared/config.samagra.yml run samagra-os
deploy\cloudflared\config.samagra.yml:4:# Full procedure + the REQUIRED Cloudflare Access gate: docs/deploy-tunnel.md
deploy\cloudflared\config.samagra.yml:7:#   <TUNNEL_ID>   from `cloudflared tunnel create samagra-os` (or `cloudflared tunnel list`).
deploy\cloudflared\config.samagra.yml:8:#                 A tunnel UUID is NOT a secret.
deploy\cloudflared\config.samagra.yml:11:# The credentials JSON it points at IS secret - it lives in ~/.cloudflared/ (gitignored),
deploy\cloudflared\config.samagra.yml:12:# is written by `cloudflared tunnel create`, and is NEVER committed. Same for cert.pem.
deploy\cloudflared\config.samagra.yml:14:# This config is INDEPENDENT of the default ~/.cloudflared/config.yml (which runs the
deploy\cloudflared\config.samagra.yml:15:# unrelated `bhautiki-prashnavali` / hermes tunnel) - always run samagra with --config.
deploy\cloudflared\config.samagra.yml:17:tunnel: 9b7a3df8-6fda-4500-b97c-4592c2dd101e
deploy\cloudflared\config.samagra.yml:18:credentials-file: C:\Users\abc\.cloudflared\9b7a3df8-6fda-4500-b97c-4592c2dd101e.json
deploy\cloudflared\config.samagra.yml:21:  # SAMAGRA OS - same-origin FastAPI serving frontend/dist + /api on :8799.
deploy\cloudflared\config.samagra.yml:22:  # ACCESS NOTE: a Cloudflare Access app (one-time-PIN to owner email) MUST gate this
deploy\cloudflared\config.samagra.yml:23:  # hostname BEFORE running the tunnel - the capture write-paths + admin keys must not
deploy\cloudflared\config.samagra.yml:24:  # be open to the world. See docs/deploy-tunnel.md sec 5.
deploy\cloudflared\config.samagra.yml:25:  - hostname: samagra.bhautikiplusprashnavali.com
deploy\cloudflared\config.samagra.yml:26:    service: http://localhost:8799
frontend/src\components\icons-data.test.ts:2:// The A-1 production-serve audit found every app glyph rendering a real <svg> (no
frontend/src\hooks\useApiPost.ts:10:        headers: { "content-type": "application/json", accept: "application/json" },
frontend/src\hooks\useApiPost.ts:15:        try { const j = await res.json(); if (j?.detail) msg = String(j.detail); } catch { /* keep msg */ }
frontend/src\hooks\useApiPost.ts:19:      const json = (await res.json()) as T;
frontend/src\hooks\useApiPost.ts:20:      setState({ data: json, error: null, loading: false });
frontend/src\hooks\useApiPost.ts:21:      return json;
frontend/src\components\IconButton.tsx:10:  /** Accessible name (aria-label) — icon buttons have no visible text label. */
frontend/src\hooks\useApiPost.test.ts:6:    new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json" } }),
frontend/src\hooks\useApiPost.test.ts:18:    new Response(JSON.stringify({ detail: "bad kind" }), { status: 400, headers: { "content-type": "application/json" } }),
frontend/src\hooks\useApi.ts:16: * decode failure surfaces as `error` rather than throwing into render. The
frontend/src\hooks\useApi.ts:31:        const res = await fetch(path, { headers: { accept: "application/json" } });
frontend/src\hooks\useApi.ts:36:        const json = (await res.json()) as T;
frontend/src\hooks\useApi.ts:37:        if (alive) setState({ data: json, error: null, loading: false });
frontend/src\components\Icon.tsx:18:  /** Accessible name. When set, the svg becomes role="img"; otherwise decorative. */
frontend/src\lib\persistence.test.ts:29:    const s = fakeStorage({ "samagra.notes": "{not json" });
frontend/src\types\contracts.ts:46:  meta: Record<string, unknown>;     // parsed from meta_json
frontend/src\types\contracts.ts:47:  meta_json?: string;                 // raw string ALSO present on the wire
frontend/src\types\contracts.ts:77:  summary_json?: string;             // raw string ALSO present on the wire
frontend/src\types\contracts.ts:82:export type PipelineStatus = "pending" | "in_progress" | "awaiting_gate" | "done" | "failed" | "blocked";
frontend/src\components\AppIcon.tsx:24:  /** Accessible name for the tile (e.g. the app's display name). */
frontend/src\lib\clock\world.ts:36: * Not asserted in the rule test (depends on the host `Intl` data); kept thin so all
frontend/src\apps\Mycontentdev\index.tsx:27:  // failure, so useApi's hook error stays null — surface data.error explicitly.
frontend/src\apps\Mycontentdev\index.tsx:103:            {loading ? "Loading…" : (data?.error ?? "mycontentdev not available — set mcd-cloud.json adminKey.")}
frontend/src\apps\Mycontentdev\index.test.tsx:33:    // /api/mcd/seeds returns 200 {results:[], error} on an upstream read failure,
frontend/src\apps\Mycontentdev\index.test.tsx:35:    // error, not the "set mcd-cloud.json adminKey" line.
frontend/src\apps\Mycontentdev\index.test.tsx:36:    useApiMock.mockReturnValue({ data: { results: [], error: "mycontentdev read failed" }, loading: false, error: null });
frontend/src\apps\Mycontentdev\index.test.tsx:38:    expect(screen.getByTestId("catalog-empty")).toHaveTextContent("mycontentdev read failed");
frontend/src\apps\Mycontentdev\index.test.tsx:45:        { status: 200, headers: { "content-type": "application/json" } }));
frontend/src\apps\Mycontentdev\index.test.tsx:70:      { status: 200, headers: { "content-type": "application/json" } }));
frontend/src\lib\terminal\dispatch.ts:112:    line(pad("Claude-Deepak", 18) + "CEO — substrate & engine", "fg"),
frontend/src\lib\terminal\dispatch.ts:113:    line(pad("Claude-Khanak", 18) + "CTO — leaf apps & UX", "fg"),
frontend/src\apps\Munshi\index.tsx:35:  // failure, so useApi's hook error stays null — surface data.error explicitly.
frontend/src\apps\Munshi\index.tsx:102:            {loading ? "Loading…" : (data?.error ?? "Munshi not available — set MUNSHI_API_URL / MUNSHI_SECRET.")}
frontend/src\stores\windowManager.test.ts:186:    // i=0 → top-left cell at the work-area origin
frontend/src\stores\windowManager.test.ts:248:  it("tiles into the ACTIVE theme's work area origin (samagra rail offset)", () => {
frontend/src\stores\windowManager.test.ts:256:    expect(ws[0].x).toBe(WAs.x); // top-left cell sits at the samagra work-area origin
frontend/src\apps\Dashboard\index.tsx:113:// `Claude-<name>`. Avatar colors are the prototype's fixed per-person hues.
frontend/src\apps\Dashboard\index.tsx:347:                    <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>Claude-{b.name}</div>
frontend/src\apps\Org\index.test.tsx:9:  board: [{ id: "claude-deepak", name: "Claude-Deepak", role: "CEO" }],
frontend/src\apps\Org\index.test.tsx:22:    expect(screen.getByText("Claude-Deepak")).toBeInTheDocument();
frontend/src\apps\Munshi\index.test.tsx:34:    // failure, so useApi's hook error is null. The empty-state must show the
frontend/src\apps\Munshi\index.test.tsx:35:    // real read error, not the "set MUNSHI_API_URL/MUNSHI_SECRET" line.
frontend/src\apps\Munshi\index.test.tsx:36:    useApiMock.mockReturnValue({ data: { results: [], error: "munshi read failed" }, loading: false, error: null });
frontend/src\apps\Munshi\index.test.tsx:38:    expect(screen.getByTestId("catalog-empty")).toHaveTextContent("munshi read failed");
frontend/src\apps\Munshi\index.test.tsx:39:    expect(screen.getByTestId("catalog-empty")).not.toHaveTextContent(/set MUNSHI/i);
frontend/src\apps\Munshi\index.test.tsx:52:        { status: 200, headers: { "content-type": "application/json" } })));
frontend/src\apps\Dashboard\index.test.tsx:62:          headers: { "content-type": "application/json" },
frontend/src\apps\Dashboard\index.test.tsx:69:          headers: { "content-type": "application/json" },
frontend/src\apps\Dashboard\index.test.tsx:75:          headers: { "content-type": "application/json" },
frontend/src\apps\Dashboard\index.test.tsx:80:        headers: { "content-type": "application/json" },
frontend/src\apps\Dashboard\index.test.tsx:126:  it("surfaces a network/decode failure as an error (catch branch)", async () => {
frontend/src\apps\Dashboard\index.test.tsx:289:    expect(within(board).getByText("Claude-Deepak")).toBeInTheDocument();
frontend/src\apps\Dashboard\index.test.tsx:291:    expect(within(board).getByText("Claude-Khanak")).toBeInTheDocument();
frontend/src\apps\Dashboard\index.test.tsx:293:    expect(within(board).getByText("Claude-Codex")).toBeInTheDocument();
frontend/src\apps\Notes\index.tsx:536:          {/* Task rows — card-bg / 1px line / r11, 20×20 checkbox, hover × delete. */}
frontend/src\apps\Notes\index.test.tsx:436:      expect(box).toHaveAccessibleName(text);
frontend/src\apps\Clock\index.tsx:114:    // no-op — audio is best-effort
frontend/src\shell\Taskbar.test.tsx:1:// CH2 fidelity — Console Taskbar (README §Global Layout / .dc.html renderTaskbar
frontend/src\shell\Taskbar.test.tsx:11:import Taskbar from "./Taskbar";
frontend/src\shell\Taskbar.test.tsx:49:describe("Taskbar (CH2 console chrome fidelity)", () => {
frontend/src\shell\Taskbar.test.tsx:51:    const { container } = render(<Taskbar windows={[]} clock="2:58 PM" />);
frontend/src\shell\Taskbar.test.tsx:55:  // --- exact taskbar geometry (renderTaskbar L1036) ---
frontend/src\shell\Taskbar.test.tsx:56:  it("is a 50px bottom-anchored full-width bar (proto renderTaskbar L1036)", () => {
frontend/src\shell\Taskbar.test.tsx:57:    const { container } = render(<Taskbar windows={[]} clock="2:58 PM" />);
frontend/src\shell\Taskbar.test.tsx:68:  // dock tokens (renderTaskbar uses dockBg/dockBlur/dockBorder), not literals. ---
frontend/src\shell\Taskbar.test.tsx:70:    const { container } = render(<Taskbar windows={[]} clock="2:58 PM" />);
frontend/src\shell\Taskbar.test.tsx:78:  // --- Start button (renderTaskbar L1038-1039): SAMAGRA wordmark + dashboard glyph ---
frontend/src\shell\Taskbar.test.tsx:80:    render(<Taskbar windows={[]} clock="2:58 PM" />);
frontend/src\shell\Taskbar.test.tsx:87:    const { rerender } = render(<Taskbar windows={[]} clock="2:58 PM" startOpen={false} />);
frontend/src\shell\Taskbar.test.tsx:91:    rerender(<Taskbar windows={[]} clock="2:58 PM" startOpen />);
frontend/src\shell\Taskbar.test.tsx:99:    render(<Taskbar windows={[]} clock="2:58 PM" onToggleStart={onToggleStart} />);
frontend/src\shell\Taskbar.test.tsx:106:    render(<Taskbar windows={[]} clock="2:58 PM" />);
frontend/src\shell\Taskbar.test.tsx:111:  // --- running-window buttons (renderTaskbar L1041-1045) ---
frontend/src\shell\Taskbar.test.tsx:114:      <Taskbar windows={[dashWin, termWin]} activeId="w2" clock="2:58 PM" />,
frontend/src\shell\Taskbar.test.tsx:125:    render(<Taskbar windows={[dashWin, termWin]} activeId="w2" clock="2:58 PM" />);
frontend/src\shell\Taskbar.test.tsx:136:    render(<Taskbar windows={[dashWin, termWin]} activeId="w2" clock="2:58 PM" />);
frontend/src\shell\Taskbar.test.tsx:146:    render(<Taskbar windows={[minWin]} activeId={null} clock="2:58 PM" />);
frontend/src\shell\Taskbar.test.tsx:156:      <Taskbar
frontend/src\shell\Taskbar.test.tsx:167:  // --- right cluster (renderTaskbar L1046): activity glyph + clickable clock ---
frontend/src\shell\Taskbar.test.tsx:170:    render(<Taskbar windows={[]} clock="2:58 PM" onOpenClock={onOpenClock} />);
frontend/src\shell\Taskbar.test.tsx:178:    const { container } = render(<Taskbar windows={[]} clock="2:58 PM" />);
frontend/src\shell\Taskbar.test.tsx:183:  // --- theme correctness (FD1): a samagra/aqua-token Taskbar paints from THOSE tokens
frontend/src\shell\Taskbar.test.tsx:187:      <Taskbar windows={[]} clock="2:58 PM" theme="samagra" />,
frontend/src\shell\Taskbar.test.tsx:194:  // --- Start menu popover slot (renderTaskbar L1047): children render inside the bar ---
frontend/src\shell\Taskbar.test.tsx:197:      <Taskbar windows={[]} clock="2:58 PM" startOpen>
frontend/src\shell\Taskbar.test.tsx:199:      </Taskbar>,
frontend/src\apps\Clock\index.test.tsx:382:    // of the two — never an undecided/blank state — whatever the host-local hour is.
frontend/src\apps\Clock\index.test.tsx:384:    // host's rgba() serialisation (jsdom re-emits `rgba(r, g, b, a)` with spaces).
frontend/src\shell\Taskbar.tsx:1:// src/shell/Taskbar.tsx — SAMAGRA OS console taskbar (CH2 fidelity).
frontend/src\shell\Taskbar.tsx:2:// Verbatim port of the prototype's renderTaskbar (.dc.html L1033-1049): the console
frontend/src\shell\Taskbar.tsx:25:export interface TaskbarProps {
frontend/src\shell\Taskbar.tsx:48:export default function Taskbar({
frontend/src\shell\Taskbar.tsx:59:}: TaskbarProps) {
frontend/src\shell\Taskbar.tsx:65:      aria-label="Taskbar"
frontend/src\shell\Taskbar.tsx:88:      {/* Start button (renderTaskbar L1038-1039) */}
frontend/src\shell\Taskbar.tsx:112:      {/* divider (renderTaskbar L1040) */}
frontend/src\shell\Taskbar.tsx:115:      {/* running-window strip (renderTaskbar L1041-1045) */}
frontend/src\shell\Taskbar.tsx:156:      {/* right cluster (renderTaskbar L1046): activity glyph + clickable clock */}
frontend/src\shell\Taskbar.tsx:175:      {/* Start-menu popover slot (renderTaskbar L1047) */}
frontend/src\shell\WindowFrame.test.tsx:215:    // grab at (100,80): offset from win origin (40,60) = (60,20).
samagra\clients\mcd_client.py:3:Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
samagra\clients\mcd_client.py:4:{apiUrl,adminKey} at the mycontentdev repo root, or env MCD_API_URL /
samagra\clients\mcd_client.py:5:MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
samagra\clients\mcd_client.py:15:import json
samagra\clients\mcd_client.py:23:# mycontentdev repo root, sibling of the samagra repo under claude_box.
samagra\clients\mcd_client.py:24:_MCD_ROOT = config.CLAUDE_BOX / "mycontentdev"
samagra\clients\mcd_client.py:27:def _load_cloud_json() -> dict:
samagra\clients\mcd_client.py:28:    p = _MCD_ROOT / "mcd-cloud.json"
samagra\clients\mcd_client.py:31:            return json.loads(p.read_text(encoding="utf-8"))
samagra\clients\mcd_client.py:39:        file = _load_cloud_json()
samagra\clients\mcd_client.py:40:        url = api_url or os.environ.get("MCD_API_URL") or file.get("apiUrl") or ""
samagra\clients\mcd_client.py:42:        self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
samagra\clients\mcd_client.py:43:        self._app_key = app_key or os.environ.get("MCD_APP_KEY") or file.get("appKey") or ""
samagra\clients\mcd_client.py:51:            headers={"x-mcd-admin": self._admin_key, "content-type": "application/json"},
samagra\clients\mcd_client.py:52:            json={"sql": sql},
samagra\clients\mcd_client.py:56:        return r.json()
samagra\clients\mcd_client.py:60:        # (request.formData()), so send form-encoded — NOT json. The existing
samagra\clients\mcd_client.py:69:        return r.json()
samagra\clients\mcd_client.py:78:        return r.json()
samagra\clients\munshi_client.py:4:Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
samagra\clients\munshi_client.py:5:MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
samagra\clients\munshi_client.py:18:    def __init__(self, api_url=None, secret=None):
samagra\clients\munshi_client.py:19:        url = api_url or os.environ.get("MUNSHI_API_URL") or ""
samagra\clients\munshi_client.py:21:        self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""
samagra\clients\munshi_client.py:24:        return bool(self.api_url and self._secret)
samagra\clients\munshi_client.py:30:        # so both forms round-trip to the same secret — auth is unaffected.
samagra\clients\munshi_client.py:31:        return "munshi=" + quote(self._secret, safe="")
samagra\clients\munshi_client.py:40:        return r.json()
samagra\clients\munshi_client.py:45:        # rejects others). The secret is never logged.
samagra\clients\munshi_client.py:48:            headers={"Cookie": self._cookie(), "content-type": "application/json"},
samagra\clients\munshi_client.py:49:            json={"kind": kind, **fields},
samagra\clients\munshi_client.py:53:        return r.json()
samagra\clients\munshi_client.py:55:    def __repr__(self) -> str:  # never leak the secret
samagra\clients\munshi_client.py:56:        return f"MunshiClient(api_url={self.api_url!r}, secret=<set:{bool(self._secret)}>)"
samagra\clients\qx_client.py:9:No secret: QX is local and fail-open on localhost (Cloudflare Access only engages
samagra\clients\qx_client.py:33:        return r.json()
samagra\lock.py:4:``os.open(O_CREAT | O_EXCL)``, which fails if the file already exists, and stamp
samagra\config.py:3:All paths/secrets come from environment variables (optionally loaded from a .env
samagra\config.py:5:(gitignored). Nothing here hardcodes secrets — see .env.example.
samagra\config.py:12:# Optional .env loading (python-dotenv is only required once you install deps).
samagra\config.py:16:    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
samagra\config.py:24:    val = os.environ.get(name)
samagra\config.py:30:CLAUDE_BOX = _env_path("SAMAGRA_CLAUDE_BOX", Path(r"C:\SandBox\claude_box"))
samagra\config.py:39:TEXTBOOK_QUEUE = TEXTBOOK_ROOT / "textbook" / "queue.json"
samagra\config.py:45:BOOKLETS_ROOT = _env_path("SAMAGRA_BOOKLETS_ROOT", CLAUDE_BOX / "claude-booklet-proofer")
samagra\config.py:46:INSP_ROOT = _env_path("SAMAGRA_INSP_ROOT", CLAUDE_BOX / "claude-INSP-extract")
samagra\config.py:50:QUESTIONDB_URL = os.environ.get(
samagra\config.py:57:QX_SERVER_URL = os.environ.get("SAMAGRA_QX_SERVER_URL", "http://127.0.0.1:8783")
samagra\config.py:72:HOST = os.environ.get("SAMAGRA_HOST", "127.0.0.1")
samagra\config.py:73:PORT = int(os.environ.get("SAMAGRA_PORT", "8799"))
samagra\catalog.py:4:import json
samagra\catalog.py:15:  path text, url text, updated_at text, meta_json text);
samagra\catalog.py:18:  summary_json text, n_artifacts int, refreshed_at text);
samagra\catalog.py:51:    deleted: the previous good catalog survives, the failure is surfaced in the
samagra\catalog.py:63:    failures: list[str] = []
samagra\catalog.py:70:        failed = False
samagra\catalog.py:84:                # A failing adapter must NOT poison the live catalog. Record the
samagra\catalog.py:85:                # failure, drop this adapter's partial rows, and continue
samagra\catalog.py:89:                failed = True
samagra\catalog.py:92:        if failed:
samagra\catalog.py:93:            failures.append(ad.name)
samagra\catalog.py:101:             json.dumps(summ, ensure_ascii=False),
samagra\catalog.py:102:             0 if failed else len(rows), now)
samagra\catalog.py:105:            shown = "FAILED" if failed else f"{len(rows):>6}"
samagra\catalog.py:108:    if failures:
samagra\catalog.py:113:            print(f"  refresh ABORTED — adapters failed: {', '.join(failures)}; "
samagra\catalog.py:155:            r["summary"] = json.loads(r["summary_json"])
samagra\catalog.py:185:            r["meta"] = json.loads(r["meta_json"])
frontend/src\apps\Questions\index.tsx:68:  // Typeset every KaTeX span the QX engine emitted; on failure, reveal the
samagra\notify.py:31:    token = os.environ.get("TELEGRAM_BOT_TOKEN")
samagra\notify.py:32:    chat = os.environ.get("TELEGRAM_CHAT_ID")
samagra\notify.py:40:            json={"chat_id": chat, "text": text}, timeout=15,
samagra\notify.py:48:    host = os.environ.get("SMTP_HOST")
samagra\notify.py:49:    user = os.environ.get("SMTP_USER")
samagra\notify.py:50:    pwd = os.environ.get("SMTP_PASS")
samagra\notify.py:51:    to = os.environ.get("NOTIFY_EMAIL_TO", user or "")
samagra\notify.py:52:    if not (host and user and pwd and to):
samagra\notify.py:55:        port = int(os.environ.get("SMTP_PORT", "587"))
samagra\notify.py:61:        with smtplib.SMTP(host, port, timeout=20) as s:
samagra\api\app.py:111:        gstore.init_tables(conn)  # inside try: a failed init must still close the conn
samagra\api\app.py:159:_MUNSHI_REQUIRED = {
samagra\api\app.py:167:_MUNSHI_OPTIONAL = {
samagra\api\app.py:177:    if not isinstance(kind, str) or kind not in _MUNSHI_REQUIRED:
samagra\api\app.py:179:    required = _MUNSHI_REQUIRED[kind]
samagra\api\app.py:180:    allowed = required + _MUNSHI_OPTIONAL[kind]
samagra\api\app.py:198:        raise HTTPException(503, "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET")
samagra\api\app.py:201:    except Exception:  # noqa: BLE001 — never surface the upstream/secret details
samagra\api\app.py:202:        raise HTTPException(502, "munshi capture failed")
samagra\api\app.py:220:        raise HTTPException(503, "mycontentdev not configured — set mcd-cloud.json adminKey")
samagra\api\app.py:229:        raise HTTPException(502, "mycontentdev seed create failed")
samagra\api\app.py:259:# creds-gated, never leak upstream/secret detail.
samagra\api\app.py:264:        return {"results": [], "error": "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET"}
samagra\api\app.py:267:    except Exception:  # noqa: BLE001 — never surface upstream/secret detail
samagra\api\app.py:268:        return {"results": [], "error": "munshi read failed"}
samagra\api\app.py:275:        return {"results": [], "error": "mycontentdev not configured — set mcd-cloud.json adminKey"}
samagra\api\app.py:278:    except Exception:  # noqa: BLE001 — never surface upstream/secret detail
samagra\api\app.py:279:        return {"results": [], "error": "mycontentdev read failed"}
samagra\governance\store.py:122:    # the durable audit ledger; an orphan event is false history.
samagra\adapters\base.py:10:import json
samagra\adapters\base.py:16:    "chapter", "status", "path", "url", "updated_at", "meta_json",
samagra\adapters\base.py:39:            self.updated_at, json.dumps(self.meta, ensure_ascii=False),
samagra\questions_proxy.py:5:own origin, so those relative URLs would resolve against SAMAGRA (404). Rewrite
samagra\scheduler.py:13:import json
samagra\scheduler.py:37:    q = json.loads(config.TEXTBOOK_QUEUE.read_text(encoding="utf-8"))
samagra\scheduler.py:136:            state.set_phase("textbook", "export", "failed", error=str(e))
samagra\scheduler.py:137:            events.append(("failure", f"textbook export failed for {slug}: {e}"))
samagra\scheduler.py:162:                notify.notify("failure", msg)
samagra\scheduler.py:173:            # surface which sources failed so degradation is visible, not hidden.
samagra\scheduler.py:175:            failed = [s for s, v in totals.items() if v is None]
samagra\scheduler.py:177:            if failed:
samagra\scheduler.py:178:                log.append(f"catalog: {len(failed)} source(s) FAILED: {', '.join(failed)}")
samagra\scheduler.py:179:                events.append(("failure",
samagra\scheduler.py:180:                               f"catalog refresh: {len(failed)} source(s) failed "
samagra\scheduler.py:181:                               f"({', '.join(failed)}); previous catalog preserved."))
samagra\scheduler.py:228:# -- Windows Task Scheduler integration ---------------------------------
samagra\state.py:4:(`state/<pipeline>.orchestrator_state.json`), mirrored to a human-readable
samagra\state.py:9:import json
samagra\state.py:30:        "owners": {"capture": "human", "enrich": "claude2",
samagra\state.py:31:                   "review": "claude1", "publish": "human"},
samagra\state.py:37:        "owners": {"extract": "codex", "tag": "gemini", "verify": "claude2"},
samagra\state.py:43:        "owners": {"link": "claude2", "build": "teachingos", "finalize": "human"},
samagra\state.py:46:        "label": "Media (audio/decks/images)",
samagra\state.py:49:        "owners": {"plan": "claude1", "generate": "notebooklm", "publish": "human"},
samagra\state.py:53:VALID_STATUS = {"pending", "in_progress", "awaiting_gate", "done", "failed", "blocked"}
samagra\state.py:61:    return config.STATE_DIR / f"{pipeline}.orchestrator_state.json"
samagra\state.py:103:        return json.loads(p.read_text(encoding="utf-8"))
samagra\state.py:127:    failure of the write/replace, the leftover ``*.tmp`` is best-effort removed
samagra\state.py:132:    payload = json.dumps(st, indent=2, ensure_ascii=False)
samagra\state.py:139:        # Best-effort temp cleanup must NOT mask the original write/replace
samagra\state.py:179:        if status in ("done", "failed"):
samagra\org.py:6:(terminal `agents`/`whoami`). Owner-confirmed (2026-06-21): claude1 = Claude-Deepak
samagra\org.py:7:(CEO), claude2 = Claude-Khanak (CTO).
samagra\org.py:14:        {"id": "claude-deepak", "name": "Claude-Deepak", "role": "CEO — substrate & engine"},
samagra\org.py:15:        {"id": "claude-khanak", "name": "Claude-Khanak", "role": "CTO — leaf apps & UX"},
samagra\org.py:28:        "claude1": {"name": "Claude-Deepak", "role": "CEO — substrate & engine"},
samagra\org.py:29:        "claude2": {"name": "Claude-Khanak", "role": "CTO — leaf apps & UX"},
samagra\clients\__init__.py:7:client ever logs a secret value.
samagra\review\codex_dispatch.py:3:Adapted from claude-booklet-proofer/scripts/codex_dispatch.py. Only the bits the
samagra\review\codex_dispatch.py:12:import json
samagra\review\codex_dispatch.py:37:    exe = os.environ.get("CODEX_BIN") or shutil.which("codex")
samagra\review\codex_dispatch.py:70:    parse failure after `max_attempts`.
samagra\review\codex_dispatch.py:75:        sfd, sname = tempfile.mkstemp(suffix=".schema.json", prefix="codex_sch_")
samagra\review\codex_dispatch.py:78:        schema_path.write_text(json.dumps(schema), encoding="utf-8")
samagra\review\codex_dispatch.py:87:            ofd, oname = tempfile.mkstemp(suffix=".json", prefix="codex_out_")
samagra\review\codex_dispatch.py:113:                parsed = json.loads(_strip_fences(raw_text))
samagra\review\codex_dispatch.py:117:            except (json.JSONDecodeError, CodexError) as e:
samagra\review\codex_dispatch.py:119:                print(f"[codex-precommit] attempt={attempt} failed: {e}",
samagra\review\codex_dispatch.py:136:        f"codex dispatch failed after {attempt} attempts "
samagra\lectures\export.py:35:        print(f"  ! pandoc failed: {proc.stderr.strip()[:200]}")
samagra\review\precommit.py:1:"""Advisory pre-commit Codex review (runbook D5 — NOT fail-closed).
samagra\review\precommit.py:9:D5 contract (supersedes the retired fail-closed / no-escape-hatch design):
samagra\review\precommit.py:16:    and appends an audited line to state/review/breakglass.log.
samagra\review\precommit.py:22:import json
samagra\review\precommit.py:56:lines. Use severity CRITICAL only for: secret/credential leaks, destructive
samagra\review\precommit.py:99:    separate args (`_warn("failed:", e)`), never f-stringed before the call."""
samagra\review\precommit.py:114:    return _review_dir() / "diff_cache.json"
samagra\review\precommit.py:125:        data = json.loads(p.read_text(encoding="utf-8"))
samagra\review\precommit.py:145:        _cache_path().write_text(json.dumps(cache, indent=2), encoding="utf-8")
samagra\review\precommit.py:167:    # extra lines) and cap length (don't echo a pasted secret in full).
samagra\review\precommit.py:172:def _audit_breakglass(diff_hash: str, reason: str) -> None:
samagra\review\precommit.py:173:    # Best-effort: a logging failure must not wedge a break-glass commit.
samagra\review\precommit.py:186:    fails to print. Swallow everything here so nothing on a decided path can be
samagra\review\precommit.py:191:        _warn("[codex-precommit] warning: side-effect failed:", e)
samagra\review\precommit.py:246:    reason = os.environ.get("SAMAGRA_REVIEW_BREAKGLASS")
samagra\review\precommit.py:248:        _emit(lambda: _audit_breakglass(dhash, reason))
samagra\review\precommit.py:250:            f"\n=== SAMAGRA pre-commit: BREAK-GLASS (audited) ===\n"
samagra\review\precommit.py:269:    # warn and allow; do NOT cache a transient failure, do NOT wedge.
samagra\review\precommit.py:272:    except Exception as e:  # noqa: BLE001 - CodexError or any failure is advisory
samagra\review\precommit.py:290:    except Exception as e:  # noqa: BLE001 - confirm failure -> advisory, not block
samagra\review\precommit.py:301:        # criticals on any failure. (Prints/cache below are already _emit/best-effort.)
samagra\review\precommit.py:320:    print("  Fix the issue and re-commit. Emergency override (audited):",
scripts\install-durable-task.ps1:3:  Register (or remove) the "SAMAGRA-OS" Scheduled Task that brings the deployment up at logon (B-5).
scripts\install-durable-task.ps1:6:  Creates a Task Scheduler task that runs scripts/serve-durable.ps1 at the current user's logon, so the
scripts\install-durable-task.ps1:7:  local stack (:8799 + :8783) and the cloudflared `samagra-os` tunnel come back after a reboot.
scripts\install-durable-task.ps1:10:  (NOT at the pre-login lock screen). For 24/7 pre-login uptime, run cloudflared as a Windows service
scripts\install-durable-task.ps1:11:  instead (separate from the hermes default config) - documented in docs/deploy-tunnel.md sec 8.
scripts\install-durable-task.ps1:14:  Does NOT use -ExecutionPolicy Bypass (relies on the machine policy that already runs these local scripts).
scripts\install-durable-task.ps1:22:$TaskName = 'SAMAGRA-OS'
scripts\install-durable-task.ps1:27:  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
scripts\install-durable-task.ps1:28:    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
scripts\install-durable-task.ps1:29:    Write-Host "[task] removed '$TaskName'" -ForegroundColor Yellow
scripts\install-durable-task.ps1:31:    Write-Host "[task] '$TaskName' not present - nothing to remove" -ForegroundColor DarkGray
scripts\install-durable-task.ps1:38:$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
scripts\install-durable-task.ps1:39:  -Argument ('-NoProfile -WindowStyle Hidden -File "{0}"' -f $script) `
scripts\install-durable-task.ps1:41:$trigger   = New-ScheduledTaskTrigger -AtLogOn -User ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME)
scripts\install-durable-task.ps1:42:$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
scripts\install-durable-task.ps1:43:$principal = New-ScheduledTaskPrincipal -UserId ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME) -LogonType Interactive -RunLevel Limited
scripts\install-durable-task.ps1:45:Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
scripts\install-durable-task.ps1:47:  -Description 'Bring up SAMAGRA OS local stack + cloudflared samagra-os tunnel at logon (B-5 durable deploy).' | Out-Null
scripts\install-durable-task.ps1:49:Write-Host ("[task] registered '{0}' - runs scripts\serve-durable.ps1 at logon of {1}\{2}" -f $TaskName, $env:USERDOMAIN, $env:USERNAME) -ForegroundColor Green
scripts\serve-durable.ps1:3:  SAMAGRA OS durable bring-up (ralph ship-loop B-5) - local stack + Cloudflare tunnel, idempotent.
scripts\serve-durable.ps1:7:    * runs serve-local.ps1 (FastAPI :8799 + QX :8783, idempotent - reuses healthy servers), then
scripts\serve-durable.ps1:8:    * starts the cloudflared `samagra-os` tunnel DETACHED (survives this shell) if not already running.
scripts\serve-durable.ps1:10:  Designed to be run at logon by the "SAMAGRA-OS" Scheduled Task (scripts/install-durable-task.ps1), and
scripts\serve-durable.ps1:11:  safe to run by hand any time. Touches ONLY the samagra tunnel via its own --config - it NEVER touches the
scripts\serve-durable.ps1:12:  hermes default ~/.cloudflared/config.yml.
scripts\serve-durable.ps1:28:$cfg = Join-Path $RepoRoot 'deploy\cloudflared\config.samagra.yml'
scripts\serve-durable.ps1:38:# --- 2. cloudflared tunnel (detached; only if not already running this config) ----
scripts\serve-durable.ps1:39:$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
scripts\serve-durable.ps1:40:if (-not $cf) { $cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
scripts\serve-durable.ps1:42:$running = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
scripts\serve-durable.ps1:45:  Write-Host ("[tunnel] already running (pid {0}) - reusing" -f $running.ProcessId) -ForegroundColor Green
scripts\serve-durable.ps1:47:  Write-Host "[tunnel] starting cloudflared samagra-os (detached) ..." -ForegroundColor Cyan
scripts\serve-durable.ps1:48:  Start-Process -FilePath $cf `
scripts\serve-durable.ps1:49:    -ArgumentList @('tunnel','--config', $cfg, 'run','samagra-os') `
scripts\serve-durable.ps1:51:    -RedirectStandardOutput (Join-Path $LogDir 'tunnel.out.log') `
scripts\serve-durable.ps1:52:    -RedirectStandardError  (Join-Path $LogDir 'tunnel.err.log') `
scripts\serve-durable.ps1:53:    -WindowStyle Hidden | Out-Null
scripts\serve-durable.ps1:54:  Write-Host "[tunnel] launched" -ForegroundColor Green
scripts\serve-durable.ps1:58:Write-Host "[durable] stack + tunnel up -> https://samagra.bhautikiplusprashnavali.com (behind Cloudflare Access)" -ForegroundColor Cyan
samagra\review\__init__.py:4:surviving the staged-diff-hash cache, carries an audited break-glass
samagra\lectures\gdocs.py:3:Creds-gated: if GOOGLE_OAUTH_CLIENT is unset or the client-secret file is missing,
samagra\lectures\gdocs.py:7:next to the client secret).
samagra\lectures\gdocs.py:19:    raw = os.environ.get("GOOGLE_OAUTH_CLIENT", "")
samagra\lectures\gdocs.py:35:        from google.oauth2.credentials import Credentials
samagra\lectures\gdocs.py:43:    token = client.parent / "google_token.json"
samagra\lectures\gdocs.py:48:        flow = InstalledAppFlow.from_client_secrets_file(str(client), SCOPES)
samagra\lectures\gdocs.py:50:        token.write_text(creds.to_json(), encoding="utf-8")
samagra\lectures\gdocs.py:52:    drive = build("drive", "v3", credentials=creds)
samagra\lectures\gdocs.py:54:    folder = os.environ.get("GOOGLE_DOCS_FOLDER_ID")
samagra\adapters\booklets.py:1:"""claude-booklet-proofer adapter — theory/workbook booklets."""
samagra\adapters\insp.py:1:"""claude-INSP-extract adapter — INSP / olympiad papers."""
samagra\lectures\render.py:1:"""Render a physics-textbook chapter (content.json) to standalone HTML.
samagra\lectures\render.py:4:deliverable. content.json blocks already carry HTML; we wrap them in a clean,
samagra\lectures\render.py:10:import json
samagra\lectures\render.py:60:    cj = config.TEXTBOOK_CHAPTERS / slug / "content.json"
samagra\lectures\render.py:63:    return json.loads(cj.read_text(encoding="utf-8"))
samagra\lectures\render.py:90:    """Render a content.json dict (thick original, or a thin variant) to HTML."""
samagra\__main__.py:14:    # successful artifacts — never sum None — and name any failed source(s).
samagra\__main__.py:16:    failed = [s for s, v in totals.items() if v is None]
samagra\__main__.py:17:    if failed:
samagra\__main__.py:19:              f"({len(failed)} failed: {', '.join(failed)}). "
samagra\__main__.py:20:              "Previous catalog preserved for failed source(s).")
samagra\__main__.py:54:    uvicorn.run("samagra.api.app:app", host=args.host, port=args.port,
samagra\__main__.py:141:    sv.add_argument("--host", default=config.HOST)
samagra\__main__.py:158:    si = sub.add_parser("schedule-install", help="register the Windows Task Scheduler tick")
scripts\serve-local.ps1:3:  SAMAGRA OS local bring-up (ralph ship-loop B-1) - the stack the Cloudflare tunnel points at.
scripts\serve-local.ps1:8:    * starts the same-origin FastAPI server on :8799 (serves dist + /api), and
scripts\serve-local.ps1:14:  NO SECRETS: live capture creds come from .env / mcd-cloud.json (both gitignored).
scripts\serve-local.ps1:18:  Only :8799 is meant to be tunnelled; keep :8783 (QX) internal - SAMAGRA reaches it
scripts\serve-local.ps1:19:  via the same-origin /api/questions proxy.
scripts\serve-local.ps1:24:.PARAMETER Restart    Kill existing :8799 / :8783 listeners and relaunch fresh.
scripts\serve-local.ps1:25:.PARAMETER ApiPort    FastAPI port (default 8799; override only for isolated testing).
scripts\serve-local.ps1:38:  [int]$ApiPort = 8799,
scripts\serve-local.ps1:90:    if (-not (Test-Path 'node_modules')) { & npm install; if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" } }
scripts\serve-local.ps1:92:    if ($LASTEXITCODE -ne 0) { throw "frontend build failed (exit $LASTEXITCODE)" }
scripts\serve-local.ps1:98:# --- 2. FastAPI :ApiPort (serves dist + /api, same-origin) -------------------
scripts\serve-local.ps1:99:$apiHealth = "http://127.0.0.1:$ApiPort/api/overview"
scripts\serve-local.ps1:107:  $apiArgs = @('-m','uvicorn','samagra.api.app:app','--host','127.0.0.1','--port',"$ApiPort")
scripts\serve-local.ps1:108:  Start-Process -FilePath $py -ArgumentList $apiArgs -WorkingDirectory $RepoRoot `
scripts\serve-local.ps1:110:    -RedirectStandardError  (Join-Path $LogDir 'api.err.log') -WindowStyle Hidden | Out-Null
scripts\serve-local.ps1:116:$qxHealth = "http://127.0.0.1:$QxPort/api/qsearch?q=ping&mode=exact"
scripts\serve-local.ps1:127:    Start-Process -FilePath 'python' -ArgumentList @('-X','utf8','gui/qx_browser.py') -WorkingDirectory $QxRoot `
scripts\serve-local.ps1:129:      -RedirectStandardError  (Join-Path $LogDir 'qx.err.log') -WindowStyle Hidden | Out-Null
scripts\serve-local.ps1:138:$envState = if (Test-Path (Join-Path $RepoRoot '.env')) { 'present' } else { 'absent' }
scripts\serve-local.ps1:139:$mcdState = if (Test-Path (Join-Path $RepoRoot 'mcd-cloud.json')) { 'present' } else { 'absent' }
scripts\serve-local.ps1:144:Write-Host ("  creds    .env={0}  mcd-cloud.json={1}  (presence only; capture apps show graceful empties if absent)" -f $envState, $mcdState)
scripts\serve-local.ps1:145:Write-Host ("  open     http://127.0.0.1:{0}/" -f $ApiPort)
scripts\tos_tick.cmd:2:REM SAMAGRA scheduler tick — run by Windows Task Scheduler.
samagra\adapters\textbook.py:3:`textbook/queue.json` IS the lecture tracker (order -> unit -> status). Each chapter's
samagra\adapters\textbook.py:4:authored content is `chapters/<slug>/content.json`.
samagra\adapters\textbook.py:8:import json
samagra\adapters\textbook.py:24:        return json.loads(config.TEXTBOOK_QUEUE.read_text(encoding="utf-8"))
samagra\adapters\textbook.py:36:            cj = config.TEXTBOOK_CHAPTERS / slug / "content.json"
samagra\adapters\textbook.py:41:                        json.loads(cj.read_text(encoding="utf-8")).get("sections", [])
samagra\portal\static\app.js:19:async function jget(url) { const r = await fetch(url); return r.json(); }
samagra\portal\static\style.css:72:.dot.awaiting_gate{background:var(--warn);} .dot.failed{background:#dc2626;}

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'scripts/serve-local.ps1' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 170) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'scripts/install-durable-task.ps1' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 80) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'scripts/tos_tick.cmd' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'scripts/serve-durable.ps1' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 90) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 3333ms:
   1: @echo off
   2: REM SAMAGRA scheduler tick â€” run by Windows Task Scheduler.
   3: REM Portable: resolves the repo root from this script's location.
   4: pushd "%~dp0.."
   5: ".venv\Scripts\python.exe" -m samagra tick >> "state\tick.log" 2>&1
   6: popd

 succeeded in 3600ms:
   1: <#
   2: .SYNOPSIS
   3:   SAMAGRA OS local bring-up (ralph ship-loop B-1) - the stack the Cloudflare tunnel points at.
   4: 
   5: .DESCRIPTION
   6:   Brings up the local stack on this machine:
   7:     * builds the frontend (Vite -> frontend/dist) unless -SkipBuild,
   8:     * starts the same-origin FastAPI server on :8799 (serves dist + /api), and
   9:     * starts the QX question sidecar on :8783 (the Questions app depends on it).
  10:   Idempotent: a server already answering its health check is REUSED, not restarted.
  11:   -Restart forces a clean relaunch, clearing any stale listener first (the orphaned-
  12:   uvicorn gotcha). Health checks tolerate cold-start latency (catalog / BGE index load).
  13: 
  14:   NO SECRETS: live capture creds come from .env / mcd-cloud.json (both gitignored).
  15:   This script never reads or prints them - it only reports whether they EXIST so the
  16:   operator knows the capture apps will show live data vs graceful empty states.
  17: 
  18:   Only :8799 is meant to be tunnelled; keep :8783 (QX) internal - SAMAGRA reaches it
  19:   via the same-origin /api/questions proxy.
  20: 
  21:   NOTE: ASCII-only on purpose - Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI.
  22: 
  23: .PARAMETER SkipBuild  Reuse the existing frontend/dist instead of rebuilding.
  24: .PARAMETER Restart    Kill existing :8799 / :8783 listeners and relaunch fresh.
  25: .PARAMETER ApiPort    FastAPI port (default 8799; override only for isolated testing).
  26: .PARAMETER QxPort     QX sidecar port (default 8783).
  27: .PARAMETER QxRoot     QX sidecar repo root (default C:\SandBox\gpt_box\gpt-extract-ques).
  28: .PARAMETER NoQx       Skip the QX sidecar (Questions degrades gracefully without it).
  29: 
  30: .EXAMPLE  powershell -File scripts/serve-local.ps1
  31: .EXAMPLE  powershell -File scripts/serve-local.ps1 -Restart
  32: .EXAMPLE  powershell -File scripts/serve-local.ps1 -SkipBuild
  33: #>
  34: [CmdletBinding()]
  35: param(
  36:   [switch]$SkipBuild,
  37:   [switch]$Restart,
  38:   [int]$ApiPort = 8799,
  39:   [int]$QxPort  = 8783,
  40:   [string]$QxRoot = 'C:\SandBox\gpt_box\gpt-extract-ques',
  41:   [switch]$NoQx
  42: )
  43: 
  44: $ErrorActionPreference = 'Stop'
  45: $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  46: $LogDir   = Join-Path $RepoRoot '.serve-logs'   # gitignored, transient
  47: New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  48: 
  49: function Get-PortPid([int]$Port) {
  50:   try { (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1).OwningProcess }
  51:   catch { $null }
  52: }
  53: function Test-Url([string]$Url) {
  54:   try { (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200 }
  55:   catch { $false }
  56: }
  57: function Wait-Url([string]$Url, [int]$TimeoutSec = 45) {
  58:   $deadline = (Get-Date).AddSeconds($TimeoutSec)
  59:   while ((Get-Date) -lt $deadline) {
  60:     if (Test-Url $Url) { return $true }
  61:     Start-Sleep -Milliseconds 700
  62:   }
  63:   return $false
  64: }
  65: function Stop-Port([int]$Port) {
  66:   $procId = Get-PortPid $Port
  67:   if ($procId) {
  68:     Write-Host ("  clearing :{0} (pid {1})" -f $Port, $procId) -ForegroundColor Yellow
  69:     Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  70:     Start-Sleep -Milliseconds 600
  71:   }
  72: }
  73: 
  74: $py = Join-Path $RepoRoot '.venv\Scripts\python.exe'
  75: if (-not (Test-Path $py)) { throw "venv python not found at $py - create the .venv first (python -m venv .venv; pip install -e .)." }
  76: 
  77: Write-Host "SAMAGRA OS local bring-up" -ForegroundColor Cyan
  78: Write-Host ("  repo : {0}" -f $RepoRoot)
  79: Write-Host ("  ports: api :{0}  qx :{1}" -f $ApiPort, $QxPort)
  80: 
  81: # --- 1. frontend build -------------------------------------------------------
  82: $dist = Join-Path $RepoRoot 'frontend\dist\index.html'
  83: if ($SkipBuild) {
  84:   if (-not (Test-Path $dist)) { throw "-SkipBuild but frontend/dist is missing - run once without -SkipBuild." }
  85:   Write-Host "[build] skipped (reusing frontend/dist)" -ForegroundColor DarkGray
  86: } else {
  87:   Write-Host "[build] npm run build ..." -ForegroundColor Cyan
  88:   Push-Location (Join-Path $RepoRoot 'frontend')
  89:   try {
  90:     if (-not (Test-Path 'node_modules')) { & npm install; if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" } }
  91:     & npm run build
  92:     if ($LASTEXITCODE -ne 0) { throw "frontend build failed (exit $LASTEXITCODE)" }
  93:   } finally { Pop-Location }
  94:   if (-not (Test-Path $dist)) { throw "build finished but $dist is missing" }
  95:   Write-Host "[build] dist ready" -ForegroundColor Green
  96: }
  97: 
  98: # --- 2. FastAPI :ApiPort (serves dist + /api, same-origin) -------------------
  99: $apiHealth = "http://127.0.0.1:$ApiPort/api/overview"
 100: if ($Restart) { Stop-Port $ApiPort }
 101: if ((-not $Restart) -and (Test-Url $apiHealth)) {
 102:   Write-Host ("[api ] already healthy on :{0} - reusing" -f $ApiPort) -ForegroundColor Green
 103: } else {
 104:   if (Get-PortPid $ApiPort) { Write-Host ("[api ] :{0} in use but unhealthy - clearing" -f $ApiPort) -ForegroundColor Yellow; Stop-Port $ApiPort }
 105:   Write-Host ("[api ] starting uvicorn on :{0} ..." -f $ApiPort) -ForegroundColor Cyan
 106:   $env:PYTHONPATH = $RepoRoot
 107:   $apiArgs = @('-m','uvicorn','samagra.api.app:app','--host','127.0.0.1','--port',"$ApiPort")
 108:   Start-Process -FilePath $py -ArgumentList $apiArgs -WorkingDirectory $RepoRoot `
 109:     -RedirectStandardOutput (Join-Path $LogDir 'api.out.log') `
 110:     -RedirectStandardError  (Join-Path $LogDir 'api.err.log') -WindowStyle Hidden | Out-Null
 111:   if (Wait-Url $apiHealth 45) { Write-Host ("[api ] healthy on :{0}" -f $ApiPort) -ForegroundColor Green }
 112:   else { throw ("[api ] did NOT become healthy on :{0} within 45s - see {1}" -f $ApiPort, (Join-Path $LogDir 'api.err.log')) }
 113: }
 114: 
 115: # --- 3. QX sidecar :QxPort (internal; Questions proxies it) ------------------
 116: $qxHealth = "http://127.0.0.1:$QxPort/api/qsearch?q=ping&mode=exact"
 117: if ($NoQx) {
 118:   Write-Host "[qx  ] skipped (-NoQx) - Questions degrades gracefully" -ForegroundColor DarkGray
 119: } else {
 120:   if ($Restart) { Stop-Port $QxPort }
 121:   if ((-not $Restart) -and (Get-PortPid $QxPort)) {
 122:     Write-Host ("[qx  ] already listening on :{0} - reusing" -f $QxPort) -ForegroundColor Green
 123:   } elseif (-not (Test-Path (Join-Path $QxRoot 'gui\qx_browser.py'))) {
 124:     Write-Host ("[qx  ] QX repo not found at {0} - Questions will degrade gracefully" -f $QxRoot) -ForegroundColor Yellow
 125:   } else {
 126:     Write-Host ("[qx  ] starting QX sidecar on :{0} ..." -f $QxPort) -ForegroundColor Cyan
 127:     Start-Process -FilePath 'python' -ArgumentList @('-X','utf8','gui/qx_browser.py') -WorkingDirectory $QxRoot `
 128:       -RedirectStandardOutput (Join-Path $LogDir 'qx.out.log') `
 129:       -RedirectStandardError  (Join-Path $LogDir 'qx.err.log') -WindowStyle Hidden | Out-Null
 130:     if (Wait-Url $qxHealth 60) { Write-Host ("[qx  ] healthy on :{0}" -f $QxPort) -ForegroundColor Green }
 131:     else { Write-Host ("[qx  ] not answering /api/qsearch on :{0} yet (BGE index may still be loading; Questions degrades gracefully)" -f $QxPort) -ForegroundColor Yellow }
 132:   }
 133: }
 134: 
 135: # --- 4. summary --------------------------------------------------------------
 136: $apiState = if (Test-Url $apiHealth) { 'HEALTHY' } else { 'DOWN' }
 137: $qxState  = if (Test-Url $qxHealth) { 'HEALTHY' } elseif (Get-PortPid $QxPort) { 'LISTENING' } else { 'DOWN' }
 138: $envState = if (Test-Path (Join-Path $RepoRoot '.env')) { 'present' } else { 'absent' }
 139: $mcdState = if (Test-Path (Join-Path $RepoRoot 'mcd-cloud.json')) { 'present' } else { 'absent' }
 140: Write-Host ""
 141: Write-Host "-- bring-up summary -----------------------------" -ForegroundColor Cyan
 142: Write-Host ("  FastAPI  :{0,-5} {1}" -f $ApiPort, $apiState)
 143: Write-Host ("  QX       :{0,-5} {1}" -f $QxPort,  $qxState)
 144: Write-Host ("  creds    .env={0}  mcd-cloud.json={1}  (presence only; capture apps show graceful empties if absent)" -f $envState, $mcdState)
 145: Write-Host ("  open     http://127.0.0.1:{0}/" -f $ApiPort)
 146: Write-Host "-------------------------------------------------" -ForegroundColor Cyan
 147: 
 148: if (-not (Test-Url $apiHealth)) { exit 1 }
 149: exit 0

 succeeded in 3579ms:
   1: <#
   2: .SYNOPSIS
   3:   SAMAGRA OS durable bring-up (ralph ship-loop B-5) - local stack + Cloudflare tunnel, idempotent.
   4: 
   5: .DESCRIPTION
   6:   Brings the full public deployment up and keeps it durable:
   7:     * runs serve-local.ps1 (FastAPI :8799 + QX :8783, idempotent - reuses healthy servers), then
   8:     * starts the cloudflared `samagra-os` tunnel DETACHED (survives this shell) if not already running.
   9: 
  10:   Designed to be run at logon by the "SAMAGRA-OS" Scheduled Task (scripts/install-durable-task.ps1), and
  11:   safe to run by hand any time. Touches ONLY the samagra tunnel via its own --config - it NEVER touches the
  12:   hermes default ~/.cloudflared/config.yml.
  13: 
  14:   Reuses the already-built frontend/dist (no npm needed at logon) unless -Rebuild or dist is missing.
  15:   NO SECRETS. ASCII-only on purpose (Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI).
  16: 
  17: .PARAMETER Rebuild  Force a fresh `npm run build` instead of reusing frontend/dist.
  18: 
  19: .EXAMPLE  powershell -File scripts/serve-durable.ps1
  20: #>
  21: [CmdletBinding()]
  22: param([switch]$Rebuild)
  23: 
  24: $ErrorActionPreference = 'Stop'
  25: $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  26: $LogDir   = Join-Path $RepoRoot '.serve-logs'
  27: New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  28: $cfg = Join-Path $RepoRoot 'deploy\cloudflared\config.samagra.yml'
  29: 
  30: Write-Host "SAMAGRA OS durable bring-up" -ForegroundColor Cyan
  31: 
  32: # --- 1. local stack (idempotent) -------------------------------------------
  33: # Reuse the built dist unless -Rebuild / dist missing, so the logon task needs no npm on PATH.
  34: $dist       = Join-Path $RepoRoot 'frontend\dist\index.html'
  35: $serveLocal = Join-Path $PSScriptRoot 'serve-local.ps1'
  36: if ($Rebuild -or -not (Test-Path $dist)) { & $serveLocal } else { & $serveLocal -SkipBuild }
  37: 
  38: # --- 2. cloudflared tunnel (detached; only if not already running this config) ----
  39: $cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
  40: if (-not $cf) { $cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
  41: 
  42: $running = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
  43:   Where-Object { $_.CommandLine -like '*config.samagra.yml*' }
  44: if ($running) {
  45:   Write-Host ("[tunnel] already running (pid {0}) - reusing" -f $running.ProcessId) -ForegroundColor Green
  46: } else {
  47:   Write-Host "[tunnel] starting cloudflared samagra-os (detached) ..." -ForegroundColor Cyan
  48:   Start-Process -FilePath $cf `
  49:     -ArgumentList @('tunnel','--config', $cfg, 'run','samagra-os') `
  50:     -WorkingDirectory $RepoRoot `
  51:     -RedirectStandardOutput (Join-Path $LogDir 'tunnel.out.log') `
  52:     -RedirectStandardError  (Join-Path $LogDir 'tunnel.err.log') `
  53:     -WindowStyle Hidden | Out-Null
  54:   Write-Host "[tunnel] launched" -ForegroundColor Green
  55: }
  56: 
  57: Write-Host ""
  58: Write-Host "[durable] stack + tunnel up -> https://samagra.bhautikiplusprashnavali.com (behind Cloudflare Access)" -ForegroundColor Cyan

 succeeded in 4348ms:
   1: <#
   2: .SYNOPSIS
   3:   Register (or remove) the "SAMAGRA-OS" Scheduled Task that brings the deployment up at logon (B-5).
   4: 
   5: .DESCRIPTION
   6:   Creates a Task Scheduler task that runs scripts/serve-durable.ps1 at the current user's logon, so the
   7:   local stack (:8799 + :8783) and the cloudflared `samagra-os` tunnel come back after a reboot.
   8: 
   9:   Runs in the USER context with no stored password, so the public URL is up once the owner is logged in
  10:   (NOT at the pre-login lock screen). For 24/7 pre-login uptime, run cloudflared as a Windows service
  11:   instead (separate from the hermes default config) - documented in docs/deploy-tunnel.md sec 8.
  12: 
  13:   Idempotent: re-registering overwrites (-Force). Remove with:  scripts\install-durable-task.ps1 -Remove
  14:   Does NOT use -ExecutionPolicy Bypass (relies on the machine policy that already runs these local scripts).
  15: 
  16: .PARAMETER Remove  Unregister the task instead of creating it.
  17: #>
  18: [CmdletBinding()]
  19: param([switch]$Remove)
  20: 
  21: $ErrorActionPreference = 'Stop'
  22: $TaskName = 'SAMAGRA-OS'
  23: $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  24: $script   = Join-Path $PSScriptRoot 'serve-durable.ps1'
  25: 
  26: if ($Remove) {
  27:   if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  28:     Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  29:     Write-Host "[task] removed '$TaskName'" -ForegroundColor Yellow
  30:   } else {
  31:     Write-Host "[task] '$TaskName' not present - nothing to remove" -ForegroundColor DarkGray
  32:   }
  33:   return
  34: }
  35: 
  36: if (-not (Test-Path $script)) { throw "serve-durable.ps1 not found at $script" }
  37: 
  38: $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  39:   -Argument ('-NoProfile -WindowStyle Hidden -File "{0}"' -f $script) `
  40:   -WorkingDirectory $RepoRoot
  41: $trigger   = New-ScheduledTaskTrigger -AtLogOn -User ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME)
  42: $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  43: $principal = New-ScheduledTaskPrincipal -UserId ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME) -LogonType Interactive -RunLevel Limited
  44: 
  45: Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  46:   -Principal $principal -Force `
  47:   -Description 'Bring up SAMAGRA OS local stack + cloudflared samagra-os tunnel at logon (B-5 durable deploy).' | Out-Null
  48: 
  49: Write-Host ("[task] registered '{0}' - runs scripts\serve-durable.ps1 at logon of {1}\{2}" -f $TaskName, $env:USERDOMAIN, $env:USERNAME) -ForegroundColor Green

codex
The deployment scripts bind FastAPI to `127.0.0.1`, which helps against LAN exposure. The weak point remains the Cloudflare tunnel contract: if the Access policy is absent/misconfigured, the app has no origin-side authentication fallback.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git check-ignore -v .env mcd-cloud.json deploy/cloudflared/placeholder.json C:\\Users\\abc\\.cloudflared\\9b7a3df8-6fda-4500-b97c-4592c2dd101e.json 2>"'$null' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git ls-files .env mcd-cloud.json deploy/cloudflared/config.samagra.yml deploy/cloudflared/*.json *.pem *.json | Sort-Object' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'docs/deploy-tunnel.md' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 180) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "Cf-Access|CF-Access|Cloudflare-Access|JWT|Access-Jwt|aud|access" samagra frontend/src scripts deploy docs/deploy-tunnel.md CLAUDE.md STATUS.html HANDOFF.md SUMMARY.html' in C:\SandBox\claude_box\TeachingOS
 succeeded in 3462ms:
CLAUDE.md:7:> **✅ Direction-coherence decision (ratified 2026-06-21 by Deepak):** a coherence audit found execution solid but
CLAUDE.md:25:- (5) 2026-06-22 claude: User instructed to merge and push changes to make the deployment durable. [Git merge, Git push, deployment]
CLAUDE.md:26:- (5) 2026-06-22 claude: The autonomous ralph loop is driving SAMAGRA OS to a fully working state. [SAMAGRA OS, ralph loop, autonomous deployment]
CLAUDE.md:27:- (5) 2026-06-22 claude: The Ralph loop's mission is to drive the SAMAGRA OS app to fully working, served from frontend/dist/ by FastAPI on :8799. [Ralph, SAMAGRA OS, FastAPI]
CLAUDE.md:28:- (5) 2026-06-21 claude: The session concluded with a plan to improve the app in a custom ralph loop and deploy to Cloudflare with a custom URL pointing to a localhost tunnel. [deployment, Cloudflare, localhost tunnel, ralph loop]
CLAUDE.md:29:- (5) 2026-06-21 claude: The test-driven-development skill was applied: tests were written before code, and tests were seen to fail before passing. [test-driven-development, TDD, testing]
CLAUDE.md:30:- (5) 2026-06-21 claude: Munshi auth uses a single shared-secret cookie model: GET /login?k=<secret> sets the cookie; subsequent /api/ calls must carry it. [Munshi, authentication, cookie]
CLAUDE.md:31:- (5) 2026-06-21 claude: Immediate next step: update handoffs and project trackers plus summary (option B). [planning, project tracking]
CLAUDE.md:32:- (5) 2026-06-21 claude: Scope firewall and attention-ROI gate were implemented to prevent scope creep and maintain focus. [scope firewall, attention-ROI gate, project management]
CLAUDE.md:33:- (5) 2026-06-21 claude: Phase E2 requires 11 data/control apps as thin React wrappers over the existing FastAPI /api/* contract plus one new endpoint GET /api/or. [SAMAGRA OS, Phase E2, React, FastAPI]
CLAUDE.md:34:- (5) 2026-06-21 claude: A bug exists: the Questions app displays simulation IDs instead of the question search interface; this will be addressed in a future session. [bug, sim IDs, question search]
CLAUDE.md:35:- (5) 2026-06-20 claude: New design direction for TeachingOS based on 'Web OS GUI design.zip' is the immediate next priority. [design, priority, project]
CLAUDE.md:36:- (5) 2026-06-20 claude: All OS themes must include right-click functionality. [right-click, functionality, themes]
CLAUDE.md:37:- (5) 2026-06-20 claude: Windows in the OS must be draggable. [draggable, windows, UI]
CLAUDE.md:38:- (5) 2026-06-19 claude: Phase 0 executed: repo renamed from teachingos to samagra, Python package renamed, catalog rebuilt to 7,044 artifacts, 11/11 tests green, docs rebranded. [SAMAGRA, teachingos, rename, catalog, tests, docs]
CLAUDE.md:39:- (5) 2026-06-19 claude: Used a subagent team with a judge agent to debate the Samagra vision over two rounds. [subagent team, judge agent, deliberation]
CLAUDE.md:40:- (5) 2026-06-19 claude: Produced 10 concrete suggestions for improving the future vision direction based on the current intent. [suggestions, vision direction]
CLAUDE.md:41:- (5) 2026-06-18 claude: The final plan was recorded using `cbm record-plan docs/superpowers/plans/2026-06-19-samagra-evolution.md --title 'SAMAGRA Evolution'`. [cbm, record-plan, plan storage]
CLAUDE.md:42:- (5) 2026-06-18 claude: TeachingOS is designed to automate the creation of JEE/NEET physics educational content from handwritten notes to multiple output formats including lectures, booklets, and question banks. [TeachingOS, JEE/NEET, content pipeline]
CLAUDE.md:43:- (4) 2026-06-22 claude: User created an application deployment policy for SAMAGRA OS. [SAMAGRA OS, deployment policy]
CLAUDE.md:44:- (4) 2026-06-22 claude: User created an access policy for SAMAGRA OS. [SAMAGRA OS, access policy]
CLAUDE.md:45:- (4) 2026-06-22 claude: The user created an application policy for deployment. [SAMAGRA OS, deployment, policy]
CLAUDE.md:46:- (4) 2026-06-22 claude: The user created an access policy. [SAMAGRA OS, deployment, policy]
CLAUDE.md:47:- (4) 2026-06-22 claude: The app serves from frontend/dist/ by FastAPI on port 8799. [SAMAGRA OS, FastAPI, frontend]
CLAUDE.md:48:- (4) 2026-06-22 claude: The /loop command is set to dynamic mode (no interval specified) for self-paced execution. [/loop, dynamic mode]
CLAUDE.md:49:- (4) 2026-06-21 claude: User requested implementation of test-only S3/S4 cleanup LOWs from HANDOFF item 4. [testing, cleanup, HANDOFF]
CLAUDE.md:50:- (4) 2026-06-21 claude: User requested implementation of E3 mobile/visual-polish track. [mobile, visual, polish]
CLAUDE.md:51:- (4) 2026-06-21 claude: User committed qx files as part of finishing a development branch in the TeachingOS project. [git commit, qx files, TeachingOS]
CLAUDE.md:52:- (4) 2026-06-21 claude: Production secret MUNSHI_PROD_SECRET was copied from myProd\.dev.vars to TeachingOS's .env via shell, never exposed in transcript; length verified as 40 characters. [secret management, environment variables, Munshi]
CLAUDE.md:53:- (4) 2026-06-21 claude: Decision to implement a narrow fix for question maths display and add search functionality in a new session, after evaluating code review suggestions. [math rendering, search, code review]
CLAUDE.md:54:- (4) 2026-06-21 claude: OS-drift finding was finalized as decided and closed. [OS-drift, design decision]
CLAUDE.md:55:- (4) 2026-06-21 claude: The Questions app frontend was modified to fetch /api/facets and use subject facets instead of static qtype chips. [Questions app, facets API, frontend]
CLAUDE.md:57:- (4) 2026-06-20 claude: Tasks are divided between two agents: claude-deepak and claude-khanak, operating in parallel loops. [multi-agent, task division]
CLAUDE.md:58:- (4) 2026-06-20 claude: Three themes are required, with matching fidelity to design spec using browser vision. [themes, fidelity, browser vision]
CLAUDE.md:59:- (4) 2026-06-20 claude: The todo toggle in the Notes app To-dos tab is a plain <div> without keyboard focus or semantics, needing conversion to a focusable element with proper ARIA roles and event handling. [accessibility, keyboard, WCAG]
CLAUDE.md:60:Deep recall: C:\SandBox\claude_box\memboxes\scribe\bin\scribe.cmd q "<topic>"
SUMMARY.html:301:              <text x="135" y="133" text-anchor="middle" font-size="13.5" font-weight="650" fill="var(--text)">Claude-Deepak · CEO</text>
SUMMARY.html:304:              <text x="360" y="133" text-anchor="middle" font-size="13.5" font-weight="650" fill="var(--text)">Claude-Khanak · COO</text>
SUMMARY.html:366:      <p class="muted" style="margin-top:22px">Earlier: the governance layer was built and switched on — a place to track who's assigned what, a record of every decision, and an advisory code gate that asks a reviewer before risky changes land (it warns, can be overridden with a logged reason, and a broken reviewer never blocks work; only the human publish step is ever a hard stop). <strong>Now (20 Jun): the control room's first floor is built — and dressed.</strong> SAMAGRA OS — an OS-style screen with windows, a dock, and small built-in apps (a clock, notes, a terminal, a calculator-style settings panel, a game) — is up and running on tested foundations, and it now comes in <strong>three looks</strong> (a light one, a dark "mission-control" one, and a warm Indian-editorial one) with proper hand-drawn icons everywhere instead of plain letters. The trick that makes it solid: every piece of real behaviour (how windows move and stack, how the clock and game tick, how the terminal reads commands) lives in small, separately-tested building blocks — so the screen is now checked by <strong>439 automated tests, all green</strong>, on top of the backend's 102. Windows now drag and resize, every screen (in all three looks) has a right-click menu, and the whole thing is addressed to the chairman by name (Deepak Bhardwaj). The tests also lock down the look details a machine <em>can</em> judge: the right icons are drawn, each look uses its own colours, the window buttons are labelled. All of this has now been <strong>folded into the main build and published to the shared copy</strong>. <strong>Now (21 Jun): the real tool screens are in.</strong> Eleven of them — the org chart, the pipelines board, lectures, questions, booklets, the assignments board, the activity log, and more — now open as windows inside the control room, each one <strong>read-only</strong> (it only shows what's there; it never changes anything). Same trick as before: the real work lives in small, separately-tested building blocks, so these screens add up to <strong>501 automated tests, all green</strong> (plus the backend's 106, which gained a tiny new "who's who" lookup for the org chart). A reviewer (Codex) looked the batch over and gave the <strong>go-ahead</strong>, with three middling fixes made first: the worker list now shows "Gemini+NotebookLM" as one line, the pipelines screen spells out owner names properly, and the list screens make web links clickable. A couple of other things got tidied along the way: the org chart's who-reports-to-whom was corrected (Claude-Deepak is the CEO, Claude-Khanak the CTO), and a <strong>real bug from the earlier build was caught and fixed</strong> — when the screen was served the normal way (not the developer's preview), the app windows were coming up <em>empty</em>; a packaging setting was quietly leaving every app out of the shipped bundle. That's now fixed, so every window fills in properly. This new batch is now <strong>reviewed, folded into the main build, and published to the shared copy</strong> (21 Jun). What's still left is the one thing tests can't judge — a <strong>person eyeballing each screen against the design pictures</strong> to confirm it truly looks right (a few of the new app icons may still show a blank placeholder — a small polish item). That look-check hasn't happened, so we are <em>not</em> claiming a pixel-perfect match. <strong>Now (22 Jun): the phone version is built</strong> (see "What's next" below), and a batch of test-only loose ends was tidied. <strong>Next:</strong> the eyeball pass over the screens (now including the phone frame) and the owner's time-saved measurement, before going deeper on look-and-feel.</p>
HANDOFF.md:145:> confirmed-CRITICAL only, diff-hash cached, audited break-glass, never wedges; real enforcement = CI). The
HANDOFF.md:148:> **Pre-merge review: APPROVE** (Codex gpt-5.5/xhigh, 6 rounds + a CEO adversarial Workflow audit — see
HANDOFF.md:149:> `docs/codex-reviews/07–13` + `12-workflow-invariant-audit.md`; all findings fixed TDD).
HANDOFF.md:170:> mycontentdev · Munshi** (owner claude-deepak) and **Assignments (kanban) · Activity · Questions · Booklets ·
HANDOFF.md:171:> INSP/Olympiad · Simulations** (owner claude-khanak). No new write paths; mcd/munshi render empty-or-unavailable
HANDOFF.md:190:> actionable. **Also reconciled during review:** `org.py` owner mapping is OWNER-CONFIRMED — `claude1` =
HANDOFF.md:191:> **Claude-Deepak** (CEO — substrate & engine), `claude2` = **Claude-Khanak** (CTO — leaf apps & UX) — locked by
HANDOFF.md:252:> questions; or (c) drop subject chips and facet on chapter/q_type per the Gotcha. **Deeper cause (audit 2026-06-21):**
HANDOFF.md:260:A dedicated coherence audit this session — an independent **Codex vision review** plus a **multi-agent
HANDOFF.md:261:implementation audit** (4 mappers + 4 verifiers, live test runs) — found **execution coherence strong but
HANDOFF.md:263:HEAD `e1cb22a`), the **read-only safety invariant held exactly at the time of that audit** (no `create_seed`
HANDOFF.md:278:  STATUS / SUMMARY / HANDOFF did not surface the tension at all until this audit.
HANDOFF.md:281:  `_vision-review.log`); audit synthesis is summarised in STATUS.html → *Direction coherence*.
HANDOFF.md:336:cd C:\SandBox\claude_box\TeachingOS
HANDOFF.md:343:# portal: preview harness (.claude/launch.json -> "samagra") OR:
HANDOFF.md:361:- `samagra/review/` — Phase 2 advisory pre-commit Codex review (D5): `codex_dispatch.py` (vendored subprocess shim, lazy exe) + `precommit.py` (confirmed-CRITICAL + `state/review/` diff-hash cache + `SAMAGRA_REVIEW_BREAKGLASS` audit). CLI: `samagra review-staged`.
HANDOFF.md:375:· booklets `claude-booklet-proofer` · INSP `claude-INSP-extract` · sims `pratyaksh-May-deploy` (never write).
HANDOFF.md:421:1. **Pre-merge Codex review → APPROVE** (gpt-5.5, xhigh): 6 rounds + a CEO adversarial Workflow audit. Caught a never-wedge HIGH, a recurring "outer guard downgrades a confirmed-CRITICAL block" class (5 ever-deeper instances: cache prune, malformed cached findings, broken-stderr warnings, pathological exception str/repr, and a finding's raising `__eq__` on the dedup), + 2 MEDIUM + nits — all fixed TDD (+11 invariant regressions, suite 98). Reports `docs/codex-reviews/07–13` + `12-workflow-invariant-audit.md`.
STATUS.html:180:  <p>Governance principle: only the three board agents — <strong>Claude-Deepak (CEO)</strong>,
STATUS.html:181:  <strong>Claude-Khanak (COO / CCO)</strong>, <strong>Codex (Chief Architect &amp; Code-Review Lead)</strong> —
STATUS.html:209:  the branches merge without conflict: <strong>claude-deepak</strong> owns the substrate (bootstrap, all
STATUS.html:211:  <strong>claude-khanak</strong> owns the self-contained leaf apps (Clock/Notes/Snake wrappers + shared
STATUS.html:233:  <p class="lede">A dedicated coherence audit this session — an independent <strong>Codex vision review</strong>
STATUS.html:234:  plus a <strong>multi-agent implementation audit</strong> (4 mappers + 4 verifiers, live test runs) — found
STATUS.html:240:    <div class="card"><div class="n">⚠ <span class="badge todo">direction drifting</span></div><div class="l">The 2026-06-19 vision <em>retired</em> the word "OS" (<em>"it silently licenses OS-sized scope"</em>) and bound the project to an attention-ROI kill-criterion — yet the project pivoted to a literal 17-app "SAMAGRA OS" and parked the value-producing active loop. Codex verdict <strong>DRIFTING</strong>; audit verdict <strong>COHERENT-WITH-CAVEATS</strong> (this is the caveat).</div></div>
STATUS.html:297:    <tr><td>claude-booklet-proofer</td><td>11 booklets</td><td>theory / workbooks</td></tr>
STATUS.html:298:    <tr><td>claude-INSP-extract</td><td>136 items</td><td>116 sets · 20 papers</td></tr>
STATUS.html:308:    <tr><td>Claude #1 (Deepak)</td><td>CEO · board</td><td>Orchestrator — routes work, owns gates + the loop</td></tr>
STATUS.html:309:    <tr><td>Claude #2 (Khanak)</td><td>COO / CCO · board</td><td>Parallel content worker / QA / summarization; approves content</td></tr>
STATUS.html:311:    <tr><td>Gemini + NotebookLM</td><td>Director, Research &amp; Media</td><td>Question generation + media (audio/decks)</td></tr>
STATUS.html:359:    <text class="t" x="180" y="162" text-anchor="middle">Claude-Deepak</text>
STATUS.html:364:    <text class="t" x="460" y="162" text-anchor="middle">Claude-Khanak</text>
STATUS.html:484:  wedges, audited + sanitized break-glass, diff-hash cache hits, and the full never-downgrade hardening from
STATUS.html:485:  the pre-merge review + adversarial audit: corrupt/wrong-shape/unwritable cache, broken stderr, pathological
STATUS.html:599:    <strong>Org Chart · Pipelines · Lectures · mycontentdev · Munshi</strong> (owner claude-deepak) and
STATUS.html:601:    (owner claude-khanak). No new write paths; mcd/munshi render empty-or-unavailable states; Munshi
STATUS.html:619:    in <code>samagra/org.py</code>, <code>claude1</code> = <strong>Claude-Deepak</strong> (CEO — substrate &amp;
STATUS.html:620:    engine) and <code>claude2</code> = <strong>Claude-Khanak</strong> (CTO — leaf apps &amp; UX), locked by
STATUS.html:695:    accessors tolerate malformed data. A CEO-run <strong>adversarial multi-agent Workflow audit</strong> (6
STATUS.html:700:    Reports <code>docs/codex-reviews/07–13</code> + the Workflow audit <code>12-workflow-invariant-audit.md</code>.
STATUS.html:710:    staged-diff hash, carries an audited break-glass (<code>SAMAGRA_REVIEW_BREAKGLASS</code>), and a Codex that
STATUS.html:753:    <code>CRITICAL</code>, diff-hash cached, audited break-glass) with real enforcement in CI / branch protection;
STATUS.html:765:    <tr><td><code>samagra/org.py</code> + <code>tests/test_api_org.py</code></td><td><span class="badge ok">E2</span> static founder→board→workers registry behind <code>GET /api/org</code>; OWNER-CONFIRMED mapping (<code>claude1</code>=Claude-Deepak CEO, <code>claude2</code>=Claude-Khanak CTO) pinned by 4 new pytest.</td></tr>
STATUS.html:806:  has <strong>passed pre-merge Codex review (6 rounds + an adversarial Workflow audit → APPROVE)</strong>, and
STATUS.html:847:    <tr><td>Phase 2 — pre-merge Codex review</td><td><span class="badge ok">APPROVE</span></td><td>Codex (gpt-5.5/xhigh) 6 rounds + a CEO adversarial Workflow audit; caught a never-wedge HIGH, a recurring confirmed-block downgrade class, 2 MEDIUM + nits — all fixed TDD. R6 APPROVE-WITH-NITS (nit fixed). Reports <code>07–13</code> + <code>12-workflow-invariant-audit.md</code>.</td></tr>
docs/deploy-tunnel.md:51:# from the repo root (C:\SandBox\claude_box\TeachingOS)
docs/deploy-tunnel.md:116:> missing `Cf-Access-Jwt-Assertion` / `Cf-Access-Authenticated-User-Email` header
docs/deploy-tunnel.md:139:  # -> Location: https://jolly-sound-164b.cloudflareaccess.com/cdn-cgi/access/login/...
docs/deploy-tunnel.md:140:  # -> Www-Authenticate: Cloudflare-Access
samagra\adapters\booklets.py:1:"""claude-booklet-proofer adapter — theory/workbook booklets."""
frontend/src\components\AppIcon.test.tsx:96:    it("exposes the app name as an accessible label on the tile", () => {
frontend/src\components\Icon.test.tsx:103:    it("is decorative by default: aria-hidden, no accessible name", () => {
frontend/src\components\IconButton.test.tsx:11:  it("renders its children as an accessible button", () => {
frontend/src\components\IconButton.tsx:2:// Thin presentational wrapper: an accessible square button holding a glyph/icon.
frontend/src\components\IconButton.tsx:16:/** Square icon-only button with an accessible name. */
frontend/src\components\icons-data.test.ts:2:// The A-1 production-serve audit found every app glyph rendering a real <svg> (no
samagra\adapters\insp.py:1:"""claude-INSP-extract adapter — INSP / olympiad papers."""
samagra\state.py:30:        "owners": {"capture": "human", "enrich": "claude2",
samagra\state.py:31:                   "review": "claude1", "publish": "human"},
samagra\state.py:37:        "owners": {"extract": "codex", "tag": "gemini", "verify": "claude2"},
samagra\state.py:43:        "owners": {"link": "claude2", "build": "teachingos", "finalize": "human"},
samagra\state.py:46:        "label": "Media (audio/decks/images)",
samagra\state.py:49:        "owners": {"plan": "claude1", "generate": "notebooklm", "publish": "human"},
frontend/src\apps\Clock\index.tsx:114:    // no-op — audio is best-effort
frontend/src\apps\Notes\index.test.tsx:387:  it("exposes a per-row × delete control with an accessible name", () => {
frontend/src\apps\Notes\index.test.tsx:417:// so a faithful port inherits a real accessibility gap: pointer-only toggle.  //
frontend/src\apps\Notes\index.test.tsx:434:      // …and the accessible name is the task text (the row's todo-text).
frontend/src\apps\Org\index.test.tsx:9:  board: [{ id: "claude-deepak", name: "Claude-Deepak", role: "CEO" }],
frontend/src\apps\Org\index.test.tsx:22:    expect(screen.getByText("Claude-Deepak")).toBeInTheDocument();
samagra\review\__init__.py:4:surviving the staged-diff-hash cache, carries an audited break-glass
samagra\review\precommit.py:16:    and appends an audited line to state/review/breakglass.log.
samagra\review\precommit.py:172:def _audit_breakglass(diff_hash: str, reason: str) -> None:
samagra\review\precommit.py:248:        _emit(lambda: _audit_breakglass(dhash, reason))
samagra\review\precommit.py:250:            f"\n=== SAMAGRA pre-commit: BREAK-GLASS (audited) ===\n"
samagra\review\precommit.py:320:    print("  Fix the issue and re-commit. Emergency override (audited):",
frontend/src\apps\Terminal\index.test.tsx:98:    // The single command-line input — addressed by its accessible name.
frontend/src\apps\Terminal\index.test.tsx:299:    // It is a labelled FD2 line-icon (role=img + accessible name), and carries the
frontend/src\shell\Dock.tsx:59:            // No explicit aria-label: the button derives its accessible name from
samagra\review\codex_dispatch.py:3:Adapted from claude-booklet-proofer/scripts/codex_dispatch.py. Only the bits the
frontend/src\themes\index.test.ts:4:describe("getTheme / isTheme — fallback-guarded token access (advisory HIGH #4)", () => {
frontend/src\shell\Mobile.tsx:50: *  button's accessible name comes from the labelled AppIcon (role=img), matching
frontend/src\apps\Settings\index.test.tsx:72:    // The Console appearance control — addressed by its accessible name.
frontend/src\shell\Rail.tsx:103:              // accessible name via aria-label; `title` gives the hover tooltip.
samagra\org.py:6:(terminal `agents`/`whoami`). Owner-confirmed (2026-06-21): claude1 = Claude-Deepak
samagra\org.py:7:(CEO), claude2 = Claude-Khanak (CTO).
samagra\org.py:14:        {"id": "claude-deepak", "name": "Claude-Deepak", "role": "CEO — substrate & engine"},
samagra\org.py:15:        {"id": "claude-khanak", "name": "Claude-Khanak", "role": "CTO — leaf apps & UX"},
samagra\org.py:28:        "claude1": {"name": "Claude-Deepak", "role": "CEO — substrate & engine"},
samagra\org.py:29:        "claude2": {"name": "Claude-Khanak", "role": "CTO — leaf apps & UX"},
samagra\clients\mcd_client.py:23:# mycontentdev repo root, sibling of the samagra repo under claude_box.
samagra\config.py:30:CLAUDE_BOX = _env_path("SAMAGRA_CLAUDE_BOX", Path(r"C:\SandBox\claude_box"))
samagra\config.py:45:BOOKLETS_ROOT = _env_path("SAMAGRA_BOOKLETS_ROOT", CLAUDE_BOX / "claude-booklet-proofer")
samagra\config.py:46:INSP_ROOT = _env_path("SAMAGRA_INSP_ROOT", CLAUDE_BOX / "claude-INSP-extract")
samagra\governance\store.py:122:    # the durable audit ledger; an orphan event is false history.
frontend/src\apps\Dashboard\index.test.tsx:273:  it("exposes each bar as an accessible progressbar with the documented fill width", async () => {
frontend/src\apps\Dashboard\index.test.tsx:289:    expect(within(board).getByText("Claude-Deepak")).toBeInTheDocument();
frontend/src\apps\Dashboard\index.test.tsx:291:    expect(within(board).getByText("Claude-Khanak")).toBeInTheDocument();
frontend/src\apps\Dashboard\index.test.tsx:293:    expect(within(board).getByText("Claude-Codex")).toBeInTheDocument();
frontend/src\apps\Dashboard\index.tsx:113:// `Claude-<name>`. Avatar colors are the prototype's fixed per-person hues.
frontend/src\apps\Dashboard\index.tsx:347:                    <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>Claude-{b.name}</div>
frontend/src\lib\questions\facets.test.ts:38:describe("response accessors", () => {
frontend/src\lib\terminal\dispatch.ts:112:    line(pad("Claude-Deepak", 18) + "CEO — substrate & engine", "fg"),
frontend/src\lib\terminal\dispatch.ts:113:    line(pad("Claude-Khanak", 18) + "CTO — leaf apps & UX", "fg"),

 succeeded in 3511ms:
.claude/launch.json
deploy/cloudflared/config.samagra.yml
frontend/package.json
frontend/package-lock.json
frontend/tsconfig.json
frontend/tsconfig.node.json

 succeeded in 3854ms:
   1: # SAMAGRA OS â€” Cloudflare tunnel deploy runbook
   2: 
   3: Expose the **local** SAMAGRA OS stack at a custom HTTPS URL via a `cloudflared`
   4: **named tunnel** (NOT a Workers/Pages edge deploy â€” the Python + QX + BGE stack
   5: runs locally; the tunnel just fronts it). Only `:8799` is tunnelled; the QX
   6: sidecar on `:8783` stays internal and is reached via the same-origin
   7: `/api/questions` proxy.
   8: 
   9: > **âœ… LIVE as of 2026-06-22** at **https://samagra.bhautikiplusprashnavali.com**
  10: > behind Cloudflare Access. The values below are the as-shipped reality.
  11: 
  12: - **Custom hostname:** `samagra.bhautikiplusprashnavali.com` (zone `bhautikiplusprashnavali.com`)
  13: - **Tunnel name / id:** `samagra-os` / `9b7a3df8-6fda-4500-b97c-4592c2dd101e`
  14: - **Origin:** `http://localhost:8799` (FastAPI serving `frontend/dist` + `/api`, same-origin)
  15: - **Committed config:** [`deploy/cloudflared/config.samagra.yml`](../deploy/cloudflared/config.samagra.yml)
  16: - **Auth gate:** Cloudflare Access (one-time-PIN to owner email) â€” **required before any public run**
  17: 
  18: > âš ï¸ **Access before exposure (hard rule).** Never `cloudflared tunnel run` this
  19: > hostname before its Cloudflare Access application exists and is verified â€” the
  20: > owner-initiated capture write-paths (`POST /api/munshi/capture`,
  21: > `POST /api/mcd/seeds`) and admin keys must not be reachable unauthenticated.
  22: > The SAMAGRA origin does **not** itself fail closed, so **Access is the only
  23: > gate** â€” the Â§7 smoke-test (unauth request must 302 to the Access login) is
  24: > load-bearing, not optional. This mirrors the existing
  25: > `hermes.bhautikiplusprashnavali.com` tunnel's gate.
  26: 
  27: > ðŸ”‘ **Why `bhautikiplusprashnavali.com` and not `pratyakshsims.com`?** The local
  28: > `cloudflared` `cert.pem` (from a prior `cloudflared tunnel login`) is **scoped to
  29: > the `bhautikiplusprashnavali.com` zone**. Both domains are on the *same* Cloudflare
  30: > account (identical nameservers), but the cert can only write DNS in the zone it was
  31: > issued for â€” `route dns samagra.pratyakshsims.com` mangled the name to
  32: > `samagra.pratyakshsims.com.bhautikiplusprashnavali.com`. To use `pratyakshsims.com`
  33: > instead, re-run `cloudflared tunnel login` and select that zone (a browser action,
  34: > owner-only), then repeat steps 3â€“6 with the new hostname + a new Access app.
  35: 
  36: ---
  37: 
  38: ## 0. Prerequisites (one-time)
  39: 
  40: - `cloudflared` installed (`cloudflared --version`; shipped on 2025.8.1).
  41: - Authenticated to the Cloudflare account that owns the zone:
  42:   `~/.cloudflared/cert.pem` present **and scoped to the zone you route into**
  43:   (here `bhautikiplusprashnavali.com`). If `route dns` mangles the hostname (appends
  44:   another zone), the cert is scoped to the wrong zone â€” re-run `cloudflared tunnel
  45:   login` and pick the right one (owner-only browser auth).
  46: - The QX sidecar repo present at `C:\SandBox\gpt_box\gpt-extract-ques` (Questions).
  47: 
  48: ## 1. Bring up the local stack
  49: 
  50: ```powershell
  51: # from the repo root (C:\SandBox\claude_box\TeachingOS)
  52: & .\scripts\serve-local.ps1
  53: ```
  54: 
  55: This builds `frontend/dist`, starts FastAPI on `:8799` and the QX sidecar on
  56: `:8783`, is idempotent (reuses healthy servers; `-Restart` forces a clean
  57: relaunch clearing stale listeners), and prints a health summary. Confirm the
  58: summary shows `FastAPI :8799 HEALTHY` before tunnelling. (Run it directly â€” do
  59: **not** add `-ExecutionPolicy Bypass`; a local script runs fine under the normal
  60: policy and the bypass flag is an unnecessary security-weakening.)
  61: 
  62: ## 2. Create the tunnel (once) â€” DONE
  63: 
  64: ```bash
  65: cloudflared tunnel create samagra-os
  66: # -> Created tunnel samagra-os with id 9b7a3df8-6fda-4500-b97c-4592c2dd101e
  67: # -> writes credentials to ~/.cloudflared/<id>.json  (KEEP LOCAL, never commit)
  68: cloudflared tunnel list   # confirm samagra-os + its id
  69: ```
  70: 
  71: ## 3. Tunnel config (committed, no secrets) â€” DONE
  72: 
  73: The committed config at `deploy/cloudflared/config.samagra.yml` carries the real
  74: tunnel id + the `credentials-file` path under `~/.cloudflared/` (OUTSIDE the repo â€”
  75: the creds JSON and `cert.pem` are gitignored and never committed; a tunnel UUID is
  76: not a secret). Validate it:
  77: 
  78: ```bash
  79: cloudflared tunnel --config deploy/cloudflared/config.samagra.yml ingress validate   # -> OK
  80: ```
  81: 
  82: `ingress` maps `samagra.bhautikiplusprashnavali.com -> http://localhost:8799`, with
  83: a `http_status:404` catch-all so nothing else is served.
  84: 
  85: ## 4. Route DNS (creates the proxied CNAME) â€” DONE
  86: 
  87: Always pass `--config` so cloudflared uses the **samagra-os** tunnel (without it, it
  88: loads the default `~/.cloudflared/config.yml` = the hermes tunnel, and routes wrong):
  89: 
  90: ```bash
  91: cloudflared tunnel --config deploy/cloudflared/config.samagra.yml route dns samagra-os samagra.bhautikiplusprashnavali.com
  92: ```
  93: 
  94: Until the tunnel is running this hostname returns Cloudflare Error 1016 (origin
  95: down) â€” harmless. (To undo: delete the `samagra` CNAME in the zone's DNS.)
  96: 
  97: > ðŸ§¹ **Cleanup owed (D-8):** an initial mis-route (run without `--config`, against the
  98: > pratyakshsims hostname) left a stray CNAME
  99: > `samagra.pratyakshsims.com.bhautikiplusprashnavali.com` â†’ the hermes tunnel. It is
 100: > harmless (nobody resolves that FQDN; it does not affect `hermes.*` or the real
 101: > samagra host) but should be **deleted in the Cloudflare DNS dashboard**
 102: > (`cloudflared` has no `route dns delete`).
 103: 
 104: ## 5. Cloudflare Access â€” REQUIRED before any public run (owner, dashboard) â€” DONE
 105: 
 106: In the **Zero Trust dashboard** (mirrors the existing `hermes.*` gate):
 107: 
 108: 1. **Access â†’ Applications â†’ Add an application â†’ Self-hosted.**
 109: 2. Application domain: `samagra.bhautikiplusprashnavali.com`.
 110: 3. Add a **policy**: Action **Allow**, Include â†’ **Emails** â†’ the owner's email
 111:    (`dbhardwaj86@gmail.com`); login method **One-time PIN**.
 112: 4. Save. Verify (step 7): a logged-out request **302-redirects to the Access
 113:    one-time-PIN login** (not straight to the app).
 114: 
 115: > Defence-in-depth (optional, later): make the FastAPI origin fail closed on a
 116: > missing `Cf-Access-Jwt-Assertion` / `Cf-Access-Authenticated-User-Email` header
 117: > for remote requests, like the hermes origin does. Recommended for the capture
 118: > write-paths since Access is currently the sole gate.
 119: 
 120: ## 6. Run the tunnel (the public step â€” owner-gated) â€” RUNNING
 121: 
 122: Only after step 5 is verified:
 123: 
 124: ```bash
 125: cloudflared tunnel --config deploy/cloudflared/config.samagra.yml run samagra-os
 126: ```
 127: 
 128: Leave it running (foreground / background process), or install as a persistent
 129: service (step 8). A healthy run registers ~4 QUIC edge connections.
 130: 
 131: ## 7. Smoke test (over TLS) â€” gate VERIFIED
 132: 
 133: - **Confirm the gate (load-bearing):** an unauthenticated request is blocked by
 134:   Access â€” verified:
 135: 
 136:   ```bash
 137:   curl -sS -D - -o /dev/null https://samagra.bhautikiplusprashnavali.com/api/overview
 138:   # -> HTTP/1.1 302 Found
 139:   # -> Location: https://jolly-sound-164b.cloudflareaccess.com/cdn-cgi/access/login/...
 140:   # -> Www-Authenticate: Cloudflare-Access
 141:   ```
 142: 
 143:   A `200` with API JSON here means the gate is OFF â€” **stop the tunnel immediately.**
 144: - **Browser (owner):** load `https://samagra.bhautikiplusprashnavali.com` â†’ Access
 145:   OTP login â†’ after auth the SAMAGRA OS desktop loads. Verify a few apps render
 146:   (Dashboard, Questions, Munshi), both devices + a theme switch, and that `/api/*`
 147:   is same-origin (no CORS).
 148: 
 149: ## 8. Persistence + restart â€” DONE (logon Scheduled Task)
 150: 
 151: Durability is set up via a **logon Scheduled Task** (chosen over `cloudflared
 152: service install`, which would hijack the hermes default `~/.cloudflared/config.yml`):
 153: 
 154: ```powershell
 155: & .\scripts\install-durable-task.ps1            # register (idempotent) the "SAMAGRA-OS" task
 156: & .\scripts\install-durable-task.ps1 -Remove    # remove it
 157: & .\scripts\serve-durable.ps1                   # bring it all up by hand any time
 158: ```
 159: 
 160: - The task runs **`scripts\serve-durable.ps1`** at logon: it brings the stack up
 161:   (`serve-local.ps1`, reusing healthy servers + the built `dist`, so no npm is
 162:   needed) and starts the `samagra-os` tunnel **detached** (survives the shell),
 163:   idempotent, touching ONLY the samagra `--config`.
 164: - **Scope:** user context, no stored password â€” so the URL is up **once the owner
 165:   is logged in**, not at the pre-login lock screen. For 24/7 pre-login uptime, run
 166:   cloudflared as a **Windows service** pointed at a copy of `config.samagra.yml`
 167:   (separate from the hermes default service) instead of / in addition to the task.
 168: 
 169: ## 9. Teardown
 170: 
 171: ```bash
 172: # stop the tunnel process (Ctrl-C, or stop the service)
 173: # delete the samagra CNAME in the dashboard (and the D-8 junk record)
 174: cloudflared tunnel delete samagra-os   # removes the tunnel (delete creds JSON after)
 175: ```
 176: 
 177: Also remove the Access application in the Zero Trust dashboard if retiring the host.
 178: 
 179: ---
 180: 

2026-06-22T16:06:49.891309Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 5.8 seconds
Output:

 exited 1 in 5780ms:
codex
No tracked `.env`, `mcd-cloud.json`, PEM, or tunnel JSON showed up in `git ls-files`. I won’t print local secret files; I only need tracked/untracked status and ignore posture for this audit.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git check-ignore -v -- mcd-cloud.json' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git check-ignore -v -- .env' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Test-Path -LiteralPath '.env'; Test-Path -LiteralPath 'mcd-cloud.json'" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git check-ignore -v -- deploy/cloudflared/placeholder.json' in C:\SandBox\claude_box\TeachingOS
 succeeded in 998ms:
True
False

 succeeded in 3185ms:
.gitignore:52:mcd-cloud.json	mcd-cloud.json
warning: unable to access 'C:\Users\abc/.config/git/ignore': Permission denied

 succeeded in 3164ms:
.gitignore:2:.env	.env
warning: unable to access 'C:\Users\abc/.config/git/ignore': Permission denied

2026-06-22T16:07:03.342214Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 3.1 seconds
Output:
warning: unable to access 'C:\Users\abc/.config/git/ignore': Permission denied

 exited 1 in 3117ms:
warning: unable to access 'C:\Users\abc/.config/git/ignore': Permission denied

codex
A concrete deploy hygiene issue turned up: `.gitignore` ignores `.env` and root-level `mcd-cloud.json`, but the `cloudflared/*.json` pattern does not cover `deploy/cloudflared/*.json`. That is a real footgun if someone copies tunnel credentials next to the committed config.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'frontend/src/apps/Questions/index.tsx' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 180) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'frontend/src/types/contracts.ts' | ForEach-Object { "'$i++; if ($i -ge 50 -and $i -le 140) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/adapters/qx.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 140) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'frontend/src/lib/questions/facets.ts' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 120) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 2748ms:
  50: export interface Facets { sources: string[]; kinds: string[]; subjects: string[]; }
  51: 
  52: // â”€â”€ Questions (GET /api/questions) â€” proxied from the live QX engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  53: export type QuestionMode = "exact" | "semantic";
  54: export interface Question {
  55:   q_uid: string; slug: string; q_type: string | null;
  56:   subject: string | null; chapter: string | null; difficulty: string | null;
  57:   snippet: string;   // flat text_projection preview
  58:   html: string;      // QX-rendered question HTML (KaTeX maths + figure <img>)
  59: }
  60: export type FacetPair = [string, number];   // [value, count]
  61: export interface QuestionFacetCounts {
  62:   subject: FacetPair[]; chapter: FacetPair[]; qtype: FacetPair[];
  63: }
  64: export interface QuestionsResponse {
  65:   results: Question[];
  66:   total: number; page: number; page_size: number;
  67:   mode: QuestionMode; degraded: boolean;     // degraded = semantic asked, exact served
  68:   facets: QuestionFacetCounts;
  69:   error?: string;                            // present (HTTP 200) when QX is unreachable
  70: }
  71: 
  72: // â”€â”€ Overview (GET /api/overview) â€” promote Dashboard's inline types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  73: export interface OverviewSource {
  74:   source: string; label: string; available: number;   // 0 | 1
  75:   n_artifacts: number; refreshed_at: string;
  76:   summary: Record<string, unknown>;
  77:   summary_json?: string;             // raw string ALSO present on the wire
  78: }
  79: export interface Overview { sources: OverviewSource[]; refreshed_at: string | null; }
  80: 
  81: // â”€â”€ Pipelines (GET /api/pipelines) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  82: export type PipelineStatus = "pending" | "in_progress" | "awaiting_gate" | "done" | "failed" | "blocked";
  83: export interface Phase {
  84:   status: PipelineStatus; owner: string | null; gate: boolean;
  85:   started: string | null; finished: string | null; artifacts: string[]; error: string | null;
  86: }
  87: export interface Pipeline {
  88:   pipeline: string; label: string; created: string; updated: string;
  89:   current: string; phases: Record<string, Phase>;     // keyed by phase NAME, not array
  90: }
  91: export interface PipelinesResponse { pipelines: Pipeline[]; }
  92: 
  93: // â”€â”€ Assignments + events (GET /api/assignments) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  94: export type AssignmentStatus = "queued" | "running" | "in-review" | "approved" | "changes";  // HYPHEN
  95: export interface Assignment {
  96:   id: string; agent: string; outbox_path: string;
  97:   pipeline: string | null; seed_ref: string | null; artifact_ref: string | null;
  98:   expected_output: string | null; review_by: string | null;
  99:   status: AssignmentStatus; created_at: string; updated_at: string;
 100: }
 101: export interface EventItem {
 102:   id: number; ts: string; actor: string; verb: string;
 103:   assignment_id: string | null; subsystem: string | null; subsystem_ref: string | null; note: string | null;
 104: }
 105: export interface AssignmentsResponse { assignments: Assignment[]; events: EventItem[]; }
 106: 
 107: // â”€â”€ Org chart (GET /api/org â€” built in E2.1; shape mirrors samagra/org.py) â”€â”€â”€â”€
 108: export interface OrgPerson { id: string; name: string; role: string; }
 109: export interface OrgChart {
 110:   chairman: OrgPerson; board: OrgPerson[]; workers: OrgPerson[];
 111:   owners: Record<string, { name: string; role: string }>;  // token -> identity (7 owner ids)
 112: }
 113: 
 114: // â”€â”€ Capture / sims / facets (control-plane: POST capture + read-only sims/facets) â”€â”€
 115: export type MunshiKind = "todo" | "note" | "followup";
 116: export interface MunshiCaptureForm { kind: MunshiKind; [field: string]: string; }
 117: export interface SeedForm { type: SeedType; title?: string; raw_text: string; source_ref?: string; }
 118: export type SeedType =
 119:   | "concept" | "question" | "snippet" | "simulation_idea"
 120:   | "experiment" | "notebooklm_link" | "rough_idea";
 121: export interface SimRow { id: string; title: string; subject: string | null; grade: string | null; url: string; }
 122: export interface SimsResponse { sims: SimRow[]; total: number; }
 123: export interface QuestionFacets { subjects: string[]; }

 succeeded in 2806ms:
   1: import { buildQuery } from "../api/query";
   2: import type {
   3:   Question, QuestionsResponse, QuestionMode,
   4: } from "../../types/contracts";
   5: 
   6: export const MODES: QuestionMode[] = ["exact", "semantic"];
   7: export const FACET_DIMS = ["subject", "chapter", "qtype"] as const;
   8: export type FacetDim = (typeof FACET_DIMS)[number];
   9: 
  10: export interface QuestionParams {
  11:   q?: string;
  12:   mode?: QuestionMode;
  13:   subject?: string;
  14:   chapter?: string;
  15:   qtype?: string;
  16:   page?: number;
  17: }
  18: 
  19: /** Path for useApi: a change to it drives the refetch. Empty params are dropped. */
  20: export function buildQuestionsPath(p: QuestionParams): string {
  21:   return "/api/questions" + buildQuery({
  22:     q: p.q, mode: p.mode, subject: p.subject,
  23:     chapter: p.chapter, qtype: p.qtype, page: p.page,
  24:   });
  25: }
  26: 
  27: type R = QuestionsResponse | null | undefined;
  28: 
  29: export function questionRows(data: R): Question[] {
  30:   return Array.isArray(data?.results) ? data!.results : [];
  31: }
  32: 
  33: /** In-body error (HTTP 200) when the QX backend is unreachable, else null. */
  34: export function questionError(data: R): string | null {
  35:   return data?.error ?? null;
  36: }
  37: 
  38: export function searchMode(data: R): QuestionMode {
  39:   return data?.mode === "semantic" ? "semantic" : "exact";
  40: }
  41: 
  42: /** True when a semantic search fell back to exact (QX SemanticUnavailable). */
  43: export function isDegraded(data: R): boolean {
  44:   return data?.degraded === true;
  45: }
  46: 
  47: export function totalCount(data: R): number {
  48:   return typeof data?.total === "number" ? data!.total : 0;
  49: }
  50: 
  51: /** The value names for a facet dimension (subject / chapter / qtype), [] if absent. */
  52: export function facetNames(data: R, dim: FacetDim): string[] {
  53:   const pairs = data?.facets?.[dim];
  54:   return Array.isArray(pairs) ? pairs.map((p) => String(p[0])).filter(Boolean) : [];
  55: }

 succeeded in 2868ms:
   1: import { useEffect, useRef, useState } from "react";
   2: import katex from "katex";
   3: import "katex/dist/katex.min.css";
   4: import { useApi } from "../../hooks/useApi";
   5: import Icon from "../../components/Icon";
   6: import {
   7:   MODES, buildQuestionsPath, questionRows, questionError,
   8:   isDegraded, totalCount, facetNames,
   9: } from "../../lib/questions/facets";
  10: import type { QuestionsResponse, QuestionMode } from "../../types/contracts";
  11: 
  12: const V = {
  13:   text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  14:   cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  15:   accent: "var(--samagra-accent)", font: "var(--samagra-font)",
  16: } as const;
  17: 
  18: const ACTIVE_BG = "color-mix(in srgb, var(--samagra-accent) 18%, transparent)";
  19: 
  20: // Scoped styling for the QX-rendered question HTML: hide the equation-image
  21: // fallback once KaTeX typesets, bound figure size, and lay out options.
  22: const QX_CSS = `
  23: .qx-html { color: ${V.text}; font-size: 13px; line-height: 1.5; }
  24: .qx-html .mwrap { display: inline-block; vertical-align: middle; }
  25: .qx-html .eq-hidden { display: none; }
  26: .qx-html .fig { max-width: 100%; max-height: 320px; display: block; margin: 8px 0; }
  27: .qx-html .opt { margin-top: 4px; }
  28: .qx-html .opt-label { color: ${V.muted}; font-weight: 600; margin-right: 4px; }
  29: .qx-html .passage { margin-bottom: 8px; }
  30: .qx-html .ptag { color: ${V.muted}; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  31: .qx-html .matrix-table { border-collapse: collapse; margin-top: 6px; }
  32: .qx-html .matrix-table td, .qx-html .matrix-table th { border: 1px solid ${V.line}; padding: 3px 8px; }
  33: `;
  34: 
  35: const chipStyle = (active: boolean) => ({
  36:   background: active ? ACTIVE_BG : V.subBg, color: active ? V.text : V.muted,
  37:   border: `1px solid ${active ? V.accent : V.line}`, cursor: "pointer",
  38:   fontSize: 11, borderRadius: 999, padding: "2px 8px", fontFamily: V.font,
  39: });
  40: 
  41: export default function Questions() {
  42:   const [q, setQ] = useState("");          // live input value
  43:   const [query, setQuery] = useState("");  // submitted query (drives the fetch)
  44:   const [mode, setMode] = useState<QuestionMode>("exact");
  45:   const [subject, setSubject] = useState("");
  46:   const [chapter, setChapter] = useState("");
  47:   const [qtype, setQtype] = useState("");
  48:   const [page, setPage] = useState(1);
  49: 
  50:   // A change to this path re-fires useApi â†’ the single source of truth for the
  51:   // proxied QX search (exact/semantic, rendered HTML, filter-scoped facets).
  52:   const path = buildQuestionsPath({
  53:     q: query, mode,
  54:     subject: subject || undefined, chapter: chapter || undefined,
  55:     qtype: qtype || undefined, page: page > 1 ? page : undefined,
  56:   });
  57:   const { data, loading, error } = useApi<QuestionsResponse>(path);
  58: 
  59:   const rows = questionRows(data);
  60:   const notice = questionError(data);
  61:   const degraded = isDegraded(data);
  62:   const total = totalCount(data);
  63:   const pageSize = data?.page_size || 25;
  64:   const subjects = facetNames(data, "subject");
  65:   const chapters = facetNames(data, "chapter");
  66:   const qtypes = facetNames(data, "qtype");
  67: 
  68:   // Typeset every KaTeX span the QX engine emitted; on failure, reveal the
  69:   // adjacent equation-image fallback instead of showing nothing.
  70:   const listRef = useRef<HTMLDivElement>(null);
  71:   useEffect(() => {
  72:     const root = listRef.current;
  73:     if (!root) return;
  74:     root.querySelectorAll<HTMLElement>(".ktx[data-tex]").forEach((el) => {
  75:       try {
  76:         katex.render(el.getAttribute("data-tex") || "", el,
  77:           { throwOnError: false, displayMode: false });
  78:       } catch {
  79:         const img = el.nextElementSibling;
  80:         if (img) img.classList.remove("eq-hidden");
  81:       }
  82:     });
  83:   }, [data]);
  84: 
  85:   function toggle(value: string, current: string, set: (v: string) => void) {
  86:     set(current === value ? "" : value);
  87:     setPage(1);
  88:   }
  89:   function onSubmit(e: React.FormEvent) {
  90:     e.preventDefault();
  91:     setQuery(q.trim());
  92:     setPage(1);
  93:   }
  94:   function pickMode(m: QuestionMode) {
  95:     setMode(m);
  96:     setPage(1);
  97:   }
  98: 
  99:   function chips(testid: string, items: string[], active: string, set: (v: string) => void) {
 100:     if (!items.length) return null;
 101:     return (
 102:       <div data-testid={testid} style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
 103:         {items.map((s) => {
 104:           const on = active === s;
 105:           return (
 106:             <button key={s} type="button" data-testid={`${testid}-chip`} aria-pressed={on}
 107:                     onClick={() => toggle(s, active, set)} style={chipStyle(on)}>{s}</button>
 108:           );
 109:         })}
 110:       </div>
 111:     );
 112:   }
 113: 
 114:   return (
 115:     <div data-testid="questions" style={{ padding: 20, fontFamily: V.font }}>
 116:       <style>{QX_CSS}</style>
 117:       <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
 118:         <span style={{ color: V.accent, display: "inline-flex" }}>
 119:           <Icon name="questions" size={26} label="Questions" />
 120:         </span>
 121:         <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Questions</h1>
 122:       </header>
 123: 
 124:       <form data-testid="q-form" onSubmit={onSubmit}
 125:             style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
 126:         <input data-testid="q-input" aria-label="search questions" value={q}
 127:                onChange={(e) => setQ(e.target.value)} placeholder="Search questionsâ€¦"
 128:                style={{ flex: "1 1 220px", background: V.subBg, color: V.text,
 129:                         border: `1px solid ${V.line}`, borderRadius: 8, padding: "6px 10px",
 130:                         fontFamily: V.font, fontSize: 13 }} />
 131:         <button type="submit"
 132:                 style={{ background: V.accent, color: "#fff", border: "none", borderRadius: 8,
 133:                          padding: "7px 14px", fontFamily: V.font, fontSize: 13, cursor: "pointer" }}>
 134:           Search
 135:         </button>
 136:         <div role="group" aria-label="search mode" style={{ display: "flex", gap: 4 }}>
 137:           {MODES.map((m) => {
 138:             const on = mode === m;
 139:             return (
 140:               <button key={m} type="button" aria-pressed={on} onClick={() => pickMode(m)}
 141:                       title={m === "semantic" ? "rank by meaning (BGE embeddings)" : "literal text match"}
 142:                       style={{ ...chipStyle(on), textTransform: "capitalize", padding: "5px 12px", fontSize: 12 }}>
 143:                 {m}
 144:               </button>
 145:             );
 146:           })}
 147:         </div>
 148:       </form>
 149: 
 150:       {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
 151:       {notice ? <div data-testid="questions-notice" style={{ color: V.muted, marginTop: 8 }}>{notice}</div> : null}
 152:       {degraded ? (
 153:         <div data-testid="questions-degraded" style={{ color: V.muted, marginTop: 8, fontSize: 12 }}>
 154:           Semantic search unavailable â€” showing exact matches.
 155:         </div>
 156:       ) : null}
 157: 
 158:       {chips("subject-filters", subjects, subject, setSubject)}
 159:       {chips("chapter-filters", chapters, chapter, setChapter)}
 160:       {chips("qtype-filters", qtypes, qtype, setQtype)}
 161: 
 162:       <div style={{ color: V.muted, fontSize: 12, marginTop: 12 }}>
 163:         {total} result{total === 1 ? "" : "s"}{mode === "semantic" ? " Â· semantic" : ""}
 164:       </div>
 165: 
 166:       <section ref={listRef} data-testid="questions-list" aria-busy={loading}
 167:                style={{ marginTop: 8, display: "grid", gap: 10 }}>
 168:         {rows.length === 0 ? (
 169:           <div data-testid="questions-empty" style={{ color: V.muted }}>
 170:             {loading ? "Loadingâ€¦" : "No questions to show."}
 171:           </div>
 172:         ) : rows.map((row) => (
 173:           <article key={row.q_uid} data-testid="question-row"
 174:                    style={{ background: V.cardBg, border: `1px solid ${V.line}`,
 175:                             borderRadius: 10, padding: "10px 12px" }}>
 176:             <div className="qx-html" dangerouslySetInnerHTML={{ __html: row.html }} />
 177:             <div style={{ color: V.muted, fontSize: 12, marginTop: 6 }}>
 178:               {[row.q_type, row.subject, row.chapter, row.difficulty].filter(Boolean).join(" Â· ")}
 179:             </div>
 180:           </article>

 succeeded in 3057ms:
   1: """QX (gpt-extract-ques) adapter â€” the question engine.
   2: 
   3: Content DB (`qx_content.sqlite`) holds documents + questions but its subject/chapter
   4: columns are NULL; the real, overlay-aware metadata lives in `builder.sqlite.search_index`
   5: (coalesce ov_* over base columns). We attach both READ-ONLY (immutable) so we never
   6: interfere with QX's own writes.
   7: """
   8: from __future__ import annotations
   9: 
  10: import sqlite3
  11: from collections import Counter
  12: from typing import Iterator
  13: 
  14: from .. import config
  15: from .base import Adapter, Artifact
  16: 
  17: 
  18: def _ro(path) -> sqlite3.Connection:
  19:     return sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)
  20: 
  21: 
  22: class QXAdapter(Adapter):
  23:     name = "qx"
  24:     label = "Question Bank (QX)"
  25: 
  26:     def available(self) -> bool:
  27:         return config.QX_CONTENT_DB.exists()
  28: 
  29:     # -- helpers ---------------------------------------------------------
  30:     def _subject_by_slug(self) -> dict:
  31:         out: dict[str, str] = {}
  32:         if not config.QX_BUILDER_DB.exists():
  33:             return out
  34:         b = _ro(config.QX_BUILDER_DB)
  35:         try:
  36:             rows = b.execute(
  37:                 "select slug, coalesce(ov_subject, subject) from search_index"
  38:             ).fetchall()
  39:         finally:
  40:             b.close()
  41:         agg: dict[str, Counter] = {}
  42:         for slug, subj in rows:
  43:             if subj:
  44:                 agg.setdefault(slug, Counter())[subj] += 1
  45:         for slug, c in agg.items():
  46:             out[slug] = c.most_common(1)[0][0]
  47:         return out
  48: 
  49:     # -- contract --------------------------------------------------------
  50:     def summary(self) -> dict:
  51:         c = _ro(config.QX_CONTENT_DB)
  52:         try:
  53:             docs = c.execute("select count(*) from documents").fetchone()[0]
  54:             qs = c.execute("select count(*) from questions").fetchone()[0]
  55:         finally:
  56:             c.close()
  57:         subjects: dict[str, int] = {}
  58:         if config.QX_BUILDER_DB.exists():
  59:             b = _ro(config.QX_BUILDER_DB)
  60:             try:
  61:                 for s, n in b.execute(
  62:                     "select coalesce(ov_subject, subject) s, count(*) "
  63:                     "from search_index group by 1 order by 2 desc"
  64:                 ):
  65:                     if s:
  66:                         subjects[s] = n
  67:             finally:
  68:                 b.close()
  69:         return {"documents": docs, "questions": qs, "subjects": subjects,
  70:                 "online": config.QUESTIONDB_URL}
  71: 
  72:     def artifacts(self) -> Iterator[Artifact]:
  73:         subj_map = self._subject_by_slug()
  74:         c = _ro(config.QX_CONTENT_DB)
  75:         try:
  76:             qcount = dict(c.execute("select slug, count(*) from questions group by slug"))
  77:             for slug, rel, title, exam, year, status, extracted in c.execute(
  78:                 "select slug, rel_path, title, exam, year, status, extracted_at "
  79:                 "from documents"
  80:             ):
  81:                 yield Artifact(
  82:                     uid=f"qx:doc:{slug}", source=self.name, kind="paper",
  83:                     title=title or slug, subject=subj_map.get(slug),
  84:                     status=status, path=rel, updated_at=extracted,
  85:                     meta={"exam": exam, "year": year,
  86:                           "questions": qcount.get(slug, 0)},
  87:                 )
  88:         finally:
  89:             c.close()
  90: 
  91:     # -- live question search for the portal -----------------------------
  92:     def search_questions(self, q="", subject=None, chapter=None, qtype=None, limit=50):
  93:         if not config.QX_BUILDER_DB.exists():
  94:             return []
  95:         b = _ro(config.QX_BUILDER_DB)
  96:         try:
  97:             sql = ("select q_uid, slug, q_type, coalesce(ov_subject,subject), "
  98:                    "coalesce(ov_chapter,chapter), difficulty, text_projection "
  99:                    "from search_index where 1=1")
 100:             args: list = []
 101:             if q:
 102:                 sql += " and text_projection like ?"
 103:                 args.append(f"%{q}%")
 104:             if subject:
 105:                 sql += " and coalesce(ov_subject,subject)=?"
 106:                 args.append(subject)
 107:             if chapter:
 108:                 sql += " and coalesce(ov_chapter,chapter)=?"
 109:                 args.append(chapter)
 110:             if qtype:
 111:                 sql += " and q_type=?"
 112:                 args.append(qtype)
 113:             sql += " limit ?"
 114:             args.append(limit)
 115:             cols = ["q_uid", "slug", "q_type", "subject", "chapter", "difficulty", "text"]
 116:             return [dict(zip(cols, r)) for r in b.execute(sql, args)]
 117:         finally:
 118:             b.close()

codex
The Questions app is QX-backed and no longer consumes catalog-wide `/api/facets`, so the original SIM chip leak path is gone. A new nuance: the backend’s `/api/questions/facets` has the non-alpha filter, but the actual app chips come from `/api/questions` response facets, so that filter does not protect the rendered chips.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"deployed-sims|SIM\\d{4}|482|sim_url|parse_deployed_sims|non-vacuous|Sims\" tests samagra frontend/src/apps/Sims frontend/src/lib" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$path = Join-Path (Resolve-Path '"'..\\pratyaksh-May-deploy').Path 'deployed-sims-by-grade.md'; if (Test-Path "'$path) { rg -n "SIM'"\\d{4}|"'^##|''^###|Grade|Class" $path | Select-Object -First 40 } else { '"'MISSING' }" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/sims_manifest.py' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$path = Join-Path (Resolve-Path '"'..\\pratyaksh-May-deploy').Path 'deployed-sims-by-grade.md'; if (Test-Path "'$path) { $matches = rg -o "SIM'"\\d{4}\" "'$path; ($matches | Measure-Object).Count; $path } else { '"'MISSING' }" in C:\SandBox\claude_box\TeachingOS
 succeeded in 3447ms:
   1: """Parse the Pratyaksh deployed-sims manifest (read-only). No network, no DB."""
   2: from __future__ import annotations
   3: import re
   4: 
   5: SITE = "https://pratyakshsims.com"
   6: _GRADE = re.compile(r"^##\s+(?!#)(.*?)\s*(?:\(\d+\))?\s*$")
   7: _SUBJECT = re.compile(r"^###\s+(.*?)\s*(?:\(\d+\))?\s*$")
   8: _ITEM = re.compile(r"^-\s*(\d{3,4})\s*[â€”-]\s*(.+?)\s*$")
   9: 
  10: 
  11: def sim_url(sim_id: str) -> str:
  12:     # Canonical deployed URL is extensionless â€” the .html form 308-redirects to
  13:     # this; linking directly avoids the redirect hop and lands on a 200.
  14:     # Enforce the parser-validated id space (1â€“4 digits, _ITEM accepts \d{3,4}):
  15:     # a non-conforming id (letters, >4 digits, empty) would otherwise zero-pad
  16:     # into a malformed canonical URL silently (S3 LOW-2).
  17:     sid = str(sim_id).strip()
  18:     if not re.fullmatch(r"\d{1,4}", sid):
  19:         raise ValueError(f"sim id must be 1-4 digits, got {sim_id!r}")
  20:     n = sid.zfill(4)
  21:     return f"{SITE}/sims/SIM{n}/SIM{n}_sim"
  22: 
  23: 
  24: def parse_deployed_sims(text: str) -> list[dict]:
  25:     grade = subject = None
  26:     out: list[dict] = []
  27:     for line in text.splitlines():
  28:         ms = _SUBJECT.match(line)
  29:         if ms:
  30:             subject = ms.group(1).strip()
  31:             continue
  32:         mg = _GRADE.match(line)
  33:         if mg:
  34:             grade = mg.group(1).strip()
  35:             subject = None  # a new grade starts fresh â€” don't bleed the prior grade's subject
  36:             continue
  37:         mi = _ITEM.match(line)
  38:         if mi:
  39:             sid = mi.group(1).strip()
  40:             out.append({"id": sid, "title": mi.group(2).strip(),
  41:                         "subject": subject, "grade": grade, "url": sim_url(sid)})
  42:     return out

 succeeded in 3961ms:
frontend/src/apps/Sims\index.tsx:4:import { filterSims, groupByGrade } from "../../lib/sims/deployed";
frontend/src/apps/Sims\index.tsx:5:import type { SimsResponse } from "../../types/contracts";
frontend/src/apps/Sims\index.tsx:13:export default function Sims() {
frontend/src/apps/Sims\index.tsx:14:  const { data, loading, error } = useApi<SimsResponse>("/api/sims");
frontend/src/apps/Sims\index.tsx:17:  const groups = groupByGrade(filterSims(rows, query));
frontend/src/apps/Sims\index.test.tsx:5:import Sims from "./index";
frontend/src/apps/Sims\index.test.tsx:9:    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
frontend/src/apps/Sims\index.test.tsx:12:describe("Sims app", () => {
frontend/src/apps/Sims\index.test.tsx:16:    render(<Sims />);
frontend/src/apps/Sims\index.test.tsx:26:    // Sims app renders NO subject chips at all (the old catalog-wide chip UI was
frontend/src/apps/Sims\index.test.tsx:27:    // removed). Assert the absence directly (a non-vacuous guard) rather than
frontend/src/apps/Sims\index.test.tsx:34:    render(<Sims />);
frontend/src/apps/Sims\index.test.tsx:40:    render(<Sims />);
samagra\api\app.py:235:    p = config.SIMS_ROOT / "deployed-sims-by-grade.md"
samagra\api\app.py:238:    sims = sims_manifest.parse_deployed_sims(p.read_text(encoding="utf-8"))
samagra\sims_manifest.py:1:"""Parse the Pratyaksh deployed-sims manifest (read-only). No network, no DB."""
samagra\sims_manifest.py:11:def sim_url(sim_id: str) -> str:
samagra\sims_manifest.py:24:def parse_deployed_sims(text: str) -> list[dict]:
samagra\sims_manifest.py:41:                        "subject": subject, "grade": grade, "url": sim_url(sid)})
samagra\adapters\__init__.py:11:from .sims import SimsAdapter
samagra\adapters\__init__.py:19:    SimsAdapter(),
samagra\adapters\sims.py:10:class SimsAdapter(Adapter):
tests\test_sims_manifest.py:2:SAMPLE = """_482 deployed sims_
tests\test_sims_manifest.py:14:    rows = sm.parse_deployed_sims(SAMPLE)
tests\test_sims_manifest.py:21:def test_sim_url_pads():
tests\test_sims_manifest.py:22:    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
tests\test_sims_manifest.py:23:    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"
tests\test_sims_manifest.py:26:def test_sim_url_rejects_non_conforming_ids():
tests\test_sims_manifest.py:27:    # S3 LOW-2: sim_url() previously padded ANY input, so a stray "abc"/"12345"
tests\test_sims_manifest.py:33:            sm.sim_url(bad)
tests\test_sims_manifest.py:35:    assert sm.sim_url("7") == "https://pratyakshsims.com/sims/SIM0007/SIM0007_sim"
tests\test_sims_manifest.py:36:    assert sm.sim_url("1234") == "https://pratyakshsims.com/sims/SIM1234/SIM1234_sim"
tests\test_sims_manifest.py:47:    rows = sm.parse_deployed_sims(text)
tests\test_sims_manifest.py:62:    rows = sm.parse_deployed_sims(text)
tests\test_sims_manifest.py:75:    rows = sm.parse_deployed_sims(text)
tests\test_sims_manifest.py:83:        "_482 deployed sims_\n"
tests\test_sims_manifest.py:92:    rows = sm.parse_deployed_sims(text)
tests\test_sims_manifest.py:107:    rows = sm.parse_deployed_sims(text)
tests\test_sims_manifest.py:122:    rows = sm.parse_deployed_sims(text)
tests\test_api_sims.py:6:    (tmp_path / "deployed-sims-by-grade.md").write_text(
tests\test_api_sims.py:13:    assert body["sims"][0]["url"].endswith("/sims/SIM0020/SIM0020_sim")
frontend/src/lib\sims\deployed.ts:2:export function filterSims(rows: SimRow[], q: string): SimRow[] {
samagra\portal\static\app.js:36:  sims: renderSims, pipelines: renderPipelines,
samagra\portal\static\app.js:140:async function renderSims() {
frontend/src/lib\sims\deployed.test.ts:1:import { filterSims, groupByGrade } from "./deployed";
frontend/src/lib\sims\deployed.test.ts:7:  expect(filterSims(rows, "osmo").map(r => r.id)).toEqual(["0466"]);
frontend/src/lib\sims\deployed.test.ts:8:  expect(filterSims(rows, "physics").map(r => r.id)).toEqual(["0020"]);
frontend/src/lib\sims\deployed.test.ts:9:  expect(filterSims(rows, "").length).toBe(2);

 succeeded in 4675ms:
3:## Class 9  (57)
5:### Biology (15)
22:### Chemistry (11)
33:- 0138 — Electron Configuration Builder — Class IX Chemistry
35:### Maths (14)
51:### Physics (17)
52:- 0341 — Position, Distance & Displacement — Class IX
65:- 0354 — Production & Propagation of Sound — Class IX Physics
66:- 0355 — Wave Properties of Sound — Pratyaksh · Class IX Physics
70:## Class 10  (62)
72:### Biology (20)
94:### Chemistry (21)
96:- 0140 — Reaction Type Classifier — Class X Chemistry
110:- 0154 — Soap & Micelle Simulator — SIM0154
111:- 0155 — Ethanol & Ethanoic Acid Properties Lab — SIM0155
112:- 0156 — Classification Timeline
117:### Maths (5)
124:### Physics (16)
142:## Class 11  (151)
144:### Biology (30)
176:### Chemistry (55)
233:### Maths (21)
256:### Physics (45)
303:## Class 12  (212)
305:### Biology (63)
346:- 0573 — PCR Engine — Biotechnology · Class XII
370:### Chemistry (58)
376:- 0221 — Packing Efficiency Visualizer — Solid State | SIM0221
428:- 0273 — Drug Classification: Interactive Pharmacology Table
430:### Maths (27)
459:### Physics (64)

 succeeded in 4714ms:
3
C:\SandBox\claude_box\pratyaksh-May-deploy\deployed-sims-by-grade.md

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$path = Join-Path (Resolve-Path '"'..\\pratyaksh-May-deploy').Path 'deployed-sims-by-grade.md'; if (Test-Path "'$path) { Select-String -LiteralPath $path -Pattern '"'"'^##'"\\s+Class' } else { 'MISSING' }" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$path = Join-Path (Resolve-Path '"'..\\pratyaksh-May-deploy').Path 'deployed-sims-by-grade.md'; if (Test-Path "'$path) { (Select-String -LiteralPath $path -Pattern '"'"'^-'"\\s*\\d{3,4}\\s*[—–-]' | Measure-Object).Count } else { 'MISSING' }" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'tests/test_sims_manifest.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 140) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/adapters/sims.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 110) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 3900ms:
   1: from samagra import sims_manifest as sm
   2: SAMPLE = """_482 deployed sims_
   3: ## Class 9  (57)
   4: ### Biology (15)
   5: - 0466 â€” Osmosis & Plasmolysis Lab
   6: - 0470 â€” Xylem & Phloem Transport
   7: ### Chemistry (11)
   8: - 0127 â€” States of Matter Explorer
   9: ## Class 11  (3)
  10: ### Physics (3)
  11: - 0020 â€” Vector Algebra Lab Â· KSS 180
  12: """
  13: def test_parse_groups_and_urls():
  14:     rows = sm.parse_deployed_sims(SAMPLE)
  15:     assert len(rows) == 4
  16:     bio = [r for r in rows if r["subject"] == "Biology"]
  17:     assert {r["id"] for r in bio} == {"0466", "0470"}
  18:     assert all(r["grade"] == "Class 9" for r in bio)
  19:     phys = [r for r in rows if r["subject"] == "Physics"][0]
  20:     assert phys["grade"] == "Class 11" and phys["title"].startswith("Vector Algebra")
  21: def test_sim_url_pads():
  22:     assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
  23:     assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"
  24: 
  25: 
  26: def test_sim_url_rejects_non_conforming_ids():
  27:     # S3 LOW-2: sim_url() previously padded ANY input, so a stray "abc"/"12345"
  28:     # produced a malformed canonical URL silently. It now enforces a 1â€“4 digit id
  29:     # (the parser-validated id space) and raises rather than emit a bad URL.
  30:     import pytest
  31:     for bad in ["abc", "12345", "", "1a", "-1", "  "]:
  32:         with pytest.raises(ValueError):
  33:             sm.sim_url(bad)
  34:     # The valid edges still pass through (1â€“4 digits, zero-padded to 4).
  35:     assert sm.sim_url("7") == "https://pratyakshsims.com/sims/SIM0007/SIM0007_sim"
  36:     assert sm.sim_url("1234") == "https://pratyakshsims.com/sims/SIM1234/SIM1234_sim"
  37: 
  38: 
  39: def test_h2_h3_disambiguation():
  40:     # S3 LOW-3: a `## ` heading is a GRADE, a `### ` heading is a SUBJECT â€” the
  41:     # extra hash must not let a subject heading be read as a grade (or vice versa).
  42:     text = (
  43:         "## Class 9 (2)\n"
  44:         "### Physics (1)\n"
  45:         "- 0001 â€” Newton's Cradle\n"
  46:     )
  47:     rows = sm.parse_deployed_sims(text)
  48:     assert len(rows) == 1
  49:     assert rows[0]["grade"] == "Class 9"      # from `## `, not `### `
  50:     assert rows[0]["subject"] == "Physics"    # from `### `, not `## `
  51: 
  52: 
  53: def test_trailing_count_is_stripped_from_grade_and_subject():
  54:     # S3 LOW-3: the trailing `(NN)` count on a heading is dropped â€” the parsed
  55:     # grade/subject are the bare names, even with the double-space the real
  56:     # manifest uses before the count.
  57:     text = (
  58:         "## Class 11  (3)\n"
  59:         "### Chemistry  (11)\n"
  60:         "- 0127 â€” States of Matter\n"
  61:     )
  62:     rows = sm.parse_deployed_sims(text)
  63:     assert rows[0]["grade"] == "Class 11"
  64:     assert rows[0]["subject"] == "Chemistry"
  65: 
  66: 
  67: def test_internal_em_dash_title_round_trips():
  68:     # S3 LOW-3: only the FIRST `â€”`/`-` separates id from title; em-dashes WITHIN
  69:     # the title are preserved verbatim (the real manifest has such titles).
  70:     text = (
  71:         "## Class 9 (1)\n"
  72:         "### Physics (1)\n"
  73:         "- 0128 â€” Change of State â€” Heating Curve\n"
  74:     )
  75:     rows = sm.parse_deployed_sims(text)
  76:     assert rows[0]["title"] == "Change of State â€” Heating Curve"
  77: 
  78: 
  79: def test_leading_italics_and_blank_lines_ignored():
  80:     # S3 LOW-3: non-data lines (the leading `_..._` header, blank lines, stray
  81:     # prose) produce no rows â€” only `- <id> â€” <title>` bullets do.
  82:     text = (
  83:         "_482 deployed sims_\n"
  84:         "\n"
  85:         "Some intro prose that is not a bullet.\n"
  86:         "## Class 9 (1)\n"
  87:         "\n"
  88:         "### Physics (1)\n"
  89:         "- 0001 â€” Newton's Cradle\n"
  90:         "\n"
  91:     )
  92:     rows = sm.parse_deployed_sims(text)
  93:     assert len(rows) == 1
  94:     assert rows[0]["id"] == "0001"
  95: 
  96: 
  97: def test_over_length_ids_are_dropped_not_misparsed():
  98:     # S3 LOW-2 (flip side): _ITEM only matches \d{3,4}, so a 5+-digit bullet id is
  99:     # dropped entirely (no row) rather than emitting a malformed URL. Lock this so
 100:     # a future _ITEM widening surfaces the change rather than silently vanishing.
 101:     text = (
 102:         "## Class 9 (1)\n"
 103:         "### Physics (1)\n"
 104:         "- 12345 â€” Five Digit Id\n"
 105:         "- 0001 â€” Valid Id\n"
 106:     )
 107:     rows = sm.parse_deployed_sims(text)
 108:     assert [r["id"] for r in rows] == ["0001"]
 109: 
 110: 
 111: def test_subject_resets_on_new_grade():
 112:     # A new ## grade heading must clear the carried subject: an item that appears
 113:     # under a grade before any ### subject heading must NOT inherit the previous
 114:     # grade's last subject (cross-grade subject bleed).
 115:     text = (
 116:         "## Class 9  (1)\n"
 117:         "### Biology (1)\n"
 118:         "- 0466 â€” Osmosis & Plasmolysis Lab\n"
 119:         "## Class 10  (1)\n"
 120:         "- 0999 â€” Ungrouped sim under a fresh grade\n"
 121:     )
 122:     rows = sm.parse_deployed_sims(text)
 123:     bled = [r for r in rows if r["id"] == "0999"][0]
 124:     assert bled["grade"] == "Class 10"
 125:     assert bled["subject"] is None

 succeeded in 4147ms:

C:\SandBox\claude_box\pratyaksh-May-deploy\deployed-sims-by-grade.md:3:## Class 9  (57)
C:\SandBox\claude_box\pratyaksh-May-deploy\deployed-sims-by-grade.md:70:## Class 10  (62)
C:\SandBox\claude_box\pratyaksh-May-deploy\deployed-sims-by-grade.md:142:## Class 11  (151)
C:\SandBox\claude_box\pratyaksh-May-deploy\deployed-sims-by-grade.md:303:## Class 12  (212)



 succeeded in 4374ms:
482

 succeeded in 4439ms:
   1: """pratyaksh-May-deploy adapter â€” simulations. READ-ONLY, never writes."""
   2: from __future__ import annotations
   3: 
   4: from typing import Iterator
   5: 
   6: from .. import config
   7: from .base import Adapter, Artifact
   8: 
   9: 
  10: class SimsAdapter(Adapter):
  11:     name = "sims"
  12:     label = "Simulations (Pratyaksh)"
  13: 
  14:     def available(self) -> bool:
  15:         return config.SIMS_ROOT.exists()
  16: 
  17:     def _sims(self):
  18:         out = []
  19:         for p in config.SIMS_ROOT.rglob("*.html"):
  20:             if "sims" in {part.lower() for part in p.parts}:
  21:                 out.append(p)
  22:         return out
  23: 
  24:     def summary(self) -> dict:
  25:         return {"sims": len(self._sims())}
  26: 
  27:     def artifacts(self) -> Iterator[Artifact]:
  28:         root = config.SIMS_ROOT
  29:         for p in self._sims():
  30:             rel = p.relative_to(root)
  31:             parts = rel.parts
  32:             subject = grade = None
  33:             lowered = [x.lower() for x in parts]
  34:             if "sims" in lowered:
  35:                 after = parts[lowered.index("sims") + 1:]
  36:                 if len(after) >= 1:
  37:                     subject = after[0]
  38:                 if len(after) >= 2:
  39:                     grade = after[1]
  40:             yield Artifact(
  41:                 uid=f"sims:{rel.as_posix()}", source=self.name, kind="sim",
  42:                 title=p.stem, subject=subject, unit=grade, path=str(p),
  43:                 meta={"grade": grade},
  44:             )

codex
The deployed sims count is verified from the source manifest structure: 482 bullet rows and class headings summing 57+62+151+212. The old catalog adapter still produces SIM subjects for the global catalog, but the Sims screen does not rely on those facets.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/review/precommit.py' | ForEach-Object { "'$i++; if ($i -ge 181 -and $i -le 340) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/governance/store.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 180) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/review/codex_dispatch.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 170) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/review/precommit.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 180) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 4166ms:
   1: """Minimal vendored Codex subprocess wrapper for the pre-commit review.
   2: 
   3: Adapted from claude-booklet-proofer/scripts/codex_dispatch.py. Only the bits the
   4: pre-commit hook needs: a single `dispatch_codex(prompt, *, schema=...)` call that
   5: shells `codex exec`, reads the structured final message from a temp JSON file,
   6: and retries on malformed JSON. The exe is resolved lazily so this module imports
   7: cleanly even when `codex` is not on PATH (the advisory hook then warns and
   8: allows the commit â€” it does NOT wedge â€” per runbook D5).
   9: """
  10: from __future__ import annotations
  11: 
  12: import json
  13: import os
  14: import shutil
  15: import subprocess
  16: import sys
  17: import tempfile
  18: import time
  19: from dataclasses import dataclass
  20: from pathlib import Path
  21: from typing import Any
  22: 
  23: 
  24: class CodexError(RuntimeError):
  25:     pass
  26: 
  27: 
  28: @dataclass
  29: class CodexResult:
  30:     parsed: dict[str, Any]
  31:     raw: str
  32:     elapsed_s: float
  33:     attempts: int
  34: 
  35: 
  36: def _resolve_codex_exe() -> str:
  37:     exe = os.environ.get("CODEX_BIN") or shutil.which("codex")
  38:     if not exe:
  39:         raise CodexError(
  40:             "Could not locate `codex` on PATH. Install Codex CLI "
  41:             "(`npm i -g @openai/codex`) or set the CODEX_BIN environment variable."
  42:         )
  43:     return exe
  44: 
  45: 
  46: def _strip_fences(raw: str) -> str:
  47:     s = raw.strip()
  48:     if s.startswith("```"):
  49:         lines = s.splitlines()
  50:         if lines and lines[0].startswith("```"):
  51:             lines = lines[1:]
  52:         if lines and lines[-1].strip() == "```":
  53:             lines = lines[:-1]
  54:         s = "\n".join(lines).strip()
  55:     return s
  56: 
  57: 
  58: def dispatch_codex(
  59:     prompt: str,
  60:     *,
  61:     schema: dict | None = None,
  62:     timeout_s: int = 90,
  63:     max_attempts: int = 2,
  64: ) -> CodexResult:
  65:     """Invoke `codex exec` (read-only sandbox) and return the parsed JSON.
  66: 
  67:     The prompt is passed on stdin to avoid Windows shell-quoting issues. When a
  68:     `schema` dict is given it is written to a temp file and passed via
  69:     --output-schema. Raises CodexError on non-zero exit, empty output, or JSON
  70:     parse failure after `max_attempts`.
  71:     """
  72:     exe = _resolve_codex_exe()
  73:     schema_path: Path | None = None
  74:     if schema is not None:
  75:         sfd, sname = tempfile.mkstemp(suffix=".schema.json", prefix="codex_sch_")
  76:         os.close(sfd)
  77:         schema_path = Path(sname)
  78:         schema_path.write_text(json.dumps(schema), encoding="utf-8")
  79: 
  80:     last_error: Exception | None = None
  81:     raw_text = ""
  82:     t0 = time.monotonic()
  83:     attempt = 0
  84:     try:
  85:         while attempt < max_attempts:
  86:             attempt += 1
  87:             ofd, oname = tempfile.mkstemp(suffix=".json", prefix="codex_out_")
  88:             os.close(ofd)
  89:             out_path = Path(oname)
  90:             try:
  91:                 args = [
  92:                     exe, "exec", "--ephemeral", "--skip-git-repo-check",
  93:                     "--sandbox", "read-only",
  94:                     "--output-last-message", str(out_path),
  95:                     "--color", "never",
  96:                 ]
  97:                 if schema_path is not None:
  98:                     args += ["--output-schema", str(schema_path)]
  99:                 args.append("-")  # prompt on stdin
 100:                 proc = subprocess.run(
 101:                     args, input=prompt, capture_output=True, text=True,
 102:                     timeout=timeout_s, encoding="utf-8",
 103:                 )
 104:                 if proc.returncode != 0:
 105:                     raise CodexError(
 106:                         f"codex exited {proc.returncode}\nstderr tail:\n"
 107:                         f"{(proc.stderr or '')[-2000:]}"
 108:                     )
 109:                 raw_text = (out_path.read_text(encoding="utf-8").strip()
 110:                             if out_path.exists() else "")
 111:                 if not raw_text:
 112:                     raise CodexError("codex produced empty output-last-message")
 113:                 parsed = json.loads(_strip_fences(raw_text))
 114:                 return CodexResult(parsed=parsed, raw=raw_text,
 115:                                    elapsed_s=time.monotonic() - t0,
 116:                                    attempts=attempt)
 117:             except (json.JSONDecodeError, CodexError) as e:
 118:                 last_error = e
 119:                 print(f"[codex-precommit] attempt={attempt} failed: {e}",
 120:                       file=sys.stderr)
 121:                 if attempt < max_attempts:
 122:                     time.sleep(2)
 123:             finally:
 124:                 try:
 125:                     out_path.unlink()
 126:                 except FileNotFoundError:
 127:                     pass
 128:     finally:
 129:         if schema_path is not None:
 130:             try:
 131:                 schema_path.unlink()
 132:             except FileNotFoundError:
 133:                 pass
 134: 
 135:     raise CodexError(
 136:         f"codex dispatch failed after {attempt} attempts "
 137:         f"({time.monotonic() - t0:.1f}s). Last error: {last_error}"
 138:     )

 succeeded in 4355ms:
 181: 
 182: # -- verdict helpers -----------------------------------------------------
 183: def _emit(fn) -> None:
 184:     """Run a best-effort side-effect (printing / logging). Cosmetics must NEVER
 185:     change a verdict: once a block is decided it returns 1 even if its banner
 186:     fails to print. Swallow everything here so nothing on a decided path can be
 187:     caught by the outer never-wedge guard and silently downgrade the result."""
 188:     try:
 189:         fn()
 190:     except Exception as e:  # noqa: BLE001 - a side-effect must never flip a verdict
 191:         _warn("[codex-precommit] warning: side-effect failed:", e)
 192: 
 193: 
 194: def _criticals(findings) -> list[dict]:
 195:     # Tolerant of malformed entries (a cache or Codex payload could be junk):
 196:     # only dict findings with severity CRITICAL count.
 197:     if not isinstance(findings, list):
 198:         return []
 199:     return [f for f in findings
 200:             if isinstance(f, dict) and f.get("severity") == "CRITICAL"]
 201: 
 202: 
 203: def _print_findings(findings, header: str) -> None:
 204:     print(f"\n=== SAMAGRA pre-commit: {header} ===", file=sys.stderr)
 205:     items = findings if isinstance(findings, list) else []
 206:     for f in items:
 207:         if isinstance(f, dict):
 208:             print(f"  [{f.get('severity')}] {f.get('file')}:{f.get('line')} "
 209:                   f"{f.get('issue')}", file=sys.stderr)
 210:         else:
 211:             print(f"  [?] {f!r}", file=sys.stderr)
 212:     if not items:
 213:         print("  (no findings)", file=sys.stderr)
 214: 
 215: 
 216: def _review_once(diff: str) -> list[dict]:
 217:     result = dispatch_codex(_PROMPT.format(diff=diff), schema=FINDINGS_SCHEMA,
 218:                             timeout_s=90, max_attempts=2)
 219:     return result.parsed.get("findings") or []
 220: 
 221: 
 222: def review_staged_diff() -> int:
 223:     """Return 0 to allow the commit, 1 to block it (confirmed CRITICAL only).
 224: 
 225:     Outer never-wedge guard (D5): ANY unexpected error in the local hook logic is
 226:     advisory â€” it warns and ALLOWS the commit (returns 0). Only the deliberate
 227:     confirmed-CRITICAL path returns 1. Real enforcement lives in CI.
 228:     """
 229:     try:
 230:         return _review_staged_diff_inner()
 231:     except Exception as e:  # noqa: BLE001 - the local hook must never wedge a commit
 232:         _warn("\n=== SAMAGRA pre-commit: review error (advisory) ===")
 233:         _warn("  unexpected error in the local hook:", e)
 234:         _warn("  Commit ALLOWED locally â€” enforcement is in CI / branch protection.")
 235:         return 0
 236: 
 237: 
 238: def _review_staged_diff_inner() -> int:
 239:     diff = get_staged_diff()
 240:     if not diff.strip():
 241:         return 0  # nothing staged -> nothing to review
 242: 
 243:     dhash = _diff_hash(diff)
 244: 
 245:     # Audited break-glass: allow + log, overriding even a confirmed-CRITICAL.
 246:     reason = os.environ.get("SAMAGRA_REVIEW_BREAKGLASS")
 247:     if reason:
 248:         _emit(lambda: _audit_breakglass(dhash, reason))
 249:         _emit(lambda: print(
 250:             f"\n=== SAMAGRA pre-commit: BREAK-GLASS (audited) ===\n"
 251:             f"  reason: {_sanitize_reason(reason)}\n"
 252:             f"  logged to state/review/breakglass.log", file=sys.stderr))
 253:         return 0
 254: 
 255:     # Diff-hash cache: a previously-confirmed verdict is deterministic. A cached
 256:     # block must return 1 regardless of how malformed its stored findings are, so
 257:     # all emission is best-effort and the return is decided first.
 258:     cache = _load_cache()
 259:     cached = cache.get(dhash)
 260:     if isinstance(cached, dict):
 261:         if cached.get("verdict") == "block":
 262:             _emit(lambda: _print_findings(cached.get("findings", []),
 263:                                           "COMMIT BLOCKED (cached confirmed-CRITICAL)"))
 264:             _emit(_print_breakglass_help)
 265:             return 1
 266:         return 0
 267: 
 268:     # Cache miss -> run the review. A Codex that cannot run is ADVISORY (D5):
 269:     # warn and allow; do NOT cache a transient failure, do NOT wedge.
 270:     try:
 271:         findings = _review_once(diff)
 272:     except Exception as e:  # noqa: BLE001 - CodexError or any failure is advisory
 273:         _warn("\n=== SAMAGRA pre-commit: review skipped (advisory) ===")
 274:         _warn("  Codex could not run:", e)
 275:         _warn("  Commit ALLOWED locally â€” enforcement is in CI / branch protection.")
 276:         _warn("  (Restore `codex` on PATH or set CODEX_BIN to re-enable the local gate.)")
 277:         return 0
 278: 
 279:     crits = _criticals(findings)
 280:     if not crits:
 281:         if findings:
 282:             _emit(lambda: _print_findings(findings, "advisory findings (non-blocking)"))
 283:         _remember(cache, dhash, {"verdict": "pass", "ts": _now()})
 284:         return 0
 285: 
 286:     # CRITICAL in pass 1 -> require a confirming second pass (the "confirmed" in
 287:     # confirmed-CRITICAL). If confirm errors or disagrees, treat as advisory.
 288:     try:
 289:         confirm = _review_once(diff)
 290:     except Exception as e:  # noqa: BLE001 - confirm failure -> advisory, not block
 291:         _emit(lambda: _print_findings(crits, "UNCONFIRMED CRITICAL (confirm pass "
 292:                                              "errored) â€” allowed"))
 293:         _warn("  confirm pass could not run:", e)
 294:         return 0
 295: 
 296:     if _criticals(confirm):
 297:         # Block is DECIDED here. Every statement below must be non-throwing so the
 298:         # return value can't be downgraded. The dedup compares findings via `in`
 299:         # (which calls __eq__), and findings may be pathological dict subclasses
 300:         # with a raising __eq__/__hash__ â€” so guard it and fall back to the pass-1
 301:         # criticals on any failure. (Prints/cache below are already _emit/best-effort.)
 302:         try:
 303:             confirmed = crits + [c for c in _criticals(confirm) if c not in crits]
 304:         except Exception:  # noqa: BLE001 - a pathological finding must not downgrade a decided block
 305:             confirmed = crits
 306:         _emit(lambda: _print_findings(confirmed, "COMMIT BLOCKED (confirmed CRITICAL)"))
 307:         _emit(_print_breakglass_help)
 308:         _remember(cache, dhash, {"verdict": "block", "findings": confirmed,
 309:                                  "ts": _now()})
 310:         return 1
 311: 
 312:     # Confirm pass disagreed -> single-pass false positive -> advisory.
 313:     _emit(lambda: _print_findings(crits, "UNCONFIRMED CRITICAL (confirm pass "
 314:                                          "disagreed) â€” allowed"))
 315:     _remember(cache, dhash, {"verdict": "pass", "ts": _now()})
 316:     return 0
 317: 
 318: 
 319: def _print_breakglass_help() -> None:
 320:     print("  Fix the issue and re-commit. Emergency override (audited):",
 321:           file=sys.stderr)
 322:     print('    SAMAGRA_REVIEW_BREAKGLASS="<reason>" git commit ...',
 323:           file=sys.stderr)
 324:     print("  Inspect what would be reviewed: git diff --cached --unified=3",
 325:           file=sys.stderr)
 326: 
 327: 
 328: def main() -> None:
 329:     sys.exit(review_staged_diff())
 330: 
 331: 
 332: if __name__ == "__main__":
 333:     main()

 succeeded in 4464ms:
   1: """Governance store â€” assignments, events ledger, and board-review overlay.
   2: 
   3: Runbook D6: governance state is DURABLE and lives in its OWN database file
   4: (`config.GOVERNANCE_DB`), SEPARATE from the rebuildable catalog
   5: (`config.DATA_DB`). The catalog may be deleted and rebuilt at will; this DB must
   6: NOT be â€” it is the irreplaceable decision ledger (every board approve/reject is
   7: one immutable row). The store carries a `schema_version` (PRAGMA user_version),
   8: an additive migration hook, and a file-consistent `backup()`.
   9: 
  10: Timestamps are UTC ISO 'YYYY-MM-DDTHH:MM:SSZ', matching state._now() /
  11: catalog._now(). Per D11 the ledger stays metadata-free: verdict + free-text
  12: rationale only, no enumerated reason columns.
  13: """
  14: from __future__ import annotations
  15: 
  16: import sqlite3
  17: import time
  18: from pathlib import Path
  19: 
  20: from .. import config
  21: 
  22: # Baseline schema version. Bump when adding a migration below; never edit a
  23: # migration that has already shipped.
  24: SCHEMA_VERSION = 1
  25: 
  26: DDL = """
  27: CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, agent TEXT NOT NULL, outbox_path TEXT NOT NULL, pipeline TEXT, seed_ref TEXT, artifact_ref TEXT, expected_output TEXT, review_by TEXT, status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  28: CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor TEXT NOT NULL, verb TEXT NOT NULL, assignment_id TEXT, subsystem TEXT, subsystem_ref TEXT, note TEXT);
  29: CREATE TABLE IF NOT EXISTS review_overlay (id INTEGER PRIMARY KEY AUTOINCREMENT, subsystem TEXT NOT NULL, subsystem_ref TEXT NOT NULL, artifact_uid TEXT, reviewer TEXT NOT NULL, verdict TEXT NOT NULL, rationale TEXT, ts TEXT NOT NULL);
  30: """
  31: 
  32: # Additive migrations BEYOND the v1 baseline DDL above. Map target_version -> SQL
  33: # script. Empty today â€” the hook is ready to grow (e.g. {2: "ALTER TABLE ..."}).
  34: # `init_tables` applies every migration whose version exceeds the DB's current
  35: # user_version, then stamps SCHEMA_VERSION.
  36: _MIGRATIONS: dict[int, str] = {}
  37: 
  38: ASSIGNMENT_STATUS = {"queued", "running", "in-review", "approved", "changes"}
  39: REVIEW_VERDICT = {"approved", "changes"}
  40: 
  41: 
  42: def _now() -> str:
  43:     return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
  44: 
  45: 
  46: def connect() -> sqlite3.Connection:
  47:     """Open the DURABLE governance DB (`config.GOVERNANCE_DB`).
  48: 
  49:     Deliberately NOT `config.DATA_DB`: the catalog is rebuildable, this is not
  50:     (runbook D6). Resolved at call time so tests can repoint it.
  51:     """
  52:     config.GOVERNANCE_DB.parent.mkdir(parents=True, exist_ok=True)
  53:     con = sqlite3.connect(config.GOVERNANCE_DB)
  54:     con.row_factory = sqlite3.Row
  55:     return con
  56: 
  57: 
  58: def init_tables(conn: sqlite3.Connection) -> None:
  59:     """Create baseline tables, apply pending migrations, stamp schema_version.
  60: 
  61:     Idempotent: safe to call on every connection (used by the API endpoint).
  62:     """
  63:     conn.executescript(DDL)
  64:     _apply_migrations(conn)
  65:     conn.commit()
  66: 
  67: 
  68: def _apply_migrations(conn: sqlite3.Connection) -> None:
  69:     cur = conn.execute("PRAGMA user_version").fetchone()[0]
  70:     for version in sorted(_MIGRATIONS):
  71:         if version > cur:
  72:             conn.executescript(_MIGRATIONS[version])
  73:             cur = version
  74:     cur = max(cur, SCHEMA_VERSION)
  75:     # PRAGMA user_version does not accept bound params; cur is an int we control.
  76:     conn.execute(f"PRAGMA user_version = {int(cur)}")
  77: 
  78: 
  79: def backup(dest) -> Path:
  80:     """Make a consistent copy of the governance DB to `dest` (sqlite backup API).
  81: 
  82:     Use this before any risky migration or as a durable governance snapshot â€”
  83:     NEVER 'reset' governance state by deleting the DB (D6).
  84:     """
  85:     dest = Path(dest)
  86:     dest.parent.mkdir(parents=True, exist_ok=True)
  87:     src = connect()
  88:     try:
  89:         out = sqlite3.connect(dest)
  90:         try:
  91:             src.backup(out)
  92:         finally:
  93:             out.close()
  94:     finally:
  95:         src.close()
  96:     return dest
  97: 
  98: 
  99: def add_assignment(conn, *, id, agent, outbox_path, pipeline=None,
 100:                    seed_ref=None, artifact_ref=None, expected_output=None,
 101:                    review_by=None) -> None:
 102:     now = _now()
 103:     conn.execute(
 104:         "INSERT INTO assignments (id, agent, outbox_path, pipeline, seed_ref, "
 105:         "artifact_ref, expected_output, review_by, status, created_at, updated_at) "
 106:         "VALUES (?,?,?,?,?,?,?,?, 'queued', ?, ?)",
 107:         (id, agent, outbox_path, pipeline, seed_ref, artifact_ref,
 108:          expected_output, review_by, now, now),
 109:     )
 110:     conn.commit()
 111: 
 112: 
 113: def set_assignment_status(conn, assignment_id, status) -> None:
 114:     if status not in ASSIGNMENT_STATUS:
 115:         raise ValueError(f"invalid assignment status {status!r}")
 116:     now = _now()
 117:     cur = conn.execute(
 118:         "UPDATE assignments SET status=?, updated_at=? WHERE id=?",
 119:         (status, now, assignment_id),
 120:     )
 121:     # Don't write a status event for an assignment that does not exist â€” this is
 122:     # the durable audit ledger; an orphan event is false history.
 123:     if cur.rowcount != 1:
 124:         conn.rollback()
 125:         raise ValueError(f"unknown assignment {assignment_id!r}")
 126:     append_event(conn, actor="system", verb=f"status:{status}",
 127:                  assignment_id=assignment_id)
 128:     conn.commit()
 129: 
 130: 
 131: def append_event(conn, *, actor, verb, assignment_id=None, subsystem=None,
 132:                  subsystem_ref=None, note=None) -> None:
 133:     conn.execute(
 134:         "INSERT INTO events (ts, actor, verb, assignment_id, subsystem, "
 135:         "subsystem_ref, note) VALUES (?,?,?,?,?,?,?)",
 136:         (_now(), actor, verb, assignment_id, subsystem, subsystem_ref, note),
 137:     )
 138:     conn.commit()
 139: 
 140: 
 141: def add_review(conn, *, subsystem, subsystem_ref, reviewer, verdict,
 142:                artifact_uid=None, rationale=None) -> None:
 143:     if verdict not in REVIEW_VERDICT:
 144:         raise ValueError(f"invalid verdict {verdict!r}")
 145:     conn.execute(
 146:         "INSERT INTO review_overlay (subsystem, subsystem_ref, artifact_uid, "
 147:         "reviewer, verdict, rationale, ts) VALUES (?,?,?,?,?,?,?)",
 148:         (subsystem, subsystem_ref, artifact_uid, reviewer, verdict,
 149:          rationale, _now()),
 150:     )
 151:     conn.commit()
 152: 
 153: 
 154: def list_assignments(conn) -> list[dict]:
 155:     return [dict(r) for r in conn.execute(
 156:         "SELECT * FROM assignments ORDER BY created_at, id")]
 157: 
 158: 
 159: def list_events(conn, limit: int = 200) -> list[dict]:
 160:     return [dict(r) for r in conn.execute(
 161:         "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,))]

 succeeded in 5240ms:
   1: """Advisory pre-commit Codex review (runbook D5 â€” NOT fail-closed).
   2: 
   3: Logic: get the staged diff, ask Codex to review it against a findings schema, and
   4: BLOCK the commit (exit 1) ONLY when a CRITICAL finding is *confirmed* â€” a second
   5: Codex pass over the same diff independently agrees. Everything else allows
   6: (exit 0). The verdict is cached by staged-diff hash so repeated commit attempts
   7: of the identical diff are deterministic and do not re-prompt Codex.
   8: 
   9: D5 contract (supersedes the retired fail-closed / no-escape-hatch design):
  10:   * Advisory-local: a Codex that errors / times out / can't be found does NOT
  11:     wedge commits â€” it warns and allows. Real enforcement is CI / branch
  12:     protection.
  13:   * Confirmed-CRITICAL only: a lone (unconfirmed) CRITICAL is treated as
  14:     advisory, not blocking, to absorb single-pass false positives.
  15:   * Audited break-glass: SAMAGRA_REVIEW_BREAKGLASS="<reason>" allows the commit
  16:     and appends an audited line to state/review/breakglass.log.
  17:   * Empty diff -> allow without calling Codex. HIGH/MED/LOW print but never block.
  18: """
  19: from __future__ import annotations
  20: 
  21: import hashlib
  22: import json
  23: import os
  24: import subprocess
  25: import sys
  26: import time
  27: from pathlib import Path
  28: 
  29: from .. import config
  30: from .codex_dispatch import dispatch_codex
  31: 
  32: FINDINGS_SCHEMA = {
  33:     "type": "object",
  34:     "additionalProperties": False,
  35:     "required": ["findings"],
  36:     "properties": {
  37:         "findings": {
  38:             "type": "array",
  39:             "items": {
  40:                 "type": "object",
  41:                 "additionalProperties": False,
  42:                 "required": ["severity", "file", "line", "issue"],
  43:                 "properties": {
  44:                     "severity": {"enum": ["CRITICAL", "HIGH", "MED", "LOW"]},
  45:                     "file": {"type": "string"},
  46:                     "line": {"type": "integer"},
  47:                     "issue": {"type": "string"},
  48:                 },
  49:             },
  50:         }
  51:     },
  52: }
  53: 
  54: _PROMPT = """You are SAMAGRA's pre-commit code reviewer (Chief Architect / Codex).
  55: Review the following STAGED git diff. Report only real defects in the changed
  56: lines. Use severity CRITICAL only for: secret/credential leaks, destructive
  57: shell/SQL (rm -rf, DROP/DELETE without WHERE), command/SQL injection, or code
  58: that would corrupt data or break the build. Everything else is HIGH/MED/LOW.
  59: Return JSON matching the schema: {{"findings": [{{"severity","file","line","issue"}}]}}.
  60: Empty findings means the diff is safe to commit.
  61: 
  62: === STAGED DIFF ===
  63: {diff}
  64: === END DIFF ===
  65: """
  66: 
  67: _CACHE_CAP = 256  # keep the most recent N verdicts; prune older on write.
  68: 
  69: 
  70: # -- git + hashing -------------------------------------------------------
  71: def get_staged_diff() -> str:
  72:     proc = subprocess.run(
  73:         ["git", "diff", "--cached", "--unified=3"],
  74:         capture_output=True, text=True, encoding="utf-8",
  75:     )
  76:     return proc.stdout or ""
  77: 
  78: 
  79: def _diff_hash(diff: str) -> str:
  80:     return hashlib.sha256(diff.encode("utf-8")).hexdigest()
  81: 
  82: 
  83: def _safe_str(obj) -> str:
  84:     """str(obj) that can never raise â€” even a pathological __str__/__repr__."""
  85:     try:
  86:         return str(obj)
  87:     except Exception:  # noqa: BLE001
  88:         try:
  89:             return repr(obj)
  90:         except Exception:  # noqa: BLE001
  91:             return "<unprintable>"
  92: 
  93: 
  94: def _warn(*parts) -> None:
  95:     """Emit a diagnostic that can NEVER raise. Stringification of every part
  96:     happens INSIDE the guard (via _safe_str), so neither a broken stderr nor a
  97:     pathological Exception.__str__/__repr__ on a passed object can escape and let
  98:     the outer guard downgrade a decided verdict. Pass exception objects as
  99:     separate args (`_warn("failed:", e)`), never f-stringed before the call."""
 100:     try:
 101:         print(" ".join(_safe_str(p) for p in parts), file=sys.stderr)
 102:     except Exception:  # noqa: BLE001 - a diagnostic must never affect control flow
 103:         pass
 104: 
 105: 
 106: # -- durable side files (state/ is gitignored) ---------------------------
 107: def _review_dir() -> Path:
 108:     d = config.STATE_DIR / "review"
 109:     d.mkdir(parents=True, exist_ok=True)
 110:     return d
 111: 
 112: 
 113: def _cache_path() -> Path:
 114:     return _review_dir() / "diff_cache.json"
 115: 
 116: 
 117: def _load_cache() -> dict:
 118:     # A corrupt OR wrong-shaped cache must never wedge a commit: return {} unless
 119:     # it is a dict whose entries are themselves dicts (verdict records). A valid
 120:     # but non-dict JSON value (e.g. `[]`) would otherwise blow up at `.get()`.
 121:     p = _cache_path()
 122:     if not p.exists():
 123:         return {}
 124:     try:
 125:         data = json.loads(p.read_text(encoding="utf-8"))
 126:     except Exception:  # noqa: BLE001 - unreadable/corrupt cache -> ignore it
 127:         return {}
 128:     if not isinstance(data, dict):
 129:         return {}
 130:     return {k: v for k, v in data.items() if isinstance(v, dict)}
 131: 
 132: 
 133: def _save_cache(cache: dict) -> None:
 134:     # FULLY best-effort: persisting the cache is an optimization, never a gate.
 135:     # Nothing here â€” pruning, the sort key, JSON serialization, or IO â€” may raise,
 136:     # because a confirmed-CRITICAL block calls this BEFORE `return 1`; an exception
 137:     # escaping here would be swallowed by the outer guard and silently downgrade
 138:     # the block to allow. The sort key is coerced with str() so a malformed entry
 139:     # (e.g. a non-string `ts`) can't poison the prune.
 140:     try:
 141:         if len(cache) > _CACHE_CAP:
 142:             keep = sorted(cache.items(),
 143:                           key=lambda kv: str(kv[1].get("ts", "")))[-_CACHE_CAP:]
 144:             cache = dict(keep)
 145:         _cache_path().write_text(json.dumps(cache, indent=2), encoding="utf-8")
 146:     except Exception as e:  # noqa: BLE001 - cache persistence must never flip a verdict
 147:         _warn("[codex-precommit] warning: could not write review cache:", e)
 148: 
 149: 
 150: def _remember(cache: dict, dhash: str, entry: dict) -> None:
 151:     # Persist a verdict, best-effort. Belt-and-suspenders around _save_cache: even
 152:     # if a future _save_cache regressed and raised, the verdict (esp. a confirmed
 153:     # block returning 1) must still stand, so this can never propagate.
 154:     try:
 155:         cache[dhash] = entry
 156:         _save_cache(cache)
 157:     except Exception as e:  # noqa: BLE001 - verdict persistence is never a gate
 158:         _warn("[codex-precommit] warning: could not persist verdict:", e)
 159: 
 160: 
 161: def _now() -> str:
 162:     return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
 163: 
 164: 
 165: def _sanitize_reason(reason: str) -> str:
 166:     # Audit lines are single-line + bounded: collapse whitespace (no forged
 167:     # extra lines) and cap length (don't echo a pasted secret in full).
 168:     one_line = " ".join(str(reason).split())
 169:     return one_line[:200]
 170: 
 171: 
 172: def _audit_breakglass(diff_hash: str, reason: str) -> None:
 173:     # Best-effort: a logging failure must not wedge a break-glass commit.
 174:     line = f"{_now()}\t{diff_hash[:12]}\t{_sanitize_reason(reason)}\n"
 175:     try:
 176:         with (_review_dir() / "breakglass.log").open("a", encoding="utf-8") as fh:
 177:             fh.write(line)
 178:     except OSError as e:
 179:         _warn("[codex-precommit] warning: could not write break-glass log:", e)
 180: 

codex
Governance is mostly aligned with the “durable separate DB” claim, but I found two review-hook caveats: break-glass auditing is best-effort, and a failed `git diff --cached` is treated as an empty diff. I’ll include those as low/medium governance risks instead of overclaiming a hard wedge.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"POST|PUT|DELETE|PATCH|method:\\s*\\\"POST\\\"|useApiPost|fetch\\(\" frontend/src --glob '"'!**/*.test.ts'"' --glob '"'!**/*.test.tsx'"'" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/lectures/export.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 170) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"@app\\.post|@app\\.put|@app\\.delete|@app\\.patch|requests\\.post|state\\.set_phase|catalog\\.refresh|create_seed|create_item|notify\\.notify|write_text|open\\(|os\\.replace|executescript|commit\\(\" samagra" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "def run|write_text|mkdir|pandoc|gdocs|publish|export|GOOGLE|Docs" samagra/lectures samagra scheduler.py' in C:\SandBox\claude_box\TeachingOS
2026-06-22T16:08:57.612029Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 6.5 seconds
Output:
rg: regex parse error:
    (?:POST|PUT|DELETE|PATCH|method:\s*\)
    ^
error: unclosed group

 exited 1 in 6540ms:
rg: regex parse error:
    (?:POST|PUT|DELETE|PATCH|method:\s*\)
    ^
error: unclosed group

 succeeded in 7175ms:
   1: """Thin/thick multi-format lecture export: HTML + local DOCX + Google Docs.
   2: 
   3: PDF is intentionally omitted (browser/Word print covers it). DOCX is produced via
   4: Pandoc with the tex_math_dollars extension so `$...$` math becomes native OMML
   5: equations. Google Docs upload is creds-gated (see gdocs.py).
   6: """
   7: from __future__ import annotations
   8: 
   9: import shutil
  10: import subprocess
  11: from pathlib import Path
  12: 
  13: from .. import config
  14: from . import gdocs, render
  15: from .thin import build_thin
  16: 
  17: LABELS = {"thick": "Full lecture", "thin": "Revision sheet"}
  18: 
  19: 
  20: def _out_dir(slug: str) -> Path:
  21:     d = config.EXPORT_DIR / slug
  22:     d.mkdir(parents=True, exist_ok=True)
  23:     return d
  24: 
  25: 
  26: def _html_to_docx(html_path: Path, docx_path: Path) -> bool:
  27:     pandoc = shutil.which("pandoc")
  28:     if not pandoc:
  29:         print("  ! pandoc not on PATH â€” skipping DOCX")
  30:         return False
  31:     cmd = [pandoc, str(html_path), "-f", "html+tex_math_dollars",
  32:            "-t", "docx", "-o", str(docx_path)]
  33:     proc = subprocess.run(cmd, capture_output=True, text=True)
  34:     if proc.returncode != 0:
  35:         print(f"  ! pandoc failed: {proc.stderr.strip()[:200]}")
  36:         return False
  37:     return True
  38: 
  39: 
  40: def export_one(slug: str, variant: str) -> dict:
  41:     content = render.load_chapter(slug)
  42:     if variant == "thin":
  43:         content = build_thin(content)
  44:     label = LABELS[variant]
  45:     html = render.render_chapter_html(content, label=label)
  46: 
  47:     out = _out_dir(slug)
  48:     html_path = out / f"{slug}-{variant}.html"
  49:     html_path.write_text(html, encoding="utf-8")
  50: 
  51:     docx_path = out / f"{slug}-{variant}.docx"
  52:     have_docx = _html_to_docx(html_path, docx_path)
  53: 
  54:     gdoc = None
  55:     if have_docx:
  56:         title = f"{content.get('title', slug)} â€” {label}"
  57:         gdoc = gdocs.upload(docx_path, title)
  58: 
  59:     return {
  60:         "variant": variant,
  61:         "html": str(html_path),
  62:         "docx": str(docx_path) if have_docx else None,
  63:         "gdoc": gdoc,
  64:     }
  65: 
  66: 
  67: def run(chapter: str, variant: str = "both") -> list[dict]:
  68:     variants = ["thin", "thick"] if variant == "both" else [variant]
  69:     print(f"Exporting chapter {chapter!r}: {', '.join(variants)}")
  70:     results = []
  71:     for v in variants:
  72:         r = export_one(chapter, v)
  73:         results.append(r)
  74:         print(f"  [{v}] html  = {r['html']}")
  75:         print(f"        docx  = {r['docx']}")
  76:         print(f"        gdoc  = {r['gdoc'] or '(not configured â€” set GOOGLE_OAUTH_CLIENT)'}")
  77:     return results

2026-06-22T16:08:58.546786Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 7.4 seconds
Output:
samagra\catalog.py:30:    config.DATA_DB.parent.mkdir(parents=True, exist_ok=True)
samagra/lectures\__init__.py:1:"""Lecture rendering + multi-format export (thin/thick)."""
samagra\org.py:32:        "teachingos": {"name": "TeachingOS", "role": "Build / export automation"},
samagra\lock.py:117:    lock.parent.mkdir(parents=True, exist_ok=True)
samagra\governance\store.py:52:    config.GOVERNANCE_DB.parent.mkdir(parents=True, exist_ok=True)
samagra\governance\store.py:86:    dest.parent.mkdir(parents=True, exist_ok=True)
samagra\lectures\__init__.py:1:"""Lecture rendering + multi-format export (thin/thick)."""
samagra\notify.py:23:    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
samagra\clients\mcd_client.py:11:(owner-initiated capture in-scope; the human publish gate stays never-automated).
samagra\review\precommit.py:109:    d.mkdir(parents=True, exist_ok=True)
samagra\review\precommit.py:145:        _cache_path().write_text(json.dumps(cache, indent=2), encoding="utf-8")
samagra\state.py:21:        "phases": ["draft", "enrich", "approve", "export"],
samagra\state.py:24:                   "approve": "human", "export": "teachingos"},
samagra\state.py:28:        "phases": ["capture", "enrich", "review", "publish"],
samagra\state.py:29:        "gates": ["review", "publish"],
samagra\state.py:31:                   "review": "claude1", "publish": "human"},
samagra\state.py:47:        "phases": ["plan", "generate", "publish"],
samagra\state.py:48:        "gates": ["publish"],
samagra\state.py:49:        "owners": {"plan": "claude1", "generate": "notebooklm", "publish": "human"},
samagra\state.py:130:    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
samagra\state.py:136:        tmp.write_text(payload, encoding="utf-8")
samagra\state.py:196:    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
samagra\review\codex_dispatch.py:78:        schema_path.write_text(json.dumps(schema), encoding="utf-8")
samagra/lectures\render.py:3:Used by the portal for live previews and by the Phase C exporter as the HTML
samagra\lectures\render.py:3:Used by the portal for live previews and by the Phase C exporter as the HTML
samagra/lectures\export.py:1:"""Thin/thick multi-format lecture export: HTML + local DOCX + Google Docs.
samagra/lectures\export.py:5:equations. Google Docs upload is creds-gated (see gdocs.py).
samagra/lectures\export.py:14:from . import gdocs, render
samagra/lectures\export.py:22:    d.mkdir(parents=True, exist_ok=True)
samagra/lectures\export.py:27:    pandoc = shutil.which("pandoc")
samagra/lectures\export.py:28:    if not pandoc:
samagra/lectures\export.py:29:        print("  ! pandoc not on PATH — skipping DOCX")
samagra/lectures\export.py:31:    cmd = [pandoc, str(html_path), "-f", "html+tex_math_dollars",
samagra/lectures\export.py:35:        print(f"  ! pandoc failed: {proc.stderr.strip()[:200]}")
samagra/lectures\export.py:40:def export_one(slug: str, variant: str) -> dict:
samagra/lectures\export.py:49:    html_path.write_text(html, encoding="utf-8")
samagra/lectures\export.py:57:        gdoc = gdocs.upload(docx_path, title)
samagra/lectures\export.py:67:def run(chapter: str, variant: str = "both") -> list[dict]:
samagra/lectures\export.py:72:        r = export_one(chapter, v)
samagra/lectures\export.py:76:        print(f"        gdoc  = {r['gdoc'] or '(not configured — set GOOGLE_OAUTH_CLIENT)'}")
samagra\lectures\export.py:1:"""Thin/thick multi-format lecture export: HTML + local DOCX + Google Docs.
samagra\lectures\export.py:5:equations. Google Docs upload is creds-gated (see gdocs.py).
samagra\lectures\export.py:14:from . import gdocs, render
samagra\lectures\export.py:22:    d.mkdir(parents=True, exist_ok=True)
samagra\lectures\export.py:27:    pandoc = shutil.which("pandoc")
samagra\lectures\export.py:28:    if not pandoc:
samagra\lectures\export.py:29:        print("  ! pandoc not on PATH — skipping DOCX")
samagra\lectures\export.py:31:    cmd = [pandoc, str(html_path), "-f", "html+tex_math_dollars",
samagra\lectures\export.py:35:        print(f"  ! pandoc failed: {proc.stderr.strip()[:200]}")
samagra\lectures\export.py:40:def export_one(slug: str, variant: str) -> dict:
samagra\lectures\export.py:49:    html_path.write_text(html, encoding="utf-8")
samagra\lectures\export.py:57:        gdoc = gdocs.upload(docx_path, title)
samagra\lectures\export.py:67:def run(chapter: str, variant: str = "both") -> list[dict]:
samagra\lectures\export.py:72:        r = export_one(chapter, v)
samagra\lectures\export.py:76:        print(f"        gdoc  = {r['gdoc'] or '(not configured — set GOOGLE_OAUTH_CLIENT)'}")
samagra\__main__.py:1:"""SAMAGRA CLI: refresh | status | search | serve | tick | gate | export | unlock."""
samagra\__main__.py:93:def cmd_export(args) -> None:
samagra\__main__.py:94:    from .lectures import export as lex
samagra\__main__.py:162:    e = sub.add_parser("export", help="export a lecture (Phase C)")
samagra\__main__.py:165:    e.set_defaults(func=cmd_export)
samagra\scheduler.py:5:hard gate (pause + notify) when drafting/enriching is complete, and export any
samagra\scheduler.py:22:EXPORT_BATCH = 3  # chapters exported per tick once approved (bounded)
samagra\scheduler.py:93:    # All seeds done -> publish phase done.
samagra\scheduler.py:94:    if c["total"] and c["done"] >= c["total"] and st["phases"]["publish"]["status"] != "done":
samagra\scheduler.py:96:            state.set_phase("mycontentdev", "publish", "done",
samagra\scheduler.py:109:def _run_pending_exports(dry: bool, counts: dict, events: list) -> int:
samagra\scheduler.py:113:    if st["phases"]["export"]["status"] == "done":
samagra\scheduler.py:115:    from .lectures import export as lex
samagra\scheduler.py:125:            state.set_phase("textbook", "export", "done",
samagra\scheduler.py:126:                            artifacts=[f'{counts["total"]} chapters exported'])
samagra\scheduler.py:130:        events.append(("export", f"would export {len(batch)} chapter(s): {', '.join(batch)}"))
samagra\scheduler.py:136:            state.set_phase("textbook", "export", "failed", error=str(e))
samagra\scheduler.py:137:            events.append(("failure", f"textbook export failed for {slug}: {e}"))
samagra\scheduler.py:140:    events.append(("export", f"exported {len(batch)} chapter(s); {remaining} remaining"))
samagra\scheduler.py:142:        state.set_phase("textbook", "export", "done",
samagra\scheduler.py:143:                        artifacts=[f'{counts["total"]} chapters exported'])
samagra\scheduler.py:185:            n = _run_pending_exports(dry_run, counts, events)
samagra\scheduler.py:186:            log.append(f"exports this tick: {n}")
samagra\scheduler.py:207:    # gate before its prerequisite phases — which would let exports run from an
samagra\lectures\gdocs.py:1:"""Optional Google Docs export via the Drive API.
samagra\lectures\gdocs.py:3:Creds-gated: if GOOGLE_OAUTH_CLIENT is unset or the client-secret file is missing,
samagra\lectures\gdocs.py:4:upload() returns None and the rest of the export still produces HTML + DOCX. To
samagra\lectures\gdocs.py:5:enable, create an OAuth *Desktop* client in Google Cloud, point GOOGLE_OAUTH_CLIENT
samagra\lectures\gdocs.py:6:at its JSON, and run an export once to complete the consent flow (token cached
samagra\lectures\gdocs.py:19:    raw = os.environ.get("GOOGLE_OAUTH_CLIENT", "")
samagra\lectures\gdocs.py:50:        token.write_text(creds.to_json(), encoding="utf-8")
samagra\lectures\gdocs.py:54:    folder = os.environ.get("GOOGLE_DOCS_FOLDER_ID")
samagra/lectures\gdocs.py:1:"""Optional Google Docs export via the Drive API.
samagra/lectures\gdocs.py:3:Creds-gated: if GOOGLE_OAUTH_CLIENT is unset or the client-secret file is missing,
samagra/lectures\gdocs.py:4:upload() returns None and the rest of the export still produces HTML + DOCX. To
samagra/lectures\gdocs.py:5:enable, create an OAuth *Desktop* client in Google Cloud, point GOOGLE_OAUTH_CLIENT
samagra/lectures\gdocs.py:6:at its JSON, and run an export once to complete the consent flow (token cached
samagra/lectures\gdocs.py:19:    raw = os.environ.get("GOOGLE_OAUTH_CLIENT", "")
samagra/lectures\gdocs.py:50:        token.write_text(creds.to_json(), encoding="utf-8")
samagra/lectures\gdocs.py:54:    folder = os.environ.get("GOOGLE_DOCS_FOLDER_ID")
rg: scheduler.py: The system cannot find the file specified. (os error 2)

 exited 1 in 7421ms:
samagra\catalog.py:30:    config.DATA_DB.parent.mkdir(parents=True, exist_ok=True)
samagra/lectures\__init__.py:1:"""Lecture rendering + multi-format export (thin/thick)."""
samagra\org.py:32:        "teachingos": {"name": "TeachingOS", "role": "Build / export automation"},
samagra\lock.py:117:    lock.parent.mkdir(parents=True, exist_ok=True)
samagra\governance\store.py:52:    config.GOVERNANCE_DB.parent.mkdir(parents=True, exist_ok=True)
samagra\governance\store.py:86:    dest.parent.mkdir(parents=True, exist_ok=True)
samagra\lectures\__init__.py:1:"""Lecture rendering + multi-format export (thin/thick)."""
samagra\notify.py:23:    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
samagra\clients\mcd_client.py:11:(owner-initiated capture in-scope; the human publish gate stays never-automated).
samagra\review\precommit.py:109:    d.mkdir(parents=True, exist_ok=True)
samagra\review\precommit.py:145:        _cache_path().write_text(json.dumps(cache, indent=2), encoding="utf-8")
samagra\state.py:21:        "phases": ["draft", "enrich", "approve", "export"],
samagra\state.py:24:                   "approve": "human", "export": "teachingos"},
samagra\state.py:28:        "phases": ["capture", "enrich", "review", "publish"],
samagra\state.py:29:        "gates": ["review", "publish"],
samagra\state.py:31:                   "review": "claude1", "publish": "human"},
samagra\state.py:47:        "phases": ["plan", "generate", "publish"],
samagra\state.py:48:        "gates": ["publish"],
samagra\state.py:49:        "owners": {"plan": "claude1", "generate": "notebooklm", "publish": "human"},
samagra\state.py:130:    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
samagra\state.py:136:        tmp.write_text(payload, encoding="utf-8")
samagra\state.py:196:    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
samagra\review\codex_dispatch.py:78:        schema_path.write_text(json.dumps(schema), encoding="utf-8")
samagra/lectures\render.py:3:Used by the portal for live previews and by the Phase C exporter as the HTML
samagra\lectures\render.py:3:Used by the portal for live previews and by the Phase C exporter as the HTML
samagra/lectures\export.py:1:"""Thin/thick multi-format lecture export: HTML + local DOCX + Google Docs.
samagra/lectures\export.py:5:equations. Google Docs upload is creds-gated (see gdocs.py).
samagra/lectures\export.py:14:from . import gdocs, render
samagra/lectures\export.py:22:    d.mkdir(parents=True, exist_ok=True)
samagra/lectures\export.py:27:    pandoc = shutil.which("pandoc")
samagra/lectures\export.py:28:    if not pandoc:
samagra/lectures\export.py:29:        print("  ! pandoc not on PATH — skipping DOCX")
samagra/lectures\export.py:31:    cmd = [pandoc, str(html_path), "-f", "html+tex_math_dollars",
samagra/lectures\export.py:35:        print(f"  ! pandoc failed: {proc.stderr.strip()[:200]}")
samagra/lectures\export.py:40:def export_one(slug: str, variant: str) -> dict:
samagra/lectures\export.py:49:    html_path.write_text(html, encoding="utf-8")
samagra/lectures\export.py:57:        gdoc = gdocs.upload(docx_path, title)
samagra/lectures\export.py:67:def run(chapter: str, variant: str = "both") -> list[dict]:
samagra/lectures\export.py:72:        r = export_one(chapter, v)
samagra/lectures\export.py:76:        print(f"        gdoc  = {r['gdoc'] or '(not configured — set GOOGLE_OAUTH_CLIENT)'}")
samagra\lectures\export.py:1:"""Thin/thick multi-format lecture export: HTML + local DOCX + Google Docs.
samagra\lectures\export.py:5:equations. Google Docs upload is creds-gated (see gdocs.py).
samagra\lectures\export.py:14:from . import gdocs, render
samagra\lectures\export.py:22:    d.mkdir(parents=True, exist_ok=True)
samagra\lectures\export.py:27:    pandoc = shutil.which("pandoc")
samagra\lectures\export.py:28:    if not pandoc:
samagra\lectures\export.py:29:        print("  ! pandoc not on PATH — skipping DOCX")
samagra\lectures\export.py:31:    cmd = [pandoc, str(html_path), "-f", "html+tex_math_dollars",
samagra\lectures\export.py:35:        print(f"  ! pandoc failed: {proc.stderr.strip()[:200]}")
samagra\lectures\export.py:40:def export_one(slug: str, variant: str) -> dict:
samagra\lectures\export.py:49:    html_path.write_text(html, encoding="utf-8")
samagra\lectures\export.py:57:        gdoc = gdocs.upload(docx_path, title)
samagra\lectures\export.py:67:def run(chapter: str, variant: str = "both") -> list[dict]:
samagra\lectures\export.py:72:        r = export_one(chapter, v)
samagra\lectures\export.py:76:        print(f"        gdoc  = {r['gdoc'] or '(not configured — set GOOGLE_OAUTH_CLIENT)'}")
samagra\__main__.py:1:"""SAMAGRA CLI: refresh | status | search | serve | tick | gate | export | unlock."""
samagra\__main__.py:93:def cmd_export(args) -> None:
samagra\__main__.py:94:    from .lectures import export as lex
samagra\__main__.py:162:    e = sub.add_parser("export", help="export a lecture (Phase C)")
samagra\__main__.py:165:    e.set_defaults(func=cmd_export)
samagra\scheduler.py:5:hard gate (pause + notify) when drafting/enriching is complete, and export any
samagra\scheduler.py:22:EXPORT_BATCH = 3  # chapters exported per tick once approved (bounded)
samagra\scheduler.py:93:    # All seeds done -> publish phase done.
samagra\scheduler.py:94:    if c["total"] and c["done"] >= c["total"] and st["phases"]["publish"]["status"] != "done":
samagra\scheduler.py:96:            state.set_phase("mycontentdev", "publish", "done",
samagra\scheduler.py:109:def _run_pending_exports(dry: bool, counts: dict, events: list) -> int:
samagra\scheduler.py:113:    if st["phases"]["export"]["status"] == "done":
samagra\scheduler.py:115:    from .lectures import export as lex
samagra\scheduler.py:125:            state.set_phase("textbook", "export", "done",
samagra\scheduler.py:126:                            artifacts=[f'{counts["total"]} chapters exported'])
samagra\scheduler.py:130:        events.append(("export", f"would export {len(batch)} chapter(s): {', '.join(batch)}"))
samagra\scheduler.py:136:            state.set_phase("textbook", "export", "failed", error=str(e))
samagra\scheduler.py:137:            events.append(("failure", f"textbook export failed for {slug}: {e}"))
samagra\scheduler.py:140:    events.append(("export", f"exported {len(batch)} chapter(s); {remaining} remaining"))
samagra\scheduler.py:142:        state.set_phase("textbook", "export", "done",
samagra\scheduler.py:143:                        artifacts=[f'{counts["total"]} chapters exported'])
samagra\scheduler.py:185:            n = _run_pending_exports(dry_run, counts, events)
samagra\scheduler.py:186:            log.append(f"exports this tick: {n}")
samagra\scheduler.py:207:    # gate before its prerequisite phases — which would let exports run from an
samagra\lectures\gdocs.py:1:"""Optional Google Docs export via the Drive API.
samagra\lectures\gdocs.py:3:Creds-gated: if GOOGLE_OAUTH_CLIENT is unset or the client-secret file is missing,
samagra\lectures\gdocs.py:4:upload() returns None and the rest of the export still produces HTML + DOCX. To
samagra\lectures\gdocs.py:5:enable, create an OAuth *Desktop* client in Google Cloud, point GOOGLE_OAUTH_CLIENT
samagra\lectures\gdocs.py:6:at its JSON, and run an export once to complete the consent flow (token cached
samagra\lectures\gdocs.py:19:    raw = os.environ.get("GOOGLE_OAUTH_CLIENT", "")
samagra\lectures\gdocs.py:50:        token.write_text(creds.to_json(), encoding="utf-8")
samagra\lectures\gdocs.py:54:    folder = os.environ.get("GOOGLE_DOCS_FOLDER_ID")
samagra/lectures\gdocs.py:1:"""Optional Google Docs export via the Drive API.
samagra/lectures\gdocs.py:3:Creds-gated: if GOOGLE_OAUTH_CLIENT is unset or the client-secret file is missing,
samagra/lectures\gdocs.py:4:upload() returns None and the rest of the export still produces HTML + DOCX. To
samagra/lectures\gdocs.py:5:enable, create an OAuth *Desktop* client in Google Cloud, point GOOGLE_OAUTH_CLIENT
samagra/lectures\gdocs.py:6:at its JSON, and run an export once to complete the consent flow (token cached
samagra/lectures\gdocs.py:19:    raw = os.environ.get("GOOGLE_OAUTH_CLIENT", "")
samagra/lectures\gdocs.py:50:        token.write_text(creds.to_json(), encoding="utf-8")
samagra/lectures\gdocs.py:54:    folder = os.environ.get("GOOGLE_DOCS_FOLDER_ID")
rg: scheduler.py: The system cannot find the file specified. (os error 2)

 succeeded in 8262ms:
samagra\catalog.py:32:    con.executescript(SCHEMA)
samagra\catalog.py:136:        con.commit()
samagra\notify.py:25:    with open(config.STATE_DIR / "notifications.log", "a", encoding="utf-8") as f:
samagra\notify.py:38:        r = requests.post(
samagra\lock.py:4:``os.open(O_CREAT | O_EXCL)``, which fails if the file already exists, and stamp
samagra\lock.py:98:        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
samagra\scheduler.py:54:            state.set_phase("textbook", "draft", "done",
samagra\scheduler.py:58:            state.set_phase("textbook", "enrich", "done",
samagra\scheduler.py:65:            state.set_phase("textbook", "approve", "awaiting_gate")
samagra\scheduler.py:96:            state.set_phase("mycontentdev", "publish", "done",
samagra\scheduler.py:102:            state.set_phase("mycontentdev", "review", "awaiting_gate")
samagra\scheduler.py:125:            state.set_phase("textbook", "export", "done",
samagra\scheduler.py:136:            state.set_phase("textbook", "export", "failed", error=str(e))
samagra\scheduler.py:142:        state.set_phase("textbook", "export", "done",
samagra\scheduler.py:162:                notify.notify("failure", msg)
samagra\scheduler.py:170:            totals = {} if dry_run else catalog.refresh(verbose=False)
samagra\scheduler.py:171:            # H3: catalog.refresh() maps a FAILED source to None (last-known-good
samagra\scheduler.py:193:            notify.notify(ev, msg)
samagra\scheduler.py:220:        state.set_phase(pipeline, target, "done", approved_at=_stamp())
samagra\scheduler.py:221:        notify.notify("gate-approved", f'{pipeline}: "{target}" approved.')
samagra\scheduler.py:223:        state.set_phase(pipeline, target, "blocked")
samagra\scheduler.py:224:        notify.notify("gate-rejected", f'{pipeline}: "{target}" rejected.')
samagra\api\app.py:118:@app.post("/api/refresh")
samagra\api\app.py:120:    totals = catalog.refresh(verbose=False)
samagra\api\app.py:124:@app.post("/api/tick")
samagra\api\app.py:129:@app.post("/api/gate/{pipeline}/{decision}")
samagra\api\app.py:174:@app.post("/api/munshi/capture")
samagra\api\app.py:200:        created = client.create_item(kind, fields)
samagra\api\app.py:210:@app.post("/api/mcd/seeds")
samagra\api\app.py:211:def api_mcd_create_seed(payload: dict):
samagra\api\app.py:227:        created = client.create_seed(fields)
samagra\__main__.py:12:    totals = catalog.refresh(verbose=True)
samagra\__main__.py:79:    res = notify.notify("test", "SAMAGRA notification test — channels online.")
samagra\review\codex_dispatch.py:78:        schema_path.write_text(json.dumps(schema), encoding="utf-8")
samagra\clients\mcd_client.py:8:available) plus the owner-initiated capture write create_seed (POST /api/seeds,
samagra\clients\mcd_client.py:49:        r = requests.post(
samagra\clients\mcd_client.py:58:    def create_seed(self, fields: dict) -> dict:
samagra\clients\mcd_client.py:62:        r = requests.post(
samagra\governance\store.py:63:    conn.executescript(DDL)
samagra\governance\store.py:65:    conn.commit()
samagra\governance\store.py:72:            conn.executescript(_MIGRATIONS[version])
samagra\governance\store.py:110:    conn.commit()
samagra\governance\store.py:128:    conn.commit()
samagra\governance\store.py:138:    conn.commit()
samagra\governance\store.py:151:    conn.commit()
samagra\review\precommit.py:145:        _cache_path().write_text(json.dumps(cache, indent=2), encoding="utf-8")
samagra\review\precommit.py:176:        with (_review_dir() / "breakglass.log").open("a", encoding="utf-8") as fh:
samagra\clients\munshi_client.py:42:    def create_item(self, kind: str, fields: dict) -> dict:
samagra\clients\munshi_client.py:46:        r = requests.post(
samagra\state.py:113:    The read is unlocked: ``os.replace`` makes every write land atomically, so a
samagra\state.py:125:    ``updated``, writes to a sibling ``*.tmp`` file, then ``os.replace``s it into
samagra\state.py:136:        tmp.write_text(payload, encoding="utf-8")
samagra\state.py:137:        os.replace(tmp, path)
samagra\state.py:156:    Writes the JSON to a sibling ``*.tmp`` file then ``os.replace``s it into
samagra\state.py:197:    with open(config.STATE_DIR / "tracker.txt", "a", encoding="utf-8") as f:
samagra\clients\__init__.py:4:Phase 1. The single subsystem write path (McdClient.create_seed) is DEFERRED to
samagra\lectures\export.py:49:    html_path.write_text(html, encoding="utf-8")
samagra\lectures\gdocs.py:50:        token.write_text(creds.to_json(), encoding="utf-8")

codex
The extra POSTs are not harmless: `/api/refresh` rewrites `samagra.db`, `/api/tick` refreshes catalog, mutates pipeline state, can export local lecture artifacts and optionally upload Google Docs after approval, and `/api/gate/*` mutates gate state. Those are local/control-plane writes, not the two capture writes.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n 'POST|PUT|DELETE|PATCH|method:\\s*\"POST\"|useApiPost|fetch\\(' frontend/src --glob '"'!**/*.test.ts'"' --glob '"'!**/*.test.tsx'"'" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/lectures/gdocs.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 90) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/notify.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 90) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/clients/__init__.py' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 6624ms:
frontend/src\hooks\useApiPost.ts:3:export function useApiPost<T = unknown>() {
frontend/src\hooks\useApiPost.ts:8:      const res = await fetch(path, {
frontend/src\hooks\useApiPost.ts:9:        method: "POST",
frontend/src\types\contracts.ts:114:// ── Capture / sims / facets (control-plane: POST capture + read-only sims/facets) ──
frontend/src\apps\Munshi\index.tsx:3:import { useApiPost } from "../../hooks/useApiPost";
frontend/src\apps\Munshi\index.tsx:42:  const { post, loading: posting, error: postError } = useApiPost<{ ok: boolean }>();
frontend/src\hooks\useApi.ts:31:        const res = await fetch(path, { headers: { accept: "application/json" } });
frontend/src\lib\terminal\dispatch.ts:139:function cmdNeofetch(): TermLine[] {
frontend/src\lib\terminal\dispatch.ts:252:      return { lines: cmdNeofetch(), effects: [] };
frontend/src\apps\Mycontentdev\index.tsx:3:import { useApiPost } from "../../hooks/useApiPost";
frontend/src\apps\Mycontentdev\index.tsx:35:  const { post, loading: posting, error: postError } = useApiPost<{ ok: boolean }>();
frontend/src\apps\Snake\index.tsx:12:// INPUT or TEXTAREA, so arrow/WASD/Space keypresses are NOT hijacked away from a
frontend/src\apps\Snake\index.tsx:148: * - FALSE if a text field is focused (`activeElement` is INPUT/TEXTAREA) — so a
frontend/src\apps\Snake\index.tsx:157:  if (tag === "INPUT" || tag === "TEXTAREA") return false;

 succeeded in 6927ms:
   1: """Optional Google Docs export via the Drive API.
   2: 
   3: Creds-gated: if GOOGLE_OAUTH_CLIENT is unset or the client-secret file is missing,
   4: upload() returns None and the rest of the export still produces HTML + DOCX. To
   5: enable, create an OAuth *Desktop* client in Google Cloud, point GOOGLE_OAUTH_CLIENT
   6: at its JSON, and run an export once to complete the consent flow (token cached
   7: next to the client secret).
   8: """
   9: from __future__ import annotations
  10: 
  11: import os
  12: from pathlib import Path
  13: 
  14: SCOPES = ["https://www.googleapis.com/auth/drive.file"]
  15: DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  16: 
  17: 
  18: def _client_path() -> Path | None:
  19:     raw = os.environ.get("GOOGLE_OAUTH_CLIENT", "")
  20:     if not raw:
  21:         return None
  22:     p = Path(raw)
  23:     return p if p.exists() else None
  24: 
  25: 
  26: def configured() -> bool:
  27:     return _client_path() is not None
  28: 
  29: 
  30: def upload(docx_path: Path, title: str) -> str | None:
  31:     client = _client_path()
  32:     if not client:
  33:         return None
  34:     try:
  35:         from google.oauth2.credentials import Credentials
  36:         from google_auth_oauthlib.flow import InstalledAppFlow
  37:         from googleapiclient.discovery import build
  38:         from googleapiclient.http import MediaFileUpload
  39:     except ImportError:
  40:         print("  ! google api libs missing â€” pip install -r requirements.txt")
  41:         return None
  42: 
  43:     token = client.parent / "google_token.json"
  44:     creds = None
  45:     if token.exists():
  46:         creds = Credentials.from_authorized_user_file(str(token), SCOPES)
  47:     if not creds or not creds.valid:
  48:         flow = InstalledAppFlow.from_client_secrets_file(str(client), SCOPES)
  49:         creds = flow.run_local_server(port=0)
  50:         token.write_text(creds.to_json(), encoding="utf-8")
  51: 
  52:     drive = build("drive", "v3", credentials=creds)
  53:     meta = {"name": title, "mimeType": "application/vnd.google-apps.document"}
  54:     folder = os.environ.get("GOOGLE_DOCS_FOLDER_ID")
  55:     if folder:
  56:         meta["parents"] = [folder]
  57:     media = MediaFileUpload(str(docx_path), mimetype=DOCX_MIME, resumable=True)
  58:     created = drive.files().create(
  59:         body=meta, media_body=media, fields="id,webViewLink"
  60:     ).execute()
  61:     return created.get("webViewLink")

 succeeded in 6718ms:
   1: """HTTP clients for external subsystems (read-only in Phase 1).
   2: 
   3: mycontentdev (editorial) and munshi (front desk). Both clients are read-only in
   4: Phase 1. The single subsystem write path (McdClient.create_seed) is DEFERRED to
   5: Phase 3 per runbook D2/D9 â€” it is NOT built here, because a read-only phase must
   6: not ship a prod-adjacent write method before governance + idempotency exist. No
   7: client ever logs a secret value.
   8: """
   9: from __future__ import annotations
  10: 
  11: from .mcd_client import McdClient
  12: from .munshi_client import MunshiClient
  13: from .qx_client import QxClient
  14: 
  15: __all__ = ["McdClient", "MunshiClient", "QxClient"]

 succeeded in 7086ms:
   1: """Notifications â€” Telegram (via Hermes bot) + email, both creds-gated.
   2: 
   3: Every notification is always appended to state/notifications.log, so there is a
   4: record even when no channel is configured. Telegram/email are attempted only when
   5: their env vars are present, so the scheduler runs fine before creds are set up.
   6: """
   7: from __future__ import annotations
   8: 
   9: import os
  10: import smtplib
  11: import ssl
  12: import time
  13: from email.message import EmailMessage
  14: 
  15: from . import config
  16: 
  17: 
  18: def _stamp() -> str:
  19:     return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
  20: 
  21: 
  22: def _log(event: str, message: str) -> str:
  23:     config.STATE_DIR.mkdir(parents=True, exist_ok=True)
  24:     line = f"{_stamp()} [{event}] {message}"
  25:     with open(config.STATE_DIR / "notifications.log", "a", encoding="utf-8") as f:
  26:         f.write(line + "\n")
  27:     return line
  28: 
  29: 
  30: def _telegram(text: str) -> tuple[bool, str]:
  31:     token = os.environ.get("TELEGRAM_BOT_TOKEN")
  32:     chat = os.environ.get("TELEGRAM_CHAT_ID")
  33:     if not token or not chat:
  34:         return False, "telegram not configured"
  35:     try:
  36:         import requests
  37: 
  38:         r = requests.post(
  39:             f"https://api.telegram.org/bot{token}/sendMessage",
  40:             json={"chat_id": chat, "text": text}, timeout=15,
  41:         )
  42:         return r.ok, f"telegram {r.status_code}"
  43:     except Exception as e:  # noqa: BLE001
  44:         return False, f"telegram error: {e}"
  45: 
  46: 
  47: def _email(subject: str, body: str) -> tuple[bool, str]:
  48:     host = os.environ.get("SMTP_HOST")
  49:     user = os.environ.get("SMTP_USER")
  50:     pwd = os.environ.get("SMTP_PASS")
  51:     to = os.environ.get("NOTIFY_EMAIL_TO", user or "")
  52:     if not (host and user and pwd and to):
  53:         return False, "email not configured"
  54:     try:
  55:         port = int(os.environ.get("SMTP_PORT", "587"))
  56:         msg = EmailMessage()
  57:         msg["Subject"] = subject
  58:         msg["From"] = user
  59:         msg["To"] = to
  60:         msg.set_content(body)
  61:         with smtplib.SMTP(host, port, timeout=20) as s:
  62:             s.starttls(context=ssl.create_default_context())
  63:             s.login(user, pwd)
  64:             s.send_message(msg)
  65:         return True, "email sent"
  66:     except Exception as e:  # noqa: BLE001
  67:         return False, f"email error: {e}"
  68: 
  69: 
  70: def notify(event: str, message: str, channels=("telegram", "email")) -> dict:
  71:     line = _log(event, message)
  72:     results: dict[str, tuple[bool, str]] = {}
  73:     text = f"SAMAGRA Â· {event}\n{message}"
  74:     if "telegram" in channels:
  75:         results["telegram"] = _telegram(text)
  76:     if "email" in channels:
  77:         results["email"] = _email(f"SAMAGRA: {event}", message)
  78:     return {"logged": line, "results": results}
  79: 
  80: 
  81: def test() -> dict:
  82:     return notify("test", "SAMAGRA notification test â€” channels online.")

codex
The frontend itself only uses the generic POST hook from Munshi and Mycontentdev; `useApi` remains GET-only. Backend API exposure is broader than frontend exposure, which matters because Cloudflare Access is the only gate.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'.claude/launch.json' | ForEach-Object { "'$i++; if ($i -le 120) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "retired|OS-sized|operator console|attention-ROI|kill-criterion|DEC-1|DEC-2|DEC-3|DEC-4|DEC-5|parked|drift|coherent" HANDOFF.md CLAUDE.md STATUS.html SUMMARY.html docs/superpowers/specs/2026-06-19-samagra-evolution-design.md docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "read-only except|exactly two write paths|no new write paths beyond|No publish automation|No automated munshi|owner-initiated|Access is the only gate|origin does not|does not fail closed" HANDOFF.md CLAUDE.md STATUS.html SUMMARY.html docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md docs/deploy-tunnel.md docs/superpowers/loops/ralph-deploy/BACKLOG.md docs/superpowers/specs/2026-06-19-samagra-evolution-design.md docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "host|port|8799|autoPort|samagra|serve" .claude/launch.json docs/superpowers/loops/ralph-deploy/BACKLOG.md HANDOFF.md STATUS.html CLAUDE.md' in C:\SandBox\claude_box\TeachingOS
 succeeded in 1870ms:
.claude/launch.json:5:      "name": "samagra",
.claude/launch.json:7:      "runtimeArgs": ["-m", "uvicorn", "samagra.api.app:app", "--host", "127.0.0.1", "--port", "8799"],
.claude/launch.json:8:      "port": 8799,
.claude/launch.json:9:      "autoPort": false
.claude/launch.json:12:      "name": "samagra-os-ui",
.claude/launch.json:15:      "port": 5173
docs/superpowers/loops/ralph-deploy/BACKLOG.md:8:- [x] **C-0 · Branch base.** **DONE 2026-06-22.** Decision: **Option B** — branched `ship/samagra-os`
docs/superpowers/loops/ralph-deploy/BACKLOG.md:9:  off `e3/samagra-os` HEAD (`396ca50`) **without** merging PR
docs/superpowers/loops/ralph-deploy/BACKLOG.md:10:  [samagra#4](https://github.com/dbhardwaj86/samagra/pull/4) to `main`. Rationale: merging to the
docs/superpowers/loops/ralph-deploy/BACKLOG.md:20:- [x] **A-1 · Production-serve audit. DONE 2026-06-22.** Built `dist/` (via `npm run verify`), served by
docs/superpowers/loops/ralph-deploy/BACKLOG.md:21:  FastAPI on `:8799` (preview-owned; killed a stale orphan uvicorn first — see Discovered). Walked all
docs/superpowers/loops/ralph-deploy/BACKLOG.md:28:    `/api` hit after cold server start and fires two calls (`/api/pipelines`+`/api/org`); at 3s it fully
docs/superpowers/loops/ralph-deploy/BACKLOG.md:52:  through the FastAPI `:8799` proxy. **Exact** `q=capacitor` → 488 results, 25 rows (browser screenshot
docs/superpowers/loops/ralph-deploy/BACKLOG.md:80:- [x] **A-6 · Theme pass. DONE 2026-06-22.** Exercised **console + samagra** across **all 17 apps + shell
docs/superpowers/loops/ralph-deploy/BACKLOG.md:82:  window reskins via the `--samagra-*` CSS vars). **No aqua-only leakage found** — the leaf apps are
docs/superpowers/loops/ralph-deploy/BACKLOG.md:87:    `#e7eef8`) → all 17 light, **0 dark-text leakage** (min lum 0.42 = readable muted); **samagra** (text
docs/superpowers/loops/ralph-deploy/BACKLOG.md:89:    `bar-h:0px/rail:0px`, samagra `bar-h:32px/rail:66px/accent:#d9601a`.
docs/superpowers/loops/ralph-deploy/BACKLOG.md:91:    clock) · **no top bar** · right-side window controls; samagra = top bar (`समग्र` wordmark + Phase
docs/superpowers/loops/ralph-deploy/BACKLOG.md:93:  - **Theme-aware WM geometry confirmed** (`lib/wm/geometry.workArea`): a fresh window opened *in* samagra
docs/superpowers/loops/ralph-deploy/BACKLOG.md:94:    lands at x=86,y=50,w=895 (clears rail+topbar, fits work area + viewport); *in* console at x=32,y=20,
docs/superpowers/loops/ralph-deploy/BACKLOG.md:97:    the new work area — e.g. opened in wide aqua/console then switched to samagra's rail-inset area —
docs/superpowers/loops/ralph-deploy/BACKLOG.md:103:  samagra}** — the full 17×6 = 102 app-instance matrix — with `preview_console_logs` (error level)
docs/superpowers/loops/ralph-deploy/BACKLOG.md:105:  | device \ theme | aqua | console | samagra |
docs/superpowers/loops/ralph-deploy/BACKLOG.md:110:  **mobile+samagra** (17/17 open→Home, accent `#d9601a` — launcher icons correctly unify to the samagra
docs/superpowers/loops/ralph-deploy/BACKLOG.md:111:  accent; max overflow 1px, so the A-5 clip fixes hold under samagra too). Across two page sessions
docs/superpowers/loops/ralph-deploy/BACKLOG.md:114:  samagra (warm).
docs/superpowers/loops/ralph-deploy/BACKLOG.md:125:- [x] **B-0 · Owner confirm. DONE 2026-06-22.** Owner authorized **proceed** with hostname
docs/superpowers/loops/ralph-deploy/BACKLOG.md:126:  **`samagra.pratyakshsims.com`** (zone `pratyakshsims.com`). Discovery via the `cloudflare` skill +
docs/superpowers/loops/ralph-deploy/BACKLOG.md:129:  `mycontentdev-api`, `quizrag-demo`) + a default `~/.cloudflared/config.yml` for hermes — so `samagra-os`
docs/superpowers/loops/ralph-deploy/BACKLOG.md:134:- [x] **B-1 · Local bring-up script. DONE 2026-06-22.** `scripts/serve-local.ps1` (Windows is the deploy
docs/superpowers/loops/ralph-deploy/BACKLOG.md:135:  host the tunnel points at): builds `frontend/dist` (unless `-SkipBuild`), starts the same-origin FastAPI
docs/superpowers/loops/ralph-deploy/BACKLOG.md:136:  on `:8799` + the QX sidecar on `:8783`, **idempotent** (reuses a server already passing its health check;
docs/superpowers/loops/ralph-deploy/BACKLOG.md:139:  secrets** — reports only whether `.env` / `mcd-cloud.json` EXIST (never contents); logs → gitignored
docs/superpowers/loops/ralph-deploy/BACKLOG.md:140:  `.serve-logs/`. ASCII-only (Win PS 5.1 reads BOM-less `.ps1` as ANSI — first write tripped this). Verified
docs/superpowers/loops/ralph-deploy/BACKLOG.md:143:  preview `:8799` preserved). No app-source change → backend 154 / frontend 546 gates unaffected.
docs/superpowers/loops/ralph-deploy/BACKLOG.md:145:  application (Zero Trust, one-time-PIN to owner email) on the live hostname. **Verified the gate bites:**
docs/superpowers/loops/ralph-deploy/BACKLOG.md:146:  an unauthenticated `GET https://samagra.bhautikiplusprashnavali.com/api/overview` returns **HTTP 302** →
docs/superpowers/loops/ralph-deploy/BACKLOG.md:150:- [x] **B-3 · Tunnel config. DONE 2026-06-22.** `cloudflared tunnel create samagra-os` → id
docs/superpowers/loops/ralph-deploy/BACKLOG.md:152:  repo, gitignored — never committed). Filled the committed `deploy/cloudflared/config.samagra.yml` with the
docs/superpowers/loops/ralph-deploy/BACKLOG.md:154:  ingress hostname. `cloudflared tunnel --config deploy/cloudflared/config.samagra.yml ingress validate`
docs/superpowers/loops/ralph-deploy/BACKLOG.md:156:- [x] **B-4 · Bring up + DNS (OWNER-GATED public step). DONE 2026-06-22.** Final hostname is
docs/superpowers/loops/ralph-deploy/BACKLOG.md:157:  **`samagra.bhautikiplusprashnavali.com`** (NOT pratyakshsims — see D-7). Local stack up via
docs/superpowers/loops/ralph-deploy/BACKLOG.md:158:  `serve-local.ps1` (FastAPI `:8799` HEALTHY + QX `:8783` HEALTHY, fresh `dist`). DNS routed
docs/superpowers/loops/ralph-deploy/BACKLOG.md:159:  (`cloudflared tunnel --config … route dns samagra-os samagra.bhautikiplusprashnavali.com`) → proxied
docs/superpowers/loops/ralph-deploy/BACKLOG.md:161:  samagra-os`) — **4 QUIC edge connections registered** (maa05/bom08/bom09). Gate smoke-test passed (B-2).
docs/superpowers/loops/ralph-deploy/BACKLOG.md:162:  **LIVE at https://samagra.bhautikiplusprashnavali.com behind Access.** Remaining human check: browser OTP
docs/superpowers/loops/ralph-deploy/BACKLOG.md:165:  reality (bhautiki hostname, real tunnel id, cert-zone gotcha D-7, Access verified, junk-record cleanup D-8).
docs/superpowers/loops/ralph-deploy/BACKLOG.md:167:  hermes default `~/.cloudflared/config.yml`): `scripts/serve-durable.ps1` brings the stack up (reuses healthy
docs/superpowers/loops/ralph-deploy/BACKLOG.md:168:  servers + the built `dist`, no npm needed) + starts the `samagra-os` tunnel **detached** (survives the
docs/superpowers/loops/ralph-deploy/BACKLOG.md:169:  shell), idempotent, touching ONLY the samagra `--config`; `scripts/install-durable-task.ps1`
docs/superpowers/loops/ralph-deploy/BACKLOG.md:172:  detached `cloudflared` (pid on `config.samagra.yml`), task State=Ready, gate live (`/api/overview` → 302).
docs/superpowers/loops/ralph-deploy/BACKLOG.md:179:  public URL (https://samagra.bhautikiplusprashnavali.com, Access-gated).
docs/superpowers/loops/ralph-deploy/BACKLOG.md:181:  `npm run verify` exit 0, `vite build ✓`), then `ship/samagra-os` **fast-forward-merged into `main`**
docs/superpowers/loops/ralph-deploy/BACKLOG.md:183:  (`8379ae1..5db7886`). Clean ff (main was an ancestor); `main` == `origin/main` == `ship/samagra-os` ==
docs/superpowers/loops/ralph-deploy/BACKLOG.md:195:- **D-1 · Stale orphan uvicorn on `:8799` (2026-06-22, handled).** On entry, a prior-session `python`
docs/superpowers/loops/ralph-deploy/BACKLOG.md:196:  uvicorn (PID from `01:37`) still held `:8799` (the gotcha HANDOFF §2 warned about). A-1 killed it and
docs/superpowers/loops/ralph-deploy/BACKLOG.md:197:  let `preview_start` own a fresh serve. **Action for B-1:** the bring-up script should detect/clear a
docs/superpowers/loops/ralph-deploy/BACKLOG.md:198:  stale `:8799` listener before starting (and likewise the QX `:8783`).
docs/superpowers/loops/ralph-deploy/BACKLOG.md:199:- **D-2 · `preview_start` must own the server.** It refuses to attach to an externally-started uvicorn;
docs/superpowers/loops/ralph-deploy/BACKLOG.md:200:  set `"autoPort": false` on the `samagra` config in `.claude/launch.json` (done) and free `:8799` first,
docs/superpowers/loops/ralph-deploy/BACKLOG.md:201:  then `preview_start({name:"samagra"})` spawns it on 8799. Recorded so later UI iterations don't re-derive.
docs/superpowers/loops/ralph-deploy/BACKLOG.md:203:  Any automated smoke/health check must allow for it (warm the server with one request before asserting).
docs/superpowers/loops/ralph-deploy/BACKLOG.md:207:  must start/health-check `:8783` alongside `:8799`; **B-5** runbook must document it. Keep `:8783`
docs/superpowers/loops/ralph-deploy/BACKLOG.md:208:  internal — only `:8799` is tunnelled (reached via the same-origin `/api/questions` proxy). If QX isn't
docs/superpowers/loops/ralph-deploy/BACKLOG.md:211:  mobile: dispatch a `contextmenu` MouseEvent on `#samagra-os-shell` (the bare-desktop handler checks
docs/superpowers/loops/ralph-deploy/BACKLOG.md:230:  `cloudflared tunnel route dns … samagra.pratyakshsims.com` could not write that zone — it **mangled** the
docs/superpowers/loops/ralph-deploy/BACKLOG.md:231:  name to `samagra.pratyakshsims.com.bhautikiplusprashnavali.com` (treated it as a relative label under the
docs/superpowers/loops/ralph-deploy/BACKLOG.md:233:  (browser, owner-only). **Owner decision: use `samagra.bhautikiplusprashnavali.com`** (cert already covers
docs/superpowers/loops/ralph-deploy/BACKLOG.md:237:  **`samagra.pratyakshsims.com.bhautikiplusprashnavali.com`** → hermes tunnel `40f0e7b2`. Harmless (a weird
docs/superpowers/loops/ralph-deploy/BACKLOG.md:238:  FQDN nobody hits; does NOT affect `hermes.bhautikiplusprashnavali.com` or the real samagra host), but it
STATUS.html:5:<meta name="viewport" content="width=device-width,initial-scale=1">
STATUS.html:61:  <h1>SAMAGRA</h1><span class="sub"><strong>✅ DEPLOYED LIVE (2026-06-22)</strong> — SAMAGRA OS is reachable at <a href="https://samagra.bhautikiplusprashnavali.com" style="color:inherit">samagra.bhautikiplusprashnavali.com</a> behind <strong>Cloudflare Access</strong> (one-time-PIN), via a <code>cloudflared</code> named tunnel (<code>samagra-os</code>, <code>9b7a3df8…</code>) → local <code>:8799</code> · <strong>gate verified</strong> (unauth <code>/api/overview</code> → 302 Access login) · Phase A (17 apps × mobile × 3 themes, 0 console errors, gates green) + Phase B (tunnel + Access) done on branch <code>ship/samagra-os</code> (<code>cce285d</code>) · runbook <a href="docs/deploy-tunnel.md" style="color:inherit">docs/deploy-tunnel.md</a> · see <a href="#next" style="color:inherit">Next</a> for owner follow-ups (junk-record cleanup, durable service, browser smoke, finish branch)</span>
STATUS.html:64:    <a href="#samagra">SAMAGRA</a><a href="#experience">OS GUI</a><a href="#arch">Architecture</a><a href="#org">Org</a>
STATUS.html:76:  <a href="#samagra">SAMAGRA roadmap</a>
STATUS.html:93:  portal, fills the thin/thick lecture-generation gap, and runs semi-autonomously with hard
STATUS.html:95:  <p>Repo: <a href="https://github.com/dbhardwaj86/samagra">github.com/dbhardwaj86/samagra</a>
STATUS.html:96:  · <a href="https://github.com/dbhardwaj86/samagra/pull/1">PR #1</a> squash-merged to <code>main</code>
STATUS.html:103:  (see <a href="#samagra">SAMAGRA roadmap</a> + <a href="#artifacts">Artifacts</a>).
STATUS.html:105:  <code>samagra</code>, <code>samagra.db</code> rebuilt to 7,044 artifacts, 11/11 tests green.</p>
STATUS.html:138:  <code>payload.text/body</code> the live server never emits (each kind stores its title under a
STATUS.html:150:  <strong>independent Codex review per implementation</strong> (reports <code>docs/codex-reviews/14–17</code>).
STATUS.html:155:    <div class="card"><div class="n">Munshi <span class="badge ok">write</span></div><div class="l"><code>POST /api/munshi/capture</code> → live <code>MunshiClient.create_item</code> → <code>/api/item</code> (cookie). Kinds <strong>todo/note/followup</strong>, per-kind required fields, server-validated, creds-gated.</div></div>
STATUS.html:167:    <div class="card"><div class="n">C <span class="badge ok">done</span></div><div class="l">Thin/thick exporter — HTML + DOCX + GDocs</div></div>
STATUS.html:171:  <h2 id="samagra">SAMAGRA evolution (planned)</h2>
STATUS.html:175:    <div class="card"><div class="n">0 <span class="badge ok">done</span></div><div class="l">Rename to <code>samagra</code> (repo + package); PR #1 merged</div></div>
STATUS.html:184:  Spec: <code>docs/superpowers/specs/2026-06-19-samagra-evolution-design.md</code> ·
STATUS.html:185:  Plan: <code>docs/superpowers/plans/2026-06-19-samagra-evolution.md</code> (34 tasks).</p>
STATUS.html:188:  <p class="lede">The new top priority: replace the plain tabbed portal with <strong>SAMAGRA OS</strong> — an
STATUS.html:190:  Vite and served by FastAPI. It has its own spec + phased plan + agent division + autonomous loop scripts
STATUS.html:192:  <strong>3-theme + icon fidelity layer</strong> has now landed on top of it (aqua · console · samagra chrome,
STATUS.html:197:    <div class="card"><div class="n">E1 <span class="badge ok">merged to main · 439/439</span></div><div class="l">Shell + <strong>all 3 themes</strong> + OS utilities — window manager (draggable/resizable), dock/top-bar, Dashboard · Settings · Terminal · Clock · Notes · Snake + FastAPI serve seam. Built TDD then fidelity-passed; chairman renamed <strong>Deepak Bhardwaj</strong> + <strong>right-click context menus</strong> in every theme. Fast-forwarded <code>e1/samagra-os</code> → <code>main</code> (<code>06d88a3</code>); gate clean (lint + <code>tsc</code> + 439 Vitest + <code>vite build</code>; backend 102/102). Not yet pushed.</div></div>
STATUS.html:198:    <div class="card"><div class="n">Fidelity <span class="badge ok">landed · 3 themes + icons</span></div><div class="l">Theme-driven chrome for <strong>aqua · console · samagra</strong> (Dock / Taskbar + Start menu / left Rail; per-theme window controls + wordmarks), plus the <code>Icon</code>/<code>AppIcon</code> SVG system (FD2) wired through every launcher and the six apps. RTL tests pin the fidelity hooks (aria-labels, <code>&lt;svg&gt;</code> presence, theme data-attribute/CSS-var, key token measurements). <strong>Pixel parity NOT yet claimed</strong> — next step is the browser-vision pass.</div></div>
STATUS.html:199:    <div class="card"><div class="n">E2 <span class="badge ok">merged · headless-green</span></div><div class="l">Eleven data/control apps — Org · Pipelines · Lectures · mycontentdev · Munshi · Assignments · Activity · Questions · Booklets · INSP · Sims — as thin read-only React wrappers over <code>/api/*</code>, plus one new endpoint <code>GET /api/org</code> (static <code>samagra/org.py</code>). Built TDD on <code>e2/samagra-os</code> (22 commits); backend 106/106 + frontend 501/501 green, <code>tsc</code>/<code>vite build</code> clean (22 lazy chunks). <strong>MERGED to <code>main</code> (fast-forward, <code>31aa5bb</code>) and pushed to <code>origin/main</code> 2026-06-21</strong> after a Codex pre-merge review (GO; 3 MEDIUMs fixed) — <a href="https://github.com/dbhardwaj86/samagra/pull/2">merged PR #2</a>.</div></div>
STATUS.html:200:    <div class="card"><div class="n">E3 <span class="badge ok">built · green</span></div><div class="l"><strong>Built TDD on <code>e3/samagra-os</code> (2026-06-22, not merged).</strong> <strong>Mobile device mode</strong> — theme store <code>mobileApp</code> + <code>openMobileApp</code>/<code>goHome</code> (<code>setDevice</code> resets it); new <code>shell/Mobile.tsx</code> phone frame (notch · 44px status bar · 4-col app grid · favorites dock · home-indicator); <code>App.tsx</code> branches on <code>device</code>. <strong>Theme-correct WM geometry</strong> — <code>windowManager</code> tracks the active theme so open/move/maximize/tile use that theme's <code>workArea</code>+<code>barH</code> (fixes console/samagra). <strong>Responsive Dashboard</strong> (HIGH#2) — lower grid now <code>auto-fit minmax(260px,1fr)</code>, stacks on the phone. Terminal <code>open</code> made device-aware. Adversarial multi-agent review (6 raw → 3 confirmed, all fixed). Gate: backend <strong>152 pytest</strong> + frontend <strong>541 vitest</strong> + <code>tsc</code>/<code>vite build</code>. <strong>⚠ DEC-4 consciously deferred</strong> by the Chairman; pixel parity = separate owner pass (not claimed).</div></div>
STATUS.html:210:  <code>lib/</code> engines, stores, themes, aqua chrome, Dashboard/Settings/Terminal, the FastAPI serve seam);
STATUS.html:214:  merge model. Artifacts: <code>specs/2026-06-20-samagra-os-experience-design.md</code>,
STATUS.html:215:  <code>plans/2026-06-20-samagra-os.md</code>, <code>plans/2026-06-20-samagra-os-division.md</code>,
STATUS.html:221:  the aqua chrome shell, the six OS-utility apps + shared components, and the FastAPI serve seam (Vite
STATUS.html:222:  <code>dist/</code> + SPA fallback, jinja portal route retired). <strong>Fidelity layer (this gate):</strong>
STATUS.html:223:  the shell now re-themes end-to-end across <strong>aqua · console · samagra</strong> (driven by the theme
STATUS.html:228:  <strong>pytest 102/102</strong> (incl. <code>test_serve_seam.py</code>). Pixel/interaction fidelity is a
STATUS.html:244:  or the kill-criterion</strong>, and the value-producing <a href="#samagra">active loop (Phase 3)</a> — the
STATUS.html:247:  <code>docs/superpowers/_research/samagra-os/_vision-review-output.md</code> (+ <code>_vision-review-prompt.md</code>,
STATUS.html:254:    <li><strong>DEC-4 · Attention-ROI acceptance gate before E3:</strong> 2–3 representative operator tasks (triage munshi captures · read pipeline/gate status · find + open a catalog artifact) measured for owner time-saved vs the old portal; fail → freeze GUI expansion + reprioritize Phase 3. <strong>⚠ Consciously DEFERRED 2026-06-22</strong> — the Chairman chose to build E3 first this session. The gate is <strong>not satisfied and not voided</strong>; it remains the binding gate for the Phase-3-vs-GUI reprioritization and should run before further GUI investment.</li>
STATUS.html:272:    <text class="mut" x="34" y="126">samagra.db (FTS5) · phase state machine · scheduler · notify</text>
STATUS.html:417:  (last run 2026-06-22, branch <code>e3/samagra-os</code>). <strong>E3 + the test-only LOW cleanup</strong> added
STATUS.html:429:  mocked (no live calls in the suite); live end-to-end verified separately against the running server.
STATUS.html:446:  (<code>themes/index</code> 14 — every <code>aqua</code>/<code>console</code>/<code>samagra</code> token set,
STATUS.html:454:  inactive), and the full theme swap — console (Taskbar + Start menu + right-side icon controls) and samagra
STATUS.html:459:  the suite grew to <strong>102</strong> with <code>test_serve_seam.py</code> (the Vite-<code>dist/</code>
STATUS.html:466:  <strong>has not run</strong>. The surfaces (aqua / console / samagra shell · Dashboard · Settings · Terminal ·
STATUS.html:478:  dry-run). The suite is isolated from the real <code>samagra.db</code> and <code>governance.db</code>
STATUS.html:492:    <strong><a href="https://samagra.bhautikiplusprashnavali.com">samagra.bhautikiplusprashnavali.com</a></strong>
STATUS.html:494:    <code>cloudflared</code> named tunnel (<code>samagra-os</code>, <code>9b7a3df8…</code>) →
STATUS.html:495:    <code>localhost:8799</code> (FastAPI serving <code>frontend/dist</code> + same-origin <code>/api</code>; QX
STATUS.html:501:    over a browser re-login for pratyakshsims. Committed <code>deploy/cloudflared/config.samagra.yml</code> +
STATUS.html:502:    the as-shipped <code>docs/deploy-tunnel.md</code> (<code>cce285d</code>, branch <code>ship/samagra-os</code>).
STATUS.html:511:    reprioritization. <strong>E3 (client-only, TDD)</strong> on branch <code>e3/samagra-os</code>: <strong>mobile
STATUS.html:517:    <code>workArea</code>+<code>barH</code>, fixing console/samagra), and a <strong>responsive Dashboard</strong>
STATUS.html:529:    <code>[fig]</code>, no semantic). Per the owner's decision — <em>"deploy QX on localhost and use its backend
STATUS.html:530:    directly"</em> — it now <strong>reuses the real QX engine</strong> as a localhost sidecar. QX gained a tested
STATUS.html:556:    <strong>Final integrated Codex review: GO-WITH-FIXES</strong> (0 CRITICAL/HIGH/MEDIUM; report
STATUS.html:557:    <code>docs/codex-reviews/18-capture-final.report.md</code>) — branch merge-safe. <strong>Owner decision
STATUS.html:571:    (<code>select distinct subject from catalog</code>, <code>samagra/catalog.py:191</code>), and the sims
STATUS.html:573:    <code>subject</code> column (<code>samagra/adapters/sims.py:37</code>), so global catalog facets ≠ the
STATUS.html:591:    <strong>106 pytest</strong>. The merged PR is <a href="https://github.com/dbhardwaj86/samagra/pull/2">#2</a>.
STATUS.html:593:    apps now render when FastAPI-served, not just under <code>npm run dev</code>) is the next step; then Phase E3
STATUS.html:595:  <div class="log"><div class="d">2026-06-21 · SAMAGRA OS — E2 BUILT (11 data apps + <code>GET /api/org</code>); built TDD on <code>e2/samagra-os</code></div>
STATUS.html:596:    The eleven data/control apps shipped TDD on branch <code>e2/samagra-os</code> (22 commits) as thin,
STATUS.html:598:    new backend endpoint <strong><code>GET /api/org</code></strong> (static <code>samagra/org.py</code>). Apps:
STATUS.html:604:    workflow produced <code>docs/superpowers/_research/samagra-os/e2-grounding.md</code> — the verified
STATUS.html:608:    only in <code>dispatch.ts</code>, etc.). The plan (<code>plans/2026-06-21-samagra-os-e2.md</code>) cleared a
STATUS.html:619:    in <code>samagra/org.py</code>, <code>claude1</code> = <strong>Claude-Deepak</strong> (CEO — substrate &amp;
STATUS.html:621:    <code>tests/test_api_org.py</code>. <strong>(b) Production-serve bundling fix (pre-existing E1 bug):</strong>
STATUS.html:622:    <code>App.tsx</code>'s <code>/* @vite-ignore */</code> dynamic import left every <code>apps/*/index.tsx</code>
STATUS.html:623:    <strong>OUT of the production bundle</strong>, so FastAPI-served app windows rendered empty (only
STATUS.html:633:    <code>deepak@samagra:~$</code>, board listing + <code>whoami</code>; zero "Devesh" left) and
STATUS.html:635:    surface — verified live in aqua/console/samagra). Landed as 3 commits (<code>7db1a9e</code>, <code>09b0566</code>,
STATUS.html:642:    (no top bar; bottom Taskbar + Start menu + right-side neon icon controls), and <strong>samagra</strong>
STATUS.html:665:    wrappers; and the FastAPI serve seam now mounts the Vite <code>dist/</code> with an SPA fallback (the jinja
STATUS.html:666:    portal route retired, <code>/api/*</code> frozen). Gate: <code>npm run verify</code> clean (lint +
STATUS.html:668:    and backend <strong>pytest 102/102</strong> green (incl. <code>test_serve_seam.py</code>) on branch
STATUS.html:669:    <code>e1/samagra-os</code>. <strong>Pixel/interaction fidelity is a separate human QA pass</strong>
STATUS.html:673:    The owner re-prioritised: replace the plain tabbed portal with <strong>SAMAGRA OS</strong>, an OS-style
STATUS.html:700:    Reports <code>docs/codex-reviews/07–13</code> + the Workflow audit <code>12-workflow-invariant-audit.md</code>.
STATUS.html:707:    <code>samagra.db</code> (schema_version + migration hook + consistent backup; the plan wrongly put it in
STATUS.html:720:    adapter read <code>payload.text/body</code>, but the live server stores each kind's title under a
STATUS.html:729:    manual <code>samagra unlock</code> for the rare crashed-holder case). A third Codex pass returned
STATUS.html:744:  <div class="log"><div class="d">2026-06-19 · Phase 0 executed — package renamed to samagra</div>
STATUS.html:745:    PR #1 squash-merged to <code>main</code>; GitHub repo and Python package are now <code>samagra</code>; env keys moved to the <code>SAMAGRA_*</code> namespace; <code>samagra.db</code> rebuilt to 7,044 artifacts; 11/11 tests green.</div>
STATUS.html:747:    Build order locked: rename to <code>samagra</code> (Phase 0) → subsystem adapters → governance → active loop. 34 tasks across 4 phases; spec + plan committed and recorded to the cbm sidecar.</div>
STATUS.html:758:    Thin = concise revision sheet, thick = full chapter; export HTML + DOCX (OMML math) + Google Docs.</div>
STATUS.html:763:    <tr><td><code>frontend/</code> (React + TS + Vite app)</td><td>SAMAGRA OS E1 + fidelity layer — windowing shell, <strong>three themes</strong> (aqua/console/samagra chrome) + the <code>Icon</code>/<code>AppIcon</code> SVG system, six OS utilities; pure-TS engines in <code>src/lib/**</code> (each with a co-located Vitest), Zustand stores, theme-driven shell, apps + components, + the chairman rename and right-click context menus. 439 Vitest / 38 files green.</td></tr>
STATUS.html:765:    <tr><td><code>samagra/org.py</code> + <code>tests/test_api_org.py</code></td><td><span class="badge ok">E2</span> static founder→board→workers registry behind <code>GET /api/org</code>; OWNER-CONFIRMED mapping (<code>claude1</code>=Claude-Deepak CEO, <code>claude2</code>=Claude-Khanak CTO) pinned by 4 new pytest.</td></tr>
STATUS.html:766:    <tr><td><code>docs/superpowers/_research/samagra-os/e2-grounding.md</code> + <code>plans/2026-06-21-samagra-os-e2.md</code></td><td><span class="badge ok">E2</span> the live-source-verified <code>/api</code> contract (supersedes <code>api.md</code>; caught 11 deltas) + the dedicated 20-task E2 plan (4-critic adversarial pass: 0 CRITICAL / 0 MAJOR, 6 polish fixes).</td></tr>
STATUS.html:767:    <tr><td><code>samagra/api/app.py</code> + <code>tests/test_serve_seam.py</code></td><td>FastAPI serve seam — mounts Vite <code>dist/</code>, SPA fallback (404s <code>api/*</code>, 503 if unbuilt); jinja portal route retired</td></tr>
STATUS.html:768:    <tr><td><code>docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md</code> + <code>plans/2026-06-20-samagra-os.md</code></td><td>SAMAGRA OS Experience-track spec + phased plan (E1 in full TDD detail; E2/E3 skeletons)</td></tr>
STATUS.html:769:    <tr><td><code>docs/superpowers/specs/2026-06-19-samagra-evolution-design.md</code></td><td>approved SAMAGRA design spec (integration contracts verified)</td></tr>
STATUS.html:770:    <tr><td><code>docs/superpowers/plans/2026-06-19-samagra-evolution.md</code></td><td>34-task, 4-phase SAMAGRA implementation plan (TDD)</td></tr>
STATUS.html:773:    <tr><td><code>docs/samagra-vision-deliberation-2026-06-19.html</code></td><td>6-lens vision deliberation — 10 suggestions + 14 action items (folded into D9–D12)</td></tr>
STATUS.html:774:    <tr><td><code>docs/codex-reviews/01–03-*.report.md</code></td><td>raw Codex reports (adversarial code · architecture · loop-plan)</td></tr>
STATUS.html:775:    <tr><td><code>docs/codex-reviews/04–06-premerge-*.report.md</code></td><td>3-pass Codex pre-merge review (BLOCK → REQUEST-CHANGES → APPROVE) behind the S-06–S-09 fixes</td></tr>
STATUS.html:777:    <tr><td><code>samagra/clients/{mcd_client,munshi_client}.py</code></td><td>Phase 1 — read-only subsystem HTTP clients (secret-safe)</td></tr>
STATUS.html:778:    <tr><td><code>samagra/adapters/{mcd,munshi}.py</code> + 3 test suites</td><td>Phase 1 — subsystem adapters + <code>mycontentdev</code> pipeline + <code>_reflect_mycontentdev</code> (TDD, HTTP mocked)</td></tr>
STATUS.html:779:    <tr><td><code>samagra/</code></td><td>package — adapters, clients, catalog, state, scheduler, api, portal, lectures</td></tr>
STATUS.html:780:    <tr><td><code>samagra.db</code></td><td>unified catalog — rebuildable FTS5 index (generated, gitignored)</td></tr>
STATUS.html:782:    <tr><td><code>build/lectures/&lt;slug&gt;/</code></td><td>exported thin/thick HTML + DOCX</td></tr>
STATUS.html:787:  <p><strong>Deployed, durable, and merged to <code>main</code></strong> (2026-06-22, <code>5db7886</code> — fast-forward, pushed to <code>origin/main</code>). The tunnel + stack now auto-start at logon via the <code>SAMAGRA-OS</code> Scheduled Task (<code>scripts/serve-durable.ps1</code>). The ralph ship-&-tunnel loop (Phase A + B + C) is <strong>complete</strong>. Remaining:</p>
STATUS.html:789:    <li><strong>Durability — ✅ done.</strong> A logon Scheduled Task <code>SAMAGRA-OS</code> runs <code>scripts/serve-durable.ps1</code> (stack + detached tunnel, touching only the samagra <code>--config</code>), so the URL survives session-close and reboot (at logon). For 24/7 pre-login uptime: a Windows service separate from hermes (runbook §8). Manage via <code>scripts/install-durable-task.ps1</code>.</li>
STATUS.html:790:    <li><strong>Branch finished — ✅ done.</strong> <code>ship/samagra-os</code> fast-forward-merged into <code>main</code> (20 commits: E3 + Phase A + deploy + durability) and pushed to <code>origin/main</code> (<code>5db7886</code>); gates green (backend pytest + frontend verify).</li>
STATUS.html:791:    <li><strong>Delete the junk DNS record</strong> <code>samagra.pratyakshsims.com.bhautikiplusprashnavali.com</code> (D-8) in the Cloudflare DNS dashboard — a harmless stray CNAME from the first mis-route (does not affect <code>hermes.*</code> or the live samagra host). <em>Owner action.</em></li>
STATUS.html:812:  end-to-end across <strong>aqua · console · samagra</strong> (token-driven chrome — FD1) with every launcher
STATUS.html:814:  engines + the FastAPI serve seam, green across the E1-merge gate (frontend <strong>439/439</strong> +
STATUS.html:818:  <code>samagra/org.py</code>), built TDD on branch <code>e2/samagra-os</code> (22 commits), headless-green
STATUS.html:826:  <a href="https://github.com/dbhardwaj86/samagra/pull/2">#2</a>. <strong>Next planned action = the owner-run
STATUS.html:828:  FastAPI-served, not just under <code>npm run dev</code>); then <strong>Phase E3</strong> (mobile device mode +
STATUS.html:829:  remaining per-theme re-skin — the 3 aqua/console/samagra themes already shipped in E1). The
STATUS.html:842:    <tr><td>Phase 0 (rename)</td><td><span class="badge ok">done</span></td><td>repo + package <code>samagra</code>; catalog 7,044 artifacts.</td></tr>
STATUS.html:847:    <tr><td>Phase 2 — pre-merge Codex review</td><td><span class="badge ok">APPROVE</span></td><td>Codex (gpt-5.5/xhigh) 6 rounds + a CEO adversarial Workflow audit; caught a never-wedge HIGH, a recurring confirmed-block downgrade class, 2 MEDIUM + nits — all fixed TDD. R6 APPROVE-WITH-NITS (nit fixed). Reports <code>07–13</code> + <code>12-workflow-invariant-audit.md</code>.</td></tr>
STATUS.html:849:    <tr><td>Create agent worktrees</td><td><span class="badge ok">done</span></td><td><code>../samagra-{deepak,khanak,codex}</code> on <code>agent/{deepak,khanak,codex}</code>.</td></tr>
STATUS.html:851:    <tr><td>SAMAGRA OS — E1 (shell + aqua + utilities)</td><td><span class="badge ok">shipped · 166/166</span></td><td>React+TS+Vite GUI replacing the portal. Built TDD (E1.1–E1.25) on <code>e1/samagra-os</code>; E1.26 green gate clean (lint + <code>tsc</code> + 166 Vitest + <code>vite build</code>; backend 102/102). Pure-TS engines + aqua shell + six apps + serve seam.</td></tr>
STATUS.html:852:    <tr><td>SAMAGRA OS — 3-theme + icon fidelity layer</td><td><span class="badge ok">landed · 419/419</span></td><td>Theme-driven chrome for <strong>aqua · console · samagra</strong> (token map — FD1) + the <code>Icon</code>/<code>AppIcon</code> SVG system (FD2) across every launcher + the six apps. RTL tests adapted + fidelity hooks pinned. QA1 gate clean (lint + <code>tsc</code> + <strong>419 Vitest / 38 files</strong> + <code>vite build</code>, no <code>.only</code>/<code>.skip</code>; backend 102/102). Pixel parity not yet claimed.</td></tr>
STATUS.html:853:    <tr><td>SAMAGRA OS — chairman rename + right-click menus + merge to <code>main</code></td><td><span class="badge ok">done · 439/439</span></td><td>Chairman renamed <strong>Deepak Bhardwaj</strong> + <strong>right-click context menus</strong> in all 3 themes (desktop · window · dock-icon), on top of draggable windows + HIGH#4 guard + Notes a11y. Fast-forwarded <code>e1/samagra-os</code> → <code>main</code> (<code>06d88a3</code>; 96 files / ~19k ins). Advisory Codex hook ran (90s timeout, never-wedge).</td></tr>
STATUS.html:856:    <tr><td>SAMAGRA OS — E2 (data/control apps)</td><td><span class="badge ok">merged · headless-green</span></td><td>Eleven read-only apps over <code>/api/*</code> + one new endpoint <code>GET /api/org</code> (static <code>samagra/org.py</code>), on 7 pure-TS linchpin modules. Built TDD on <code>e2/samagra-os</code> (22 commits); backend 106/106 + frontend 501/501 green, <code>vite build</code> clean (22 lazy chunks). Grounded on <code>e2-grounding.md</code> (supersedes <code>api.md</code>). <strong>MERGED to <code>main</code> (fast-forward, <code>31aa5bb</code>) and pushed to <code>origin/main</code> 2026-06-21</strong> after a Codex pre-merge review (GO; 3 MEDIUMs fixed) — <a href="https://github.com/dbhardwaj86/samagra/pull/2">merged PR #2</a>.</td></tr>
STATUS.html:857:    <tr><td>SAMAGRA OS — browser-vision pixel QA (11 E2 apps)</td><td><span class="badge todo">owner · next · pending</span></td><td><strong>Next planned action.</strong> The owner-run browser-vision pixel/interaction-parity pass over the 11 E2 apps (and the E1 shell) — now that the bundling fix makes the apps render when FastAPI-served, not just under <code>npm run dev</code>. Outside any loop; has NOT run; pixel parity not claimed. Some E2 glyphs may still be unregistered in <code>components/icons-data</code> (empty-icon fallback) — a visual-polish follow-up.</td></tr>
STATUS.html:859:    <tr><td>SAMAGRA OS — attention-ROI gate (DEC-4)</td><td><span class="badge todo">required before E3</span></td><td><strong>New gate.</strong> Measure owner time-saved on 2–3 representative operator tasks via SAMAGRA OS vs the old portal; must pass before any E3 (mobile / theme-polish) work. Fail → freeze GUI expansion + reprioritize Phase 3 (active loop).</td></tr>
STATUS.html:864:    <tr><td>Google Docs export</td><td><span class="badge todo">creds</span></td><td>Set <code>GOOGLE_OAUTH_CLIENT</code> (Desktop OAuth JSON); HTML + DOCX already work.</td></tr>
HANDOFF.md:5:> Cloudflare Access** at **https://samagra.bhautikiplusprashnavali.com** via a `cloudflared` named tunnel
HANDOFF.md:6:> (`samagra-os`, `9b7a3df8…`) → local `:8799`. **Gate verified** (unauth `/api/overview` → HTTP 302 to the
HANDOFF.md:9:> Scheduled Task (`scripts/serve-durable.ps1` → stack + detached tunnel; survives session-close + reboot at
HANDOFF.md:14:>   `samagra.pratyakshsims.com.bhautikiplusprashnavali.com` (D-8 — harmless, in the CF dashboard); (2) **browser
HANDOFF.md:25:> On branch **`e3/samagra-os`** (3 commits: `0dceb0d` test-LOWs · `73a97b7` E3 · `82edd06` review fixes; **NOT
HANDOFF.md:39:>   windowing shell for the phone (keeping the `--samagra-*` vars). **(b) theme-correct WM geometry** —
HANDOFF.md:41:>   that theme's `workArea`+`barH` instead of always aqua (fixes console/samagra windows). **(c) responsive
HANDOFF.md:53:> - **▶ NEXT:** present `superpowers:finishing-a-development-branch` and merge `e3/samagra-os` (it sits on top of
HANDOFF.md:59:> engine** as a localhost sidecar (owner decision — "deploy QX on localhost and use its backend
HANDOFF.md:63:> `/api/questions` **proxies** it (`samagra/clients/qx_client.py` → `config.QX_SERVER_URL`, default
HANDOFF.md:64:> `http://127.0.0.1:8783`; `samagra/questions_proxy.py` absolutizes figure `/asset` URLs to the QX
HANDOFF.md:65:> server; QX-down → graceful `{results:[], error}`, never a 500). The **Questions app**
HANDOFF.md:76:> - **⚙ ACTIVATION (durable):** the always-up QX server **must run the new code** — restarted this
HANDOFF.md:89:> implementation** (reports `docs/codex-reviews/14–17`).
HANDOFF.md:92:>   deterministic set), per-kind required fields, server-validated, creds-gated.
HANDOFF.md:105:>   mcd seed (`seed_01KVNN90…`, status `captured`, seeds 1→2) through the running server; both appear in
HANDOFF.md:109:> - **Final integrated Codex review (`docs/codex-reviews/18-capture-final.report.md`): GO-WITH-FIXES** — 0
HANDOFF.md:119:>    "thin wrapper" to **reuse the real QX engine via a localhost sidecar** (owner decision); QX gained a
HANDOFF.md:137:> owner-initiated capture*."** Spec/plan: `docs/superpowers/{specs/2026-06-21-samagra-control-plane-capture-design.md,plans/2026-06-21-samagra-control-plane-capture.md}`.
HANDOFF.md:139:> **▶ STATUS:** The project is **SAMAGRA** (package `samagra`) — a company-structured agent org
HANDOFF.md:144:> the rebuildable catalog `samagra.db`) and **D5** (the Codex pre-commit hook is **advisory-local** —
HANDOFF.md:153:> the three agent worktrees exist (`../samagra-{deepak,khanak,codex}` on `agent/{deepak,khanak,codex}`).
HANDOFF.md:154:> **▶ NEW TOP PRIORITY (2026-06-20): SAMAGRA OS — the Experience track.** Replace the plain tabbed portal with
HANDOFF.md:155:> an OS-style windowing GUI (17 apps · 3 themes · 2 device modes) in React + TypeScript + Vite, served by
HANDOFF.md:157:> (spec `specs/2026-06-20-samagra-os-experience-design.md`; plan `plans/2026-06-20-samagra-os.md`; division
HANDOFF.md:158:> `plans/2026-06-20-samagra-os-division.md`; loops `loops/{deepak,khanak}-loop.js` + `RUBRIC.md`).
HANDOFF.md:163:> `deepak@samagra:~$`, board + `whoami`) and **right-click context menus for all 3 themes** (desktop · window ·
HANDOFF.md:164:> dock-icon; theme-driven surface, verified live in aqua/console/samagra). **PUSHED to `origin/main` 2026-06-21
HANDOFF.md:169:> new backend endpoint **`GET /api/org`** (static `samagra/org.py`). Apps: **Org Chart · Pipelines · Lectures ·
HANDOFF.md:175:> Built TDD on branch **`e2/samagra-os`** as a single-tree DAG driven by two background Workflows (backend + 7
HANDOFF.md:177:> verification workflow produced `docs/superpowers/_research/samagra-os/e2-grounding.md` — the verified `/api`
HANDOFF.md:181:> `plans/2026-06-21-samagra-os-e2.md` cleared a **4-critic adversarial pass** (0 CRITICAL / 0 MAJOR; 6 minor
HANDOFF.md:192:> `tests/test_api_org.py`; and a **pre-existing E1 production-serve bundling bug** — `App.tsx`'s
HANDOFF.md:193:> `/* @vite-ignore */` dynamic import left every `apps/*/index.tsx` OUT of the production bundle, so FastAPI-served
HANDOFF.md:198:> <https://github.com/dbhardwaj86/samagra/pull/2>. **Pixel/interaction parity of the 11 apps is a
HANDOFF.md:202:> FastAPI-served, not just under `npm run dev`), then Phase E3 (mobile device mode + remaining per-theme re-skin
HANDOFF.md:211:> shared leaf components, and the FastAPI serve seam (Vite `dist/` + SPA fallback, jinja portal route retired).
HANDOFF.md:214:> controls), **samagra** (Devanagari top strip + left **Rail** dock + warm window frame) — every colour/size
HANDOFF.md:223:> 102/102 green (incl. `test_serve_seam.py`).** Linchpin held: all real behaviour lives in pure-TS
HANDOFF.md:228:> makes them render when FastAPI-served, not just under `npm run dev`), then **E3** (mobile device mode + remaining
HANDOFF.md:243:> `samagra/catalog.py:191`). The sims adapter writes each simulation's folder id (`SIM0018`…`SIM0626`) into the
HANDOFF.md:244:> `subject` column (`samagra/adapters/sims.py:37`, `subject = after[0]`), so **~500 `SIM0xxx` ids dominate the
HANDOFF.md:245:> chip list** (498 measured against `samagra.db` — 502 of 504 distinct catalog subjects come from the sims source). Global catalog facets ≠ the question bank's subject vocabulary;
HANDOFF.md:250:> `summary().subjects` (`samagra/adapters/qx.py:57`) via a new `/api/questions/facets` or the existing qx
HANDOFF.md:280:  reviews: `docs/superpowers/_research/samagra-os/_vision-review-output.md` (+ `_vision-review-prompt.md`,
HANDOFF.md:298:   SAMAGRA OS vs the prior tabbed portal / point tools. **Pass** = the GUI demonstrably *reduces* total owner
HANDOFF.md:306:it travels with the project. Reviews that informed it: `docs/superpowers/_research/samagra-os/_vision-review-output.md`.
HANDOFF.md:312:   (`73a97b7`+`82edd06`) on `e3/samagra-os` — DEC-4 consciously deferred by the Chairman this session.**
HANDOFF.md:313:4. **Merge `e3/samagra-os`** (present `superpowers:finishing-a-development-branch`).
HANDOFF.md:323:**Repo:** github.com/dbhardwaj86/samagra · `main` (E1 merged, `06d88a3`; **E2 merged, `31aa5bb`**) · **E2 MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` 2026-06-21 (Codex pre-merge review GO; 3 MEDIUMs fixed)** · local-first Python+FastAPI.
HANDOFF.md:324:**State:** Spine + portal + thin/thick exporter + semi-autonomous loop + two read-only subsystem adapters
HANDOFF.md:327:Assignments portal tab, an advisory Codex pre-commit gate (`samagra/review/`), the committed
HANDOFF.md:329:+ fidelity layer**: the `frontend/` React+TS+Vite windowing shell (three themes — aqua/console/samagra chrome
HANDOFF.md:330:· `Icon`/`AppIcon` SVG system · WM · six OS utilities on tested pure-TS engines) served by FastAPI from
HANDOFF.md:337:set PYTHONPATH=%CD%                 # or: export PYTHONPATH=$(pwd) in bash
HANDOFF.md:338:.venv\Scripts\python -m samagra refresh        # rebuild catalog (7,044 artifacts)
HANDOFF.md:339:.venv\Scripts\python -m samagra status
HANDOFF.md:340:.venv\Scripts\python -m samagra export --chapter vectors --variant both
HANDOFF.md:341:.venv\Scripts\python -m samagra tick [--dry-run]
HANDOFF.md:342:.venv\Scripts\python -m samagra gate textbook approve
HANDOFF.md:343:# portal: preview harness (.claude/launch.json -> "samagra") OR:
HANDOFF.md:344:.venv\Scripts\python -m uvicorn samagra.api.app:app --port 8799   # http://127.0.0.1:8799
HANDOFF.md:351:npm run dev                      # Vite :5173, proxies /api,/lecture,/open -> uvicorn :8799
HANDOFF.md:353:npm run build                    # writes frontend/dist/ (FastAPI serves it at / with an SPA fallback)
HANDOFF.md:358:- `samagra/adapters/` — read-only source adapters → common `Artifact` (incl. Phase 1 `mcd.py`, `munshi.py`).
HANDOFF.md:359:- `samagra/clients/` — read-only subsystem HTTP clients: `McdClient` (mycontentdev admin API), `MunshiClient` (`library()`); secret-safe, never logged.
HANDOFF.md:360:- `samagra/governance/store.py` — Phase 2 durable `governance.db` store (D6): `assignments`, `events`, `review_overlay` + `schema_version`/migration hook + `backup()`. **Never delete `governance.db` as a "catalog reset".**
HANDOFF.md:361:- `samagra/review/` — Phase 2 advisory pre-commit Codex review (D5): `codex_dispatch.py` (vendored subprocess shim, lazy exe) + `precommit.py` (confirmed-CRITICAL + `state/review/` diff-hash cache + `SAMAGRA_REVIEW_BREAKGLASS` audit). CLI: `samagra review-staged`.
HANDOFF.md:362:- `.githooks/pre-commit` — committed shim → `python -m samagra.review.precommit`. Activate (owner) with `git config core.hooksPath .githooks`.
HANDOFF.md:364:- `samagra/catalog.py` — `samagra.db` unified catalog (FTS5) + search/overview/facets.
HANDOFF.md:365:- `samagra/state.py` — phase state machine; `state/<pipeline>.orchestrator_state.json` + `tracker.txt`.
HANDOFF.md:366:- `samagra/scheduler.py` — `tick()`, `gate()`, Task Scheduler installer.
HANDOFF.md:367:- `samagra/notify.py` — Telegram + email (creds-gated, always logs `state/notifications.log`).
HANDOFF.md:368:- `samagra/lectures/` — `render.py` (content.json→HTML), `thin.py`, `export.py` (HTML/DOCX/GDocs), `gdocs.py`.
HANDOFF.md:369:- `samagra/api/app.py` — FastAPI; serves the Vite build at `/` (mounts `frontend/dist/assets`, SPA fallback `GET /{full_path}` declared LAST, 404s `api/*`, 503 if not built); `/api/*`, `/lecture/{slug}`, `/open` are a frozen contract.
HANDOFF.md:370:- `frontend/` — **SAMAGRA OS E1 + fidelity layer** (React 18 + TS + Vite; own `package.json`, lockfile tracked, `dist/` gitignored). `src/lib/**` = pure headless-testable engines (WM geometry/z-order, snake, clock, terminal, notes, persistence) each co-located with a `*.test.ts`; `src/stores/**` = thin Zustand over `lib/`; `src/themes/**` = the per-theme token map (aqua/console/samagra — **FD1**); `src/components/{Icon,AppIcon}.tsx` = the SVG icon system (**FD2**, `icons-data.ts`); `src/shell/**` = theme-driven chrome (`ThemeRoot` · `TopBar` · `Dock` · `Taskbar` · `StartMenu` · `Rail` · `WindowFrame` · `ContextMenu`); `src/apps/**` = the six OS utilities; `src/registry.ts` = the frozen 17-app table.
HANDOFF.md:372:## Sources (read-only, paths in samagra/config.py / .env)
HANDOFF.md:379:- Python 3.11 venv (`.venv`) for the portal; system Python is 3.14 (stdlib-only CLI works there too).
HANDOFF.md:380:- Do **not** use `uvicorn --reload` here — an orphaned reload worker held the port once. Use the preview harness or plain uvicorn.
HANDOFF.md:392:0. **E1 BUILT + GREEN + 3-theme/icon fidelity layer landed (2026-06-20) on `e1/samagra-os`.** The full
HANDOFF.md:394:   console · samagra** (all colours/sizes from the `themes/` token map — FD1) and the `Icon`/`AppIcon` SVG
HANDOFF.md:397:   `test_serve_seam.py`). **Owner to-do now:** (a) the **browser-vision pixel QA pass** over the three-theme
HANDOFF.md:399:   NOT claimed**); (b) the merge/integration decision for `e1/samagra-os` (see
HANDOFF.md:401:   over `/api/*`; one hard backend gap = `GET /api/org` via static `samagra/org.py`). **No new creds needed**
HANDOFF.md:406:   pass, never a loop gate** — run once per surface with `npm run dev` (Vite :5173) or a built `samagra
HANDOFF.md:407:   serve`, against the extracted prototype + `screenshots/`. The owner (deepak) signs each row here. **Status:
HANDOFF.md:410:   - [ ] **Theme chrome (×3)** — aqua (top bar **30px** · bottom-centre Dock **radius 20** + hover lift · left traffic-lights), console (no top bar · bottom Taskbar **50px** + Start menu · right-side neon icon controls · active glow ring), samagra (Devanagari **समग्र** top strip · left **Rail 66px** + active accent bar · warm window frame). WindowFrame radii aqua **13** / console **10** / samagra **15**; **38px** title bar; right controls 28×23; double-click maximize; ContextMenu **width 216**.
HANDOFF.md:417:   - [ ] **Snake** — movement feel, speed ramp, death visuals, D-pad, themed board (cream in samagra).
HANDOFF.md:421:1. **Pre-merge Codex review → APPROVE** (gpt-5.5, xhigh): 6 rounds + a CEO adversarial Workflow audit. Caught a never-wedge HIGH, a recurring "outer guard downgrades a confirmed-CRITICAL block" class (5 ever-deeper instances: cache prune, malformed cached findings, broken-stderr warnings, pathological exception str/repr, and a finding's raising `__eq__` on the dedup), + 2 MEDIUM + nits — all fixed TDD (+11 invariant regressions, suite 98). Reports `docs/codex-reviews/07–13` + `12-workflow-invariant-audit.md`.
HANDOFF.md:423:3. **Worktrees created** — `../samagra-{deepak,khanak,codex}` on `agent/{deepak,khanak,codex}`.
HANDOFF.md:428:6. **Google Docs** — set `GOOGLE_OAUTH_CLIENT` (Desktop OAuth JSON); run an export to complete consent flow.
HANDOFF.md:434:deploy QX + portal online (HF Space `QuestionDB` / Docker).
CLAUDE.md:1:# SAMAGRA (repo & Python package = `samagra`) — project notes
CLAUDE.md:4:> Python package are `samagra`** since the Phase-0 rename (2026-06-19). Where the auto-generated memory block
CLAUDE.md:20:> See `docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md`.
CLAUDE.md:27:- (5) 2026-06-22 claude: The Ralph loop's mission is to drive the SAMAGRA OS app to fully working, served from frontend/dist/ by FastAPI on :8799. [Ralph, SAMAGRA OS, FastAPI]
CLAUDE.md:28:- (5) 2026-06-21 claude: The session concluded with a plan to improve the app in a custom ralph loop and deploy to Cloudflare with a custom URL pointing to a localhost tunnel. [deployment, Cloudflare, localhost tunnel, ralph loop]
CLAUDE.md:38:- (5) 2026-06-19 claude: Phase 0 executed: repo renamed from teachingos to samagra, Python package renamed, catalog rebuilt to 7,044 artifacts, 11/11 tests green, docs rebranded. [SAMAGRA, teachingos, rename, catalog, tests, docs]
CLAUDE.md:41:- (5) 2026-06-18 claude: The final plan was recorded using `cbm record-plan docs/superpowers/plans/2026-06-19-samagra-evolution.md --title 'SAMAGRA Evolution'`. [cbm, record-plan, plan storage]
CLAUDE.md:47:- (4) 2026-06-22 claude: The app serves from frontend/dist/ by FastAPI on port 8799. [SAMAGRA OS, FastAPI, frontend]
CLAUDE.md:56:- (4) 2026-06-21 codex: The workers list in samagra/org.py now shows 'Gemini+NotebookLM' as one entry with id 'gemini-notebooklm', while the owners map keeps gemini and notebooklm as distinct keys. [samagra/org.py, worker roster, ownership]

 succeeded in 1902ms:
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:103:  > bridge**, and the invariant becomes *"read-only except owner-initiated capture."* See
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:35:- **New invariant wording:** *"read-only **except owner-initiated capture**."* Every other backend
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:87:- **No automated munshi→mcd bridge.** Promotion of a munshi item into an mcd seed is a manual,
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:89:- **No publish automation.** The human publish/approve gate is untouched and never automated.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:284:| Writing to **production** munshi/mcd | Server-side validation, creds-gating, owner-initiated only, no delete/edit/publish; live verification done deliberately in Slice 6 with the owner |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:313:   "read-only except owner-initiated capture" invariant.
docs/deploy-tunnel.md:20:> owner-initiated capture write-paths (`POST /api/munshi/capture`,
CLAUDE.md:14:> **✅ DEC-3 AMENDMENT (2026-06-21, Chairman):** the read-only firewall is amended to allow **owner-initiated
CLAUDE.md:15:> capture** — exactly two write paths, `POST /api/munshi/capture` (munshi item) and `POST /api/mcd/seeds`
CLAUDE.md:17:> invariant is now *"read-only except owner-initiated capture."* The capture control plane is **live-verified**
HANDOFF.md:7:> Access OTP login; the origin does not fail-closed, so Access is the sole gate). **Merged to `main`**
HANDOFF.md:87:> owner-initiated captures end-to-end** and browses every read-only surface with live data, on branch
HANDOFF.md:132:> **owner-initiated capture** (a munshi item + an mcd seed) is now **in-scope** — the project's only two
HANDOFF.md:137:> owner-initiated capture*."** Spec/plan: `docs/superpowers/{specs/2026-06-21-samagra-control-plane-capture-design.md,plans/2026-06-21-samagra-control-plane-capture.md}`.
HANDOFF.md:265:by the DEC-3 amendment** (see the LATEST banner at the top): the invariant is now *"read-only except
HANDOFF.md:266:owner-initiated capture"* with exactly two write paths (`/api/munshi/capture`, `/api/mcd/seeds`), the
STATUS.html:148:  <p>The SAMAGRA OS now performs <strong>real owner-initiated captures end-to-end</strong> and browses every
STATUS.html:153:  <em>"read-only except owner-initiated capture."</em></p>
STATUS.html:498:    write-paths are not open) — the origin does not fail-closed, so Access is the sole gate.
STATUS.html:547:    The read-only firewall was <strong>amended by the Chairman</strong> to allow <strong>owner-initiated
STATUS.html:548:    capture</strong>: exactly two write paths — <code>POST /api/munshi/capture</code> (a munshi item) and
STATUS.html:550:    there is <strong>no munshi→mcd bridge</strong>, and the invariant becomes <em>"read-only except
STATUS.html:551:    owner-initiated capture."</em> Built TDD on <code>feature/control-plane-capture</code> with an independent

 succeeded in 2060ms:
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:22:## 0. The DEC-3 amendment (Chairman, 2026-06-21)
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:24:This track **deliberately reopens write paths that DEC-3 firewalled earlier the same day.** Recorded
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:27:- **AMEND DEC-3.** *Owner-initiated capture* becomes **in-scope**: the OS may create a **munshi
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:32:  Chairman request); **no app-platform scope** (DEC-1); the **attention-ROI north-star +
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:33:  kill-criterion** (DEC-2) and the **pre-E3 attention-ROI gate** (DEC-4) remain binding; Phase 3's
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:34:  full active loop (auto-proposal, scheduling) stays parked (DEC-5).
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:94:  parked.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:311:7. **DEC-3 amendment + pointer files synced** — `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, both
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:9:> "OS" framing this spec **deliberately retired in §1**, and parks the Phase-3 active loop (§8) below it. A
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:10:> coherence audit flagged this as a direction drift (Codex vision review: **DRIFTING**; implementation audit:
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:11:> **COHERENT-WITH-CAVEATS**). **The attention-ROI north-star (§1) and the kill-criterion (§1) remain the binding
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:13:> console* (scope firewall + a pre-E3 attention-ROI gate; DEC-1…DEC-5), and Phase 3 (the active loop) restarts
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:24:SAMAGRA (समग्र — *integrated / whole*) grows the spine into a **company-structured control plane** for the operator's content lifecycle: a board of three frontier agents governing a worker fleet, folding in `mycontentdev` (editorial seed pipeline) and `munshi` (phone capture clerk), with a blocking pre-commit Codex review and a CEO prompt-outbox. It is inward-facing back-office infrastructure for a single operator (§1), not a product and not an audience-facing OS. *(The "OS" framing is retired — A14/D9; see §1.)*
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:30:SAMAGRA is a *control plane*, deliberately NOT an *operating system*: it routes, reflects, and gates — it does not own a process model, scheduler-as-platform, or app lifecycle. The word "OS" is retired because it silently licenses OS-sized scope; SAMAGRA stays a thin layer over subsystems that remain their own source of truth. (It is deliberately NOT framed as a "single pane of glass" — that framing was rejected as a north-star because it measures *seeing*, not *value*.)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:47:- No mining/learning from the decision ledger in any current phase. **Named-but-dormant:** when built, the DRAFTER may compound on Deepak's approval history (style/selection/structure); ONE adversarial REVIEWER stays anchored ONLY to external read-only ground-truth (answer keys, dimensional consistency, official syllabus weightings, known-misconception lists) and is NEVER trained on Deepak's approvals. Adversarial-reviewer catch-rate trending to zero is a RED FLAG (monoculture), not success. (Whether board-correction-rate ever becomes a headline metric is named only as a dormant possibility — the front-page metric is attention-ROI per D12.)
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:50:**Kill-criterion (anti-vision).** SAMAGRA exists to give back the single operator's scarcest resource — attention. SAMAGRA is FROZEN if, by [Y = end of Phase 2: governance layer green + one golden capture→publish thread proven + N weeks of real operating use], it is not demonstrably saving the owner [X hrs/week — owner to ratify once the Phase-2 attention-ROI gauge (A8/D12) exists; seed proposal ~3 hrs/wk over ~8 weeks, NOT yet binding] of routing/triage/status-chasing versus the prior point-tools workflow. On freeze: no Phase-3 build, revert to point tools, the spine stays only as a read-only status mirror. This is a manual judgement the owner makes from the attention-ROI gauge — never a status SAMAGRA computes about itself, and no hours-saved column is added. Naming the exit now is the cheapest insurance against the meta-tool quietly out-competing the actual teaching product for the operator's time.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:135:- **Board-review overlay** = `samagra.db` tables (§9) recording board-agent approval of *worker outputs* across subsystems; references subsystem records by id, never copies their content. This trajectory/review work-item is the single durable thing SAMAGRA owns — it tracks *trajectory*, not content (§2 boundary unchanged). **Phasing note (D9a):** although described here under Phase 1, the durable table that realizes this overlay (`review_overlay`, with `assignments`/`events`) is a **PHASE-2** build (plan `governance/store.py`; §9; D6 splits it into `governance.db`). The spec's Phase-1 placement is superseded by the runbook (D6) + the Phase-1 loop backlog, which creates NO governance table in Phase 1. Phase 1 reflects subsystem state only and adds no governance schema. **Front-page metric (A8/D12):** the chosen north-star is attention-ROI (minutes-of-Deepak-attention-per-published-artifact), computed from the `events` ledger — therefore a Phase-2 render, zero Phase-1 schema; coverage-at-tier is the named-dormant Phase-2+ successor.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:149:> **SUPERSEDED by runbook D5/D9 (2026-06-19):** the gate is **advisory-local** — it blocks only a *confirmed*-CRITICAL finding surviving the staged-diff-hash cache, with an **audited break-glass** (`SAMAGRA_REVIEW_BREAKGLASS="<reason>"`, logged), and **real enforcement in CI / branch protection** — **NOT** fail-closed / no-escape-hatch. The bullets below describe the original (retired) fail-closed design; read them through D5/D9. The human publish gate (Gate 1) is the only sacred, never-automated block.
docs/superpowers/specs/2026-06-19-samagra-evolution-design.md:192:**Gate model (folds A5 / runbook D9; supersedes §9.8).** Three ranked gates only: **Gate 1** — the human publish gate (BLOCKING, sacred, never automated) carries the physics-correctness checklist (sign conventions; limiting cases; difficulty/JEE-NEET calibration; ambiguity; corpus-linkage) as human-run prose at the existing `publish` gate (no new column/status/step); **Gate 2** — Codex pre-commit (BLOCKING, repo-wide per D5: advisory-local + confirmed-CRITICAL-only + audited break-glass + enforced-CI); **Gate 3** — advisory (non-blocking) for all other code/physics review. The fail-closed / no-escape-hatch language of §9.8 + §7c is **retired** (D5/D9).
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:17:> *retired* the word "OS"** — *"it silently licenses OS-sized scope"* — and bound SAMAGRA to an
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:18:> **attention-ROI north-star + a kill-criterion** (freeze if not saving the owner ~3 hrs/wk by Phase 2). An
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:21:> work" and firewalls write paths) but **never restates the attention-ROI metric or the kill-criterion**, and
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:23:> value sits unaddressed. **Decided (now BINDING — see HANDOFF DEC-1…DEC-5; firewall in §3, gate in §2):** (1) frame SAMAGRA OS as a *bounded operator
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:24:> console / UI-metaphor only* — no app-platform scope; (2) restate the attention-ROI north-star + ~3 hrs/wk
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:25:> kill-criterion as still binding (data source = the governance `events`/`review_overlay` ledger); (3) add a
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:27:> process-scheduler model, no user-facing identity); (4) add an attention-ROI acceptance gate before E3; (5) give
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:35:the retired Jinja portal with a windowing-metaphor shell: a top bar / dock, free-floating
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:44:priority**; the backend "active loop" is parked (kept planned, deprioritized).
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:54:`samagra/portal/` is retired (kept in git history); two agents own disjoint worktrees; the
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:84:> **E3 is gated (DEC-4, ratified 2026-06-21).** Before any E3 work (mobile device mode / further theme polish)
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:85:> begins, an **attention-ROI acceptance gate** must pass: 2–3 representative operator tasks measured for owner
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:87:> active loop). The attention-ROI north-star + kill-criterion (the 2026-06-19 vision §1) remain **binding**
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:88:> (DEC-2). See `HANDOFF.md` → *Direction-coherence DECISION*.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:94:- **Scope firewall (DEC-3, ratified 2026-06-21).** SAMAGRA OS is a **bounded operator console — a UI metaphor
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:99:  > **⚠ AMENDED 2026-06-21 (DEC-3 amendment, Chairman) — post-E2 capture track.** Owner-initiated
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:105:- **The active loop stays parked.** Former Phase 3 of `docs/superpowers/plans/2026-06-19-samagra-evolution.md`
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:161:| `lib/clock/stopwatch.ts` | drift-free elapsed (wall-anchor `start=now-elapsed`), lap splits, `fmtMs` | Pure over an injected `now()`; assert elapsed/splits with a fake clock — no real 33ms interval |
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:170:> Rationale recap: the hard, bug-prone logic (window clamp math, snake death/grow, drift-free
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:195:chrome and the math never drift.
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:308:geometry px, snake death/grow/no-reverse with injected RNG, drift-free stopwatch with a fake
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:323:`tsc --noEmit` (`npm run typecheck`) catches contract drift against `types/contracts.ts`;
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:389:| **Heterogeneous `/api/overview` summary shape** drifts client glue | Optional `GET /api/dashboard` aggregator; otherwise type the per-source summary in `contracts.ts` and read defensively (the current portal already does this client-side) |
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:392:| **Timer/interval drift + leak** (stopwatch/timer/snake/clock intervals) | Drift-free wall-anchor math in pure modules (injected `now()`); interval hygiene in `os/` — created on start, cleared on stop/pause/close/unmount; snake stops on close, pauses on minimize |
docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md:428:   - **Clock** — analog (correct hand angles, 1s step), stopwatch (drift-free, laps),
SUMMARY.html:128:  ul.clean.parked li::before{background:var(--border)}
SUMMARY.html:178:    <a href="#decided">Decided &amp; parked</a>
SUMMARY.html:374:        drifted from the original plan, which had deliberately dropped the word "OS". <strong>Deepak's call (now
SUMMARY.html:375:        decided):</strong> keep the control room a <strong>plain operator console</strong> — a way to see and run
SUMMARY.html:385:      <p class="eyebrow">06 · Decided &amp; parked</p>
SUMMARY.html:401:          <ul class="clean parked">
CLAUDE.md:8:> the strategic direction drifting — "SAMAGRA OS" had re-introduced the OS-sized scope the 2026-06-19 vision
CLAUDE.md:9:> deliberately retired. **Decided & binding:** SAMAGRA OS is a *bounded operator console* (UI metaphor only); the
CLAUDE.md:10:> attention-ROI north-star + kill-criterion stay binding; a scope firewall + a pre-E3 attention-ROI gate are in
CLAUDE.md:14:> **✅ DEC-3 AMENDMENT (2026-06-21, Chairman):** the read-only firewall is amended to allow **owner-initiated
CLAUDE.md:32:- (5) 2026-06-21 claude: Scope firewall and attention-ROI gate were implemented to prevent scope creep and maintain focus. [scope firewall, attention-ROI gate, project management]
CLAUDE.md:54:- (4) 2026-06-21 claude: OS-drift finding was finalized as decided and closed. [OS-drift, design decision]
HANDOFF.md:21:> - **DEC-4** attention-ROI gate stays ASSUMED-UNBLOCKED for this work (deferred, not voided); DEC-1/DEC-3 + the
HANDOFF.md:26:> merged**). **⚠ DEC-4 was consciously deferred by the Chairman for this session** — the owner explicitly chose
HANDOFF.md:27:> "proceed with E3 now" rather than run the attention-ROI acceptance gate first. **DEC-4 is NOT satisfied; it
HANDOFF.md:54:>   the QX-backed Questions + capture work). **Still owed before deeper GUI investment: the DEC-4 attention-ROI
HANDOFF.md:131:> **✅ DEC-3 AMENDMENT (2026-06-21, Chairman Deepak).** The morning's DEC-3 read-only firewall is amended:
HANDOFF.md:135:> scope (DEC-1); attention-ROI north-star + kill-criterion (DEC-2) + the pre-E3 gate (DEC-4) hold;
HANDOFF.md:136:> Phase-3's full active loop stays parked (DEC-5). **New invariant wording: "read-only *except
HANDOFF.md:211:> shared leaf components, and the FastAPI serve seam (Vite `dist/` + SPA fallback, jinja portal route retired).
HANDOFF.md:262:strategic direction drifting.** Execution verified clean: every merge claim holds (E1 `06d88a3`, E2 `31aa5bb`,
HANDOFF.md:265:by the DEC-3 amendment** (see the LATEST banner at the top): the invariant is now *"read-only except
HANDOFF.md:268:and live suites are **backend 106 pytest + frontend 501 vitest** green. **The drift is strategic, not factual:**
HANDOFF.md:270:- The **2026-06-19 evolution spec deliberately retired the word "OS"** — *"the word 'OS' is retired because it
HANDOFF.md:271:  silently licenses OS-sized scope"* — and bound the project to an **attention-ROI north-star + a kill-criterion**
HANDOFF.md:274:  priority** and **parked the value-producing active loop** (munshi → seed → board-approve → publish — the
HANDOFF.md:277:  work" and firewalls write paths) but **never restates the attention-ROI metric or the kill-criterion**, and
HANDOFF.md:284:1. **DEC-1 · Scope.** SAMAGRA OS is a **bounded operator console — a UI metaphor only.** SAMAGRA remains a
HANDOFF.md:287:2. **DEC-2 · North-star binding.** The **attention-ROI north-star** (minutes-of-owner-attention per published
HANDOFF.md:288:   artifact) and the **kill-criterion** from the 2026-06-19 vision remain **BINDING** and are not voided by the
HANDOFF.md:290:   proposal; the owner ratifies the exact threshold when the DEC-4 gauge first runs.)
HANDOFF.md:291:3. **DEC-3 · Scope firewall** (now a hard non-goal, mirrored into OS spec §3): **no** entertainment apps beyond
HANDOFF.md:294:4. **DEC-4 · Attention-ROI acceptance gate before E3.** Before any E3 work (mobile device mode / further theme
HANDOFF.md:299:   time (net-positive attention-ROI). **Fail** = freeze GUI expansion (per DEC-2's kill-criterion) and
HANDOFF.md:301:5. **DEC-5 · Phase 3 is the primary value engine.** The active loop (munshi → seed → board-approve → publish)
HANDOFF.md:302:   restarts **after the E2 visual-QA pass and the DEC-4 gate**, ahead of further theme/mobile polish — it is not
HANDOFF.md:312:   (`73a97b7`+`82edd06`) on `e3/samagra-os` — DEC-4 consciously deferred by the Chairman this session.**
HANDOFF.md:315:6. **Run the DEC-4 attention-ROI acceptance gate** — still the binding gate for the Phase-3-vs-GUI
STATUS.html:124:  field/status/step). Four Chairman calls were recorded — north-star = attention-ROI, concept vocabulary =
STATUS.html:151:  Per the <strong>DEC-3 amendment</strong> (Chairman, 2026-06-21) the read-only firewall now allows exactly two
STATUS.html:178:    <div class="card"><div class="n">3 <span class="badge park">parked</span></div><div class="l">Active loop — munshi → proposed seed (w/ pointers) → board approve → capture API. <strong>Deprioritised 2026-06-20</strong> for the Experience track; plan complete, resumes after SAMAGRA OS.</div></div>
STATUS.html:195:  The backend active loop (Phase 3) is <span class="badge park">parked</span> until the Experience track lands.</p>
STATUS.html:200:    <div class="card"><div class="n">E3 <span class="badge ok">built · green</span></div><div class="l"><strong>Built TDD on <code>e3/samagra-os</code> (2026-06-22, not merged).</strong> <strong>Mobile device mode</strong> — theme store <code>mobileApp</code> + <code>openMobileApp</code>/<code>goHome</code> (<code>setDevice</code> resets it); new <code>shell/Mobile.tsx</code> phone frame (notch · 44px status bar · 4-col app grid · favorites dock · home-indicator); <code>App.tsx</code> branches on <code>device</code>. <strong>Theme-correct WM geometry</strong> — <code>windowManager</code> tracks the active theme so open/move/maximize/tile use that theme's <code>workArea</code>+<code>barH</code> (fixes console/samagra). <strong>Responsive Dashboard</strong> (HIGH#2) — lower grid now <code>auto-fit minmax(260px,1fr)</code>, stacks on the phone. Terminal <code>open</code> made device-aware. Adversarial multi-agent review (6 raw → 3 confirmed, all fixed). Gate: backend <strong>152 pytest</strong> + frontend <strong>541 vitest</strong> + <code>tsc</code>/<code>vite build</code>. <strong>⚠ DEC-4 consciously deferred</strong> by the Chairman; pixel parity = separate owner pass (not claimed).</div></div>
STATUS.html:222:  <code>dist/</code> + SPA fallback, jinja portal route retired). <strong>Fidelity layer (this gate):</strong>
STATUS.html:235:  <strong>execution coherence strong, but strategic direction drifting</strong>. The drift has now been
STATUS.html:240:    <div class="card"><div class="n">⚠ <span class="badge todo">direction drifting</span></div><div class="l">The 2026-06-19 vision <em>retired</em> the word "OS" (<em>"it silently licenses OS-sized scope"</em>) and bound the project to an attention-ROI kill-criterion — yet the project pivoted to a literal 17-app "SAMAGRA OS" and parked the value-producing active loop. Codex verdict <strong>DRIFTING</strong>; audit verdict <strong>COHERENT-WITH-CAVEATS</strong> (this is the caveat).</div></div>
STATUS.html:243:  honest shape of the work" and firewalls write paths, but <strong>never restates the attention-ROI north-star
STATUS.html:244:  or the kill-criterion</strong>, and the value-producing <a href="#samagra">active loop (Phase 3)</a> — the
STATUS.html:245:  mechanism that actually saves owner attention — is parked while OS chrome (3 themes, a Snake game, mobile mode)
STATUS.html:251:    <li><strong>DEC-1 · Scope.</strong> SAMAGRA OS is a <strong>bounded operator console — a UI metaphor only</strong>; SAMAGRA remains a control plane and does not acquire app-platform scope.</li>
STATUS.html:252:    <li><strong>DEC-2 · North-star binding.</strong> The attention-ROI north-star + the kill-criterion remain <strong>binding</strong> and are not voided by the OS track (data source = the governance <code>events</code>/<code>review_overlay</code> ledger; the ~3 hrs/wk figure stays the seed proposal pending the DEC-4 gauge).</li>
STATUS.html:253:    <li><strong>DEC-3 · Scope firewall</strong> (hard non-goal, mirrored into OS spec §3): no entertainment apps beyond E1's Snake, no third-party apps / marketplace, no process-scheduler model, no user-facing product identity.</li>
STATUS.html:254:    <li><strong>DEC-4 · Attention-ROI acceptance gate before E3:</strong> 2–3 representative operator tasks (triage munshi captures · read pipeline/gate status · find + open a catalog artifact) measured for owner time-saved vs the old portal; fail → freeze GUI expansion + reprioritize Phase 3. <strong>⚠ Consciously DEFERRED 2026-06-22</strong> — the Chairman chose to build E3 first this session. The gate is <strong>not satisfied and not voided</strong>; it remains the binding gate for the Phase-3-vs-GUI reprioritization and should run before further GUI investment.</li>
STATUS.html:255:    <li><strong>DEC-5 · Phase 3 is the primary value engine</strong> — the active loop restarts after the E2 visual-QA pass and the DEC-4 gate, ahead of further theme/mobile polish.</li>
STATUS.html:507:  <div class="log"><div class="d">2026-06-22 · Phase E3 built (mobile + polish); DEC-4 consciously deferred by the Chairman</div>
STATUS.html:508:    The owner was asked how to handle E3 given the binding <strong>DEC-4 attention-ROI gate</strong> (which the
STATUS.html:509:    Chairman ratified 2026-06-21 to precede any E3 work) and chose <strong>"proceed with E3 now"</strong> — DEC-4 is
STATUS.html:546:  <div class="log"><div class="d">2026-06-21 · Capture control plane LIVE + DEC-3 amended (Chairman)</div>
STATUS.html:666:    portal route retired, <code>/api/*</code> frozen). Gate: <code>npm run verify</code> clean (lint +
STATUS.html:672:  <div class="log"><div class="d">2026-06-20 · New top priority — SAMAGRA OS (Experience track); active loop parked</div>
STATUS.html:675:    track</strong>. The backend <strong>active loop (Phase 3) is parked</strong> (plan complete, resumes
STATUS.html:737:    attention-ROI, vocab = mycontentdev taxonomy leaves, first autonomy lane = adapter-refresh, corpus may
STATUS.html:767:    <tr><td><code>samagra/api/app.py</code> + <code>tests/test_serve_seam.py</code></td><td>FastAPI serve seam — mounts Vite <code>dist/</code>, SPA fallback (404s <code>api/*</code>, 503 if unbuilt); jinja portal route retired</td></tr>
STATUS.html:795:    <li><strong>DEC-4 attention-ROI acceptance gate</strong> — deferred (not voided); still the <em>binding</em> gate for the Phase-3-vs-GUI reprioritization before deeper GUI investment.</li>
STATUS.html:837:  <span class="badge park">parked</span> (plan complete, resumes after the Experience track); reconcile its
STATUS.html:858:    <tr><td>Direction-coherence decision (OS drift)</td><td><span class="badge ok">decided · ratified 2026-06-21</span></td><td><strong>Ratified by Deepak.</strong> SAMAGRA OS = bounded operator console (UI metaphor only); attention-ROI north-star + kill-criterion remain binding; scope firewall + the pre-E3 attention-ROI gate (DEC-4) now in force; Phase 3 (active loop) restarts after the E2 visual-QA pass + DEC-4. See the <a href="#coherence">Direction coherence</a> section + <code>HANDOFF.md</code>.</td></tr>
STATUS.html:859:    <tr><td>SAMAGRA OS — attention-ROI gate (DEC-4)</td><td><span class="badge todo">required before E3</span></td><td><strong>New gate.</strong> Measure owner time-saved on 2–3 representative operator tasks via SAMAGRA OS vs the old portal; must pass before any E3 (mobile / theme-polish) work. Fail → freeze GUI expansion + reprioritize Phase 3 (active loop).</td></tr>
STATUS.html:861:    <tr><td>SAMAGRA OS — E3 (mobile device mode + theme polish)</td><td><span class="badge park">planned</span></td><td>Mobile device mode (phone frame + home-screen grid + single-app mode) + remaining per-theme re-skin polish; the three desktop themes already shipped in E1. Skeletoned in the plan. <strong>Gated on the DEC-4 attention-ROI gate</strong> (see Direction coherence).</td></tr>
STATUS.html:862:    <tr><td>Phase 3 — active loop (backend)</td><td><span class="badge park">parked</span></td><td>Deprioritised 2026-06-20 for the Experience track; plan complete, resumes after. Will need live munshi creds in <code>.env</code>.</td></tr>

 succeeded in 2345ms:
   1: {
   2:   "version": "0.0.1",
   3:   "configurations": [
   4:     {
   5:       "name": "samagra",
   6:       "runtimeExecutable": ".venv/Scripts/python.exe",
   7:       "runtimeArgs": ["-m", "uvicorn", "samagra.api.app:app", "--host", "127.0.0.1", "--port", "8799"],
   8:       "port": 8799,
   9:       "autoPort": false
  10:     },
  11:     {
  12:       "name": "samagra-os-ui",
  13:       "runtimeExecutable": "npm",
  14:       "runtimeArgs": ["--prefix", "frontend", "run", "dev"],
  15:       "port": 5173
  16:     }
  17:   ]
  18: }

codex
The `/open` path traversal guard resolves and confines paths under configured roots, so classic `../` traversal looks blocked. The risk is broader: those configured roots are whole source trees, so `/open?path=...` can serve any file under them if the caller knows the path.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"munshi.*mcd|mcd.*munshi|create_seed\\(|create_item\\(|POST /api/seeds|/api/seeds|publish|approve|bridge|promotion|promote\" samagra frontend/src tests docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md HANDOFF.md CLAUDE.md STATUS.html" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "dangerouslySetInnerHTML|innerHTML|DOMPurify|sanitize|bleach|html" frontend/src samagra | Select-Object -First 80' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"source|path|url|href|safeUrl|FileResponse|/open|open\\?path|encodeURIComponent|artifact\" frontend/src samagra/api/app.py samagra/catalog.py" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"@app\\.post|@app\\.get|@app\\.delete|@app\\.put|@app\\.patch\" samagra/api/app.py" in C:\SandBox\claude_box\TeachingOS
 succeeded in 1467ms:
CLAUDE.md:15:> capture** — exactly two write paths, `POST /api/munshi/capture` (munshi item) and `POST /api/mcd/seeds`
CLAUDE.md:16:> (mcd seed). The human **publish gate stays never-automated**, there is **no munshi→mcd bridge**, and the
HANDOFF.md:22:>   never-automated publish gate still hold. Loop prompt/backlog under `docs/superpowers/loops/ralph-deploy/`.
HANDOFF.md:94:>   `POST {apiUrl}/api/seeds` **form-encoded**, `x-mcd-admin: <adminKey>` (the existing read key
HANDOFF.md:96:> - **Live-read passthroughs** `GET /api/munshi/library` + `GET /api/mcd/seeds` — the capture apps read
HANDOFF.md:132:> **owner-initiated capture** (a munshi item + an mcd seed) is now **in-scope** — the project's only two
HANDOFF.md:133:> subsystem write paths. **Still binding & unchanged:** the human publish gate is **never automated**;
HANDOFF.md:134:> **no automated munshi→mcd bridge** (promotion is a later explicit Chairman action); no app-platform
HANDOFF.md:171:> INSP/Olympiad · Simulations** (owner claude-khanak). No new write paths; mcd/munshi render empty-or-unavailable
HANDOFF.md:254:> mcd/munshi hardcode `physics`, qx derives from the builder DB — so a catalog-wide `DISTINCT subject`
HANDOFF.md:266:owner-initiated capture"* with exactly two write paths (`/api/munshi/capture`, `/api/mcd/seeds`), the
HANDOFF.md:274:  priority** and **parked the value-producing active loop** (munshi → seed → board-approve → publish — the
HANDOFF.md:287:2. **DEC-2 · North-star binding.** The **attention-ROI north-star** (minutes-of-owner-attention per published
HANDOFF.md:301:5. **DEC-5 · Phase 3 is the primary value engine.** The active loop (munshi → seed → board-approve → publish)
HANDOFF.md:342:.venv\Scripts\python -m samagra gate textbook approve
HANDOFF.md:358:- `samagra/adapters/` — read-only source adapters → common `Artifact` (incl. Phase 1 `mcd.py`, `munshi.py`).
HANDOFF.md:402:   (the GUI reads existing `/api/*`); E2's mcd/munshi apps render graceful creds-gated empty states.
HANDOFF.md:429:7. **Phase 3 munshi** — drop `MUNSHI_API_URL` + `MUNSHI_SECRET` into `.env` (live worker secret value) to switch on the active loop's munshi reads. mcd already reads live via `mcd-cloud.json`.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:8:> **Inputs read & verified (live where noted):** `samagra/clients/{munshi_client,mcd_client}.py`,
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:9:> `samagra/adapters/{munshi,mcd,sims,qx}.py`, `samagra/api/app.py`, the 4 frontend apps
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:28:  front-desk item** (`POST /api/item`) and a **mycontentdev seed** (`POST /api/seeds`). These are
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:30:- **Unchanged & still binding:** the **human publish gate stays never-automated** (the sole sacred
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:31:  mutation); **no automated munshi→mcd bridge** (promotion happens only on an explicit later
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:87:- **No automated munshi→mcd bridge.** Promotion of a munshi item into an mcd seed is a manual,
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:89:- **No publish automation.** The human publish/approve gate is untouched and never automated.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:108:React app  ──POST /api/mcd/seeds──────►  FastAPI route  ──►  McdClient.create_seed   ──►  mycontentdev    POST /api/seeds  (x-mcd-key)
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:115:- **Validated server-side.** Reject empty/invalid `kind` (munshi) / `type` (mcd) with **400**.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:162:- **Client:** add `MunshiClient.create_item(kind, fields)` → `POST /api/item` with
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:171:> (header `x-mcd-admin`) authorizes `/api/seeds` — `GET /api/seeds?limit=1` returned 200 with real
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:173:> (ADMIN_KEY), and `functions/api/seeds/index.js` adds **no** per-route re-check — so the seed
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:177:- **Write (contract read from deployed `functions/api/seeds/index.js`):** `POST {apiUrl}/api/seeds`
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:182:- **Client:** add `McdClient.create_seed(fields: dict)` → `requests.post(.../api/seeds,
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:217:  Per the approved default, capture submits **directly on click** (no extra confirm dialog); the
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:223:- **Publish gate sacred.** No publish/approve automation anywhere in this track.
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:271:| `mcd-cloud.json` `adminKey` | mcd **reads** *and* **seed write** | ✅ present; live-verified to authorize `/api/seeds` |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:284:| Writing to **production** munshi/mcd | Server-side validation, creds-gating, owner-initiated only, no delete/edit/publish; live verification done deliberately in Slice 6 with the owner |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:286:| mcd write auth (which key?) | **Resolved** — deployed middleware accepts `adminKey` for `/api/seeds` (live-verified GET 200); no per-route re-check. `create_seed` uses `x-mcd-admin: adminKey`. First live write is a single benign seed the owner can archive |
docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:291:| Scope creep back toward the active loop | Explicit non-goals (§3); no scheduler/bridge/publish work |
STATUS.html:94:  gates at publish and Telegram + email notifications.</p>
STATUS.html:102:  approved design spec and a 34-task, four-phase implementation plan are committed and recorded
STATUS.html:122:  three-gate model (the human publish gate is the only sacred block; the Codex gate stays advisory-local
STATUS.html:125:  mycontentdev taxonomy leaves, first autonomy lane = adapter-refresh, and the published corpus may be
STATUS.html:152:  write paths; the human publish gate stays never-automated; no munshi→mcd bridge. Invariant:
STATUS.html:156:    <div class="card"><div class="n">mcd seed <span class="badge ok">write</span></div><div class="l"><code>POST /api/mcd/seeds</code> → live <code>McdClient.create_seed</code> → <code>/api/seeds</code> (form-encoded, <code>x-mcd-admin</code>). Existing adminKey authorizes the write — no APP_PASSWORD needed.</div></div>
STATUS.html:157:    <div class="card"><div class="n">Live reads <span class="badge ok">done</span></div><div class="l"><code>GET /api/munshi/library</code> + <code>GET /api/mcd/seeds</code> read the live deployed workers (not the catalog), so captures appear on refetch without a refresh.</div></div>
STATUS.html:178:    <div class="card"><div class="n">3 <span class="badge park">parked</span></div><div class="l">Active loop — munshi → proposed seed (w/ pointers) → board approve → capture API. <strong>Deprioritised 2026-06-20</strong> for the Experience track; plan complete, resumes after SAMAGRA OS.</div></div>
STATUS.html:182:  review worker output and approve writes; <strong>Deepak</strong> (human) is Founder &amp; Chairman, the
STATUS.html:183:  final publish gate. Workers (Gemini+NotebookLM, Grok, Hermes) produce drafts only.
STATUS.html:309:    <tr><td>Claude #2 (Khanak)</td><td>COO / CCO · board</td><td>Parallel content worker / QA / summarization; approves content</td></tr>
STATUS.html:318:  worker fleet that drafts (never self-approves), and the data/capture departments.</p>
STATUS.html:355:    <text class="sw" x="460" y="73" text-anchor="middle">Founder &amp; Chairman · final publish gate</text>
STATUS.html:374:    <text class="lbl" x="460" y="232" text-anchor="middle">WORKERS — drafts only, never self-approve</text>
STATUS.html:549:    <code>POST /api/mcd/seeds</code> (an mcd seed). The human <strong>publish gate stays never-automated</strong>,
STATUS.html:550:    there is <strong>no munshi→mcd bridge</strong>, and the invariant becomes <em>"read-only except
STATUS.html:554:    (<code>/api/munshi/library</code>, <code>/api/mcd/seeds</code>); Simulations shows the <strong>482 deployed
STATUS.html:601:    (owner claude-khanak). No new write paths; mcd/munshi render empty-or-unavailable states; Munshi
STATUS.html:749:    mycontentdev read via cloud admin API (<code>x-mcd-admin</code>); munshi via <code>driver.mjs library()</code> (cookie auth, <code>MUNSHI_SECRET</code>); SAMAGRA mirrors subsystem state + a thin board-review overlay — no parallel state machine.</div>
STATUS.html:754:    the durable governance store splits from the rebuildable catalog (D6). Only board agents approve writes.</div>
STATUS.html:769:    <tr><td><code>docs/superpowers/specs/2026-06-19-samagra-evolution-design.md</code></td><td>approved SAMAGRA design spec (integration contracts verified)</td></tr>
STATUS.html:777:    <tr><td><code>samagra/clients/{mcd_client,munshi_client}.py</code></td><td>Phase 1 — read-only subsystem HTTP clients (secret-safe)</td></tr>
STATUS.html:778:    <tr><td><code>samagra/adapters/{mcd,munshi}.py</code> + 3 test suites</td><td>Phase 1 — subsystem adapters + <code>mycontentdev</code> pipeline + <code>_reflect_mycontentdev</code> (TDD, HTTP mocked)</td></tr>
STATUS.html:836:  <strong>Phase 3 — the active loop</strong> (munshi → proposed seed → board approve → capture API) is now
samagra\__main__.py:150:    g = sub.add_parser("gate", help="approve/reject a pipeline's hard gate")
samagra\__main__.py:152:    g.add_argument("decision", choices=["approve", "reject"])
samagra\state.py:21:        "phases": ["draft", "enrich", "approve", "export"],
samagra\state.py:22:        "gates": ["approve"],
samagra\state.py:24:                   "approve": "human", "export": "teachingos"},
samagra\state.py:28:        "phases": ["capture", "enrich", "review", "publish"],
samagra\state.py:29:        "gates": ["review", "publish"],
samagra\state.py:31:                   "review": "claude1", "publish": "human"},
samagra\state.py:47:        "phases": ["plan", "generate", "publish"],
samagra\state.py:48:        "gates": ["publish"],
samagra\state.py:49:        "owners": {"plan": "claude1", "generate": "notebooklm", "publish": "human"},
frontend/src\types\contracts.ts:72:// ── Overview (GET /api/overview) — promote Dashboard's inline types ───────────
frontend/src\types\contracts.ts:94:export type AssignmentStatus = "queued" | "running" | "in-review" | "approved" | "changes";  // HYPHEN
samagra\scheduler.py:4:the real physics-textbook state into the `textbook` pipeline, raise the `approve`
samagra\scheduler.py:6:chapters that have been approved through SAMAGRA. Hard gates never auto-advance.
samagra\scheduler.py:22:EXPORT_BATCH = 3  # chapters exported per tick once approved (bounded)
samagra\scheduler.py:36:        return {"total": 0, "drafted": 0, "enriched": 0, "approved": 0, "chapters": []}
samagra\scheduler.py:39:    done_states = {"drafted", "in-review", "approved", "enriched"}
samagra\scheduler.py:44:        "approved": sum(1 for c in ch if c.get("status") == "approved"),
samagra\scheduler.py:63:    if ready and st["phases"]["approve"]["status"] == "pending":
samagra\scheduler.py:65:            state.set_phase("textbook", "approve", "awaiting_gate")
samagra\scheduler.py:67:                       f'textbook: "approve" gate ready — {c["drafted"]}/{c["total"]} '
samagra\scheduler.py:93:    # All seeds done -> publish phase done.
samagra\scheduler.py:94:    if c["total"] and c["done"] >= c["total"] and st["phases"]["publish"]["status"] != "done":
samagra\scheduler.py:96:            state.set_phase("mycontentdev", "publish", "done",
samagra\scheduler.py:111:    if st["phases"]["approve"]["status"] != "done":
samagra\scheduler.py:112:        return 0  # not approved yet
samagra\scheduler.py:184:                       f'{counts["approved"]} approved')
samagra\scheduler.py:199:    if decision not in ("approve", "reject"):
samagra\scheduler.py:219:    if decision == "approve":
samagra\scheduler.py:220:        state.set_phase(pipeline, target, "done", approved_at=_stamp())
samagra\scheduler.py:221:        notify.notify("gate-approved", f'{pipeline}: "{target}" approved.')
tests\test_api_live_reads.py:1:"""Live-read passthroughs: /api/munshi/library and /api/mcd/seeds.
tests\test_api_gate.py:20:    state.init("textbook")  # prereqs incomplete, approve gate still pending
tests\test_api_gate.py:23:        api.api_gate("textbook", "approve")
tests\test_api_gate.py:29:    assert state.load("textbook")["phases"]["approve"]["status"] == "pending"
tests\test_api_gate.py:37:    state.set_phase("textbook", "approve", "awaiting_gate")
tests\test_api_gate.py:39:    result = api.api_gate("textbook", "approve")
tests\test_api_gate.py:40:    assert result["decision"] == "approve" and result["gate"] == "approve"
tests\test_api_gate.py:41:    assert state.load("textbook")["phases"]["approve"]["status"] == "done"
tests\test_api_capture.py:10:        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 7}
tests\test_api_capture.py:35:        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 1}
tests\test_api_capture.py:45:        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 2}
tests\test_api_capture.py:68:        def create_item(self, kind, fields): raise RuntimeError("secret: token=abc123 https://munshi.internal")
tests\test_api_capture.py:80:        def create_seed(self, fields): captured.update(fields); return {"id": "s1", "status": "captured"}
tests\test_api_capture.py:104:        def create_seed(self, fields): raise RuntimeError("secret: x-mcd-admin=adminKEY123 https://mcd.internal")
tests\test_scheduler.py:7:def test_gate_approve_marks_done(tmp_path, monkeypatch):
tests\test_scheduler.py:12:    state.set_phase("textbook", "approve", "awaiting_gate")
tests\test_scheduler.py:13:    res = scheduler.gate("textbook", "approve")
tests\test_scheduler.py:14:    assert res["decision"] == "approve" and res["gate"] == "approve"
tests\test_scheduler.py:15:    assert state.load("textbook")["phases"]["approve"]["status"] == "done"
tests\test_scheduler.py:19:    """F-02: gate() must refuse to approve a gate whose prerequisites are not done.
tests\test_scheduler.py:22:    the ``approve`` gate still ``pending`` (never raised to ``awaiting_gate``).
tests\test_scheduler.py:26:    state.init("textbook")  # all phases pending; approve never reached awaiting_gate
tests\test_scheduler.py:28:    res = scheduler.gate("textbook", "approve")
tests\test_scheduler.py:32:    assert state.load("textbook")["phases"]["approve"]["status"] == "pending"
tests\test_scheduler.py:36:    state.set_phase("textbook", "approve", "awaiting_gate")
tests\test_scheduler.py:37:    res2 = scheduler.gate("textbook", "approve")
tests\test_scheduler.py:39:    assert state.load("textbook")["phases"]["approve"]["status"] == "awaiting_gate"
tests\test_scheduler.py:41:    # Conversely: once prereqs are done AND the gate is awaiting_gate, approve works.
tests\test_scheduler.py:44:    state.set_phase("textbook", "approve", "awaiting_gate")
tests\test_scheduler.py:45:    res3 = scheduler.gate("textbook", "approve")
tests\test_scheduler.py:46:    assert res3.get("decision") == "approve" and res3.get("gate") == "approve"
tests\test_scheduler.py:47:    assert state.load("textbook")["phases"]["approve"]["status"] == "done"
tests\test_scheduler.py:53:    # F-02: a reject decision, like approve, is only valid once the gate is
samagra\api\app.py:200:        created = client.create_item(kind, fields)
samagra\api\app.py:211:def api_mcd_create_seed(payload: dict):
samagra\api\app.py:227:        created = client.create_seed(fields)
tests\test_reflect_mycontentdev.py:17:    assert spec["phases"] == ["capture", "enrich", "review", "publish"]
tests\test_reflect_mycontentdev.py:20:        "review": "claude1", "publish": "human",
tests\test_reflect_mycontentdev.py:28:    assert set(spec["phases"]) == {"capture", "enrich", "review", "publish"}
tests\test_reflect_mycontentdev.py:84:def test_reflect_publish_done_when_all_done(monkeypatch):
tests\test_reflect_mycontentdev.py:89:    assert st["phases"]["publish"]["status"] == "done"
tests\test_reflect_mycontentdev.py:92:def test_reflect_publish_not_done_when_partial(monkeypatch):
tests\test_reflect_mycontentdev.py:93:    # Not all seeds done -> publish stays pending; a draft_ready still opens review.
tests\test_reflect_mycontentdev.py:98:    assert st["phases"]["publish"]["status"] == "pending"
tests\test_governance.py:113:    store.append_event(conn, actor="system", verb="bridge_scan",
tests\test_governance.py:120:    assert e["verb"] == "bridge_scan"
tests\test_governance.py:127:                     reviewer="khanak", verdict="approved",
tests\test_governance.py:131:    assert rows[0]["verdict"] == "approved"
tests\test_clients.py:7:create_seed (mcd) and create_item (munshi) are the owner-initiated capture writes
tests\test_clients.py:12:from samagra.clients import mcd_client, munshi_client
tests\test_clients.py:99:    out = c.create_seed({"type": "rough_idea", "raw_text": "tidal locking demo"})
tests\test_clients.py:102:    assert fake.last["url"] == "https://mcd.example.dev/api/seeds"
tests\test_clients.py:158:    out = c.create_item("todo", {"assignee": "Ravi", "task": "call parent"})
frontend/src\apps\Activity\index.test.tsx:8:  { id: 2, ts: "2026-06-20T10:00", actor: "codex", verb: "status:approved",
frontend/src\apps\Activity\index.test.tsx:19:    expect(screen.getByTestId("activity-row")).toHaveTextContent("status:approved");
tests\test_catalog_refresh_safety.py:6:mcd/munshi adapters added in Phase 1) could leave the catalog empty or partial
samagra\adapters\mcd.py:6:changes_requested,approved,brief_generated,content_linked,done,archived].
samagra\governance\store.py:6:NOT be — it is the irreplaceable decision ledger (every board approve/reject is
samagra\governance\store.py:38:ASSIGNMENT_STATUS = {"queued", "running", "in-review", "approved", "changes"}
samagra\governance\store.py:39:REVIEW_VERDICT = {"approved", "changes"}
samagra\portal\static\app.js:26:  const cls = /done|approved|extracted|enriched/.test(s) ? "ok"
samagra\portal\static\app.js:166:        ? `<span class="own"><button class="btn" onclick="gateAction('${p.pipeline}','approve')">Approve</button>
samagra\clients\mcd_client.py:8:available) plus the owner-initiated capture write create_seed (POST /api/seeds,
samagra\clients\mcd_client.py:11:(owner-initiated capture in-scope; the human publish gate stays never-automated).
samagra\clients\mcd_client.py:58:    def create_seed(self, fields: dict) -> dict:
samagra\clients\mcd_client.py:61:        # adminKey authorizes /api/seeds (middleware accepts adminOk). Never logs keys.
samagra\clients\mcd_client.py:63:            f"{self.api_url}/api/seeds",
frontend/src\apps\Dashboard\index.tsx:124:  { text: "Reflect, don’t duplicate — mcd + munshi adapters", when: "5h ago" },
frontend/src\lib\terminal\dispatch.ts:125:    line("status-flow: seed → draft → review → publish", "dim"),
frontend/src\lib\terminal\dispatch.ts:265:            "nice try — only the board (Deepak · Khanak · Codex) may approve writes.",
samagra\clients\munshi_client.py:42:    def create_item(self, kind: str, fields: dict) -> dict:
frontend/src\apps\Lectures\index.test.tsx:9:    unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
frontend/src\lib\notes\model.ts:30:        "Energy stored  U = ½CV².\n\nLink to the RC charging sim. Use the bell-jar analogy for intuition before the formula.\n\nDraft only — board reviews before publish.",
frontend/src\lib\catalog\rows.test.ts:8:      unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
frontend/src\lib\catalog\rows.test.ts:20:    expect(rows[0]).toMatchObject({ uid: "u1", title: "Vectors", subject: "Physics", status: "approved" });
frontend/src\lib\kanban\columns.test.ts:13:      ["queued", "running", "in-review", "approved", "changes"]);
frontend/src\lib\kanban\columns.test.ts:20:    expect(Object.keys(g)).toEqual(["queued", "running", "in-review", "approved", "changes"]);
frontend/src\lib\pipelines\stages.test.ts:6:  pipeline: "textbook", label: "Lectures (textbook)", created: "x", updated: "y", current: "approve",
frontend/src\lib\pipelines\stages.test.ts:10:    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },
frontend/src\lib\pipelines\stages.test.ts:18:    expect(s.map((x) => x.name)).toEqual(["draft", "enrich", "approve", "export"]);
frontend/src\lib\pipelines\stages.test.ts:19:    expect(s.find((x) => x.name === "approve")).toMatchObject({ isCurrent: true, gate: true, owner: "human" });
frontend/src\lib\kanban\columns.ts:9:  { key: "approved", label: "Approved" },
frontend/src\lib\kanban\columns.ts:15:    queued: [], running: [], "in-review": [], approved: [], changes: [],
frontend/src\apps\Pipelines\index.test.tsx:8:  pipeline: "textbook", label: "Lectures (textbook)", created: "x", updated: "y", current: "approve",
frontend/src\apps\Pipelines\index.test.tsx:11:    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },

 succeeded in 1972ms:
samagra\api\app.py:61:    return HTMLResponse(lecture_render.render_chapter_html(content, label="Preview"))
samagra\api\app.py:181:    # Whitelist + sanitize: only contract-allowed keys with string values are
samagra\api\app.py:283:# Catch-all for client-side routes: serve the Vite-built index.html so the React
samagra\api\app.py:291:    index_html = FRONTEND_DIST / "index.html"
samagra\api\app.py:292:    if not index_html.is_file():
samagra\api\app.py:294:    return FileResponse(str(index_html))
samagra\sims_manifest.py:12:    # Canonical deployed URL is extensionless — the .html form 308-redirects to
samagra\scheduler.py:120:        out = config.EXPORT_DIR / slug / f"{slug}-thick.html"
frontend/src\App.tsx:190:  // tint + left accent bar (renderDock samagra `running(id)`, .dc.html L1018).
samagra\review\precommit.py:165:def _sanitize_reason(reason: str) -> str:
samagra\review\precommit.py:174:    line = f"{_now()}\t{diff_hash[:12]}\t{_sanitize_reason(reason)}\n"
samagra\review\precommit.py:251:            f"  reason: {_sanitize_reason(reason)}\n"
samagra\adapters\sims.py:19:        for p in config.SIMS_ROOT.rglob("*.html"):
samagra\questions_proxy.py:16:    URL. Mutates and returns ``payload``. No-op when there are no results / html."""
samagra\questions_proxy.py:20:        html = row.get("html")
samagra\questions_proxy.py:21:        if isinstance(html, str) and _REL in html:
samagra\questions_proxy.py:22:            row["html"] = html.replace(_REL, repl)
samagra\lectures\thin.py:17:def _lead_paragraph(html: str) -> str:
samagra\lectures\thin.py:19:    m = _FIRST_P.search(html or "")
samagra\lectures\thin.py:20:    return m.group(0) if m else (html or "")
samagra\lectures\thin.py:39:                kept.append({"type": "prose", "html": _lead_paragraph(b.get("html", ""))})
samagra\lectures\render.py:9:import html as _html
samagra\lectures\render.py:42:DOC_TEMPLATE = """<!doctype html>
samagra\lectures\render.py:43:<html lang="en"><head><meta charset="utf-8">
samagra\lectures\render.py:49:<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
samagra\lectures\render.py:55:</div></body></html>
samagra\lectures\render.py:66:def _block_html(block: dict) -> str:
samagra\lectures\render.py:68:    h = block.get("html") or ""
samagra\lectures\render.py:73:        return f'<div class="image-need">[figure] {_html.escape(str(note))}</div>'
samagra\lectures\render.py:82:        parts.append(f'<section><h2>{_html.escape(sec.get("title", ""))}</h2>')
samagra\lectures\render.py:84:            parts.append(_block_html(block))
samagra\lectures\render.py:89:def render_chapter_html(content: dict, label: str = "Full lecture") -> str:
samagra\lectures\render.py:92:        title=_html.escape(content.get("title", "Lecture")),
samagra\lectures\render.py:93:        subtitle=_html.escape(content.get("subtitle", "")),
samagra\lectures\render.py:94:        kicker=_html.escape(label),
frontend/src\types\contracts.ts:58:  html: string;      // QX-rendered question HTML (KaTeX maths + figure <img>)
samagra\lectures\export.py:26:def _html_to_docx(html_path: Path, docx_path: Path) -> bool:
samagra\lectures\export.py:31:    cmd = [pandoc, str(html_path), "-f", "html+tex_math_dollars",
samagra\lectures\export.py:45:    html = render.render_chapter_html(content, label=label)
samagra\lectures\export.py:48:    html_path = out / f"{slug}-{variant}.html"
samagra\lectures\export.py:49:    html_path.write_text(html, encoding="utf-8")
samagra\lectures\export.py:52:    have_docx = _html_to_docx(html_path, docx_path)
samagra\lectures\export.py:61:        "html": str(html_path),
samagra\lectures\export.py:74:        print(f"  [{v}] html  = {r['html']}")
frontend/src\apps\Clock\index.tsx:13:// (.dc.html L513–607). FD1: every surface colour is driven off the theme tokens
frontend/src\apps\Clock\index.test.tsx:10://      (.dc.html L513-607):
frontend/src\apps\Settings\index.tsx:4:// VERBATIM port of the prototype's `app_settings` (.dc.html ~L490):
frontend/src\apps\Settings\index.tsx:72:// (proto.md §6 / .dc.html L499-501). The gradient PREVIEWS each theme, so it is a
frontend/src\apps\Settings\index.tsx:86:// The five fixed integration rows (.dc.html L495): [label, status, color].
frontend/src\apps\Dashboard\index.tsx:5:// VERBATIM from the prototype's `app_dashboard` (.dc.html ~L266):
frontend/src\apps\Dashboard\index.tsx:19://     not an app glyph), per .dc.html `avatar()`.
frontend/src\apps\Settings\index.test.tsx:3:// VERBATIM port of the prototype's `app_settings` (.dc.html ~L490):
frontend/src\themes\index.test.ts:55:// (.dc.html lines ~59-95 / README §Design Tokens) EXACTLY so the surface
samagra\portal\static\app.js:50:  main.innerHTML = `<h1 class="page">Overview</h1><p class="lede">Loading…</p>`;
samagra\portal\static\app.js:67:  main.innerHTML = `<h1 class="page">Overview</h1>
samagra\portal\static\app.js:79:  main.innerHTML = `<h1 class="page">Questions <span class="src">QX · live</span></h1>
samagra\portal\static\app.js:90:    $("#qres").innerHTML = `<div class="empty">Searching…</div>`;
samagra\portal\static\app.js:92:    if (d.error) { $("#qres").innerHTML = `<div class="empty">${esc(d.error)}</div>`; return; }
samagra\portal\static\app.js:97:    $("#qres").innerHTML = table(["Question", "Chapter", "Type", "Diff", "Source"], rows)
samagra\portal\static\app.js:106:  main.innerHTML = `<h1 class="page">Lectures</h1><p class="lede">Loading chapters…</p>`;
samagra\portal\static\app.js:111:  let html = `<h1 class="page">Lectures <span class="src">physics-textbook</span></h1>
samagra\portal\static\app.js:120:    html += `<h3 style="margin:18px 0 8px">${esc(unit)}</h3>` +
samagra\portal\static\app.js:123:  main.innerHTML = html;
samagra\portal\static\app.js:128:  main.innerHTML = `<h1 class="page">${esc(title)}</h1><p class="lede">Loading…</p>`;
samagra\portal\static\app.js:135:  main.innerHTML = `<h1 class="page">${esc(title)}</h1>
samagra\portal\static\app.js:141:  main.innerHTML = `<h1 class="page">Simulations</h1><p class="lede">Loading…</p>`;
samagra\portal\static\app.js:148:    $("#simres").innerHTML = table(["Simulation", "Subject", "Grade"], rows) +
samagra\portal\static\app.js:151:  main.innerHTML = `<h1 class="page">Simulations <span class="src">pratyaksh · read-only</span></h1>
samagra\portal\static\app.js:161:  main.innerHTML = `<h1 class="page">Pipelines</h1><p class="lede">Loading…</p>`;
samagra\portal\static\app.js:175:  main.innerHTML = `<h1 class="page">Pipelines
samagra\portal\static\app.js:193:  main.innerHTML = `<h1 class="page">Assignments</h1><p class="lede">Loading…</p>`;
samagra\portal\static\app.js:206:  main.innerHTML = `<h1 class="page">Assignments <span class="src">governance · outbox index</span></h1>
samagra\portal\static\app.js:217:  main.innerHTML = `<h1 class="page">Search: “${esc(q)}”</h1><p class="lede">Searching…</p>`;
samagra\portal\static\app.js:227:  main.innerHTML = `<h1 class="page">Search: “${esc(q)}”</h1>
samagra\portal\templates\portal.html:1:<!doctype html>
samagra\portal\templates\portal.html:2:<html lang="en" data-theme="light">
samagra\portal\templates\portal.html:40:</html>
frontend/src\apps\Terminal\index.tsx:11:// (.dc.html ~L842): a flex-column monospace shell —
frontend/src\apps\Terminal\index.tsx:24://     (.dc.html `termPalette()`), NOT a hardcoded aqua, so the surface renders
frontend/src\apps\Terminal\index.tsx:51:// Welcome banner (proto.md §4 / .dc.html termWelcome ~L744): accent title, dim

 succeeded in 2823ms:
55:@app.get("/lecture/{slug}", response_class=HTMLResponse)
65:@app.get("/api/overview")
70:@app.get("/api/facets")
75:@app.get("/api/search")
81:@app.get("/api/questions")
100:@app.get("/api/pipelines")
105:@app.get("/api/assignments")
118:@app.post("/api/refresh")
124:@app.post("/api/tick")
129:@app.post("/api/gate/{pipeline}/{decision}")
141:@app.get("/open")
154:@app.get("/api/org")
174:@app.post("/api/munshi/capture")
210:@app.post("/api/mcd/seeds")
233:@app.get("/api/sims")
242:@app.get("/api/questions/facets")
260:@app.get("/api/munshi/library")
271:@app.get("/api/mcd/seeds")
287:@app.get("/{full_path:path}", response_class=HTMLResponse)

 succeeded in 3831ms:
samagra/api/app.py:5:and a safe local-file opener constrained to configured source roots.
samagra/api/app.py:11:from pathlib import Path
samagra/api/app.py:14:from fastapi.responses import FileResponse, HTMLResponse
samagra/api/app.py:76:def api_search(q: str = "", source: str | None = None,
samagra/api/app.py:78:    return {"results": catalog.search(q, source=source, kind=kind, limit=limit)}
samagra/api/app.py:97:    return questions_proxy.absolutize_assets(payload, client.base_url)
samagra/api/app.py:141:@app.get("/open")
samagra/api/app.py:142:def open_file(path: str, download: bool = False):
samagra/api/app.py:143:    p = Path(path)
samagra/api/app.py:145:        raise HTTPException(403, "path outside allowed source roots")
samagra/api/app.py:150:    return FileResponse(str(p), media_type=media or "application/octet-stream",
samagra/api/app.py:222:    for opt in ("title", "source_ref"):
samagra/api/app.py:266:        return {"results": [asdict(a) for a in ad.artifacts()]}
samagra/api/app.py:277:        return {"results": [asdict(a) for a in ad.artifacts()]}
samagra/api/app.py:286:# unknown API path should be a real 404, not the SPA shell).
samagra/api/app.py:287:@app.get("/{full_path:path}", response_class=HTMLResponse)
samagra/api/app.py:288:def spa(full_path: str):
samagra/api/app.py:289:    if full_path.startswith("api/"):
samagra/api/app.py:294:    return FileResponse(str(index_html))
samagra/catalog.py:1:"""Unified catalog over all source adapters, persisted in samagra.db."""
samagra/catalog.py:13:  uid text primary key, source text, kind text, title text,
samagra/catalog.py:15:  path text, url text, updated_at text, meta_json text);
samagra/catalog.py:16:create table if not exists source_summary(
samagra/catalog.py:17:  source text primary key, label text, available int,
samagra/catalog.py:18:  summary_json text, n_artifacts int, refreshed_at text);
samagra/catalog.py:21:  uid unindexed, title, subject, chapter, kind, source);
samagra/catalog.py:47:    tables are touched. The live ``catalog``/``catalog_fts``/``source_summary``
samagra/catalog.py:49:    yielded its artifacts without error — the whole swap runs in a single
samagra/catalog.py:50:    transaction. If any adapter raises while producing artifacts, nothing is
samagra/catalog.py:52:    returned per-source totals (the source maps to ``None``), and no completed
samagra/catalog.py:77:                for art in ad.artifacts():
samagra/catalog.py:81:                         art.chapter or "", art.kind or "", art.source)
samagra/catalog.py:106:            print(f"  {ad.name:12} available={avail!s:5} artifacts={shown}  {summ}")
samagra/catalog.py:121:        cur.execute("delete from source_summary")
samagra/catalog.py:127:            "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
samagra/catalog.py:132:            "insert or replace into source_summary values(?,?,?,?,?,?)",
samagra/catalog.py:148:    rows = [dict(r) for r in con.execute("select * from source_summary order by source")]
samagra/catalog.py:158:    return {"sources": rows, "refreshed_at": refreshed[0] if refreshed else None}
samagra/catalog.py:161:def search(query: str = "", source: str | None = None,
samagra/catalog.py:173:    if source:
samagra/catalog.py:174:        sql += " and c.source=?"
samagra/catalog.py:175:        args.append(source)
samagra/catalog.py:192:    """Distinct sources / kinds / subjects for portal filters."""
samagra/catalog.py:195:        "sources": [r[0] for r in con.execute(
samagra/catalog.py:196:            "select distinct source from catalog order by 1")],
frontend/src\types\contracts.ts:42:  uid: string; source: string; kind: string; title: string;
frontend/src\types\contracts.ts:44:  status: string | null; path: string | null; url: string | null;
frontend/src\types\contracts.ts:50:export interface Facets { sources: string[]; kinds: string[]; subjects: string[]; }
frontend/src\types\contracts.ts:74:  source: string; label: string; available: number;   // 0 | 1
frontend/src\types\contracts.ts:75:  n_artifacts: number; refreshed_at: string;
frontend/src\types\contracts.ts:79:export interface Overview { sources: OverviewSource[]; refreshed_at: string | null; }
frontend/src\types\contracts.ts:85:  started: string | null; finished: string | null; artifacts: string[]; error: string | null;
frontend/src\types\contracts.ts:96:  id: string; agent: string; outbox_path: string;
frontend/src\types\contracts.ts:97:  pipeline: string | null; seed_ref: string | null; artifact_ref: string | null;
frontend/src\types\contracts.ts:117:export interface SeedForm { type: SeedType; title?: string; raw_text: string; source_ref?: string; }
frontend/src\types\contracts.ts:121:export interface SimRow { id: string; title: string; subject: string | null; grade: string | null; url: string; }
frontend/src\lib\capture\seed.ts:15:  if ((form.source_ref ?? "").trim()) body.source_ref = form.source_ref!.trim();
frontend/src\shell\Taskbar.tsx:26:  /** Open windows, in z/open order — rendered as running-window buttons. */
frontend/src\hooks\useApi.ts:19:export function useApi<T = unknown>(path: string): ApiState<T> {
frontend/src\hooks\useApi.ts:31:        const res = await fetch(path, { headers: { accept: "application/json" } });
frontend/src\hooks\useApi.ts:45:  }, [path]);
frontend/src\lib\api\query.ts:1:/** Build a query string for useApi(path). Drops undefined and empty-string values
frontend/src\lib\api\query.ts:8:    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
frontend/src\hooks\useApiPost.ts:5:  async function post(path: string, body: unknown): Promise<T | null> {
frontend/src\hooks\useApiPost.ts:8:      const res = await fetch(path, {
frontend/src\lib\api\query.test.ts:7:    expect(buildQuery({ source: undefined, limit: undefined })).toBe("");
frontend/src\lib\api\query.test.ts:10:    expect(buildQuery({ q: "", source: "textbook", limit: 200 })).toBe("?source=textbook&limit=200");
frontend/src\lib\api\query.test.ts:17:    expect(buildQuery({ source: "insp", kind: "exam", limit: 500 })).toBe("?source=insp&kind=exam&limit=500");
frontend/src\lib\notes\model.ts:78:/** First non-empty source for the displayed title: trimmed title, else first body line, else "Untitled". */
frontend/src\lib\kanban\columns.test.ts:6:  id, agent: "codex", outbox_path: "x", pipeline: null, seed_ref: null, artifact_ref: null,
frontend/src\shell\WindowFrame.tsx:155:        <path d={d} />
frontend/src\shell\WindowFrame.tsx:396:          <path
frontend/src\lib\questions\facets.test.ts:28:  it("builds the /api/questions path with set params only", () => {
frontend/src\lib\wm\geometry.ts:3:// (barH / rail) are consumed from themes/index so chrome + math share one source.
frontend/src\shell\WindowFrame.test.tsx:145:  // so the inset layer round-trips verbatim from the source string.
frontend/src\lib\pipelines\stages.test.ts:8:    draft: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
frontend/src\lib\pipelines\stages.test.ts:9:    enrich: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
frontend/src\lib\pipelines\stages.test.ts:10:    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },
frontend/src\lib\pipelines\stages.test.ts:11:    export: { status: "pending", owner: "teachingos", gate: false, started: null, finished: null, artifacts: [], error: null },
frontend/src\components\AppIcon.test.tsx:2:// Authoritative source: the prototype's dock / mobile-home tiles
frontend/src\components\AppIcon.test.tsx:24:    expect(container.querySelectorAll("path")).toHaveLength(
frontend/src\components\Icon.test.tsx:2:// Authoritative source: the prototype's `icon()` helper + `ICONS` map
frontend/src\components\Icon.test.tsx:5:// the verbatim path data (split on `|` → one <path> per segment), the size
frontend/src\components\Icon.test.tsx:49:  it("splits the verbatim path data on '|' into one <path> per segment", () => {
frontend/src\components\Icon.test.tsx:52:    expect(cDash.querySelectorAll("path")).toHaveLength(4);
frontend/src\components\Icon.test.tsx:54:    expect(cAct.querySelectorAll("path")).toHaveLength(1);
frontend/src\components\Icon.test.tsx:57:  it("emits the path 'd' attributes VERBATIM from ICONS (no mangling)", () => {
frontend/src\components\Icon.test.tsx:59:    const ds = Array.from(container.querySelectorAll("path")).map((p) =>
frontend/src\components\Icon.test.tsx:65:  it("renders every app glyph with at least one path and verbatim data", () => {
frontend/src\components\Icon.test.tsx:68:      const paths = container.querySelectorAll("path");
frontend/src\components\Icon.test.tsx:69:      expect(paths.length).toBe(ICONS[id].split("|").length);
frontend/src\components\Icon.test.tsx:70:      expect(paths.length).toBeGreaterThan(0);
frontend/src\components\Icon.test.tsx:83:  // We prove the inheritance path by painting an ancestor and reading it back.
frontend/src\components\Icon.test.tsx:94:    // no literal hex/rgb baked onto stroke or any path → fully theme-driven.
frontend/src\components\Icon.test.tsx:96:    container.querySelectorAll("path").forEach((p) => {
frontend/src\lib\sims\deployed.test.ts:3:  { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11", url: "u1" },
frontend/src\lib\sims\deployed.test.ts:4:  { id: "0466", title: "Osmosis Lab", subject: "Biology", grade: "Class 9", url: "u2" },
frontend/src\lib\snake\engine.ts:84:/** A 0..1 random source; injected so food placement is deterministic in tests. */
frontend/src\lib\snake\engine.ts:93:  // a free cell always exists; the cap only prevents a pathological RNG from
frontend/src\lib\terminal\dispatch.test.ts:67:  it("status carries the artifacts/tests/repo facts (proto §4.2)", () => {
frontend/src\lib\terminal\dispatch.test.ts:85:  it("catalog has the accent header + 7 source rows (proto §4.2)", () => {
frontend/src\lib\terminal\dispatch.ts:47:  ["catalog", "content sources & artifact counts"],
frontend/src\lib\terminal\dispatch.ts:144:    line(pad("Catalog", 10) + "7,044 artifacts", "fg"),
frontend/src\components\icons-data.test.ts:6:// registered AppId that ships WITHOUT a glyph, nor an empty-string path value
frontend/src\components\icons-data.test.ts:7:// (`""` → one empty `<path d="">`, which still passes a `paths.length > 0` check).
frontend/src\components\icons-data.test.ts:14:  it("has real, non-empty path data for every AppId the registry launches", () => {
frontend/src\components\icons-data.test.ts:19:      // Valid SVG path data starts with an absolute Move command.
frontend/src\components\icons-data.test.ts:20:      expect(d.trim().startsWith("M"), `ICONS["${id}"] is not valid path data`).toBe(true);
frontend/src\components\icons-data.test.ts:22:      // <path d=""> sneaking in via e.g. a trailing/double pipe.
frontend/src\components\icons-data.test.ts:24:        expect(seg.trim().length, `ICONS["${id}"] has an empty path segment`).toBeGreaterThan(0);
frontend/src\components\Icon.tsx:4:// glyph's path-data split on `|` into one <path> per segment. Color is inherited
frontend/src\components\Icon.tsx:22:/** 24×24 stroke line-icon, path data verbatim from the prototype's ICONS map. */
frontend/src\components\Icon.tsx:46:        <path key={i} d={d} />
frontend/src\components\icons-data.ts:2:// Each value is the EXACT path-data string from the prototype's `ICONS` object
frontend/src\components\icons-data.ts:4:// sub-paths with `|`; the <Icon> component splits on `|` into one <path> each.
frontend/src\components\icons-data.ts:6:// DATA ONLY; do not edit path strings — they are the authoritative source of truth.
frontend/src\components\icons-data.ts:9:/** Raw 24×24 line-icon path data, keyed by app id. Verbatim from the prototype. */
frontend/src\lib\catalog\rows.test.ts:2:import { catalogRows, openHref, safeUrl, subjectsOf } from "./rows";
frontend/src\lib\catalog\rows.test.ts:7:    { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
frontend/src\lib\catalog\rows.test.ts:8:      unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
frontend/src\lib\catalog\rows.test.ts:9:      url: "/lecture/vectors", updated_at: "2026-06-01", meta: { order: 1 } },
frontend/src\lib\catalog\rows.test.ts:10:    { uid: "u2", source: "textbook", kind: "chapter", title: "Kinematics", subject: "Maths",
frontend/src\lib\catalog\rows.test.ts:11:      unit: "Mechanics", chapter: "2", status: null, path: null, url: null,
frontend/src\lib\catalog\rows.test.ts:17:  it("maps results to display rows with a safe open href", () => {
frontend/src\lib\catalog\rows.test.ts:21:    expect(rows[0].openHref).toBe("/open?path=" + encodeURIComponent("C:/t/vectors.html"));
frontend/src\lib\catalog\rows.test.ts:22:    expect(rows[1].openHref).toBeNull(); // no path → no open link
frontend/src\lib\catalog\rows.test.ts:31:  it("encodes a path, returns null for null/empty", () => {
frontend/src\lib\catalog\rows.test.ts:32:    expect(openHref("C:/a b.pdf")).toBe("/open?path=" + encodeURIComponent("C:/a b.pdf"));
frontend/src\lib\catalog\rows.test.ts:44:describe("safeUrl", () => {
frontend/src\lib\catalog\rows.test.ts:46:    expect(safeUrl("https://a.com/x")).toBe("https://a.com/x");
frontend/src\lib\catalog\rows.test.ts:47:    expect(safeUrl("/lecture/x")).toBe("/lecture/x");
frontend/src\lib\catalog\rows.test.ts:48:    expect(safeUrl("javascript:alert(1)")).toBeNull();
frontend/src\lib\catalog\rows.test.ts:49:    expect(safeUrl(null)).toBeNull();
frontend/src\lib\catalog\rows.test.ts:53:describe("href (unified link target)", () => {
frontend/src\lib\catalog\rows.test.ts:54:  it("prefers the file-open link, falls back to a safe web url, drops unsafe schemes", () => {
frontend/src\lib\catalog\rows.test.ts:56:      { uid: "f", source: "s", kind: "k", title: "file", subject: null, unit: null, chapter: null,
frontend/src\lib\catalog\rows.test.ts:57:        status: null, path: "C:/a.pdf", url: "https://x/y", updated_at: null, meta: {} },
frontend/src\lib\catalog\rows.test.ts:58:      { uid: "w", source: "mycontentdev", kind: "concept", title: "seed", subject: null, unit: null,
frontend/src\lib\catalog\rows.test.ts:59:        chapter: null, status: null, path: null, url: "https://mcd/seed/1", updated_at: null, meta: {} },
frontend/src\lib\catalog\rows.test.ts:60:      { uid: "x", source: "s", kind: "k", title: "xss", subject: null, unit: null, chapter: null,
frontend/src\lib\catalog\rows.test.ts:61:        status: null, path: null, url: "javascript:alert(1)", updated_at: null, meta: {} },
frontend/src\lib\catalog\rows.test.ts:63:    expect(rows[0].href).toBe("/open?path=" + encodeURIComponent("C:/a.pdf")); // file wins
frontend/src\lib\catalog\rows.test.ts:64:    expect(rows[1].href).toBe("https://mcd/seed/1");                          // url-only → web
frontend/src\lib\catalog\rows.test.ts:65:    expect(rows[2].href).toBeNull();                                          // unsafe scheme dropped
frontend/src\lib\catalog\rows.ts:11:  url: string | null;
frontend/src\lib\catalog\rows.ts:12:  openHref: string | null;        // safe /open?path= link (file rows), or null
frontend/src\lib\catalog\rows.ts:13:  href: string | null;            // unified link target: file-open, else a safe web url
frontend/src\lib\catalog\rows.ts:17:/** Build the safe file-open href for a catalog path (null when no path). The
frontend/src\lib\catalog\rows.ts:18: *  backend /open enforces ALLOWED_ROOTS; we only link rows that carry a path. */
frontend/src\lib\catalog\rows.ts:19:export function openHref(path: string | null | undefined): string | null {
frontend/src\lib\catalog\rows.ts:20:  if (!path) return null;
frontend/src\lib\catalog\rows.ts:21:  return "/open?path=" + encodeURIComponent(path);
frontend/src\lib\catalog\rows.ts:24:/** A safe link target for a row's `url` field: http(s) or root-relative only.
frontend/src\lib\catalog\rows.ts:26:export function safeUrl(u: string | null | undefined): string | null {
frontend/src\lib\catalog\rows.ts:32:  const fileHref = openHref(r.path);
frontend/src\lib\catalog\rows.ts:41:    url: r.url ?? null,
frontend/src\lib\catalog\rows.ts:43:    href: fileHref ?? safeUrl(r.url),   // prefer file open; fall back to a safe web url
frontend/src\apps\Booklets\index.tsx:12:const PATH = "/api/search" + buildQuery({ source: "booklets", limit: 500 });
frontend/src\apps\Booklets\index.tsx:39:            {r.href ? (
frontend/src\apps\Booklets\index.tsx:40:              <a href={r.href} target="_blank" rel="noreferrer"
frontend/src\apps\Assignments\index.test.tsx:8:  { id: "A1", agent: "codex", outbox_path: "x", pipeline: "textbook", seed_ref: null, artifact_ref: null,
frontend/src\apps\Booklets\index.test.tsx:8:  { uid: "b1", source: "booklets", kind: "booklet", title: "Mechanics WB", subject: "Physics",
frontend/src\apps\Booklets\index.test.tsx:9:    unit: null, chapter: null, status: null, path: "C:/b/mech.pdf", url: null, updated_at: null, meta: {} },
frontend/src\apps\Booklets\index.test.tsx:14:  it("calls /api/search?source=booklets and lists rows", () => {
frontend/src\apps\Booklets\index.test.tsx:17:    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=booklets&limit=500");
frontend/src\apps\Clock\index.tsx:137:          <path key={i} d={d} />
frontend/src\apps\Clock\index.tsx:156:      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
frontend/src\apps\Clock\index.test.tsx:359:    // it is a real 24×24 vector glyph (round-capped stroke paths), not a glyph font.
frontend/src\apps\Clock\index.test.tsx:362:    expect(glyph!.querySelector("path")).not.toBeNull();
frontend/src\apps\Clock\index.test.tsx:381:    // = indigo #6366f1@15% bg + a single-<path> moon glyph. Each chip is exactly one
frontend/src\apps\Clock\index.test.tsx:398:        // moon glyph is path-only (no <circle>); chip text colour = the indigo glyph hue.
frontend/src\apps\Mycontentdev\index.test.tsx:8:  { uid: "s1", source: "mycontentdev", kind: "concept", title: "Seed A", subject: null,
frontend/src\apps\Mycontentdev\index.test.tsx:9:    unit: null, chapter: null, status: "captured", path: null, url: "x", updated_at: null, meta: {} },
frontend/src\apps\Insp\index.test.tsx:8:  { uid: "i1", source: "insp", kind: "exam-set", title: "NSEP 2024", subject: null,
frontend/src\apps\Insp\index.test.tsx:9:    unit: null, chapter: null, status: null, path: null, url: null, updated_at: null, meta: { pdfs: 5 } },
frontend/src\apps\Insp\index.test.tsx:14:  it("calls /api/search?source=insp and lists rows", () => {
frontend/src\apps\Insp\index.test.tsx:17:    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=insp&limit=500");
frontend/src\apps\Dashboard\index.tsx:4:// fetch hook (the live Σ-artifacts headline) and renders the documented surface
frontend/src\apps\Dashboard\index.tsx:22:// defensive Σ-artifacts read. Per-pixel parity is a separate human QA pass.
frontend/src\apps\Dashboard\index.tsx:28:// Defensive view of the `/api/overview` payload (api.md §2). Per-source `summary`
frontend/src\apps\Dashboard\index.tsx:31:  source?: string;
frontend/src\apps\Dashboard\index.tsx:34:  n_artifacts?: number;
frontend/src\apps\Dashboard\index.tsx:40:  sources?: OverviewSource[];
frontend/src\apps\Dashboard\index.tsx:43:/** Σ sources[].n_artifacts — the "Artifacts (total)" headline (api.md §3). Reads
frontend/src\apps\Dashboard\index.tsx:44: *  the array defensively: a missing/non-array `sources` yields 0, a non-numeric
frontend/src\apps\Dashboard\index.tsx:45: *  `n_artifacts` contributes 0. */
frontend/src\apps\Dashboard\index.tsx:47:  const sources = Array.isArray(ov?.sources) ? ov!.sources : [];
frontend/src\apps\Dashboard\index.tsx:48:  return sources.reduce((sum, s) => {
frontend/src\apps\Dashboard\index.tsx:49:    const n = typeof s?.n_artifacts === "number" ? s.n_artifacts : 0;
frontend/src\apps\Dashboard\index.tsx:86:  { testid: "artifacts", label: "Artifacts catalogued", color: V.accent },
frontend/src\apps\Dashboard\index.tsx:95:// The Artifacts number is supplied live (Σ n_artifacts); the rest are fixed.
frontend/src\apps\Dashboard\index.tsx:123:  { text: "samagra.db rebuilt → 7,044 artifacts", when: "2h ago" },
frontend/src\apps\Dashboard\index.tsx:164:  const artifacts = totalArtifacts(data);
frontend/src\apps\Dashboard\index.tsx:233:          const number = s.testid === "artifacts" ? groupNum(artifacts) : STAT_NUMBERS[s.testid];
frontend/src\apps\Lectures\index.tsx:13:const PATH = "/api/search" + buildQuery({ source: "textbook", limit: 200 });
frontend/src\apps\Lectures\index.tsx:42:            {r.href ? (
frontend/src\apps\Lectures\index.tsx:43:              <a href={r.href} target="_blank" rel="noreferrer"
frontend/src\apps\Munshi\index.tsx:29:  // reloadKey bumps the GET path so useApi refetches the library after a capture.
frontend/src\apps\Munshi\index.tsx:33:  const path = "/api/munshi/library" + (reloadKey ? `?_r=${reloadKey}` : "");
frontend/src\apps\Munshi\index.tsx:36:  const { data, loading, error } = useApi<SearchResponse & { error?: string }>(path);
frontend/src\apps\Munshi\index.tsx:112:            {r.href ? (
frontend/src\apps\Munshi\index.tsx:113:              <a href={r.href} target="_blank" rel="noreferrer"
frontend/src\apps\Questions\index.tsx:50:  // A change to this path re-fires useApi → the single source of truth for the
frontend/src\apps\Questions\index.tsx:52:  const path = buildQuestionsPath({
frontend/src\apps\Questions\index.tsx:57:  const { data, loading, error } = useApi<QuestionsResponse>(path);
frontend/src\apps\Insp\index.tsx:12:const PATH = "/api/search" + buildQuery({ source: "insp", limit: 500 });
frontend/src\apps\Insp\index.tsx:39:            {r.href ? (
frontend/src\apps\Insp\index.tsx:40:              <a href={r.href} target="_blank" rel="noreferrer"
frontend/src\apps\Munshi\index.test.tsx:8:  { uid: "m1", source: "munshi", kind: "todo", title: "Call vendor", subject: null,
frontend/src\apps\Munshi\index.test.tsx:9:    unit: null, chapter: null, status: "open", path: null, url: null, updated_at: null, meta: {} },
frontend/src\apps\Munshi\index.test.tsx:47:    vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
frontend/src\apps\Munshi\index.test.tsx:49:        String(url).includes("/api/munshi/capture")
frontend/src\apps\Dashboard\index.test.tsx:3:// via the `useApi` typed fetch hook (the live Σ-artifacts headline) and renders
frontend/src\apps\Dashboard\index.test.tsx:11://      Σ-n_artifacts headline renders; error branches surface role=alert + 0.
frontend/src\apps\Dashboard\index.test.tsx:22:// Canned /api/overview payload (api.md §2: sources[].{n_artifacts, available, summary}).
frontend/src\apps\Dashboard\index.test.tsx:23:// Σ n_artifacts = 4000 + 3000 + 44 = 7044 (the live catalog count) → the Artifacts hero stat.
frontend/src\apps\Dashboard\index.test.tsx:26:  sources: [
frontend/src\apps\Dashboard\index.test.tsx:28:      source: "qx",
frontend/src\apps\Dashboard\index.test.tsx:31:      n_artifacts: 4000,
frontend/src\apps\Dashboard\index.test.tsx:36:      source: "textbook",
frontend/src\apps\Dashboard\index.test.tsx:39:      n_artifacts: 3000,
frontend/src\apps\Dashboard\index.test.tsx:44:      source: "sims",
frontend/src\apps\Dashboard\index.test.tsx:47:      n_artifacts: 44,
frontend/src\apps\Dashboard\index.test.tsx:58:      const url = String(input);
frontend/src\apps\Dashboard\index.test.tsx:59:      if (url.includes("/api/overview")) {
frontend/src\apps\Dashboard\index.test.tsx:66:      if (url.includes("/api/pipelines")) {
frontend/src\apps\Dashboard\index.test.tsx:72:      if (url.includes("/api/assignments")) {
frontend/src\apps\Dashboard\index.test.tsx:92:// BEHAVIOUR — the useApi fetch path + Σ headline + error branches (E1.19).    //
frontend/src\apps\Dashboard\index.test.tsx:106:  it("renders the Artifacts stat (Σ n_artifacts = 7,044) from the canned overview", async () => {
frontend/src\apps\Dashboard\index.test.tsx:108:    // 7044 = 4000 + 3000 + 44 — the live total-artifacts headline number, grouped.
frontend/src\apps\Dashboard\index.test.tsx:112:  it("surfaces a non-2xx overview as an error and still renders a 0 artifacts stat (defensive)", async () => {
frontend/src\apps\Dashboard\index.test.tsx:122:    const artifactsStat = await screen.findByTestId("stat-artifacts");
frontend/src\apps\Dashboard\index.test.tsx:123:    expect(within(artifactsStat).getByText("0")).toBeInTheDocument();
frontend/src\apps\Dashboard\index.test.tsx:138:    const artifactsStat = await screen.findByTestId("stat-artifacts");
frontend/src\apps\Dashboard\index.test.tsx:139:    expect(within(artifactsStat).getByText("0")).toBeInTheDocument();
frontend/src\apps\Dashboard\index.test.tsx:216:  it("groups the live Σ-artifacts headline with commas deterministically (ICU-independent)", async () => {
frontend/src\apps\Dashboard\index.test.tsx:225:    const artifactsStat = await screen.findByTestId("stat-artifacts");
frontend/src\apps\Dashboard\index.test.tsx:226:    expect(await within(artifactsStat).findByText("7,044")).toBeInTheDocument();
frontend/src\apps\Dashboard\index.test.tsx:228:    expect(within(artifactsStat).queryByText("7044")).toBeNull();
frontend/src\apps\Dashboard\index.test.tsx:234:    const artifactsStat = await screen.findByTestId("stat-artifacts");
frontend/src\apps\Dashboard\index.test.tsx:235:    const value = within(artifactsStat).getByText("7,044");
frontend/src\apps\Dashboard\index.test.tsx:251:    expect(artifactsStat).toHaveStyle({
frontend/src\apps\Dashboard\index.test.tsx:312:      within(activity).getByText("samagra.db rebuilt → 7,044 artifacts"),
frontend/src\apps\Mycontentdev\index.tsx:21:  // reloadKey bumps the GET path so useApi refetches the list after a seed capture.
frontend/src\apps\Mycontentdev\index.tsx:25:  const path = "/api/mcd/seeds" + (reloadKey ? `?_r=${reloadKey}` : "");
frontend/src\apps\Mycontentdev\index.tsx:28:  const { data, loading, error } = useApi<SearchResponse & { error?: string }>(path);
frontend/src\apps\Mycontentdev\index.tsx:113:            {r.href ? (
frontend/src\apps\Mycontentdev\index.tsx:114:              <a href={r.href} target="_blank" rel="noreferrer"
frontend/src\apps\Lectures\index.test.tsx:8:  { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
frontend/src\apps\Lectures\index.test.tsx:9:    unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
frontend/src\apps\Lectures\index.test.tsx:10:    url: null, updated_at: null, meta: {} },
frontend/src\apps\Lectures\index.test.tsx:15:  it("calls /api/search?source=textbook and lists rows", () => {
frontend/src\apps\Lectures\index.test.tsx:18:    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=textbook&limit=200");
frontend/src\apps\Questions\index.test.tsx:36:    // raw LaTeX source must NOT be printed as text
frontend/src\apps\Questions\index.test.tsx:57:  it("submitting a query bakes q into the path", () => {
frontend/src\apps\Questions\index.test.tsx:66:  it("a subject facet chip filters the path", () => {
frontend/src\apps\Terminal\index.test.tsx:33:// effect-runner path is pinned both by the spy call AND by the resulting store
frontend/src\apps\Terminal\index.test.tsx:300:    // verbatim multi-segment glyph path data (≥1 <path>) — never a letter badge.
frontend/src\apps\Terminal\index.test.tsx:302:    expect(svg!.querySelectorAll("path").length).toBeGreaterThan(0);
frontend/src\apps\Pipelines\index.test.tsx:10:    draft: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
frontend/src\apps\Pipelines\index.test.tsx:11:    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },
frontend/src\apps\Settings\index.test.tsx:202:    expect(screen.getByText("Hourly scheduled task")).toBeInTheDocument();
frontend/src\apps\Settings\index.tsx:88:  { label: "Hourly scheduled task", status: "needs OK", color: WARN },
frontend/src\apps\Sims\index.test.tsx:9:    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
frontend/src\apps\Sims\index.test.tsx:18:    expect(useApiMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/search?source=sims"));
frontend/src\apps\Sims\index.test.tsx:24:    expect(link!.getAttribute("href")).toContain("pratyakshsims.com");
frontend/src\apps\Sims\index.test.tsx:28:    // looping over an empty set. (The old `/api/search?source=sims` call is already
frontend/src\apps\Sims\index.tsx:55:                  <a href={r.url} target="_blank" rel="noreferrer"
frontend/src\apps\Notes\index.tsx:6:// new note/todo logic here — every CRUD path delegates to a pure `lib/notes`
frontend/src\apps\Notes\index.tsx:110:      <path d="M5 12l4 4L19 6" />
frontend/src\apps\Notes\index.test.tsx:38:// localStorage. `load` returns the seed arrays (defensive fallback path) so the
frontend/src\apps\Notes\index.test.tsx:367:    expect(glyph!.querySelector("path")).not.toBeNull();

codex
There is no automated Munshi→MCD promotion path in the current app code; `create_item` and `create_seed` are separate and only called by their two capture routes. But the scheduler/gate API is still an unauthenticated origin-side control plane if Access is bypassed.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/adapters/mcd.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 160) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'tests/test_api_capture.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 130) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'samagra/adapters/munshi.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 170) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'tests/test_clients.py' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 190) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 2229ms:
   1: """munshi (front-desk) source adapter â€” read-only, intake-only.
   2: 
   3: Normalizes non-dismissed library items into Artifact records. item.kind in
   4: [note,todo,issue,question,followup]; item.status in
   5: [open,claimed_done,validated,dismissed]; item.payload is a dict.
   6: """
   7: from __future__ import annotations
   8: 
   9: from typing import Iterator
  10: 
  11: from ..clients import MunshiClient
  12: from .base import Adapter, Artifact
  13: 
  14: 
  15: # Live munshi payload schema (myProd/src/tools.ts insertItem calls): each item
  16: # kind stores its human-meaningful text under a kind-SPECIFIC key, never a
  17: # generic "text"/"body" field. Map each kind to its title key(s), most
  18: # descriptive first:
  19: #   note     -> {topic, issue, action}      (issue = the doubt, 1-2 lines)
  20: #   todo     -> {task}
  21: #   issue    -> {summary, source}
  22: #   question -> {stem, options, answer, ...}
  23: #   followup -> {note}
  24: _TITLE_KEYS_BY_KIND = {
  25:     "note": ("issue", "topic"),
  26:     "todo": ("task",),
  27:     "issue": ("summary",),
  28:     "question": ("stem",),
  29:     "followup": ("note",),
  30: }
  31: # Tried after the kind-specific keys, so an unknown/renamed kind still yields a
  32: # real title instead of collapsing to the bare kind. "text"/"body" are kept as a
  33: # last-ditch defensive fallback for any future generic payload.
  34: _TITLE_FALLBACK_KEYS = ("task", "summary", "stem", "note", "issue", "topic",
  35:                         "text", "body")
  36: 
  37: 
  38: def _title_from(item: dict) -> str:
  39:     """First non-empty line of the kind-specific payload text, else the kind.
  40: 
  41:     Reads the title from the live munshi per-kind payload key (see
  42:     `_TITLE_KEYS_BY_KIND`), falling back across the other known content keys,
  43:     then to the item kind. A string payload is used verbatim.
  44:     """
  45:     payload = item.get("payload") or {}
  46:     if isinstance(payload, str):
  47:         text = payload.strip()
  48:         return text.splitlines()[0][:120] if text else (item.get("kind") or "item")
  49:     if isinstance(payload, dict):
  50:         keys = _TITLE_KEYS_BY_KIND.get(item.get("kind"), ()) + _TITLE_FALLBACK_KEYS
  51:         for key in keys:
  52:             val = payload.get(key)
  53:             if isinstance(val, str) and val.strip():
  54:                 return val.strip().splitlines()[0][:120]
  55:     return item.get("kind") or "item"
  56: 
  57: 
  58: class MunshiAdapter(Adapter):
  59:     name = "munshi"
  60:     label = "Front Desk (munshi)"
  61: 
  62:     def __init__(self, client: MunshiClient | None = None):
  63:         self.client = client or MunshiClient()
  64: 
  65:     def available(self) -> bool:
  66:         return self.client.available()
  67: 
  68:     def artifacts(self) -> Iterator[Artifact]:
  69:         for item in self.client.library().get("items", []):
  70:             if item.get("status") == "dismissed":
  71:                 continue
  72:             yield Artifact(
  73:                 uid=f"munshi:{item['id']}",
  74:                 source="munshi",
  75:                 kind=item["kind"],
  76:                 title=_title_from(item),
  77:                 subject="physics",
  78:                 unit=None,
  79:                 chapter=None,
  80:                 status=item["status"],
  81:                 path=None,
  82:                 url=None,
  83:                 updated_at=item["ts"],
  84:                 meta={
  85:                     "payload": item["payload"],
  86:                     "tags": item.get("tags"),
  87:                     "person": item.get("person"),
  88:                     "due": item.get("due"),
  89:                 },
  90:             )

 succeeded in 2258ms:
   1: """Unit tests for the subsystem HTTP clients.
   2: 
   3: The HTTP layer is fully MOCKED â€” no live-prod calls. We monkeypatch the module
   4: `requests` attribute with a fake transport that records the last request and
   5: returns canned JSON. We also assert that secret values are never echoed.
   6: 
   7: create_seed (mcd) and create_item (munshi) are the owner-initiated capture writes
   8: (2026-06-21 DEC-3 amendment); both write paths are covered here with mocked transports.
   9: """
  10: from __future__ import annotations
  11: 
  12: from samagra.clients import mcd_client, munshi_client
  13: 
  14: 
  15: class FakeResponse:
  16:     def __init__(self, payload, status_code=200):
  17:         self._payload = payload
  18:         self.status_code = status_code
  19: 
  20:     def json(self):
  21:         return self._payload
  22: 
  23:     def raise_for_status(self):
  24:         if self.status_code >= 400:
  25:             raise RuntimeError(f"HTTP {self.status_code}")
  26: 
  27: 
  28: class FakeRequests:
  29:     """Records the last GET/POST and returns a canned payload."""
  30: 
  31:     def __init__(self, payload):
  32:         self.payload = payload
  33:         self.last = None
  34: 
  35:     def get(self, url, headers=None, timeout=None):
  36:         self.last = {"method": "GET", "url": url, "headers": headers or {},
  37:                      "json": None, "timeout": timeout}
  38:         return FakeResponse(self.payload)
  39: 
  40:     def post(self, url, headers=None, json=None, data=None, timeout=None):
  41:         self.last = {"method": "POST", "url": url, "headers": headers or {},
  42:                      "json": json, "data": data, "timeout": timeout}
  43:         return FakeResponse(self.payload)
  44: 
  45: 
  46: # ---------------- McdClient ----------------
  47: 
  48: def test_mcd_available_false_without_creds(monkeypatch):
  49:     monkeypatch.delenv("MCD_API_URL", raising=False)
  50:     monkeypatch.delenv("MCD_ADMIN_KEY", raising=False)
  51:     monkeypatch.delenv("MCD_APP_KEY", raising=False)
  52:     monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
  53:     c = mcd_client.McdClient()
  54:     assert c.available() is False
  55: 
  56: 
  57: def test_mcd_available_true_with_env(monkeypatch):
  58:     monkeypatch.setenv("MCD_API_URL", "https://mcd.example.dev/")
  59:     monkeypatch.setenv("MCD_ADMIN_KEY", "ADMIN-SECRET")
  60:     monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
  61:     c = mcd_client.McdClient()
  62:     assert c.available() is True
  63:     # trailing slash trimmed, mirroring _cloud.mjs
  64:     assert c.api_url == "https://mcd.example.dev"
  65: 
  66: 
  67: def test_mcd_query_posts_with_admin_header(monkeypatch):
  68:     fake = FakeRequests([{"id": "s1", "title": "Gauss law"}])
  69:     monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
  70:     monkeypatch.setattr(mcd_client, "requests", fake)
  71:     c = mcd_client.McdClient(api_url="https://mcd.example.dev",
  72:                              admin_key="ADMIN-SECRET")
  73:     rows = c.query("SELECT 1")
  74:     assert rows == [{"id": "s1", "title": "Gauss law"}]
  75:     assert fake.last["method"] == "POST"
  76:     assert fake.last["url"] == "https://mcd.example.dev/api/admin/query"
  77:     assert fake.last["headers"]["x-mcd-admin"] == "ADMIN-SECRET"
  78:     assert fake.last["json"] == {"sql": "SELECT 1"}
  79: 
  80: 
  81: def test_mcd_pending_gets_with_admin_header(monkeypatch):
  82:     fake = FakeRequests([{"id": "s2", "status": "needs_processing"}])
  83:     monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
  84:     monkeypatch.setattr(mcd_client, "requests", fake)
  85:     c = mcd_client.McdClient(api_url="https://mcd.example.dev",
  86:                              admin_key="ADMIN-SECRET")
  87:     rows = c.pending()
  88:     assert rows == [{"id": "s2", "status": "needs_processing"}]
  89:     assert fake.last["method"] == "GET"
  90:     assert fake.last["url"] == "https://mcd.example.dev/api/admin/pending"
  91:     assert fake.last["headers"]["x-mcd-admin"] == "ADMIN-SECRET"
  92: 
  93: 
  94: def test_mcd_create_seed_posts_form_with_admin(monkeypatch):
  95:     from samagra.clients import mcd_client
  96:     fake = FakeRequests({"id": "seed_X", "status": "captured"})
  97:     monkeypatch.setattr(mcd_client, "requests", fake)
  98:     c = mcd_client.McdClient(api_url="https://mcd.example.dev", admin_key="ADM")
  99:     out = c.create_seed({"type": "rough_idea", "raw_text": "tidal locking demo"})
 100:     assert out == {"id": "seed_X", "status": "captured"}
 101:     assert fake.last["method"] == "POST"
 102:     assert fake.last["url"] == "https://mcd.example.dev/api/seeds"
 103:     assert fake.last["headers"]["x-mcd-admin"] == "ADM"
 104:     assert fake.last["data"] == {"type": "rough_idea", "raw_text": "tidal locking demo"}  # form, not json
 105:     assert "json" not in fake.last or fake.last["json"] is None
 106: 
 107: 
 108: def test_mcd_repr_never_leaks_secret(monkeypatch):
 109:     monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
 110:     c = mcd_client.McdClient(api_url="https://mcd.example.dev",
 111:                              admin_key="ADMIN-SECRET", app_key="APP-SECRET")
 112:     assert "ADMIN-SECRET" not in repr(c)
 113:     assert "APP-SECRET" not in repr(c)
 114: 
 115: 
 116: # ---------------- MunshiClient ----------------
 117: 
 118: def test_munshi_available_false_without_creds(monkeypatch):
 119:     monkeypatch.delenv("MUNSHI_API_URL", raising=False)
 120:     monkeypatch.delenv("MUNSHI_SECRET", raising=False)
 121:     c = munshi_client.MunshiClient()
 122:     assert c.available() is False
 123: 
 124: 
 125: def test_munshi_available_true_with_env(monkeypatch):
 126:     monkeypatch.setenv("MUNSHI_API_URL", "https://munshi.example.dev/")
 127:     monkeypatch.setenv("MUNSHI_SECRET", "COOKIE-SECRET")
 128:     c = munshi_client.MunshiClient()
 129:     assert c.available() is True
 130:     assert c.api_url == "https://munshi.example.dev"
 131: 
 132: 
 133: def test_munshi_library_sends_cookie_header(monkeypatch):
 134:     fake = FakeRequests({"people": [], "total": 2,
 135:                          "items": [{"id": 1}, {"id": 2}]})
 136:     monkeypatch.setattr(munshi_client, "requests", fake)
 137:     c = munshi_client.MunshiClient(api_url="https://munshi.example.dev",
 138:                                    secret="COOKIE SECRET/with=chars")
 139:     lib = c.library()
 140:     assert lib["total"] == 2 and len(lib["items"]) == 2
 141:     assert fake.last["method"] == "GET"
 142:     assert fake.last["url"] == "https://munshi.example.dev/api/library"
 143:     # secret is URL-encoded into the cookie, exactly like driver.mjs cookie()
 144:     assert fake.last["headers"]["Cookie"] == "munshi=COOKIE%20SECRET%2Fwith%3Dchars"
 145: 
 146: 
 147: def test_munshi_repr_never_leaks_secret():
 148:     c = munshi_client.MunshiClient(api_url="https://munshi.example.dev",
 149:                                    secret="COOKIE-SECRET")
 150:     assert "COOKIE-SECRET" not in repr(c)
 151: 
 152: 
 153: def test_munshi_create_item_posts_json_with_cookie(monkeypatch):
 154:     from samagra.clients import munshi_client
 155:     fake = FakeRequests({"item_id": 99})
 156:     monkeypatch.setattr(munshi_client, "requests", fake)
 157:     c = munshi_client.MunshiClient(api_url="https://m.example.dev", secret="S")
 158:     out = c.create_item("todo", {"assignee": "Ravi", "task": "call parent"})
 159:     assert out == {"item_id": 99}
 160:     assert fake.last["method"] == "POST"
 161:     assert fake.last["url"] == "https://m.example.dev/api/item"
 162:     assert fake.last["headers"]["Cookie"] == "munshi=S"
 163:     assert fake.last["json"] == {"kind": "todo", "assignee": "Ravi", "task": "call parent"}
 164: 
 165: 
 166: def test_munshi_create_item_repr_never_leaks_secret():
 167:     from samagra.clients import munshi_client
 168:     c = munshi_client.MunshiClient(api_url="https://m.example.dev", secret="TOPSECRET")
 169:     assert "TOPSECRET" not in repr(c)

 succeeded in 2434ms:
   1: from fastapi.testclient import TestClient
   2: from samagra.api import app as api_app
   3: 
   4: def _client(): return TestClient(api_app.app)
   5: 
   6: def test_munshi_capture_happy(monkeypatch):
   7:     captured = {}
   8:     class FakeClient:
   9:         def available(self): return True
  10:         def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 7}
  11:     monkeypatch.setattr(api_app, "MunshiClient", lambda: FakeClient())
  12:     r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T"})
  13:     assert r.status_code == 200 and r.json()["item"] == {"item_id": 7}
  14:     assert captured["kind"] == "todo" and captured["fields"] == {"assignee": "A", "task": "T"}
  15: 
  16: def test_munshi_capture_bad_kind(monkeypatch):
  17:     monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
  18:     r = _client().post("/api/munshi/capture", json={"kind": "question", "stem": "x"})
  19:     assert r.status_code == 400
  20: 
  21: def test_munshi_capture_missing_field(monkeypatch):
  22:     monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
  23:     r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A"})
  24:     assert r.status_code == 400
  25: 
  26: def test_munshi_capture_unconfigured(monkeypatch):
  27:     monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: False})())
  28:     r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T"})
  29:     assert r.status_code == 503
  30: 
  31: def test_munshi_capture_optional_field_passed(monkeypatch):
  32:     captured = {}
  33:     class FakeClient:
  34:         def available(self): return True
  35:         def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 1}
  36:     monkeypatch.setattr(api_app, "MunshiClient", lambda: FakeClient())
  37:     r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T", "due": "tmrw"})
  38:     assert r.status_code == 200
  39:     assert captured["fields"] == {"assignee": "A", "task": "T", "due": "tmrw"}
  40: 
  41: def test_munshi_capture_strips_unknown_fields(monkeypatch):
  42:     captured = {}
  43:     class FakeClient:
  44:         def available(self): return True
  45:         def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 2}
  46:     monkeypatch.setattr(api_app, "MunshiClient", lambda: FakeClient())
  47:     r = _client().post("/api/munshi/capture", json={
  48:         "kind": "todo", "assignee": "A", "task": "T",
  49:         "status": "done", "id": 99, "ts": "x", "label": "spoof",
  50:     })
  51:     assert r.status_code == 200
  52:     # only contract-allowed fields forwarded to the production write
  53:     assert captured["fields"] == {"assignee": "A", "task": "T"}
  54: 
  55: def test_munshi_capture_nonstring_kind(monkeypatch):
  56:     monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
  57:     r = _client().post("/api/munshi/capture", json={"kind": ["todo"], "assignee": "A", "task": "T"})
  58:     assert r.status_code == 400
  59: 
  60: def test_munshi_capture_nonstring_required_value(monkeypatch):
  61:     monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
  62:     r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": 123, "task": "T"})
  63:     assert r.status_code == 400
  64: 
  65: def test_munshi_capture_upstream_failure_502(monkeypatch):
  66:     class FakeClient:
  67:         def available(self): return True
  68:         def create_item(self, kind, fields): raise RuntimeError("secret: token=abc123 https://munshi.internal")
  69:     monkeypatch.setattr(api_app, "MunshiClient", lambda: FakeClient())
  70:     r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T"})
  71:     assert r.status_code == 502
  72:     body = r.text
  73:     assert "token" not in body and "munshi.internal" not in body and "abc123" not in body
  74: 
  75: 
  76: def test_mcd_seed_happy(monkeypatch):
  77:     captured = {}
  78:     class FakeMcd:
  79:         def available(self): return True
  80:         def create_seed(self, fields): captured.update(fields); return {"id": "s1", "status": "captured"}
  81:     monkeypatch.setattr(api_app, "McdClient", lambda: FakeMcd())
  82:     r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "idea"})
  83:     assert r.status_code == 200 and r.json()["seed"]["id"] == "s1"
  84:     assert captured == {"type": "rough_idea", "raw_text": "idea"}
  85: 
  86: def test_mcd_seed_bad_type(monkeypatch):
  87:     monkeypatch.setattr(api_app, "McdClient", lambda: type("F", (), {"available": lambda s: True})())
  88:     r = _client().post("/api/mcd/seeds", json={"type": "nope", "raw_text": "x"})
  89:     assert r.status_code == 400
  90: 
  91: def test_mcd_seed_empty_text(monkeypatch):
  92:     monkeypatch.setattr(api_app, "McdClient", lambda: type("F", (), {"available": lambda s: True})())
  93:     r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "  "})
  94:     assert r.status_code == 400
  95: 
  96: def test_mcd_seed_unconfigured(monkeypatch):
  97:     monkeypatch.setattr(api_app, "McdClient", lambda: type("F", (), {"available": lambda s: False})())
  98:     r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "x"})
  99:     assert r.status_code == 503
 100: 
 101: def test_mcd_seed_upstream_failure_502(monkeypatch):
 102:     class FakeMcd:
 103:         def available(self): return True
 104:         def create_seed(self, fields): raise RuntimeError("secret: x-mcd-admin=adminKEY123 https://mcd.internal")
 105:     monkeypatch.setattr(api_app, "McdClient", lambda: FakeMcd())
 106:     r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "idea"})
 107:     assert r.status_code == 502
 108:     body = r.text
 109:     assert "adminKEY123" not in body and "mcd.internal" not in body and "x-mcd-admin" not in body

 succeeded in 2493ms:
   1: """mycontentdev (editorial) source adapter â€” read-only.
   2: 
   3: Normalizes non-archived seed rows into Artifact records. seed.type in
   4: [concept,question,snippet,simulation_idea,experiment,notebooklm_link,rough_idea];
   5: seed.status in [captured,needs_processing,processing,draft_ready,
   6: changes_requested,approved,brief_generated,content_linked,done,archived].
   7: """
   8: from __future__ import annotations
   9: 
  10: from typing import Iterator
  11: 
  12: from ..clients import McdClient
  13: from .base import Adapter, Artifact
  14: 
  15: _SEED_SQL = (
  16:     "SELECT id,type,title,status,created_at,updated_at "
  17:     "FROM seeds WHERE status != 'archived'"
  18: )
  19: 
  20: 
  21: class McdAdapter(Adapter):
  22:     name = "mycontentdev"
  23:     label = "Editorial (mycontentdev)"
  24: 
  25:     def __init__(self, client: McdClient | None = None):
  26:         self.client = client or McdClient()
  27: 
  28:     def available(self) -> bool:
  29:         return self.client.available()
  30: 
  31:     def artifacts(self) -> Iterator[Artifact]:
  32:         api_url = self.client.api_url
  33:         for row in self.client.query(_SEED_SQL):
  34:             yield Artifact(
  35:                 uid=f"mcd:{row['id']}",
  36:                 source="mycontentdev",
  37:                 kind=row["type"],
  38:                 title=row["title"],
  39:                 subject="physics",
  40:                 unit=None,
  41:                 chapter=None,
  42:                 status=row["status"],
  43:                 path=None,
  44:                 url=f"{api_url}/seed/{row['id']}",
  45:                 updated_at=row["updated_at"],
  46:                 meta={"seedId": row["id"]},
  47:             )

codex
I’ve got enough source evidence for the report. Before closing, I’m doing a final verification pass over the high-risk claims: route list, frontend POST call sites, sims count, and deploy/access posture.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -LiteralPath 'C:\\Users\\abc\\.codex\\plugins\\cache\\openai-curated\\superpowers\\202e9242\\skills\\verification-before-completion\\SKILL.md' -Raw" in C:\SandBox\claude_box\TeachingOS
 succeeded in 409ms:
---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence â‰  evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter â‰  compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion â‰  excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

**Tests:**
```
âœ… [Run test command] [See: 34/34 pass] "All tests pass"
âŒ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
âœ… Write â†’ Run (pass) â†’ Revert fix â†’ Run (MUST FAIL) â†’ Restore â†’ Run (pass)
âŒ "I've written a regression test" (without red-green verification)
```

**Build:**
```
âœ… [Run build] [See: exit 0] "Build passes"
âŒ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
âœ… Re-read plan â†’ Create checklist â†’ Verify each â†’ Report gaps or completion
âŒ "Tests pass, phase complete"
```

**Agent delegation:**
```
âœ… Agent reports success â†’ Check VCS diff â†’ Verify changes â†’ Report actual state
âŒ Trust agent report
```

## Why This Matters

From 24 failure memories:
- your human partner said "I don't believe you" - trust broken
- Undefined functions shipped - would crash
- Missing requirements shipped - incomplete features
- Time wasted on false completion â†’ redirect â†’ rework
- Violates: "Honesty is a core value. If you lie, you'll be replaced."

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.


codex
For verification I’m using static evidence, not test-suite success: current route definitions, current frontend fetch call sites, current manifest row count, and tracked-secret checks. I’m not running mutating tests in this read-only review lane.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n 'method:\\s*\"POST\"|useApiPost|post\\(\"/api/' frontend/src --glob '"'!**/*.test.ts'"' --glob '"'!**/*.test.tsx'"'" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git ls-files .env mcd-cloud.json deploy/cloudflared/*.json *.pem *.json | Sort-Object' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n '@app\\.post' samagra/api/app.py" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$path = Join-Path (Resolve-Path '"'..\\pratyaksh-May-deploy').Path 'deployed-sims-by-grade.md'; (Select-String -LiteralPath "'$path -Pattern '"'"'^-'"\\s*\\d{3,4}\\s*[—–-]' | Measure-Object).Count" in C:\SandBox\claude_box\TeachingOS
2026-06-22T16:10:41.696803Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 2.4 seconds
Output:

 exited 1 in 2382ms:
 succeeded in 3274ms:
482

 succeeded in 3904ms:
118:@app.post("/api/refresh")
124:@app.post("/api/tick")
129:@app.post("/api/gate/{pipeline}/{decision}")
174:@app.post("/api/munshi/capture")
210:@app.post("/api/mcd/seeds")

 succeeded in 4217ms:
.claude/launch.json
frontend/package.json
frontend/package-lock.json
frontend/tsconfig.json
frontend/tsconfig.node.json

codex
The final static checks confirm five FastAPI POST routes and 482 deployed-sim rows. The first frontend POST grep was over-filtered, so I’m rerunning a simpler production-source scan before finalizing.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git check-ignore -v -- .env mcd-cloud.json deploy/cloudflared/placeholder.json' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"Cf-Access|Cloudflare-Access|Access-Jwt|Authenticated-User|JWT|access\" samagra frontend/src --glob '"'!*.test.ts'"' --glob '"'!*.test.tsx'"'" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"useApiPost|method: \\\"POST\\\"|post\\(\\\"/api/\" frontend/src/apps frontend/src/hooks frontend/src/lib frontend/src/types --glob '"'!*.test.ts'"' --glob '"'!*.test.tsx'"'" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"@app\\.get\\(\\\"/api/assignments\\\"|init_tables|executescript\\(DDL\\)|PRAGMA user_version|@app\\.get\\(\\\"/api/overview\\\"|def connect\\(\\)\" samagra/api/app.py samagra/governance/store.py samagra/catalog.py" in C:\SandBox\claude_box\TeachingOS
 succeeded in 3610ms:
frontend/src\components\IconButton.tsx:2:// Thin presentational wrapper: an accessible square button holding a glyph/icon.
frontend/src\components\IconButton.tsx:16:/** Square icon-only button with an accessible name. */
frontend/src\shell\Rail.tsx:103:              // accessible name via aria-label; `title` gives the hover tooltip.
frontend/src\shell\Mobile.tsx:50: *  button's accessible name comes from the labelled AppIcon (role=img), matching
frontend/src\shell\Dock.tsx:59:            // No explicit aria-label: the button derives its accessible name from

 succeeded in 3705ms:
.gitignore:2:.env	.env
.gitignore:52:mcd-cloud.json	mcd-cloud.json
warning: unable to access 'C:\Users\abc/.config/git/ignore': Permission denied

2026-06-22T16:10:58.804094Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 4.7 seconds
Output:
The string is missing the terminator: ".
    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException
    + FullyQualifiedErrorId : TerminatorExpectedAtEndOfString
 

 exited 1 in 4651ms:
The string is missing the terminator: ".
    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException
    + FullyQualifiedErrorId : TerminatorExpectedAtEndOfString
 

2026-06-22T16:10:58.908402Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 4.7 seconds
Output:
rg: regex parse error:
    (?:@app\.get\(\)
    ^
error: unclosed group

 exited 1 in 4681ms:
rg: regex parse error:
    (?:@app\.get\(\)
    ^
error: unclosed group

codex
Two verification greps hit PowerShell quoting issues, not repo behavior. I’m rerunning them as narrower literal searches so the final evidence is clean.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n useApiPost frontend/src/apps frontend/src/hooks --glob '"'!*.test.ts'"' --glob '"'!*.test.tsx'"'" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n 'method: \"POST\"' frontend/src/hooks/useApiPost.ts" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n 'Cf-Access|Cloudflare-Access|Access-Jwt|Authenticated-User|JWT' samagra frontend/src" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n 'api_assignments|init_tables|executescript\\(DDL\\)|PRAGMA user_version|def connect\\(\\)' samagra/api/app.py samagra/governance/store.py samagra/catalog.py" in C:\SandBox\claude_box\TeachingOS
2026-06-22T16:11:09.608871Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 1.9 seconds
Output:

 exited 1 in 1938ms:
2026-06-22T16:11:09.629646Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 2 seconds
Output:

 exited 1 in 1960ms:
 succeeded in 2188ms:
samagra/catalog.py:29:def connect() -> sqlite3.Connection:
samagra/governance/store.py:7:one immutable row). The store carries a `schema_version` (PRAGMA user_version),
samagra/governance/store.py:34:# `init_tables` applies every migration whose version exceeds the DB's current
samagra/governance/store.py:46:def connect() -> sqlite3.Connection:
samagra/governance/store.py:58:def init_tables(conn: sqlite3.Connection) -> None:
samagra/governance/store.py:63:    conn.executescript(DDL)
samagra/governance/store.py:69:    cur = conn.execute("PRAGMA user_version").fetchone()[0]
samagra/governance/store.py:75:    # PRAGMA user_version does not accept bound params; cur is an int we control.
samagra/governance/store.py:76:    conn.execute(f"PRAGMA user_version = {int(cur)}")
samagra/api/app.py:106:def api_assignments():
samagra/api/app.py:108:    # rebuildable catalog. init_tables is idempotent + safe to call per request.
samagra/api/app.py:111:        gstore.init_tables(conn)  # inside try: a failed init must still close the conn

 succeeded in 5271ms:
frontend/src/hooks\useApiPost.ts:3:export function useApiPost<T = unknown>() {
frontend/src/apps\Munshi\index.tsx:3:import { useApiPost } from "../../hooks/useApiPost";
frontend/src/apps\Munshi\index.tsx:42:  const { post, loading: posting, error: postError } = useApiPost<{ ok: boolean }>();
frontend/src/apps\Mycontentdev\index.tsx:3:import { useApiPost } from "../../hooks/useApiPost";
frontend/src/apps\Mycontentdev\index.tsx:35:  const { post, loading: posting, error: postError } = useApiPost<{ ok: boolean }>();

codex
Final verification: no `Cf-Access`/JWT enforcement strings exist in `samagra` or `frontend/src`; frontend production POST use is confined to the shared `useApiPost` hook imported by Munshi and Mycontentdev. I’m compiling the report now.
  ✓ Load repo and memory context
  ✓ Map doc claims to code paths
  ✓ Audit safety/capture/deploy/questions/sims/governance
  → Cross-check line citations and compile verdict
codex
Static read-only audit only. I did not run test suites or live HTTP probes.

**Genuine Risks**
Safety/deploy
- HIGH: Origin relies entirely on Access, with open mutating APIs if bypassed. `samagra/api/app.py:118`, `:124`, `:129`, `:174`, `:210`; `deploy/cloudflared/config.samagra.yml:25-26`. Docs admit Access is sole gate; code has no `Cf-Access-*` or JWT enforcement. Fix: add production middleware validating Cloudflare Access JWT/email for all `/api/*`, especially POSTs, with explicit loopback/dev bypass.
- HIGH: `/api/tick` and `/api/gate/*` are real control-plane mutations, not read-only. `samagra/scheduler.py:170`, `:185`, `:220-224`; `samagra/state.py:165-188`; `samagra/lectures/export.py:47-58`. Docs claim exactly two write paths, but these mutate state, notifications, exports, and potentially GDocs after approval. Fix: remove these from public FastAPI or put them behind a separate admin/auth/CSRF/confirm boundary.
- MEDIUM: Broad local file disclosure via `/open`. `samagra/api/app.py:37-51`, `:141-150`. Traversal is blocked by `resolve()/relative_to()`, but any file under whole source roots can be served by path. Fix: open by catalog artifact ID, restrict extensions, and deny hidden/secret patterns.
- MEDIUM: QX proxy is config-driven SSRF/open asset-host risk. `samagra/clients/qx_client.py:23`, `:31`; `samagra/questions_proxy.py:17-22`. If `SAMAGRA_QX_SERVER_URL` is poisoned, backend fetches and frontend asset URLs point there. Fix: validate QX base URL as loopback or explicit allowlist.
- MEDIUM: QX HTML is rendered unsanitized. `frontend/src/apps/Questions/index.tsx:176`; `samagra/questions_proxy.py:19-22`. The app trusts QX HTML via `dangerouslySetInnerHTML`. Fix: sanitize QX HTML or make the QX renderer emit a strict safe subset.
- LOW: Cloudflared JSON ignore pattern misses `deploy/cloudflared/*.json`. `.gitignore:49-52`; `deploy/cloudflared/config.samagra.yml:17-18`. `mcd-cloud.json` and `.env` are ignored, but a copied tunnel credential beside the config would not be ignored. Fix: add `deploy/cloudflared/*.json` or `**/cloudflared/*.json`.
- LOW: Break-glass audit is best-effort, not guaranteed. `samagra/review/precommit.py:172-179`, `:245-253`. If audit logging fails, commit is still allowed. Fix: either document “best-effort audited” or add a second non-wedging audit sink.
- LOW: Precommit ignores `git diff --cached` failures. `samagra/review/precommit.py:71-76`, `:239-241`. Empty stdout becomes “nothing staged.” Fix: check return code and warn explicitly before advisory allow.

**Doc/Code Mismatches**
- HIGH: “Exactly two write paths” is only true if scoped to external capture writes. FastAPI exposes five POST routes. `samagra/api/app.py:118-130`, `:174`, `:210`; docs at `CLAUDE.md:14-17`, `HANDOFF.md:131-137`. Fix docs wording or route/auth split.
- MEDIUM: GETs are not purely side-effect free. `catalog.connect()` runs schema DDL on read paths, and `/api/assignments` initializes governance tables. `samagra/catalog.py:29-32`; `samagra/api/app.py:105-113`; `samagra/governance/store.py:58-65`. Fix migrate/init at startup or CLI, then open read-only for reads.
- MEDIUM: “No publish automation” is too broad. No direct MCD publish bridge exists, but `tick()` exports local lecture artifacts and can upload GDocs after gate state is marked done. `samagra/scheduler.py:109-143`; `samagra/lectures/gdocs.py:30-60`. Fix distinguish “no student publish / no MCD publish” from export automation.
- LOW: Capture spec mentions `detail?`, but server and TS drop it. `docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:186`; `frontend/src/lib/capture/seed.ts:13-15`; `samagra/api/app.py:221-225`. Fix code or spec.
- LOW: Non-alpha subject filtering is not on the actual Questions chips. Backend `/api/questions/facets` filters at `samagra/api/app.py:247-252`, but the app uses `/api/questions` facets at `frontend/src/apps/Questions/index.tsx:64-66`; `facetNames()` only stringifies at `frontend/src/lib/questions/facets.ts:52-54`. Fix by filtering proxied facets too.

**Verified Claims**
| Claim | Verdict |
|---|---|
| `useApi` remains GET-only | VERIFIED: `frontend/src/hooks/useApi.ts:31`; POSTs use `useApiPost` only in Munshi/Mycontentdev. |
| Munshi and MCD capture whitelists match TS forms | VERIFIED for current forms: `samagra/api/app.py:159-195`, `:206-225`; TS builders match. |
| Upstream error detail is not returned on capture failure | VERIFIED: `samagra/api/app.py:199-202`, `:226-229`; tests cover secret strings at `tests/test_api_capture.py:65-73`, `:101-109`. |
| No automated Munshi to MCD bridge | VERIFIED: separate calls only, `samagra/api/app.py:200`, `:227`; no bridge path found. |
| QX down is graceful, not 500 | VERIFIED by catch-all response: `samagra/api/app.py:90-97`. |
| SIM0xxx catalog chip leak is gone from current Questions app | PARTIALLY VERIFIED: app no longer calls `/api/facets`, but proxied facets lack the non-alpha guard. |
| `GET /api/sims` shows 482 deployed sims | VERIFIED: parser route `samagra/api/app.py:233-239`; manifest count is 482. |
| `sim_url()` rejects bad IDs | VERIFIED: `samagra/sims_manifest.py:11-21`. |
| Governance DB is separate from catalog | VERIFIED: `samagra/config.py:65-66`; `samagra/governance/store.py:46-55`. |
| Precommit confirmed-critical, cache, never-wedge | PARTIALLY VERIFIED: main flow exists, but audit/logging and git-diff failure caveats above. |
| Direction coherence with DEC-1..DEC-5 | PARTIALLY VERIFIED: docs admit drift and DEC-4 deferral, but E3 was built before the attention-ROI gate. `STATUS.html:200`, `:251-255`, `:507-509`. |

Final verdict: GO-WITH-FIXES on doc honesty. The core feature claims mostly map to code, but the safety invariant is materially overstated unless narrowed to “two external subsystem capture writes,” and origin auth must not remain solely documentary.


tokens used
264,988
Static read-only audit only. I did not run test suites or live HTTP probes.

**Genuine Risks**
Safety/deploy
- HIGH: Origin relies entirely on Access, with open mutating APIs if bypassed. `samagra/api/app.py:118`, `:124`, `:129`, `:174`, `:210`; `deploy/cloudflared/config.samagra.yml:25-26`. Docs admit Access is sole gate; code has no `Cf-Access-*` or JWT enforcement. Fix: add production middleware validating Cloudflare Access JWT/email for all `/api/*`, especially POSTs, with explicit loopback/dev bypass.
- HIGH: `/api/tick` and `/api/gate/*` are real control-plane mutations, not read-only. `samagra/scheduler.py:170`, `:185`, `:220-224`; `samagra/state.py:165-188`; `samagra/lectures/export.py:47-58`. Docs claim exactly two write paths, but these mutate state, notifications, exports, and potentially GDocs after approval. Fix: remove these from public FastAPI or put them behind a separate admin/auth/CSRF/confirm boundary.
- MEDIUM: Broad local file disclosure via `/open`. `samagra/api/app.py:37-51`, `:141-150`. Traversal is blocked by `resolve()/relative_to()`, but any file under whole source roots can be served by path. Fix: open by catalog artifact ID, restrict extensions, and deny hidden/secret patterns.
- MEDIUM: QX proxy is config-driven SSRF/open asset-host risk. `samagra/clients/qx_client.py:23`, `:31`; `samagra/questions_proxy.py:17-22`. If `SAMAGRA_QX_SERVER_URL` is poisoned, backend fetches and frontend asset URLs point there. Fix: validate QX base URL as loopback or explicit allowlist.
- MEDIUM: QX HTML is rendered unsanitized. `frontend/src/apps/Questions/index.tsx:176`; `samagra/questions_proxy.py:19-22`. The app trusts QX HTML via `dangerouslySetInnerHTML`. Fix: sanitize QX HTML or make the QX renderer emit a strict safe subset.
- LOW: Cloudflared JSON ignore pattern misses `deploy/cloudflared/*.json`. `.gitignore:49-52`; `deploy/cloudflared/config.samagra.yml:17-18`. `mcd-cloud.json` and `.env` are ignored, but a copied tunnel credential beside the config would not be ignored. Fix: add `deploy/cloudflared/*.json` or `**/cloudflared/*.json`.
- LOW: Break-glass audit is best-effort, not guaranteed. `samagra/review/precommit.py:172-179`, `:245-253`. If audit logging fails, commit is still allowed. Fix: either document “best-effort audited” or add a second non-wedging audit sink.
- LOW: Precommit ignores `git diff --cached` failures. `samagra/review/precommit.py:71-76`, `:239-241`. Empty stdout becomes “nothing staged.” Fix: check return code and warn explicitly before advisory allow.

**Doc/Code Mismatches**
- HIGH: “Exactly two write paths” is only true if scoped to external capture writes. FastAPI exposes five POST routes. `samagra/api/app.py:118-130`, `:174`, `:210`; docs at `CLAUDE.md:14-17`, `HANDOFF.md:131-137`. Fix docs wording or route/auth split.
- MEDIUM: GETs are not purely side-effect free. `catalog.connect()` runs schema DDL on read paths, and `/api/assignments` initializes governance tables. `samagra/catalog.py:29-32`; `samagra/api/app.py:105-113`; `samagra/governance/store.py:58-65`. Fix migrate/init at startup or CLI, then open read-only for reads.
- MEDIUM: “No publish automation” is too broad. No direct MCD publish bridge exists, but `tick()` exports local lecture artifacts and can upload GDocs after gate state is marked done. `samagra/scheduler.py:109-143`; `samagra/lectures/gdocs.py:30-60`. Fix distinguish “no student publish / no MCD publish” from export automation.
- LOW: Capture spec mentions `detail?`, but server and TS drop it. `docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md:186`; `frontend/src/lib/capture/seed.ts:13-15`; `samagra/api/app.py:221-225`. Fix code or spec.
- LOW: Non-alpha subject filtering is not on the actual Questions chips. Backend `/api/questions/facets` filters at `samagra/api/app.py:247-252`, but the app uses `/api/questions` facets at `frontend/src/apps/Questions/index.tsx:64-66`; `facetNames()` only stringifies at `frontend/src/lib/questions/facets.ts:52-54`. Fix by filtering proxied facets too.

**Verified Claims**
| Claim | Verdict |
|---|---|
| `useApi` remains GET-only | VERIFIED: `frontend/src/hooks/useApi.ts:31`; POSTs use `useApiPost` only in Munshi/Mycontentdev. |
| Munshi and MCD capture whitelists match TS forms | VERIFIED for current forms: `samagra/api/app.py:159-195`, `:206-225`; TS builders match. |
| Upstream error detail is not returned on capture failure | VERIFIED: `samagra/api/app.py:199-202`, `:226-229`; tests cover secret strings at `tests/test_api_capture.py:65-73`, `:101-109`. |
| No automated Munshi to MCD bridge | VERIFIED: separate calls only, `samagra/api/app.py:200`, `:227`; no bridge path found. |
| QX down is graceful, not 500 | VERIFIED by catch-all response: `samagra/api/app.py:90-97`. |
| SIM0xxx catalog chip leak is gone from current Questions app | PARTIALLY VERIFIED: app no longer calls `/api/facets`, but proxied facets lack the non-alpha guard. |
| `GET /api/sims` shows 482 deployed sims | VERIFIED: parser route `samagra/api/app.py:233-239`; manifest count is 482. |
| `sim_url()` rejects bad IDs | VERIFIED: `samagra/sims_manifest.py:11-21`. |
| Governance DB is separate from catalog | VERIFIED: `samagra/config.py:65-66`; `samagra/governance/store.py:46-55`. |
| Precommit confirmed-critical, cache, never-wedge | PARTIALLY VERIFIED: main flow exists, but audit/logging and git-diff failure caveats above. |
| Direction coherence with DEC-1..DEC-5 | PARTIALLY VERIFIED: docs admit drift and DEC-4 deferral, but E3 was built before the attention-ROI gate. `STATUS.html:200`, `:251-255`, `:507-509`. |

Final verdict: GO-WITH-FIXES on doc honesty. The core feature claims mostly map to code, but the safety invariant is materially overstated unless narrowed to “two external subsystem capture writes,” and origin auth must not remain solely documentary.


