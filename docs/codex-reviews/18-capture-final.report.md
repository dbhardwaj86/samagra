Reading additional input from stdin...
OpenAI Codex v0.140.0
--------
workdir: C:\SandBox\claude_box\TeachingOS
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019eeb78-2549-7313-b9b3-9b7a56e4a183
--------
user
The git diff on stdin is the set of inline additions to branch feature/control-plane-capture of the samagra repo, made AFTER the per-slice reviews. They add: (1) live-read passthroughs GET /api/munshi/library and GET /api/mcd/seeds in samagra/api/app.py that serialize the existing read-only adapters' artifacts() via dataclasses.asdict, are creds-gated, and wrap iteration in try/except returning a generic error (must NOT leak upstream/secret detail); (2) Munshi & Mycontentdev apps rewired to read those live endpoints instead of /api/search; (3) a QX facets filter in GET /api/questions/facets that drops non-alphabetic subject codes; (4) a canonical extensionless pratyaksh sim URL in samagra/sims_manifest.py sim_url. Do an INDEPENDENT adversarial review. Verify: no secret/upstream-detail leak on the read passthroughs; asdict output matches the frontend SearchResult/catalogRows contract (uid,title,subject,unit,chapter,status,kind,url,path,meta); the facet filter is correct/safe; the sim URL is right; no regression to the already-reviewed write paths. Output findings as CRITICAL/HIGH/MEDIUM/LOW with file:line and a concrete fix, then a final one-line verdict: GO / GO-WITH-FIXES / NO-GO. Be concise.

<stdin>
diff --git a/frontend/src/apps/Munshi/index.test.tsx b/frontend/src/apps/Munshi/index.test.tsx
index 9947022..e2aa27f 100644
--- a/frontend/src/apps/Munshi/index.test.tsx
+++ b/frontend/src/apps/Munshi/index.test.tsx
@@ -11,10 +11,10 @@ const data = { results: [
 
 describe("Munshi app", () => {
   beforeEach(() => useApiMock.mockReset());
-  it("calls /api/search?source=munshi and lists items", () => {
+  it("reads /api/munshi/library (live) and lists items", () => {
     useApiMock.mockReturnValue({ data, loading: false, error: null });
     render(<Munshi />);
-    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=munshi&limit=200");
+    expect(useApiMock).toHaveBeenCalledWith("/api/munshi/library");
     expect(screen.getByTestId("munshi")).toBeInTheDocument();
     expect(screen.getByText("Call vendor")).toBeInTheDocument();
   });
diff --git a/frontend/src/apps/Munshi/index.tsx b/frontend/src/apps/Munshi/index.tsx
index 3752c1f..2338359 100644
--- a/frontend/src/apps/Munshi/index.tsx
+++ b/frontend/src/apps/Munshi/index.tsx
@@ -2,7 +2,6 @@ import { useState } from "react";
 import { useApi } from "../../hooks/useApi";
 import { useApiPost } from "../../hooks/useApiPost";
 import Icon from "../../components/Icon";
-import { buildQuery } from "../../lib/api/query";
 import { catalogRows } from "../../lib/catalog/rows";
 import { buildMunshiCapture } from "../../lib/capture/munshi";
 import type { SearchResponse, MunshiKind, MunshiCaptureForm } from "../../types/contracts";
@@ -29,8 +28,9 @@ const inputStyle = {
 export default function Munshi() {
   // reloadKey bumps the GET path so useApi refetches the library after a capture.
   const [reloadKey, setReloadKey] = useState(0);
-  const path = "/api/search" + buildQuery({ source: "munshi", limit: 200 })
-    + (reloadKey ? `&_r=${reloadKey}` : "");
+  // Live read straight from the deployed Munshi worker (not the catalog), so a
+  // fresh capture appears on the next refetch (reloadKey bump).
+  const path = "/api/munshi/library" + (reloadKey ? `?_r=${reloadKey}` : "");
   const { data, loading, error } = useApi<SearchResponse>(path);
   const rows = catalogRows(data);
 
@@ -97,7 +97,7 @@ export default function Munshi() {
       <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
         {rows.length === 0 ? (
           <div data-testid="catalog-empty" style={{ color: V.muted }}>
-            {loading ? "Loading…" : "Munshi not available — set MUNSHI creds and run a refresh."}
+            {loading ? "Loading…" : "Munshi not available — set MUNSHI_API_URL / MUNSHI_SECRET."}
           </div>
         ) : rows.map((r) => (
           <article key={r.uid} data-testid="catalog-row"
diff --git a/frontend/src/apps/Mycontentdev/index.test.tsx b/frontend/src/apps/Mycontentdev/index.test.tsx
index 8c2a9c4..b7cfd8c 100644
--- a/frontend/src/apps/Mycontentdev/index.test.tsx
+++ b/frontend/src/apps/Mycontentdev/index.test.tsx
@@ -11,17 +11,17 @@ const data = { results: [
 
 describe("mycontentdev app", () => {
   beforeEach(() => useApiMock.mockReset());
-  it("calls /api/search?source=mycontentdev and lists seeds", () => {
+  it("reads /api/mcd/seeds (live) and lists seeds", () => {
     useApiMock.mockReturnValue({ data, loading: false, error: null });
     render(<Mcd />);
-    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=mycontentdev&limit=200");
+    expect(useApiMock).toHaveBeenCalledWith("/api/mcd/seeds");
     expect(screen.getByTestId("mycontentdev")).toBeInTheDocument();
     expect(screen.getByText("Seed A")).toBeInTheDocument();
   });
   it("creds-gated empty state when no rows", () => {
     useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
     render(<Mcd />);
-    expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/creds/i);
+    expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/available|adminKey/i);
   });
   it("error inline + still mounts", () => {
     useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
diff --git a/frontend/src/apps/Mycontentdev/index.tsx b/frontend/src/apps/Mycontentdev/index.tsx
index 080777a..9e0c04c 100644
--- a/frontend/src/apps/Mycontentdev/index.tsx
+++ b/frontend/src/apps/Mycontentdev/index.tsx
@@ -2,7 +2,6 @@ import { useRef, useState } from "react";
 import { useApi } from "../../hooks/useApi";
 import { useApiPost } from "../../hooks/useApiPost";
 import Icon from "../../components/Icon";
-import { buildQuery } from "../../lib/api/query";
 import { catalogRows } from "../../lib/catalog/rows";
 import { buildSeed, SEED_TYPES } from "../../lib/capture/seed";
 import type { SearchResponse, SeedType, SeedForm } from "../../types/contracts";
@@ -21,8 +20,9 @@ const inputStyle = {
 export default function Mycontentdev() {
   // reloadKey bumps the GET path so useApi refetches the list after a seed capture.
   const [reloadKey, setReloadKey] = useState(0);
-  const path = "/api/search" + buildQuery({ source: "mycontentdev", limit: 200 })
-    + (reloadKey ? `&_r=${reloadKey}` : "");
+  // Live read straight from the deployed mycontentdev worker (not the catalog),
+  // so a freshly captured seed appears on the next refetch (reloadKey bump).
+  const path = "/api/mcd/seeds" + (reloadKey ? `?_r=${reloadKey}` : "");
   const { data, loading, error } = useApi<SearchResponse>(path);
   const rows = catalogRows(data);
 
@@ -98,7 +98,7 @@ export default function Mycontentdev() {
       <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
         {rows.length === 0 ? (
           <div data-testid="catalog-empty" style={{ color: V.muted }}>
-            {loading ? "Loading…" : "mycontentdev not available — set MCD creds and run a refresh."}
+            {loading ? "Loading…" : "mycontentdev not available — set mcd-cloud.json adminKey."}
           </div>
         ) : rows.map((r) => (
           <article key={r.uid} data-testid="catalog-row"
diff --git a/samagra/api/app.py b/samagra/api/app.py
index f2c561c..9094304 100644
--- a/samagra/api/app.py
+++ b/samagra/api/app.py
@@ -7,6 +7,7 @@ and a safe local-file opener constrained to configured source roots.
 from __future__ import annotations
 
 import mimetypes
+from dataclasses import asdict
 from pathlib import Path
 
 from fastapi import FastAPI, HTTPException
@@ -236,7 +237,38 @@ def api_questions_facets():
     if not qx or not qx.available():
         return {"subjects": []}
     subjects = (qx.summary() or {}).get("subjects") or {}
-    return {"subjects": list(subjects.keys())}
+    # Only human-meaningful subject names (must contain a letter). Some QX corpora
+    # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
+    # was the eyesore replacing the old SIM0xxx leak — drop non-alphabetic keys.
+    names = [str(s) for s in subjects.keys() if any(ch.isalpha() for ch in str(s))]
+    return {"subjects": names}
+
+
+# -- live subsystem read passthroughs (always-fresh; capture appears immediately)
+# These read the LIVE deployed Munshi/mycontentdev via their adapters (not the
+# rebuildable catalog), so the capture apps show real data without a catalog
+# refresh and a fresh capture is visible on the next refetch. Read-only,
+# creds-gated, never leak upstream/secret detail.
+@app.get("/api/munshi/library")
+def api_munshi_library():
+    ad = get_adapter("munshi")
+    if not ad or not ad.available():
+        return {"results": [], "error": "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET"}
+    try:
+        return {"results": [asdict(a) for a in ad.artifacts()]}
+    except Exception:  # noqa: BLE001 — never surface upstream/secret detail
+        return {"results": [], "error": "munshi read failed"}
+
+
+@app.get("/api/mcd/seeds")
+def api_mcd_seeds():
+    ad = get_adapter("mycontentdev")
+    if not ad or not ad.available():
+        return {"results": [], "error": "mycontentdev not configured — set mcd-cloud.json adminKey"}
+    try:
+        return {"results": [asdict(a) for a in ad.artifacts()]}
+    except Exception:  # noqa: BLE001 — never surface upstream/secret detail
+        return {"results": [], "error": "mycontentdev read failed"}
 
 
 # -- SPA fallback (MUST be declared LAST) -------------------------------
diff --git a/samagra/clients/mcd_client.py b/samagra/clients/mcd_client.py
index 35ed610..27e150a 100644
--- a/samagra/clients/mcd_client.py
+++ b/samagra/clients/mcd_client.py
@@ -1,13 +1,14 @@
-"""Read-only admin-API client for mycontentdev (editorial subsystem).
+"""Admin-API client for mycontentdev (editorial subsystem).
 
 Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
 {apiUrl,adminKey} at the mycontentdev repo root, or env MCD_API_URL /
 MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
 
-SAFETY: this client NEVER logs or reprs a key value. Phase 1 surface is READ-ONLY
-(query / pending / available). The only write method, create_seed (POST
-/api/seeds), is DEFERRED to Phase 3 per runbook D2/D9 and is intentionally not
-built here; app_key is still resolved so the Phase-3 write path drops in cleanly.
+SAFETY: this client NEVER logs or reprs a key value. Reads (query / pending /
+available) plus the owner-initiated capture write create_seed (POST /api/seeds,
+form-encoded, authorized by the adminKey via the x-mcd-admin header) are
+supported. The write was added under the 2026-06-21 DEC-3 amendment
+(owner-initiated capture in-scope; the human publish gate stays never-automated).
 """
 from __future__ import annotations
 
diff --git a/samagra/sims_manifest.py b/samagra/sims_manifest.py
index 25fd573..9544916 100644
--- a/samagra/sims_manifest.py
+++ b/samagra/sims_manifest.py
@@ -9,8 +9,10 @@ _ITEM = re.compile(r"^-\s*(\d{3,4})\s*[—-]\s*(.+?)\s*$")
 
 
 def sim_url(sim_id: str) -> str:
+    # Canonical deployed URL is extensionless — the .html form 308-redirects to
+    # this; linking directly avoids the redirect hop and lands on a 200.
     n = str(sim_id).strip().zfill(4)
-    return f"{SITE}/sims/SIM{n}/SIM{n}_sim.html"
+    return f"{SITE}/sims/SIM{n}/SIM{n}_sim"
 
 
 def parse_deployed_sims(text: str) -> list[dict]:
diff --git a/tests/test_api_live_reads.py b/tests/test_api_live_reads.py
new file mode 100644
index 0000000..e3862af
--- /dev/null
+++ b/tests/test_api_live_reads.py
@@ -0,0 +1,66 @@
+"""Live-read passthroughs: /api/munshi/library and /api/mcd/seeds.
+
+These read the live subsystems via the adapters (not the catalog) so the capture
+apps show real data and a fresh capture is visible on refetch. Read-only,
+creds-gated, and must never leak upstream/secret detail on failure.
+"""
+from fastapi.testclient import TestClient
+
+from samagra.api import app as api_app
+from samagra.adapters.base import Artifact
+
+
+def _c():
+    return TestClient(api_app.app)
+
+
+def _fake_adapter(available=True, arts=None, boom=None):
+    class A:
+        def available(self):
+            return available
+
+        def artifacts(self):
+            if boom:
+                raise RuntimeError(boom)
+            return iter(arts or [])
+
+    return A()
+
+
+def test_munshi_library_returns_live_artifacts(monkeypatch):
+    art = Artifact(uid="munshi:1", source="munshi", kind="todo",
+                   title="Call parent", status="open")
+    monkeypatch.setattr(api_app, "get_adapter",
+                        lambda n: _fake_adapter(arts=[art]) if n == "munshi" else None)
+    r = _c().get("/api/munshi/library")
+    assert r.status_code == 200
+    res = r.json()["results"]
+    assert len(res) == 1
+    assert res[0]["title"] == "Call parent" and res[0]["kind"] == "todo"
+
+
+def test_munshi_library_unconfigured(monkeypatch):
+    monkeypatch.setattr(api_app, "get_adapter",
+                        lambda n: _fake_adapter(available=False))
+    r = _c().get("/api/munshi/library")
+    assert r.status_code == 200 and r.json()["results"] == []
+
+
+def test_mcd_seeds_returns_live_artifacts(monkeypatch):
+    art = Artifact(uid="mcd:s1", source="mycontentdev", kind="rough_idea",
+                   title="tidal demo", status="captured")
+    monkeypatch.setattr(api_app, "get_adapter",
+                        lambda n: _fake_adapter(arts=[art]) if n == "mycontentdev" else None)
+    r = _c().get("/api/mcd/seeds")
+    assert r.status_code == 200
+    res = r.json()["results"]
+    assert len(res) == 1 and res[0]["title"] == "tidal demo"
+
+
+def test_mcd_seeds_read_failure_does_not_leak(monkeypatch):
+    monkeypatch.setattr(api_app, "get_adapter",
+                        lambda n: _fake_adapter(boom="boom https://x.dev adminKEY123")
+                        if n == "mycontentdev" else None)
+    r = _c().get("/api/mcd/seeds")
+    assert r.status_code == 200 and r.json()["results"] == []
+    assert "adminKEY123" not in r.text and "https://x.dev" not in r.text
diff --git a/tests/test_api_questions_facets.py b/tests/test_api_questions_facets.py
index 837296b..cd4077c 100644
--- a/tests/test_api_questions_facets.py
+++ b/tests/test_api_questions_facets.py
@@ -17,3 +17,14 @@ def test_questions_facets_absent_qx(monkeypatch):
     monkeypatch.setattr(api_app, "get_adapter", lambda name: None)
     r = TestClient(api_app.app).get("/api/questions/facets")
     assert r.status_code == 200 and r.json() == {"subjects": []}
+
+
+def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
+    # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
+    # chip is useless. Only alphabetic subject names should survive.
+    class FakeQx:
+        def available(self): return True
+        def summary(self): return {"subjects": {1: 32285, "Mechanics": 40, "2": 9}}
+    monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
+    r = TestClient(api_app.app).get("/api/questions/facets")
+    assert r.status_code == 200 and r.json()["subjects"] == ["Mechanics"]
diff --git a/tests/test_api_sims.py b/tests/test_api_sims.py
index c5d35ff..4035794 100644
--- a/tests/test_api_sims.py
+++ b/tests/test_api_sims.py
@@ -10,7 +10,7 @@ def test_api_sims_reads_manifest(tmp_path, monkeypatch):
     assert r.status_code == 200
     body = r.json()
     assert body["total"] == 1
-    assert body["sims"][0]["url"].endswith("/sims/SIM0020/SIM0020_sim.html")
+    assert body["sims"][0]["url"].endswith("/sims/SIM0020/SIM0020_sim")
 
 def test_api_sims_absent_manifest(tmp_path, monkeypatch):
     monkeypatch.setattr(config, "SIMS_ROOT", tmp_path)  # no manifest file
diff --git a/tests/test_clients.py b/tests/test_clients.py
index 43f5b37..4740bd2 100644
--- a/tests/test_clients.py
+++ b/tests/test_clients.py
@@ -1,10 +1,11 @@
-"""Unit tests for the read-only subsystem HTTP clients.
+"""Unit tests for the subsystem HTTP clients.
 
 The HTTP layer is fully MOCKED — no live-prod calls. We monkeypatch the module
 `requests` attribute with a fake transport that records the last request and
 returns canned JSON. We also assert that secret values are never echoed.
 
-create_seed is DEFERRED to Phase 3 (D2/D9), so there is no write-path test here.
+create_seed (mcd) and create_item (munshi) are the owner-initiated capture writes
+(2026-06-21 DEC-3 amendment); both write paths are covered here with mocked transports.
 """
 from __future__ import annotations
 
diff --git a/tests/test_sims_manifest.py b/tests/test_sims_manifest.py
index 3225f73..87669d5 100644
--- a/tests/test_sims_manifest.py
+++ b/tests/test_sims_manifest.py
@@ -19,5 +19,5 @@ def test_parse_groups_and_urls():
     phys = [r for r in rows if r["subject"] == "Physics"][0]
     assert phys["grade"] == "Class 11" and phys["title"].startswith("Vector Algebra")
 def test_sim_url_pads():
-    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim.html"
-    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim.html"
+    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
+    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"
</stdin>
2026-06-21T18:36:30.613149Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:29979/mcp)")))
2026-06-21T18:36:32.896323Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:29979/mcp)")))
2026-06-21T18:36:35.932308Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:29979/mcp)")))
codex
I’ll do this as a strict read-only review against the diff plus the live files around the touched contracts. I’m loading the review-related skill guidance first, then I’ll inspect the actual code paths and tests before giving a GO/NO-GO.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw C:\\Users\\abc\\.codex\\plugins\\cache\\openai-curated\\coderabbit\\202e9242\\skills\\coderabbit-review\\SKILL.md" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw C:\\Users\\abc\\.codex\\plugins\\cache\\openai-curated\\superpowers\\202e9242\\skills\\using-superpowers\\SKILL.md" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "if (Test-Path .\\.gptbox\\hooks\\codex-session-start.ps1) { .\\.gptbox\\hooks\\codex-session-start.ps1 } else { 'NO_GPTBOX_HOOK' }" in C:\SandBox\claude_box\TeachingOS
 succeeded in 216ms:
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


 succeeded in 216ms:
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


 succeeded in 1556ms:
NO_GPTBOX_HOOK

codex
The repo has no local GPT Box hook at the path requested by the project instructions. I’m now checking the touched contracts in the live tree rather than trusting the diff text alone, especially the adapter `Artifact` shape and frontend row normalization.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"TeachingOS|samagra|munshi|mycontentdev|questions/facets|sim_url|Artifact\" C:\\Users\\abc\\.codex\\memories\\MEMORY.md" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short --branch' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "class Artifact|@dataclass|def artifacts|def api_questions_facets|api_munshi_library|api_mcd_seeds|def sim_url|get_adapter|create_seed|create_item" samagra frontend tests -S' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "function catalogRows|export function catalogRows|type SearchResponse|interface SearchResponse|CatalogRow|uid|subject|unit|chapter|status|kind|url|path|meta" frontend/src -S' in C:\SandBox\claude_box\TeachingOS
 succeeded in 730ms:
## feature/control-plane-capture
?? AGENTS.md
?? "Web OS GUI design.zip"
?? docs/codex-reviews/18-capture-final.report.md
warning: unable to access 'C:\Users\abc/.config/git/ignore': Permission denied
warning: unable to access 'C:\Users\abc/.config/git/ignore': Permission denied

 succeeded in 1148ms:
1:# Task Group: C:\SandBox\claude_box\TeachingOS / SAMAGRA OS E2 re-review after patch verification
2:scope: Use for read-only review follow-ups in `TeachingOS` when the user asks whether a patch actually fixed earlier findings, wants the updated grounding contract treated as authoritative, and expects a final merge GO/NO-GO.
3:applies_to: cwd=C:\SandBox\claude_box\TeachingOS; reuse_rule=Safe for this repo's `e2/samagra-os` review workflow when the task is to re-check current branch state after a fix commit. Re-read the latest grounding doc and current branch head before reusing exact verdicts.
9:- rollout_summaries/2026-06-21T06-07-52-WDV5-samagra_os_e2_rereview_after_31aa5bb.md (cwd=\\?\C:\SandBox\claude_box\TeachingOS, rollout_path=C:\Users\abc\.codex\sessions\2026\06\21\rollout-2026-06-21T11-37-57-019ee8ca-e7e8-73b3-849d-ac06841024ef.jsonl, updated_at=2026-06-21T06:39:38+00:00, thread_id=019ee8ca-e7e8-73b3-849d-ac06841024ef, re-checked the three prior MEDIUM findings against current code and the updated grounding contract)
13:- TeachingOS, samagra-os, e2/samagra-os, 31aa5bb, re-review, GO/NO-GO, docs/superpowers/_research/samagra-os/e2-grounding.md, frontend/src/App.tsx, samagra/org.py, frontend/src/lib/catalog/rows.ts, tsc --noEmit, Vitest read-only sandbox
19:- rollout_summaries/2026-06-21T06-07-52-WDV5-samagra_os_e2_rereview_after_31aa5bb.md (cwd=\\?\C:\SandBox\claude_box\TeachingOS, rollout_path=C:\Users\abc\.codex\sessions\2026\06\21\rollout-2026-06-21T11-37-57-019ee8ca-e7e8-73b3-849d-ac06841024ef.jsonl, updated_at=2026-06-21T06:39:38+00:00, thread_id=019ee8ca-e7e8-73b3-849d-ac06841024ef, confirmed GO with only one residual LOW note after the three previous MEDIUM issues were fixed)
23:- TeachingOS, samagra-os, merge recommendation, GO, Questions app, /api/facets, /* @vite-ignore */, current branch state, updated grounding doc
34:- For this branch, `docs/superpowers/_research/samagra-os/e2-grounding.md` is the first file to read on a re-review because it now explicitly says the original `/* @vite-ignore */` was removed intentionally and should not be re-added [Task 1][Task 2]
35:- The three fixed MEDIUM issues were confirmed in current code by checking `samagra/org.py`, `samagra/api/app.py`, `tests/test_api_org.py`, `frontend/src/apps/Pipelines/index.tsx`, `frontend/src/apps/Pipelines/index.test.tsx`, `frontend/src/lib/catalog/rows.ts`, `frontend/src/lib/catalog/rows.test.ts`, and the six catalog app consumers [Task 1]
36:- `samagra/org.py` is a static no-IO registry; `tests/test_api_org.py` directly asserts the worker roster names, owner keys, and route registration, making it a strong review anchor for this area [Task 1]
374:- gpt-pratyaksh-second-brain, extra Physics, NotebookLM, EXTRA-PHYSICS-BATCH-010, PHY-XI-EXTRA-046, PHY-XI-EXTRA-050, nlm source add --text, nlm research status --max-wait 0, Artifact ID:, verify_package.py, state_research_started.json, state_studio_completed.json
405:- `nlm source add` works in plain-text mode only here, `nlm research status <notebook_id> --task-id <uuid> --max-wait 0` is the reliable recovery shape when task IDs shift, and Studio artifact parsing should target the labeled `Artifact ID:` line rather than blind UUID extraction [Task 8]
684:- rollout_summaries/2026-06-12T22-30-20-IP3j-munshi_s26_1_critical_readonly_review.md (cwd=\\?\C:\SandBox\claude_box\myProd, rollout_path=C:\Users\abc\.codex\sessions\2026\06\13\rollout-2026-06-13T04-00-25-019ebdf5-27e0-7270-9688-e9ef00a30139.jsonl, updated_at=2026-06-12T22:36:52+00:00, thread_id=019ebdf5-27e0-7270-9688-e9ef00a30139, line-cited read-only review of S26.1 commit `4856fde` across auth, print, SW cache, and tool paths)
694:- rollout_summaries/2026-06-12T22-30-20-IP3j-munshi_s26_1_critical_readonly_review.md (cwd=\\?\C:\SandBox\claude_box\myProd, rollout_path=C:\Users\abc\.codex\sessions\2026\06\13\rollout-2026-06-13T04-00-25-019ebdf5-27e0-7270-9688-e9ef00a30139.jsonl, updated_at=2026-06-12T22:36:52+00:00, thread_id=019ebdf5-27e0-7270-9688-e9ef00a30139, scoped the final `S26.1 VERDICT` to the print pipeline, scroll fix, and Gemini SVG drafting changes)
730:- rollout_summaries/2026-06-12T22-31-29-9lm7-munshi_100_item_test_plan_blocked_by_production_unreachable.md (cwd=\\?\C:\SandBox\claude_box\myProd, rollout_path=C:\Users\abc\.codex\sessions\2026\06\13\rollout-2026-06-13T04-01-34-019ebdf6-33ff-7de2-8149-65ac251fae07.jsonl, updated_at=2026-06-12T22:41:00+00:00, thread_id=019ebdf6-33ff-7de2-8149-65ac251fae07, auth preflight and scratch setup for a 100-item live test plan stopped because the sandbox could not reach production)
734:- myProd, Munshi, TESTPLAN.html, 100-item, production QA, auth preflight, login?k=, Set-Cookie, stress/driver.mjs, stress/cleanup-prod.mjs, Playwright, EACCES, fetch failed, curl.exe, %TEMP%\\munshi-testrun, npm.cmd
740:- rollout_summaries/2026-06-12T22-31-29-9lm7-munshi_100_item_test_plan_blocked_by_production_unreachable.md (cwd=\\?\C:\SandBox\claude_box\myProd, rollout_path=C:\Users\abc\.codex\sessions\2026\06\13\rollout-2026-06-13T04-01-34-019ebdf6-33ff-7de2-8149-65ac251fae07.jsonl, updated_at=2026-06-12T22:41:00+00:00, thread_id=019ebdf6-33ff-7de2-8149-65ac251fae07, generated and re-verified blocked `TESTRUN-2026-06-13.md` and `.json` outputs with 100 items and consistent counts)
749:- when the user required "Before any testing: GET https://munshi.dbhardwaj86.workers.dev/login?k=<secret> with redirectFollowMode=manual (do not follow the 302)" and "If NOT 302, STOP everything" -> gate all live-prod work on that auth preflight and stop immediately if it fails [Task 1]
757:- `src/index.ts` shows the auth gate shape: `/login?k=...` returns `302` plus `Set-Cookie: munshi=...`, and `/api/library` requires that cookie [Task 1]
759:- `%TEMP%\\munshi-testrun` was a usable scratch root after the requested `C:\SandBox\claude_box\munshi-testrun` path was denied by sandbox ACLs [Task 1]
764:- Symptom: the live test run never reaches baseline inventory or Playwright navigation -> cause: the sandbox cannot reach `munshi.dbhardwaj86.workers.dev`, with `fetch failed` / `cause=EACCES` and `curl` connect failures -> fix: treat network-unreachable auth preflight as a hard stop and report it immediately [Task 1]
765:- Symptom: the requested out-of-root scratch directory is denied -> cause: sandbox ACLs block that path -> fix: fall back to `%TEMP%\\munshi-testrun` instead of retrying the denied location [Task 1]

 succeeded in 1478ms:
frontend/src\App.tsx:4://   - aqua / samagra (`kind!=='console'`): a top bar (TopBar) + a bottom-center /
frontend/src\App.tsx:6://   - console (`kind==='console'`): NO top bar — a bottom Taskbar (Start button +
frontend/src\App.tsx:111:// The open context menu is one of three kinds, discriminated by where the right-click
frontend/src\App.tsx:112:// landed; `menuItems` builds the rows for the active kind (README §Context menus).
frontend/src\App.tsx:114:  | { kind: "window"; winId: string; x: number; y: number }
frontend/src\App.tsx:115:  | { kind: "app"; appId: AppId; x: number; y: number }
frontend/src\App.tsx:116:  | { kind: "desktop"; x: number; y: number };
frontend/src\App.tsx:134:  const isConsole = t.kind === "console";
frontend/src\App.tsx:135:  const isSamagra = t.kind === "samagra";
frontend/src\App.tsx:149:    setMenu({ kind: "window", winId: id, x, y });
frontend/src\App.tsx:152:    setMenu({ kind: "app", appId, x, y });
frontend/src\App.tsx:156:    setMenu({ kind: "desktop", x, y });
frontend/src\App.tsx:218:    if (menu.kind === "window") {
frontend/src\App.tsx:231:    if (menu.kind === "app") {
frontend/src\apps\Munshi\index.tsx:15:// Required + optional fields per munshi kind (mirrors lib/capture/munshi.ts).
frontend/src\apps\Munshi\index.tsx:29:  // reloadKey bumps the GET path so useApi refetches the library after a capture.
frontend/src\apps\Munshi\index.tsx:33:  const path = "/api/munshi/library" + (reloadKey ? `?_r=${reloadKey}` : "");
frontend/src\apps\Munshi\index.tsx:34:  const { data, loading, error } = useApi<SearchResponse>(path);
frontend/src\apps\Munshi\index.tsx:37:  const [kind, setKind] = useState<MunshiKind>("todo");
frontend/src\apps\Munshi\index.tsx:48:    const form = { kind, ...values } as MunshiCaptureForm;
frontend/src\apps\Munshi\index.tsx:74:        <select data-testid="capture-kind" aria-label="kind" value={kind}
frontend/src\apps\Munshi\index.tsx:79:        {FIELDS[kind].map((f) => (
frontend/src\apps\Munshi\index.tsx:103:          <article key={r.uid} data-testid="catalog-row"
frontend/src\apps\Munshi\index.tsx:108:              <div style={{ color: V.muted, fontSize: 12 }}>{[r.kind, r.status].filter(Boolean).join(" · ")}</div>
frontend/src\apps\Munshi\index.test.tsx:8:  { uid: "m1", source: "munshi", kind: "todo", title: "Call vendor", subject: null,
frontend/src\apps\Munshi\index.test.tsx:9:    unit: null, chapter: null, status: "open", path: null, url: null, updated_at: null, meta: {} },
frontend/src\apps\Munshi\index.test.tsx:38:    vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
frontend/src\apps\Munshi\index.test.tsx:40:        String(url).includes("/api/munshi/capture")
frontend/src\apps\Munshi\index.test.tsx:43:        { status: 200, headers: { "content-type": "application/json" } })));
frontend/src\apps\Munshi\index.test.tsx:47:    fireEvent.change(screen.getByTestId("capture-kind"), { target: { value: "todo" } });
frontend/src\lib\catalog\rows.ts:3:export interface CatalogRow {
frontend/src\lib\catalog\rows.ts:4:  uid: string;
frontend/src\lib\catalog\rows.ts:6:  subject: string | null;
frontend/src\lib\catalog\rows.ts:7:  unit: string | null;
frontend/src\lib\catalog\rows.ts:8:  chapter: string | null;
frontend/src\lib\catalog\rows.ts:9:  status: string | null;
frontend/src\lib\catalog\rows.ts:10:  kind: string;
frontend/src\lib\catalog\rows.ts:11:  url: string | null;
frontend/src\lib\catalog\rows.ts:12:  openHref: string | null;        // safe /open?path= link (file rows), or null
frontend/src\lib\catalog\rows.ts:13:  href: string | null;            // unified link target: file-open, else a safe web url
frontend/src\lib\catalog\rows.ts:14:  meta: Record<string, unknown>;
frontend/src\lib\catalog\rows.ts:17:/** Build the safe file-open href for a catalog path (null when no path). The
frontend/src\lib\catalog\rows.ts:18: *  backend /open enforces ALLOWED_ROOTS; we only link rows that carry a path. */
frontend/src\lib\catalog\rows.ts:19:export function openHref(path: string | null | undefined): string | null {
frontend/src\lib\catalog\rows.ts:20:  if (!path) return null;
frontend/src\lib\catalog\rows.ts:21:  return "/open?path=" + encodeURIComponent(path);
frontend/src\lib\catalog\rows.ts:24:/** A safe link target for a row's `url` field: http(s) or root-relative only.
frontend/src\lib\catalog\rows.ts:31:function toRow(r: SearchResult): CatalogRow {
frontend/src\lib\catalog\rows.ts:32:  const fileHref = openHref(r.path);
frontend/src\lib\catalog\rows.ts:34:    uid: r.uid,
frontend/src\lib\catalog\rows.ts:36:    subject: r.subject ?? null,
frontend/src\lib\catalog\rows.ts:37:    unit: r.unit ?? null,
frontend/src\lib\catalog\rows.ts:38:    chapter: r.chapter ?? null,
frontend/src\lib\catalog\rows.ts:39:    status: r.status ?? null,
frontend/src\lib\catalog\rows.ts:40:    kind: r.kind,
frontend/src\lib\catalog\rows.ts:41:    url: r.url ?? null,
frontend/src\lib\catalog\rows.ts:43:    href: fileHref ?? safeUrl(r.url),   // prefer file open; fall back to a safe web url
frontend/src\lib\catalog\rows.ts:44:    meta: r.meta && typeof r.meta === "object" ? r.meta : {},
frontend/src\lib\catalog\rows.ts:48:export function catalogRows(data: SearchResponse | null | undefined): CatalogRow[] {
frontend/src\lib\catalog\rows.ts:53:export function subjectsOf(rows: CatalogRow[]): string[] {
frontend/src\lib\catalog\rows.ts:55:  for (const r of rows) if (r.subject) set.add(r.subject);
frontend/src\lib\catalog\rows.test.ts:2:import { catalogRows, openHref, safeUrl, subjectsOf } from "./rows";
frontend/src\lib\catalog\rows.test.ts:7:    { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
frontend/src\lib\catalog\rows.test.ts:8:      unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
frontend/src\lib\catalog\rows.test.ts:9:      url: "/lecture/vectors", updated_at: "2026-06-01", meta: { order: 1 } },
frontend/src\lib\catalog\rows.test.ts:10:    { uid: "u2", source: "textbook", kind: "chapter", title: "Kinematics", subject: "Maths",
frontend/src\lib\catalog\rows.test.ts:11:      unit: "Mechanics", chapter: "2", status: null, path: null, url: null,
frontend/src\lib\catalog\rows.test.ts:12:      updated_at: null, meta: {} },
frontend/src\lib\catalog\rows.test.ts:20:    expect(rows[0]).toMatchObject({ uid: "u1", title: "Vectors", subject: "Physics", status: "approved" });
frontend/src\lib\catalog\rows.test.ts:21:    expect(rows[0].openHref).toBe("/open?path=" + encodeURIComponent("C:/t/vectors.html"));
frontend/src\lib\catalog\rows.test.ts:22:    expect(rows[1].openHref).toBeNull(); // no path → no open link
frontend/src\lib\catalog\rows.test.ts:31:  it("encodes a path, returns null for null/empty", () => {
frontend/src\lib\catalog\rows.test.ts:32:    expect(openHref("C:/a b.pdf")).toBe("/open?path=" + encodeURIComponent("C:/a b.pdf"));
frontend/src\lib\catalog\rows.test.ts:38:describe("subjectsOf", () => {
frontend/src\lib\catalog\rows.test.ts:40:    expect(subjectsOf(catalogRows(sample))).toEqual(["Maths", "Physics"]);
frontend/src\lib\catalog\rows.test.ts:54:  it("prefers the file-open link, falls back to a safe web url, drops unsafe schemes", () => {
frontend/src\lib\catalog\rows.test.ts:56:      { uid: "f", source: "s", kind: "k", title: "file", subject: null, unit: null, chapter: null,
frontend/src\lib\catalog\rows.test.ts:57:        status: null, path: "C:/a.pdf", url: "https://x/y", updated_at: null, meta: {} },
frontend/src\lib\catalog\rows.test.ts:58:      { uid: "w", source: "mycontentdev", kind: "concept", title: "seed", subject: null, unit: null,
frontend/src\lib\catalog\rows.test.ts:59:        chapter: null, status: null, path: null, url: "https://mcd/seed/1", updated_at: null, meta: {} },
frontend/src\lib\catalog\rows.test.ts:60:      { uid: "x", source: "s", kind: "k", title: "xss", subject: null, unit: null, chapter: null,
frontend/src\lib\catalog\rows.test.ts:61:        status: null, path: null, url: "javascript:alert(1)", updated_at: null, meta: {} },
frontend/src\lib\catalog\rows.test.ts:63:    expect(rows[0].href).toBe("/open?path=" + encodeURIComponent("C:/a.pdf")); // file wins
frontend/src\lib\catalog\rows.test.ts:64:    expect(rows[1].href).toBe("https://mcd/seed/1");                          // url-only → web
frontend/src\types\contracts.ts:23:  | { kind: "openApp"; value: AppId }
frontend/src\types\contracts.ts:24:  | { kind: "setTheme"; value: Theme }
frontend/src\types\contracts.ts:25:  | { kind: "setDevice"; value: Device };
frontend/src\types\contracts.ts:42:  uid: string; source: string; kind: string; title: string;
frontend/src\types\contracts.ts:43:  subject: string | null; unit: string | null; chapter: string | null;
frontend/src\types\contracts.ts:44:  status: string | null; path: string | null; url: string | null;
frontend/src\types\contracts.ts:46:  meta: Record<string, unknown>;     // parsed from meta_json
frontend/src\types\contracts.ts:47:  meta_json?: string;                 // raw string ALSO present on the wire
frontend/src\types\contracts.ts:49:export interface SearchResponse { results: SearchResult[]; }
frontend/src\types\contracts.ts:50:export interface Facets { sources: string[]; kinds: string[]; subjects: string[]; }
frontend/src\types\contracts.ts:54:  q_uid: string; slug: string; q_type: string | null;
frontend/src\types\contracts.ts:55:  subject: string | null; chapter: string | null;
frontend/src\types\contracts.ts:72:  status: PipelineStatus; owner: string | null; gate: boolean;
frontend/src\types\contracts.ts:84:  id: string; agent: string; outbox_path: string;
frontend/src\types\contracts.ts:87:  status: AssignmentStatus; created_at: string; updated_at: string;
frontend/src\types\contracts.ts:104:export interface MunshiCaptureForm { kind: MunshiKind; [field: string]: string; }
frontend/src\types\contracts.ts:109:export interface SimRow { id: string; title: string; subject: string | null; grade: string | null; url: string; }
frontend/src\types\contracts.ts:111:export interface QuestionFacets { subjects: string[]; }
frontend/src\apps\Lectures\index.tsx:30:            {loading ? "Loading…" : "No chapters yet — run a catalog refresh."}
frontend/src\apps\Lectures\index.tsx:33:          <article key={r.uid} data-testid="catalog-row"
frontend/src\apps\Lectures\index.tsx:39:                {[r.unit, r.chapter && `ch ${r.chapter}`, r.status].filter(Boolean).join(" · ")}
frontend/src\apps\Lectures\index.test.tsx:8:  { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
frontend/src\apps\Lectures\index.test.tsx:9:    unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
frontend/src\apps\Lectures\index.test.tsx:10:    url: null, updated_at: null, meta: {} },
frontend/src\themes\index.ts:3:// Chrome constants (kind/dockPos/controlSide/barH/rail/winRadius) are consumed by
frontend/src\themes\index.ts:12:  kind: ThemeKind;
frontend/src\themes\index.ts:41:  kind: "mac",
frontend/src\themes\index.ts:73:  kind: "console",
frontend/src\themes\index.ts:106:  kind: "samagra",
frontend/src\themes\index.ts:234:// §6.5 Semantic / status colors (shared across apps)
frontend/src\themes\index.test.ts:31:    expect(a.kind).toBe("mac");
frontend/src\themes\index.test.ts:59:  it("chrome constants (kind/dockPos/controlSide/barH/winRadius)", () => {
frontend/src\themes\index.test.ts:60:    expect(c.kind).toBe("console");
frontend/src\themes\index.test.ts:93:  it("chrome constants (kind/dockPos/controlSide/barH/rail/winRadius)", () => {
frontend/src\themes\index.test.ts:94:    expect(s.kind).toBe("samagra");
frontend/src\apps\Insp\index.tsx:32:          <article key={r.uid} data-testid="catalog-row"
frontend/src\apps\Insp\index.tsx:37:              <div style={{ color: V.muted, fontSize: 12 }}>{r.kind}</div>
frontend/src\apps\Insp\index.test.tsx:8:  { uid: "i1", source: "insp", kind: "exam-set", title: "NSEP 2024", subject: null,
frontend/src\apps\Insp\index.test.tsx:9:    unit: null, chapter: null, status: null, path: null, url: null, updated_at: null, meta: { pdfs: 5 } },
frontend/src\apps\Dashboard\index.tsx:8://   (avatars + green status dots) · Recent-activity accent-left-border timeline.
frontend/src\apps\Dashboard\index.tsx:16://     hexes; the success-green pill/dots are the hardcoded status color #16a34a.
frontend/src\apps\Dashboard\index.tsx:88:  { testid: "chapters", label: "Chapters", color: V.accent2 },
frontend/src\apps\Dashboard\index.tsx:98:  chapters: "59",
frontend/src\apps\Dashboard\index.tsx:309:          {/* Board — avatars + green status dots (L287-293). */}
frontend/src\apps\Dashboard\index.tsx:340:                    data-testid="status-dot"
frontend/src\apps\Dashboard\index.test.tsx:6:// bars, a Board card (avatars + green status dots) and a Recent-activity
frontend/src\apps\Dashboard\index.test.tsx:41:      summary: { chapters: 42, units: 9, by_status: { done: 30, queued: 12 } },
frontend/src\apps\Dashboard\index.test.tsx:58:      const url = String(input);
frontend/src\apps\Dashboard\index.test.tsx:59:      if (url.includes("/api/overview")) {
frontend/src\apps\Dashboard\index.test.tsx:61:          status: 200,
frontend/src\apps\Dashboard\index.test.tsx:66:      if (url.includes("/api/pipelines")) {
frontend/src\apps\Dashboard\index.test.tsx:68:          status: 200,
frontend/src\apps\Dashboard\index.test.tsx:72:      if (url.includes("/api/assignments")) {
frontend/src\apps\Dashboard\index.test.tsx:74:          status: 200,
frontend/src\apps\Dashboard\index.test.tsx:79:        status: 200,
frontend/src\apps\Dashboard\index.test.tsx:92:// BEHAVIOUR — the useApi fetch path + Σ headline + error branches (E1.19).    //
frontend/src\apps\Dashboard\index.test.tsx:117:      vi.fn(async () => new Response("upstream down", { status: 503 })),
frontend/src\apps\Dashboard\index.test.tsx:155:  it("renders the green '11/11 tests green' status pill in the success color #16a34a", async () => {
frontend/src\apps\Dashboard\index.test.tsx:281:  it("renders the three board members with role + green status dots", async () => {
frontend/src\apps\Dashboard\index.test.tsx:292:    // Each member has a status dot painted the success green #16a34a.
frontend/src\apps\Dashboard\index.test.tsx:293:    const dots = within(board).getAllByTestId("status-dot");
frontend/src\apps\Settings\index.tsx:14://   • Integrations — the prototype's five fixed status rows (cardBg / 1px theme line
frontend/src\apps\Settings\index.tsx:15://     / radius 10 / padding 11px 13px), each a flex-1 label + a status Pill: the
frontend/src\apps\Settings\index.tsx:25://     depict each theme, so they stay fixed); the pill status hues are the fixed
frontend/src\apps\Settings\index.tsx:61:// Semantic status hues (proto.md §6.5) — fixed, NOT the theme accent.
frontend/src\apps\Settings\index.tsx:86:// The five fixed integration rows (.dc.html L495): [label, status, color].
frontend/src\apps\Settings\index.tsx:87:const INTEGRATIONS: { label: string; status: string; color: string }[] = [
frontend/src\apps\Settings\index.tsx:88:  { label: "Hourly scheduled task", status: "needs OK", color: WARN },
frontend/src\apps\Settings\index.tsx:89:  { label: "Telegram + email notify", status: "creds", color: WARN },
frontend/src\apps\Settings\index.tsx:90:  { label: "Google Docs export", status: "creds", color: WARN },
frontend/src\apps\Settings\index.tsx:91:  { label: "HTML + DOCX export", status: "active", color: SUCCESS },
frontend/src\apps\Settings\index.tsx:92:  { label: "Codex pre-commit review", status: "active", color: SUCCESS },
frontend/src\apps\Settings\index.tsx:269:      {/* ---- Integrations — the five status rows ---- */}
frontend/src\apps\Settings\index.tsx:299:              <Pill text={it.status} color={it.color} />
frontend/src\apps\Settings\index.test.tsx:12://   • Integrations — the prototype's 5 fixed status rows (cardBg / 1px line /
frontend/src\apps\Settings\index.test.tsx:13://     radius 10 / padding 11px 13px), each a label + a status Pill: the three
frontend/src\apps\Settings\index.test.tsx:23://      status rows with warning/success pills, and the FD2 header <Icon> (a real
frontend/src\apps\Settings\index.test.tsx:197:// FIDELITY — Integrations status rows (AP2).                                  //
frontend/src\apps\Settings\index.test.tsx:202:    expect(screen.getByText("Hourly scheduled task")).toBeInTheDocument();
frontend/src\apps\Settings\index.test.tsx:221:  it("colours the status pills by semantic status (warning #d97706 / success #16a34a)", () => {
frontend/src\apps\Clock\index.tsx:137:          <path key={i} d={d} />
frontend/src\apps\Clock\index.tsx:156:      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
frontend/src\apps\Clock\index.test.tsx:359:    // it is a real 24×24 vector glyph (round-capped stroke paths), not a glyph font.
frontend/src\apps\Clock\index.test.tsx:362:    expect(glyph!.querySelector("path")).not.toBeNull();
frontend/src\apps\Clock\index.test.tsx:381:    // = indigo #6366f1@15% bg + a single-<path> moon glyph. Each chip is exactly one
frontend/src\apps\Clock\index.test.tsx:398:        // moon glyph is path-only (no <circle>); chip text colour = the indigo glyph hue.
frontend/src\components\Pill.tsx:2:// Thin presentational wrapper: a small rounded status label tinted by `accent`.
frontend/src\components\Pill.tsx:7:  /** Accent/status color (e.g. STATUS.* or theme.accent from themes/). */
frontend/src\components\Pill.tsx:13:/** Compact rounded status label, tinted by the accent token. */
frontend/src\components\icons-data.ts:2:// Each value is the EXACT path-data string from the prototype's `ICONS` object
frontend/src\components\icons-data.ts:4:// sub-paths with `|`; the <Icon> component splits on `|` into one <path> each.
frontend/src\components\icons-data.ts:6:// DATA ONLY; do not edit path strings — they are the authoritative source of truth.
frontend/src\components\icons-data.ts:9:/** Raw 24×24 line-icon path data, keyed by app id. Verbatim from the prototype. */
frontend/src\components\Icon.tsx:4:// glyph's path-data split on `|` into one <path> per segment. Color is inherited
frontend/src\components\Icon.tsx:22:/** 24×24 stroke line-icon, path data verbatim from the prototype's ICONS map. */
frontend/src\components\Icon.tsx:46:        <path key={i} d={d} />
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
frontend/src\components\Chip.tsx:7:  /** Accent/status color (e.g. DIFFICULTY.* from themes/). */
frontend/src\components\AppIcon.test.tsx:24:    expect(container.querySelectorAll("path")).toHaveLength(
frontend/src\hooks\useApi.ts:17: * effect is abort-guarded so a unit that unmounts mid-flight never setstates.
frontend/src\hooks\useApi.ts:19:export function useApi<T = unknown>(path: string): ApiState<T> {
frontend/src\hooks\useApi.ts:31:        const res = await fetch(path, { headers: { accept: "application/json" } });
frontend/src\hooks\useApi.ts:33:          if (alive) setState({ data: null, error: `HTTP ${res.status}`, loading: false });
frontend/src\hooks\useApi.ts:45:  }, [path]);
frontend/src\apps\Booklets\index.tsx:32:          <article key={r.uid} data-testid="catalog-row"
frontend/src\apps\Booklets\index.tsx:37:              <div style={{ color: V.muted, fontSize: 12 }}>{[r.subject, r.status].filter(Boolean).join(" · ")}</div>
frontend/src\apps\Booklets\index.test.tsx:8:  { uid: "b1", source: "booklets", kind: "booklet", title: "Mechanics WB", subject: "Physics",
frontend/src\apps\Booklets\index.test.tsx:9:    unit: null, chapter: null, status: null, path: "C:/b/mech.pdf", url: null, updated_at: null, meta: {} },
frontend/src\apps\Snake\index.tsx:31:// theme-kind-driven (food → #fbbf24 default, #d9601a in samagra — proto `FOOD`).
frontend/src\apps\Snake\index.tsx:55:// vars (board / food / grid) are theme-kind-driven via the scoped <style> below.
frontend/src\apps\Snake\index.tsx:82:// proto §2.9 key map: Arrows + WASD → unit dir vectors.
frontend/src\apps\Snake\index.tsx:184:      if (nextState.status === "dead" && prev.status === "running") {
frontend/src\apps\Snake\index.tsx:197:    if (game.status !== "running") return;
frontend/src\apps\Snake\index.tsx:200:  }, [game.status, game.speed, tick]);
frontend/src\apps\Snake\index.tsx:204:      prev.status === "dead" || prev.status === "idle"
frontend/src\apps\Snake\index.tsx:205:        ? { ...init(prev.level, rng.current), status: "running" }
frontend/src\apps\Snake\index.tsx:206:        : { ...prev, status: "running" },
frontend/src\apps\Snake\index.tsx:212:      prev.status === "running" ? { ...prev, status: "paused" } : prev,
frontend/src\apps\Snake\index.tsx:243:          prev.status === "running" ? { ...prev, status: "paused" } : prev,
frontend/src\apps\Snake\index.tsx:245:        if (game.status !== "running") start();
frontend/src\apps\Snake\index.tsx:250:  }, [game.status, turn, start]);
frontend/src\apps\Snake\index.tsx:253:  // copy switch on status.
frontend/src\apps\Snake\index.tsx:255:    game.status === "idle" || game.status === "dead" || game.status === "paused";
frontend/src\apps\Snake\index.tsx:257:    game.status === "dead" ? "Game Over" : game.status === "paused" ? "Paused" : "Snake";
frontend/src\apps\Snake\index.tsx:259:    game.status === "dead"
frontend/src\apps\Snake\index.tsx:263:    game.status === "dead" ? "Play again" : game.status === "paused" ? "Resume" : "Start";
frontend/src\apps\Snake\index.tsx:268:    game.status === "dead" ? "Restart" : game.status === "paused" ? "Resume" : "Start";
frontend/src\apps\Snake\index.tsx:591:          {game.status === "running" ? (
frontend/src\apps\Snake\index.test.tsx:28://          are theme-kind-driven (dark navy / near-black / cream board; amber food,
frontend/src\apps\Snake\index.test.tsx:219:      // theme-kind board surface via a local var (overridden per [data-theme]).
frontend/src\apps\Snake\index.test.tsx:275:  it("scopes the theme-kind board + food hues to [data-theme] via a <style> block (FD1)", () => {
frontend/src\apps\Sims\index.test.tsx:8:  { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11",
frontend/src\apps\Sims\index.test.tsx:9:    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
frontend/src\apps\Sims\index.test.tsx:25:    // No SIM0xxx subject chips.
frontend/src\apps\Sims\index.test.tsx:26:    for (const chip of screen.queryAllByTestId("subject-chip")) {
frontend/src\hooks\useApiPost.test.ts:6:    new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json" } }),
frontend/src\hooks\useApiPost.test.ts:18:    new Response(JSON.stringify({ detail: "bad kind" }), { status: 400, headers: { "content-type": "application/json" } }),
frontend/src\hooks\useApiPost.test.ts:22:  expect(result.current.error).toBe("bad kind");
frontend/src\lib\wm\geometry.ts:24:  switch (t.kind) {
frontend/src\apps\Assignments\index.test.tsx:8:  { id: "A1", agent: "codex", outbox_path: "x", pipeline: "textbook", seed_ref: null, artifact_ref: null,
frontend/src\apps\Assignments\index.test.tsx:9:    expected_output: null, review_by: null, status: "in-review", created_at: "t", updated_at: "t" },
frontend/src\lib\activity\format.test.ts:6:  id: 1, ts: "2026-06-20T10:00:00", actor: "codex", verb: "status:in-review",
frontend/src\lib\activity\format.test.ts:13:    expect(l).toMatchObject({ id: 1, who: "codex", what: "status:in-review", note: "looks good" });
frontend/src\shell\ContextMenu.tsx:62:function menuSurface(kind: string): string {
frontend/src\shell\ContextMenu.tsx:63:  if (kind === "samagra") return "rgba(255,251,243,0.97)";
frontend/src\shell\ContextMenu.tsx:64:  if (kind === "console") return "rgba(18,24,36,0.96)";
frontend/src\shell\ContextMenu.tsx:83:        background: menuSurface(t.kind),
frontend/src\hooks\useApiPost.ts:5:  async function post(path: string, body: unknown): Promise<T | null> {
frontend/src\hooks\useApiPost.ts:8:      const res = await fetch(path, {
frontend/src\hooks\useApiPost.ts:14:        let msg = `HTTP ${res.status}`;
frontend/src\apps\Terminal\index.test.tsx:33:// effect-runner path is pinned both by the spy call AND by the resulting store
frontend/src\apps\Terminal\index.test.tsx:200:    // dim hint carries the `e.g. status · agents · catalog · open questions · theme
frontend/src\apps\Terminal\index.test.tsx:203:    // spaces (`commands.   e.g.  status`) are asserted, not collapsed.
frontend/src\apps\Terminal\index.test.tsx:206:        "Type 'help' for commands.   e.g.  status · agents · catalog · open questions · theme console",
frontend/src\apps\Terminal\index.test.tsx:283:    // verbatim multi-segment glyph path data (≥1 <path>) — never a letter badge.
frontend/src\apps\Terminal\index.test.tsx:285:    expect(svg!.querySelectorAll("path").length).toBeGreaterThan(0);
frontend/src\lib\api\query.test.ts:17:    expect(buildQuery({ source: "insp", kind: "exam", limit: 500 })).toBe("?source=insp&kind=exam&limit=500");
frontend/src\lib\capture\munshi.test.ts:6:    expect(buildMunshiCapture({ kind: "todo", assignee: "Ravi", task: "Call" }))
frontend/src\lib\capture\munshi.test.ts:7:      .toEqual({ ok: true, body: { kind: "todo", assignee: "Ravi", task: "Call" } });
frontend/src\lib\capture\munshi.test.ts:10:    const r = buildMunshiCapture({ kind: "note", student: "Amit", issue: "" });
frontend/src\lib\capture\munshi.test.ts:14:    const r = buildMunshiCapture({ kind: "todo", assignee: "A", task: "T", due: "2026-07-01" });
frontend/src\apps\Activity\index.test.tsx:8:  { id: 2, ts: "2026-06-20T10:00", actor: "codex", verb: "status:approved",
frontend/src\apps\Activity\index.test.tsx:19:    expect(screen.getByTestId("activity-row")).toHaveTextContent("status:approved");
frontend/src\lib\kanban\columns.ts:19:    const bucket = groups[a.status as AssignmentStatus];
frontend/src\lib\kanban\columns.ts:20:    if (bucket) bucket.push(a);   // unknown status → ignored, never crashes
frontend/src\lib\kanban\columns.test.ts:5:const a = (id: string, status: Assignment["status"]): Assignment => ({
frontend/src\lib\kanban\columns.test.ts:6:  id, agent: "codex", outbox_path: "x", pipeline: null, seed_ref: null, artifact_ref: null,
frontend/src\lib\kanban\columns.test.ts:7:  expected_output: null, review_by: null, status, created_at: "t", updated_at: "t",
frontend/src\lib\kanban\columns.test.ts:11:  it("is the 5 statuses in order, in-review hyphenated", () => {
frontend/src\lib\kanban\columns.test.ts:18:  it("buckets each assignment under its literal status, all 5 keys present", () => {
frontend/src\lib\kanban\columns.test.ts:24:  it("defensive: null/non-array → all-empty buckets; unknown status ignored", () => {
frontend/src\lib\kanban\columns.test.ts:27:    const u = groupByStatus([{ ...a("9", "queued"), status: "weird" as never }]);
frontend/src\apps\Pipelines\index.tsx:37:                  {s.gate ? "[gate] " : ""}{s.name}: {s.status}{s.owner ? ` · ${ownerName(org.data, s.owner)}` : ""}
frontend/src\apps\Pipelines\index.test.tsx:10:    draft: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
frontend/src\apps\Pipelines\index.test.tsx:11:    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },
frontend/src\lib\terminal\dispatch.ts:46:  ["status", "project status snapshot"],
frontend/src\lib\terminal\dispatch.ts:125:    line("status-flow: seed → draft → review → publish", "dim"),
frontend/src\lib\terminal\dispatch.ts:183:    effects: [{ kind: "openApp", value: id }],
frontend/src\lib\terminal\dispatch.ts:192:      effects: [{ kind: "setTheme", value: name as Theme }],
frontend/src\lib\terminal\dispatch.ts:206:      effects: [{ kind: "setDevice", value: name as Device }],
frontend/src\lib\terminal\dispatch.ts:232:    case "status":
frontend/src\lib\terminal\dispatch.test.ts:10:    expect(r.effects).toContainEqual({ kind: "openApp", value: "snake" });
frontend/src\lib\terminal\dispatch.test.ts:15:    expect(r.effects).toContainEqual({ kind: "openApp", value: "clock" });
frontend/src\lib\terminal\dispatch.test.ts:23:    expect(dispatch("theme console", ctx).effects).toContainEqual({ kind: "setTheme", value: "console" });
frontend/src\lib\terminal\dispatch.test.ts:27:    expect(dispatch("device mobile", ctx).effects).toContainEqual({ kind: "setDevice", value: "mobile" });
frontend/src\lib\terminal\dispatch.test.ts:61:      "help", "status", "catalog", "agents", "pipelines", "ls",
frontend/src\lib\terminal\dispatch.test.ts:67:  it("status carries the artifacts/tests/repo facts (proto §4.2)", () => {
frontend/src\lib\terminal\dispatch.test.ts:68:    const out = text("status");
frontend/src\apps\Notes\index.tsx:6:// new note/todo logic here — every CRUD path delegates to a pure `lib/notes`
frontend/src\apps\Notes\index.tsx:82:/** proto §5.4 meta line: `N words · edited <Mon D, h:mm AM/PM>`. */
frontend/src\apps\Notes\index.tsx:110:      <path d="M5 12l4 4L19 6" />
frontend/src\apps\Notes\index.tsx:330:          {/* Right editor — title input / meta / body textarea / footer. */}
frontend/src\apps\Notes\index.tsx:358:                data-testid="note-meta"
frontend/src\apps\Notes\index.test.tsx:17://          meta line `N words · edited <date>` (11px muted), body <textarea>
frontend/src\apps\Notes\index.test.tsx:38:// localStorage. `load` returns the seed arrays (defensive fallback path) so the
frontend/src\apps\Notes\index.test.tsx:236:  it("renders the meta line `N words · edited <date>` (11px muted var) (FD1)", () => {
frontend/src\apps\Notes\index.test.tsx:238:    const meta = screen.getByTestId("note-meta");
frontend/src\apps\Notes\index.test.tsx:239:    expect(meta).toHaveTextContent(/\d+ words · edited /);
frontend/src\apps\Notes\index.test.tsx:240:    expect(meta).toHaveStyle({ fontSize: "11px", color: "var(--samagra-muted)" });
frontend/src\apps\Notes\index.test.tsx:261:    // FD1: the "saved" status dot is a 6×6 round swatch in the theme accent2 var.
frontend/src\apps\Notes\index.test.tsx:367:    expect(glyph!.querySelector("path")).not.toBeNull();
frontend/src\shell\Dock.tsx:54:        const accent = t.kind === "samagra" ? t.accent : app.accent;
frontend/src\apps\Mycontentdev\index.tsx:21:  // reloadKey bumps the GET path so useApi refetches the list after a seed capture.
frontend/src\apps\Mycontentdev\index.tsx:25:  const path = "/api/mcd/seeds" + (reloadKey ? `?_r=${reloadKey}` : "");
frontend/src\apps\Mycontentdev\index.tsx:26:  const { data, loading, error } = useApi<SearchResponse>(path);
frontend/src\apps\Mycontentdev\index.tsx:104:          <article key={r.uid} data-testid="catalog-row"
frontend/src\apps\Mycontentdev\index.tsx:109:              <div style={{ color: V.muted, fontSize: 12 }}>{[r.kind, r.status].filter(Boolean).join(" · ")}</div>
frontend/src\apps\Mycontentdev\index.test.tsx:8:  { uid: "s1", source: "mycontentdev", kind: "concept", title: "Seed A", subject: null,
frontend/src\apps\Mycontentdev\index.test.tsx:9:    unit: null, chapter: null, status: "captured", path: null, url: "x", updated_at: null, meta: {} },
frontend/src\apps\Mycontentdev\index.test.tsx:35:      new Response(JSON.stringify({ ok: true, seed: { id: "s1", status: "captured" } }),
frontend/src\apps\Mycontentdev\index.test.tsx:36:        { status: 200, headers: { "content-type": "application/json" } }));
frontend/src\apps\Mycontentdev\index.test.tsx:60:    resolve(new Response(JSON.stringify({ ok: true, seed: { id: "s1", status: "captured" } }),
frontend/src\apps\Mycontentdev\index.test.tsx:61:      { status: 200, headers: { "content-type": "application/json" } }));
frontend/src\lib\questions\facets.test.ts:16:    const data = { results: [{ q_uid: "q1", slug: "s", q_type: "integer", subject: "P",
frontend/src\lib\questions\facets.test.ts:17:      chapter: "1", difficulty: "easy", text: "snippet…" }] } as QuestionsResponse;
frontend/src\shell\StartMenu.tsx:69:          const accent = t.kind === "samagra" ? t.accent : app.accent;
frontend/src\shell\Taskbar.test.tsx:179:    // beyond the Start glyph, the activity status mark is also an inline svg
frontend/src\lib\pipelines\stages.ts:5:  status: PipelineStatus;
frontend/src\lib\pipelines\stages.ts:16:    status: ph.status,
frontend/src\lib\pipelines\stages.ts:25:  return { done: stages.filter((s) => s.status === "done").length, total: stages.length };
frontend/src\lib\pipelines\stages.test.ts:8:    draft: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
frontend/src\lib\pipelines\stages.test.ts:9:    enrich: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
frontend/src\lib\pipelines\stages.test.ts:10:    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },
frontend/src\lib\pipelines\stages.test.ts:11:    export: { status: "pending", owner: "teachingos", gate: false, started: null, finished: null, artifacts: [], error: null },
frontend/src\lib\snake\engine.test.ts:17:    expect(s.status).toBe("idle");
frontend/src\lib\snake\engine.test.ts:21:    const s = { ...init("normal", rng0), status: "running" as const };
frontend/src\lib\snake\engine.test.ts:26:    const s = { ...init("normal", rng0), status: "running" as const, food: [15, 15] as [number, number] };
frontend/src\lib\snake\engine.test.ts:32:    let s = { ...init("normal", rng0), status: "running" as const };
frontend/src\lib\snake\engine.test.ts:35:    expect(out.status).toBe("dead");
frontend/src\lib\snake\engine.test.ts:38:    const s = { ...init("normal", rng0), status: "running" as const, food: [10, 9] as [number, number] };
frontend/src\lib\snake\engine.test.ts:47:      ...init("normal", rng0), status: "running" as const,
frontend/src\lib\snake\engine.test.ts:51:    expect(step(s, rng0).status).toBe("running");
frontend/src\apps\Terminal\index.tsx:53:// `e.g. status · agents · catalog · open questions · theme console` example
frontend/src\apps\Terminal\index.tsx:58:    t: "Type 'help' for commands.   e.g.  status · agents · catalog · open questions · theme console",
frontend/src\apps\Terminal\index.tsx:101:  // Context fed to the pure engine: app order + metadata (DATA only).
frontend/src\apps\Terminal\index.tsx:123:    switch (effect.kind) {
frontend/src\lib\snake\engine.ts:13:/** A direction vector `[dx, dy]` (one of the four unit vectors). */
frontend/src\lib\snake\engine.ts:44:/** Game lifecycle status. */
frontend/src\lib\snake\engine.ts:63:  /** Lifecycle status. */
frontend/src\lib\snake\engine.ts:64:  status: Status;
frontend/src\lib\snake\engine.ts:81:  status: Status;
frontend/src\lib\snake\engine.ts:93:  // a free cell always exists; the cap only prevents a pathological RNG from
frontend/src\lib\snake\engine.ts:128:    status: "idle",
frontend/src\lib\snake\engine.ts:155:  if (state.status !== "running") return state;
frontend/src\lib\snake\engine.ts:171:    return { ...state, dir, status: "dead" };
frontend/src\lib\snake\engine.ts:201:    status: s.status,
frontend/src\lib\clock\timer.ts:23: * reading share the same unit (ms) and clock — both injected, so this is pure.
frontend/src\lib\capture\munshi.ts:14:  const req = REQUIRED[form.kind];
frontend/src\lib\capture\munshi.ts:15:  if (!req) return { ok: false, error: "kind must be todo, note, or followup" };
frontend/src\lib\capture\munshi.ts:18:  const body: Record<string, string> = { kind: form.kind };
frontend/src\lib\capture\munshi.ts:20:  for (const k of OPTIONAL[form.kind]) if ((form[k] ?? "").trim()) body[k] = form[k].trim();
frontend/src\apps\Questions\index.test.tsx:8:  { q_uid: "q1", slug: "s1", q_type: "integer", subject: "Physics", chapter: "1",
frontend/src\apps\Questions\index.test.tsx:11:// Question-scoped facets (the fix): subject chips must come from here.
frontend/src\apps\Questions\index.test.tsx:12:const qFacets = { subjects: ["Physics", "Chemistry"] };
frontend/src\apps\Questions\index.test.tsx:14:const catalogFacets = { sources: ["qx"], kinds: ["question"], subjects: ["SIM0018"] };
frontend/src\apps\Questions\index.test.tsx:16:// Route the mock per path: question-scoped facets for /api/questions/facets,
frontend/src\apps\Questions\index.test.tsx:40:  it("fetches /api/questions/facets and renders a chip per question-scoped subject", () => {
frontend/src\apps\Questions\index.test.tsx:45:    const chips = screen.getAllByTestId("subject-chip");
frontend/src\apps\Questions\index.test.tsx:50:  it("selecting a subject bakes it into the /api/questions path so the list refetches", () => {
frontend/src\apps\Questions\index.test.tsx:55:    expect(useApiMock).toHaveBeenCalledWith("/api/questions?subject=Physics&limit=50");
frontend/src\apps\Questions\index.test.tsx:58:  it("re-selecting the active subject clears the filter back to the base path", () => {
frontend/src\apps\Questions\index.test.tsx:66:    expect(useApiMock).not.toHaveBeenCalledWith("/api/questions?subject=Physics&limit=50");
frontend/src\apps\Questions\index.tsx:17:  // Selected subject is baked into the /api/questions path; empty = no filter.
frontend/src\apps\Questions\index.tsx:18:  // useApi re-fires when the path string changes, so this drives the refetch.
frontend/src\apps\Questions\index.tsx:19:  const [subject, setSubject] = useState("");
frontend/src\apps\Questions\index.tsx:20:  const qPath = "/api/questions" + buildQuery({ subject, limit: 50 });
frontend/src\apps\Questions\index.tsx:23:  const subjects = Array.isArray(facetData?.subjects) ? facetData!.subjects : [];
frontend/src\apps\Questions\index.tsx:36:      {subjects.length ? (
frontend/src\apps\Questions\index.tsx:37:        <div data-testid="subject-filters" style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
frontend/src\apps\Questions\index.tsx:38:          {subjects.map((s) => {
frontend/src\apps\Questions\index.tsx:39:            const active = subject === s;
frontend/src\apps\Questions\index.tsx:41:              <button key={s} type="button" data-testid="subject-chip"
frontend/src\apps\Questions\index.tsx:63:          <article key={q.q_uid} data-testid="question-row"
frontend/src\apps\Questions\index.tsx:67:              {[q.q_type, q.subject, q.chapter, q.difficulty].filter(Boolean).join(" · ")}
frontend/src\shell\TopBar.test.tsx:74:  // --- FD2: the leading status mark is an inline <svg>, never a letter badge ---
frontend/src\shell\TopBar.test.tsx:75:  it("renders the activity status mark as an inline <svg> icon (not a text glyph)", () => {
frontend/src\lib\api\query.ts:1:/** Build a query string for useApi(path). Drops undefined and empty-string values
frontend/src\shell\TopBar.tsx:3:// strip that is shown for the `mac` (aqua) and `samagra` theme kinds and rendered as
frontend/src\shell\TopBar.tsx:19:// Small rounded status pill (proto `pill(txt,fg,bg)` helper L249): inline-flex,
frontend/src\shell\TopBar.tsx:56:  // console has no top bar (renderTopBar returns null for kind==='console').
frontend/src\shell\TopBar.tsx:57:  if (t.kind === "console") return null;
frontend/src\shell\TopBar.tsx:63:  if (t.kind === "samagra") {
frontend/src\shell\TopBar.tsx:159:        {/* FD2 — activity status mark is an inline <svg>, never a letter glyph */}
frontend/src\lib\sims\deployed.test.ts:3:  { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11", url: "u1" },
frontend/src\lib\sims\deployed.test.ts:4:  { id: "0466", title: "Osmosis Lab", subject: "Biology", grade: "Class 9", url: "u2" },
frontend/src\lib\sims\deployed.test.ts:6:it("filters by title/subject/id", () => {
frontend/src\apps\Sims\index.tsx:31:          placeholder="Search title, subject, or id…"
frontend/src\apps\Sims\index.tsx:53:                    <div style={{ color: V.muted, fontSize: 12 }}>{r.subject ?? ""}</div>
frontend/src\apps\Sims\index.tsx:55:                  <a href={r.url} target="_blank" rel="noreferrer"
frontend/src\lib\sims\deployed.ts:7:    (r.subject ?? "").toLowerCase().includes(t) ||
frontend/src\shell\WindowFrame.tsx:155:        <path d={d} />
frontend/src\shell\WindowFrame.tsx:176:  const isConsole = t.kind === "console";
frontend/src\shell\WindowFrame.tsx:396:          <path

 succeeded in 1549ms:
tests\test_lectures.py:6:from samagra.adapters import get_adapter
tests\test_lectures.py:10:_HAS_TEXTBOOK = get_adapter("textbook").available()
tests\test_api_capture.py:10:        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 7}
tests\test_api_capture.py:35:        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 1}
tests\test_api_capture.py:45:        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 2}
tests\test_api_capture.py:68:        def create_item(self, kind, fields): raise RuntimeError("secret: token=abc123 https://munshi.internal")
tests\test_api_capture.py:80:        def create_seed(self, fields): captured.update(fields); return {"id": "s1", "status": "captured"}
tests\test_api_capture.py:104:        def create_seed(self, fields): raise RuntimeError("secret: x-mcd-admin=adminKEY123 https://mcd.internal")
tests\test_api_questions_facets.py:9:    monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
tests\test_api_questions_facets.py:17:    monkeypatch.setattr(api_app, "get_adapter", lambda name: None)
tests\test_api_questions_facets.py:28:    monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
tests\test_subsystem_adapters.py:9:from samagra.adapters import ALL_ADAPTERS, get_adapter
tests\test_subsystem_adapters.py:213:    assert isinstance(get_adapter("mycontentdev"), McdAdapter)
tests\test_subsystem_adapters.py:214:    assert isinstance(get_adapter("munshi"), MunshiAdapter)
tests\test_spine.py:8:from samagra.adapters import ALL_ADAPTERS, get_adapter
tests\test_spine.py:38:@pytest.mark.skipif(not get_adapter("qx").available(),
tests\test_spine.py:41:    s = get_adapter("qx").summary()
tests\test_spine.py:45:@pytest.mark.skipif(not get_adapter("textbook").available(),
tests\test_spine.py:48:    s = get_adapter("textbook").summary()
tests\test_catalog_refresh_safety.py:38:    def artifacts(self):
tests\test_api_live_reads.py:22:        def artifacts(self):
tests\test_api_live_reads.py:33:    monkeypatch.setattr(api_app, "get_adapter",
tests\test_api_live_reads.py:43:    monkeypatch.setattr(api_app, "get_adapter",
tests\test_api_live_reads.py:52:    monkeypatch.setattr(api_app, "get_adapter",
tests\test_api_live_reads.py:61:    monkeypatch.setattr(api_app, "get_adapter",
tests\test_clients.py:7:create_seed (mcd) and create_item (munshi) are the owner-initiated capture writes
tests\test_clients.py:94:def test_mcd_create_seed_posts_form_with_admin(monkeypatch):
tests\test_clients.py:99:    out = c.create_seed({"type": "rough_idea", "raw_text": "tidal locking demo"})
tests\test_clients.py:153:def test_munshi_create_item_posts_json_with_cookie(monkeypatch):
tests\test_clients.py:158:    out = c.create_item("todo", {"assignee": "Ravi", "task": "call parent"})
tests\test_clients.py:166:def test_munshi_create_item_repr_never_leaks_secret():
samagra\api\app.py:19:from ..adapters import get_adapter
samagra\api\app.py:85:    qx = get_adapter("qx")
samagra\api\app.py:192:        created = client.create_item(kind, fields)
samagra\api\app.py:203:def api_mcd_create_seed(payload: dict):
samagra\api\app.py:219:        created = client.create_seed(fields)
samagra\api\app.py:235:def api_questions_facets():
samagra\api\app.py:236:    qx = get_adapter("qx")
samagra\api\app.py:253:def api_munshi_library():
samagra\api\app.py:254:    ad = get_adapter("munshi")
samagra\api\app.py:264:def api_mcd_seeds():
samagra\api\app.py:265:    ad = get_adapter("mycontentdev")
samagra\adapters\base.py:20:@dataclass
samagra\adapters\base.py:21:class Artifact:
samagra\adapters\base.py:57:    def artifacts(self) -> Iterator[Artifact]:
samagra\clients\mcd_client.py:8:available) plus the owner-initiated capture write create_seed (POST /api/seeds,
samagra\clients\mcd_client.py:58:    def create_seed(self, fields: dict) -> dict:
samagra\adapters\booklets.py:26:    def artifacts(self) -> Iterator[Artifact]:
samagra\clients\munshi_client.py:42:    def create_item(self, kind: str, fields: dict) -> dict:
samagra\adapters\insp.py:20:    def artifacts(self) -> Iterator[Artifact]:
samagra\clients\__init__.py:4:Phase 1. The single subsystem write path (McdClient.create_seed) is DEFERRED to
samagra\adapters\mcd.py:31:    def artifacts(self) -> Iterator[Artifact]:
samagra\adapters\munshi.py:68:    def artifacts(self) -> Iterator[Artifact]:
samagra\review\codex_dispatch.py:28:@dataclass
samagra\adapters\qx.py:72:    def artifacts(self) -> Iterator[Artifact]:
samagra\adapters\questiondb.py:25:    def artifacts(self) -> Iterator[Artifact]:
samagra\adapters\sims.py:27:    def artifacts(self) -> Iterator[Artifact]:
samagra\adapters\textbook.py:33:    def artifacts(self) -> Iterator[Artifact]:
samagra\adapters\__init__.py:26:def get_adapter(name: str) -> Adapter | None:
samagra\adapters\__init__.py:33:__all__ = ["Adapter", "Artifact", "CATALOG_COLUMNS", "ALL_ADAPTERS", "get_adapter"]
samagra\sims_manifest.py:11:def sim_url(sim_id: str) -> str:

codex
The relevant memory registry says this branch already had a prior E2 re-review pattern: use current branch state and the grounding contract, and keep the verdict explicit. I’m reading the exact touched files plus adjacent write endpoints now to check whether this diff changes any previously reviewed write behavior.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\adapters\\base.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\api\\app.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content frontend'"\\src\\types\\contracts.ts | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\adapters\\munshi.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content frontend'"\\src\\lib\\catalog\\rows.ts | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\adapters\\mcd.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 1266ms:
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
  18: from .. import catalog, config, scheduler, sims_manifest, state
  19: from ..adapters import get_adapter
  20: from ..clients import McdClient, MunshiClient
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
  84:                   limit: int = 50):
  85:     qx = get_adapter("qx")
  86:     if not qx or not qx.available():
  87:         return {"results": [], "error": "QX source not present"}
  88:     return {"results": qx.search_questions(
  89:         q, subject=subject, chapter=chapter, qtype=qtype, limit=limit)}
  90: 
  91: 
  92: @app.get("/api/pipelines")
  93: def api_pipelines():
  94:     return {"pipelines": state.all_states()}
  95: 
  96: 
  97: @app.get("/api/assignments")
  98: def api_assignments():
  99:     # Reads the DURABLE governance DB (governance.db, D6) â€” separate from the
 100:     # rebuildable catalog. init_tables is idempotent + safe to call per request.
 101:     conn = gstore.connect()
 102:     try:
 103:         gstore.init_tables(conn)  # inside try: a failed init must still close the conn
 104:         return {"assignments": gstore.list_assignments(conn),
 105:                 "events": gstore.list_events(conn)}
 106:     finally:
 107:         conn.close()
 108: 
 109: 
 110: @app.post("/api/refresh")
 111: def api_refresh():
 112:     totals = catalog.refresh(verbose=False)
 113:     return {"ok": True, "totals": totals}
 114: 
 115: 
 116: @app.post("/api/tick")
 117: def api_tick(dry_run: bool = False):
 118:     return scheduler.tick(dry_run=dry_run)
 119: 
 120: 
 121: @app.post("/api/gate/{pipeline}/{decision}")
 122: def api_gate(pipeline: str, decision: str):
 123:     result = scheduler.gate(pipeline, decision)
 124:     # F-02: a refused gate decision (prereqs incomplete, not awaiting_gate, bad
 125:     # decision) is a conflict with current pipeline state â€” surface it as HTTP
 126:     # 409 instead of a 200 with a silent JSON error body.
 127:     if "error" in result:
 128:         raise HTTPException(status_code=409, detail=result["error"])
 129:     return result
 130: 
 131: 
 132: # -- safe local file opener ---------------------------------------------
 133: @app.get("/open")
 134: def open_file(path: str, download: bool = False):
 135:     p = Path(path)
 136:     if not _allowed(p):
 137:         raise HTTPException(403, "path outside allowed source roots")
 138:     if not p.exists() or not p.is_file():
 139:         raise HTTPException(404, "file not found")
 140:     media, _ = mimetypes.guess_type(str(p))
 141:     filename = p.name if (download or p.suffix.lower() == ".docx") else None
 142:     return FileResponse(str(p), media_type=media or "application/octet-stream",
 143:                         filename=filename)
 144: 
 145: 
 146: @app.get("/api/org")
 147: def api_org():
 148:     return ORG
 149: 
 150: 
 151: _MUNSHI_REQUIRED = {
 152:     "todo": ("assignee", "task"),
 153:     "note": ("student", "issue"),
 154:     "followup": ("date", "note"),
 155: }
 156: # Contract passthrough â€” must mirror the TS buildMunshiCapture OPTIONAL whitelist
 157: # (frontend/src/lib/capture/munshi.ts). The server is the real trust boundary for
 158: # this production write, so it independently whitelists allowed fields.
 159: _MUNSHI_OPTIONAL = {
 160:     "todo": ("due",),
 161:     "note": ("label",),
 162:     "followup": ("person",),
 163: }
 164: 
 165: 
 166: @app.post("/api/munshi/capture")
 167: def api_munshi_capture(payload: dict):
 168:     kind = (payload or {}).get("kind")
 169:     if not isinstance(kind, str) or kind not in _MUNSHI_REQUIRED:
 170:         raise HTTPException(400, "kind must be one of: todo, note, followup")
 171:     required = _MUNSHI_REQUIRED[kind]
 172:     allowed = required + _MUNSHI_OPTIONAL[kind]
 173:     # Whitelist + sanitize: only contract-allowed keys with string values are
 174:     # forwarded to the live worker. Unknown keys (status, id, ts, ...) are dropped.
 175:     fields: dict[str, str] = {}
 176:     for k in allowed:
 177:         if k not in payload:
 178:             continue
 179:         v = payload[k]
 180:         if not isinstance(v, str):
 181:             raise HTTPException(400, f"field {k!r} must be a string")
 182:         v = v.strip()
 183:         if v:
 184:             fields[k] = v
 185:     missing = [k for k in required if k not in fields]
 186:     if missing:
 187:         raise HTTPException(400, f"missing required field(s): {', '.join(missing)}")
 188:     client = MunshiClient()
 189:     if not client.available():
 190:         raise HTTPException(503, "munshi not configured â€” set MUNSHI_API_URL/MUNSHI_SECRET")
 191:     try:
 192:         created = client.create_item(kind, fields)
 193:     except Exception:  # noqa: BLE001 â€” never surface the upstream/secret details
 194:         raise HTTPException(502, "munshi capture failed")
 195:     return {"ok": True, "item": created}
 196: 
 197: 
 198: _SEED_TYPES = {"concept", "question", "snippet", "simulation_idea",
 199:                "experiment", "notebooklm_link", "rough_idea"}
 200: 
 201: 
 202: @app.post("/api/mcd/seeds")
 203: def api_mcd_create_seed(payload: dict):
 204:     typ = (payload or {}).get("type")
 205:     raw_text = str((payload or {}).get("raw_text") or "").strip()
 206:     if typ not in _SEED_TYPES:
 207:         raise HTTPException(400, "type must be one of: " + ", ".join(sorted(_SEED_TYPES)))
 208:     if not raw_text:
 209:         raise HTTPException(400, "raw_text is required")
 210:     client = McdClient()
 211:     if not client.available():
 212:         raise HTTPException(503, "mycontentdev not configured â€” set mcd-cloud.json adminKey")
 213:     fields = {"type": typ, "raw_text": raw_text}
 214:     for opt in ("title", "source_ref"):
 215:         v = str((payload or {}).get(opt) or "").strip()
 216:         if v:
 217:             fields[opt] = v
 218:     try:
 219:         created = client.create_seed(fields)
 220:     except Exception:  # noqa: BLE001
 221:         raise HTTPException(502, "mycontentdev seed create failed")
 222:     return {"ok": True, "seed": created}
 223: 
 224: 
 225: @app.get("/api/sims")
 226: def api_sims():
 227:     p = config.SIMS_ROOT / "deployed-sims-by-grade.md"
 228:     if not p.exists():
 229:         return {"sims": [], "total": 0}
 230:     sims = sims_manifest.parse_deployed_sims(p.read_text(encoding="utf-8"))
 231:     return {"sims": sims, "total": len(sims)}
 232: 
 233: 
 234: @app.get("/api/questions/facets")
 235: def api_questions_facets():
 236:     qx = get_adapter("qx")
 237:     if not qx or not qx.available():
 238:         return {"subjects": []}
 239:     subjects = (qx.summary() or {}).get("subjects") or {}
 240:     # Only human-meaningful subject names (must contain a letter). Some QX corpora
 241:     # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
 242:     # was the eyesore replacing the old SIM0xxx leak â€” drop non-alphabetic keys.
 243:     names = [str(s) for s in subjects.keys() if any(ch.isalpha() for ch in str(s))]
 244:     return {"subjects": names}
 245: 
 246: 
 247: # -- live subsystem read passthroughs (always-fresh; capture appears immediately)
 248: # These read the LIVE deployed Munshi/mycontentdev via their adapters (not the
 249: # rebuildable catalog), so the capture apps show real data without a catalog
 250: # refresh and a fresh capture is visible on the next refetch. Read-only,
 251: # creds-gated, never leak upstream/secret detail.
 252: @app.get("/api/munshi/library")
 253: def api_munshi_library():
 254:     ad = get_adapter("munshi")
 255:     if not ad or not ad.available():
 256:         return {"results": [], "error": "munshi not configured â€” set MUNSHI_API_URL/MUNSHI_SECRET"}
 257:     try:
 258:         return {"results": [asdict(a) for a in ad.artifacts()]}
 259:     except Exception:  # noqa: BLE001 â€” never surface upstream/secret detail
 260:         return {"results": [], "error": "munshi read failed"}
 261: 
 262: 
 263: @app.get("/api/mcd/seeds")
 264: def api_mcd_seeds():
 265:     ad = get_adapter("mycontentdev")
 266:     if not ad or not ad.available():
 267:         return {"results": [], "error": "mycontentdev not configured â€” set mcd-cloud.json adminKey"}
 268:     try:
 269:         return {"results": [asdict(a) for a in ad.artifacts()]}
 270:     except Exception:  # noqa: BLE001 â€” never surface upstream/secret detail
 271:         return {"results": [], "error": "mycontentdev read failed"}
 272: 
 273: 
 274: # -- SPA fallback (MUST be declared LAST) -------------------------------
 275: # Catch-all for client-side routes: serve the Vite-built index.html so the React
 276: # router can take over. Declared last so it never shadows the API, the lecture
 277: # preview, or the file opener above. Explicitly 404s anything under `api/` (an
 278: # unknown API path should be a real 404, not the SPA shell).
 279: @app.get("/{full_path:path}", response_class=HTMLResponse)
 280: def spa(full_path: str):
 281:     if full_path.startswith("api/"):
 282:         raise HTTPException(404, "unknown API route")
 283:     index_html = FRONTEND_DIST / "index.html"
 284:     if not index_html.is_file():
 285:         raise HTTPException(503, "frontend not built â€” run `npm run build`")
 286:     return FileResponse(str(index_html))

 succeeded in 1364ms:
   1: """Common artifact shape + adapter contract.
   2: 
   3: Every source adapter is read-only and normalizes its source into `Artifact`
   4: records at a coarse, browsable altitude (papers, chapters, booklets, exams, sims)
   5: â€” NOT individual questions. Fine-grained question search is served live by the QX
   6: adapter against its own search index, so we don't duplicate 67k rows here.
   7: """
   8: from __future__ import annotations
   9: 
  10: import json
  11: from dataclasses import dataclass, field
  12: from typing import Iterator, Optional
  13: 
  14: CATALOG_COLUMNS = (
  15:     "uid", "source", "kind", "title", "subject", "unit",
  16:     "chapter", "status", "path", "url", "updated_at", "meta_json",
  17: )
  18: 
  19: 
  20: @dataclass
  21: class Artifact:
  22:     uid: str                       # stable, e.g. "qx:doc:<slug>"
  23:     source: str                    # adapter name
  24:     kind: str                      # paper|chapter|booklet|exam|exam-set|sim
  25:     title: str
  26:     subject: Optional[str] = None
  27:     unit: Optional[str] = None     # textbook unit / grade group
  28:     chapter: Optional[str] = None
  29:     status: Optional[str] = None
  30:     path: Optional[str] = None     # local path
  31:     url: Optional[str] = None
  32:     updated_at: Optional[str] = None
  33:     meta: dict = field(default_factory=dict)
  34: 
  35:     def row(self) -> tuple:
  36:         return (
  37:             self.uid, self.source, self.kind, self.title, self.subject,
  38:             self.unit, self.chapter, self.status, self.path, self.url,
  39:             self.updated_at, json.dumps(self.meta, ensure_ascii=False),
  40:         )
  41: 
  42: 
  43: class Adapter:
  44:     """Read-only source adapter."""
  45: 
  46:     name: str = "base"
  47:     label: str = "Base"
  48: 
  49:     def available(self) -> bool:
  50:         """True when the source exists on this machine."""
  51:         return False
  52: 
  53:     def summary(self) -> dict:
  54:         """Small dict of headline counts for the overview tile."""
  55:         return {}
  56: 
  57:     def artifacts(self) -> Iterator[Artifact]:
  58:         """Yield normalized catalog records."""
  59:         return iter(())

 succeeded in 1183ms:
   1: import type { SearchResponse, SearchResult } from "../../types/contracts";
   2: 
   3: export interface CatalogRow {
   4:   uid: string;
   5:   title: string;
   6:   subject: string | null;
   7:   unit: string | null;
   8:   chapter: string | null;
   9:   status: string | null;
  10:   kind: string;
  11:   url: string | null;
  12:   openHref: string | null;        // safe /open?path= link (file rows), or null
  13:   href: string | null;            // unified link target: file-open, else a safe web url
  14:   meta: Record<string, unknown>;
  15: }
  16: 
  17: /** Build the safe file-open href for a catalog path (null when no path). The
  18:  *  backend /open enforces ALLOWED_ROOTS; we only link rows that carry a path. */
  19: export function openHref(path: string | null | undefined): string | null {
  20:   if (!path) return null;
  21:   return "/open?path=" + encodeURIComponent(path);
  22: }
  23: 
  24: /** A safe link target for a row's `url` field: http(s) or root-relative only.
  25:  *  Guards against javascript:/data: and other unsafe schemes. */
  26: export function safeUrl(u: string | null | undefined): string | null {
  27:   if (!u) return null;
  28:   return u.startsWith("/") || /^https?:\/\//i.test(u) ? u : null;
  29: }
  30: 
  31: function toRow(r: SearchResult): CatalogRow {
  32:   const fileHref = openHref(r.path);
  33:   return {
  34:     uid: r.uid,
  35:     title: r.title,
  36:     subject: r.subject ?? null,
  37:     unit: r.unit ?? null,
  38:     chapter: r.chapter ?? null,
  39:     status: r.status ?? null,
  40:     kind: r.kind,
  41:     url: r.url ?? null,
  42:     openHref: fileHref,
  43:     href: fileHref ?? safeUrl(r.url),   // prefer file open; fall back to a safe web url
  44:     meta: r.meta && typeof r.meta === "object" ? r.meta : {},
  45:   };
  46: }
  47: 
  48: export function catalogRows(data: SearchResponse | null | undefined): CatalogRow[] {
  49:   const results = data?.results;
  50:   return Array.isArray(results) ? results.map(toRow) : [];
  51: }
  52: 
  53: export function subjectsOf(rows: CatalogRow[]): string[] {
  54:   const set = new Set<string>();
  55:   for (const r of rows) if (r.subject) set.add(r.subject);
  56:   return Array.from(set).sort();
  57: }

 succeeded in 1248ms:
   1: // src/types/contracts.ts
   2: export type AppId =
   3:   | "dashboard" | "pipelines" | "assignments" | "org" | "questions" | "lectures"
   4:   | "booklets" | "insp" | "sims" | "mycontentdev" | "munshi" | "activity"
   5:   | "settings" | "terminal" | "clock" | "notes" | "snake";
   6: 
   7: export interface AppMeta { id: AppId; name: string; accent: string; w: number; h: number; }
   8: export interface Rect { x: number; y: number; w: number; h: number; }
   9: export interface WindowState {
  10:   id: string; app: AppId; x: number; y: number; w: number; h: number;
  11:   z: number; min: boolean; max: boolean; prev: Rect | null;
  12: }
  13: export type Theme = "aqua" | "console" | "samagra";
  14: export type Device = "pc" | "mobile";
  15: 
  16: export const MIN_W = 360;
  17: export const MIN_H = 280;
  18: 
  19: // Terminal
  20: export type LineClass = "in" | "fg" | "dim" | "accent" | "ok" | "err";
  21: export interface TermLine { t: string; c: LineClass; }
  22: export type TermEffect =
  23:   | { kind: "openApp"; value: AppId }
  24:   | { kind: "setTheme"; value: Theme }
  25:   | { kind: "setDevice"; value: Device };
  26: export interface TermCtx { order: AppId[]; apps: Record<AppId, AppMeta>; }
  27: 
  28: // Notes / todos
  29: export interface Note { id: string; title: string; body: string; ts: number; }
  30: export interface Todo { id: string; text: string; done: boolean; }
  31: export type TodoFilter = "all" | "active" | "done";
  32: 
  33: // Backend
  34: export interface ApiClient {
  35:   overview(): Promise<unknown>;
  36:   pipelines(): Promise<unknown>;
  37:   assignments(): Promise<unknown>;
  38: }
  39: 
  40: // â”€â”€ Catalog / search (GET /api/search, /api/facets) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  41: export interface SearchResult {
  42:   uid: string; source: string; kind: string; title: string;
  43:   subject: string | null; unit: string | null; chapter: string | null;
  44:   status: string | null; path: string | null; url: string | null;
  45:   updated_at: string | null;
  46:   meta: Record<string, unknown>;     // parsed from meta_json
  47:   meta_json?: string;                 // raw string ALSO present on the wire
  48: }
  49: export interface SearchResponse { results: SearchResult[]; }
  50: export interface Facets { sources: string[]; kinds: string[]; subjects: string[]; }
  51: 
  52: // â”€â”€ Questions (GET /api/questions) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  53: export interface Question {
  54:   q_uid: string; slug: string; q_type: string | null;
  55:   subject: string | null; chapter: string | null;
  56:   difficulty: string | null; text: string | null;   // value is text_projection (a snippet)
  57: }
  58: export interface QuestionsResponse { results: Question[]; error?: string; }  // error OPTIONAL
  59: 
  60: // â”€â”€ Overview (GET /api/overview) â€” promote Dashboard's inline types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  61: export interface OverviewSource {
  62:   source: string; label: string; available: number;   // 0 | 1
  63:   n_artifacts: number; refreshed_at: string;
  64:   summary: Record<string, unknown>;
  65:   summary_json?: string;             // raw string ALSO present on the wire
  66: }
  67: export interface Overview { sources: OverviewSource[]; refreshed_at: string | null; }
  68: 
  69: // â”€â”€ Pipelines (GET /api/pipelines) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  70: export type PipelineStatus = "pending" | "in_progress" | "awaiting_gate" | "done" | "failed" | "blocked";
  71: export interface Phase {
  72:   status: PipelineStatus; owner: string | null; gate: boolean;
  73:   started: string | null; finished: string | null; artifacts: string[]; error: string | null;
  74: }
  75: export interface Pipeline {
  76:   pipeline: string; label: string; created: string; updated: string;
  77:   current: string; phases: Record<string, Phase>;     // keyed by phase NAME, not array
  78: }
  79: export interface PipelinesResponse { pipelines: Pipeline[]; }
  80: 
  81: // â”€â”€ Assignments + events (GET /api/assignments) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  82: export type AssignmentStatus = "queued" | "running" | "in-review" | "approved" | "changes";  // HYPHEN
  83: export interface Assignment {
  84:   id: string; agent: string; outbox_path: string;
  85:   pipeline: string | null; seed_ref: string | null; artifact_ref: string | null;
  86:   expected_output: string | null; review_by: string | null;
  87:   status: AssignmentStatus; created_at: string; updated_at: string;
  88: }
  89: export interface EventItem {
  90:   id: number; ts: string; actor: string; verb: string;
  91:   assignment_id: string | null; subsystem: string | null; subsystem_ref: string | null; note: string | null;
  92: }
  93: export interface AssignmentsResponse { assignments: Assignment[]; events: EventItem[]; }
  94: 
  95: // â”€â”€ Org chart (GET /api/org â€” built in E2.1; shape mirrors samagra/org.py) â”€â”€â”€â”€
  96: export interface OrgPerson { id: string; name: string; role: string; }
  97: export interface OrgChart {
  98:   chairman: OrgPerson; board: OrgPerson[]; workers: OrgPerson[];
  99:   owners: Record<string, { name: string; role: string }>;  // token -> identity (7 owner ids)
 100: }
 101: 
 102: // â”€â”€ Capture / sims / facets (control-plane: POST capture + read-only sims/facets) â”€â”€
 103: export type MunshiKind = "todo" | "note" | "followup";
 104: export interface MunshiCaptureForm { kind: MunshiKind; [field: string]: string; }
 105: export interface SeedForm { type: SeedType; title?: string; raw_text: string; source_ref?: string; }
 106: export type SeedType =
 107:   | "concept" | "question" | "snippet" | "simulation_idea"
 108:   | "experiment" | "notebooklm_link" | "rough_idea";
 109: export interface SimRow { id: string; title: string; subject: string | null; grade: string | null; url: string; }
 110: export interface SimsResponse { sims: SimRow[]; total: number; }
 111: export interface QuestionFacets { subjects: string[]; }

 succeeded in 1270ms:
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

 succeeded in 1276ms:
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
The first contract check is clean: `Artifact` has every frontend `SearchResult` field the apps consume, and `asdict()` keeps `meta` as an object rather than the catalog’s `meta_json` string. I’m checking the live clients next because the main leak risk is usually in availability failures or exception text crossing the API boundary.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\clients\\munshi_client.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content tests'"\\test_api_questions_facets.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content tests'"\\test_api_capture.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\clients\\mcd_client.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content tests'"\\test_api_live_reads.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\sims_manifest.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 865ms:
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

 succeeded in 1196ms:
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

 succeeded in 1247ms:
   1: from fastapi.testclient import TestClient
   2: from samagra.api import app as api_app
   3: 
   4: 
   5: def test_questions_facets_uses_qx_summary(monkeypatch):
   6:     class FakeQx:
   7:         def available(self): return True
   8:         def summary(self): return {"subjects": {"Mechanics": 40, "Optics": 12}}
   9:     monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
  10:     r = TestClient(api_app.app).get("/api/questions/facets")
  11:     assert r.status_code == 200
  12:     assert sorted(r.json()["subjects"]) == ["Mechanics", "Optics"]
  13:     assert not any(s.startswith("SIM") for s in r.json()["subjects"])
  14: 
  15: 
  16: def test_questions_facets_absent_qx(monkeypatch):
  17:     monkeypatch.setattr(api_app, "get_adapter", lambda name: None)
  18:     r = TestClient(api_app.app).get("/api/questions/facets")
  19:     assert r.status_code == 200 and r.json() == {"subjects": []}
  20: 
  21: 
  22: def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
  23:     # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
  24:     # chip is useless. Only alphabetic subject names should survive.
  25:     class FakeQx:
  26:         def available(self): return True
  27:         def summary(self): return {"subjects": {1: 32285, "Mechanics": 40, "2": 9}}
  28:     monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
  29:     r = TestClient(api_app.app).get("/api/questions/facets")
  30:     assert r.status_code == 200 and r.json()["subjects"] == ["Mechanics"]

 succeeded in 1276ms:
   1: """Live-read passthroughs: /api/munshi/library and /api/mcd/seeds.
   2: 
   3: These read the live subsystems via the adapters (not the catalog) so the capture
   4: apps show real data and a fresh capture is visible on refetch. Read-only,
   5: creds-gated, and must never leak upstream/secret detail on failure.
   6: """
   7: from fastapi.testclient import TestClient
   8: 
   9: from samagra.api import app as api_app
  10: from samagra.adapters.base import Artifact
  11: 
  12: 
  13: def _c():
  14:     return TestClient(api_app.app)
  15: 
  16: 
  17: def _fake_adapter(available=True, arts=None, boom=None):
  18:     class A:
  19:         def available(self):
  20:             return available
  21: 
  22:         def artifacts(self):
  23:             if boom:
  24:                 raise RuntimeError(boom)
  25:             return iter(arts or [])
  26: 
  27:     return A()
  28: 
  29: 
  30: def test_munshi_library_returns_live_artifacts(monkeypatch):
  31:     art = Artifact(uid="munshi:1", source="munshi", kind="todo",
  32:                    title="Call parent", status="open")
  33:     monkeypatch.setattr(api_app, "get_adapter",
  34:                         lambda n: _fake_adapter(arts=[art]) if n == "munshi" else None)
  35:     r = _c().get("/api/munshi/library")
  36:     assert r.status_code == 200
  37:     res = r.json()["results"]
  38:     assert len(res) == 1
  39:     assert res[0]["title"] == "Call parent" and res[0]["kind"] == "todo"
  40: 
  41: 
  42: def test_munshi_library_unconfigured(monkeypatch):
  43:     monkeypatch.setattr(api_app, "get_adapter",
  44:                         lambda n: _fake_adapter(available=False))
  45:     r = _c().get("/api/munshi/library")
  46:     assert r.status_code == 200 and r.json()["results"] == []
  47: 
  48: 
  49: def test_mcd_seeds_returns_live_artifacts(monkeypatch):
  50:     art = Artifact(uid="mcd:s1", source="mycontentdev", kind="rough_idea",
  51:                    title="tidal demo", status="captured")
  52:     monkeypatch.setattr(api_app, "get_adapter",
  53:                         lambda n: _fake_adapter(arts=[art]) if n == "mycontentdev" else None)
  54:     r = _c().get("/api/mcd/seeds")
  55:     assert r.status_code == 200
  56:     res = r.json()["results"]
  57:     assert len(res) == 1 and res[0]["title"] == "tidal demo"
  58: 
  59: 
  60: def test_mcd_seeds_read_failure_does_not_leak(monkeypatch):
  61:     monkeypatch.setattr(api_app, "get_adapter",
  62:                         lambda n: _fake_adapter(boom="boom https://x.dev adminKEY123")
  63:                         if n == "mycontentdev" else None)
  64:     r = _c().get("/api/mcd/seeds")
  65:     assert r.status_code == 200 and r.json()["results"] == []
  66:     assert "adminKEY123" not in r.text and "https://x.dev" not in r.text

 succeeded in 1305ms:
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
  14:     n = str(sim_id).strip().zfill(4)
  15:     return f"{SITE}/sims/SIM{n}/SIM{n}_sim"
  16: 
  17: 
  18: def parse_deployed_sims(text: str) -> list[dict]:
  19:     grade = subject = None
  20:     out: list[dict] = []
  21:     for line in text.splitlines():
  22:         ms = _SUBJECT.match(line)
  23:         if ms:
  24:             subject = ms.group(1).strip()
  25:             continue
  26:         mg = _GRADE.match(line)
  27:         if mg:
  28:             grade = mg.group(1).strip()
  29:             continue
  30:         mi = _ITEM.match(line)
  31:         if mi:
  32:             sid = mi.group(1).strip()
  33:             out.append({"id": sid, "title": mi.group(2).strip(),
  34:                         "subject": subject, "grade": grade, "url": sim_url(sid)})
  35:     return out

 succeeded in 1377ms:
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

codex
One adversarial edge is worth checking: the filter says “contains a letter,” which solves numeric subject codes but would still allow alphanumeric identifiers. I’m inspecting the QX summary source to see what values can actually arrive there.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\adapters\\qx.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"summary\\(|subjects|subject\" samagra\\adapters samagra tests docs -S" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"pratyakshsims.com/sims/SIM[0-9]+/SIM[0-9]+_sim(\\.html)?|308|extensionless|SIM0018_sim\" . -S" in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "SIM0|subject.*SIM|questions/facets|numeric subject|facets" docs samagra frontend tests -S' in C:\SandBox\claude_box\TeachingOS
 succeeded in 1168ms:
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

 succeeded in 1438ms:
.\HANDOFF.md:17:>   (**482 sims**), grade-grouped, linking the canonical extensionless `pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim`.
.\docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:21:- **Sims** = parse `{SIMS_ROOT}/deployed-sims-by-grade.md` (`## <grade>` / `### <subject>` / `- <id> — <title>`), 482 entries. URL = `https://pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim.html` (`<NNNN>` = 4-digit zero-padded id; confirmed `public/sims/SIM0018/SIM0018_sim.html`).
.\docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:527:    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim.html"
.\docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:528:    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim.html"
.\frontend\src\apps\Sims\index.test.tsx:9:    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
.\samagra\sims_manifest.py:12:    # Canonical deployed URL is extensionless — the .html form 308-redirects to
.\tests\test_sims_manifest.py:22:    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
.\tests\test_sims_manifest.py:23:    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"
.\docs\codex-reviews\16-sims-deployed.report.md:46:- **Zero-pad:** `sim_url("18")` → `.../SIM0018/SIM0018_sim.html`;
.\docs\codex-reviews\18-capture-final.report.md:14:The git diff on stdin is the set of inline additions to branch feature/control-plane-capture of the samagra repo, made AFTER the per-slice reviews. They add: (1) live-read passthroughs GET /api/munshi/library and GET /api/mcd/seeds in samagra/api/app.py that serialize the existing read-only adapters' artifacts() via dataclasses.asdict, are creds-gated, and wrap iteration in try/except returning a generic error (must NOT leak upstream/secret detail); (2) Munshi & Mycontentdev apps rewired to read those live endpoints instead of /api/search; (3) a QX facets filter in GET /api/questions/facets that drops non-alphabetic subject codes; (4) a canonical extensionless pratyaksh sim URL in samagra/sims_manifest.py sim_url. Do an INDEPENDENT adversarial review. Verify: no secret/upstream-detail leak on the read passthroughs; asdict output matches the frontend SearchResult/catalogRows contract (uid,title,subject,unit,chapter,status,kind,url,path,meta); the facet filter is correct/safe; the sim URL is right; no regression to the already-reviewed write paths. Output findings as CRITICAL/HIGH/MEDIUM/LOW with file:line and a concrete fix, then a final one-line verdict: GO / GO-WITH-FIXES / NO-GO. Be concise.
.\docs\codex-reviews\18-capture-final.report.md:209:+    # Canonical deployed URL is extensionless — the .html form 308-redirects to
.\docs\codex-reviews\18-capture-final.report.md:347:-    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim.html"
.\docs\codex-reviews\18-capture-final.report.md:348:-    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim.html"
.\docs\codex-reviews\18-capture-final.report.md:349:+    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
.\docs\codex-reviews\18-capture-final.report.md:350:+    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"
.\docs\codex-reviews\18-capture-final.report.md:354:2026-06-21T18:36:35.932308Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:29979/mcp)")))
.\docs\codex-reviews\18-capture-final.report.md:844:frontend/src\apps\Sims\index.test.tsx:9:    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
.\docs\codex-reviews\18-capture-final.report.md:2040:  12:     # Canonical deployed URL is extensionless â€” the .html form 308-redirects to
.\docs\codex-reviews\18-capture-final.report.md:2155:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"pratyakshsims.com/sims/SIM[0-9]+/SIM[0-9]+_sim(\\.html)?|308|extensionless|SIM0018_sim\" . -S" in C:\SandBox\claude_box\TeachingOS

 succeeded in 1439ms:
samagra\__main__.py:45:              f"({r.get('subject') or '-'})")
samagra\adapters\textbook.py:26:    def summary(self) -> dict:
samagra\adapters\textbook.py:47:                title=c.get("title", slug), subject="Physics", unit=c.get("unit"),
samagra\sims_manifest.py:7:_SUBJECT = re.compile(r"^###\s+(.*?)\s*(?:\(\d+\))?\s*$")
samagra\sims_manifest.py:19:    grade = subject = None
samagra\sims_manifest.py:22:        ms = _SUBJECT.match(line)
samagra\sims_manifest.py:24:            subject = ms.group(1).strip()
samagra\sims_manifest.py:34:                        "subject": subject, "grade": grade, "url": sim_url(sid)})
samagra\adapters\sims.py:24:    def summary(self) -> dict:
samagra\adapters\sims.py:32:            subject = grade = None
samagra\adapters\sims.py:37:                    subject = after[0]
samagra\adapters\sims.py:42:                title=p.stem, subject=subject, unit=grade, path=str(p),
samagra\adapters\qx.py:3:Content DB (`qx_content.sqlite`) holds documents + questions but its subject/chapter
samagra\adapters\qx.py:30:    def _subject_by_slug(self) -> dict:
samagra\adapters\qx.py:37:                "select slug, coalesce(ov_subject, subject) from search_index"
samagra\adapters\qx.py:50:    def summary(self) -> dict:
samagra\adapters\qx.py:57:        subjects: dict[str, int] = {}
samagra\adapters\qx.py:62:                    "select coalesce(ov_subject, subject) s, count(*) "
samagra\adapters\qx.py:66:                        subjects[s] = n
samagra\adapters\qx.py:69:        return {"documents": docs, "questions": qs, "subjects": subjects,
samagra\adapters\qx.py:73:        subj_map = self._subject_by_slug()
samagra\adapters\qx.py:83:                    title=title or slug, subject=subj_map.get(slug),
samagra\adapters\qx.py:92:    def search_questions(self, q="", subject=None, chapter=None, qtype=None, limit=50):
samagra\adapters\qx.py:97:            sql = ("select q_uid, slug, q_type, coalesce(ov_subject,subject), "
samagra\adapters\qx.py:104:            if subject:
samagra\adapters\qx.py:105:                sql += " and coalesce(ov_subject,subject)=?"
samagra\adapters\qx.py:106:                args.append(subject)
samagra\adapters\qx.py:115:            cols = ["q_uid", "slug", "q_type", "subject", "chapter", "difficulty", "text"]
samagra\adapters\questiondb.py:22:    def summary(self) -> dict:
tests\test_subsystem_adapters.py:80:    assert a.subject == "physics"
tests\test_subsystem_adapters.py:134:    assert a.subject == "physics"
samagra\adapters\munshi.py:77:                subject="physics",
tests\test_catalog_refresh_safety.py:35:    def summary(self) -> dict:
samagra\adapters\mcd.py:39:                subject="physics",
tests\test_api_questions_facets.py:5:def test_questions_facets_uses_qx_summary(monkeypatch):
tests\test_api_questions_facets.py:8:        def summary(self): return {"subjects": {"Mechanics": 40, "Optics": 12}}
tests\test_api_questions_facets.py:12:    assert sorted(r.json()["subjects"]) == ["Mechanics", "Optics"]
tests\test_api_questions_facets.py:13:    assert not any(s.startswith("SIM") for s in r.json()["subjects"])
tests\test_api_questions_facets.py:19:    assert r.status_code == 200 and r.json() == {"subjects": []}
tests\test_api_questions_facets.py:22:def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
tests\test_api_questions_facets.py:23:    # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
tests\test_api_questions_facets.py:24:    # chip is useless. Only alphabetic subject names should survive.
tests\test_api_questions_facets.py:27:        def summary(self): return {"subjects": {1: 32285, "Mechanics": 40, "2": 9}}
tests\test_api_questions_facets.py:30:    assert r.status_code == 200 and r.json()["subjects"] == ["Mechanics"]
samagra\adapters\insp.py:27:                    title=child.name, subject="Physics", path=str(child),
samagra\adapters\insp.py:33:                    title=child.stem, subject="Physics", path=str(child),
samagra\adapters\insp.py:36:    def summary(self) -> dict:
tests\test_spine.py:41:    s = get_adapter("qx").summary()
tests\test_spine.py:48:    s = get_adapter("textbook").summary()
tests\test_sims_manifest.py:16:    bio = [r for r in rows if r["subject"] == "Biology"]
tests\test_sims_manifest.py:19:    phys = [r for r in rows if r["subject"] == "Physics"][0]
samagra\catalog.py:14:  subject text, unit text, chapter text, status text,
samagra\catalog.py:16:create table if not exists source_summary(
samagra\catalog.py:21:  uid unindexed, title, subject, chapter, kind, source);
samagra\catalog.py:73:                summ = ad.summary()
samagra\catalog.py:80:                        (art.uid, art.title or "", art.subject or "",
samagra\catalog.py:127:            "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
samagra\catalog.py:192:    """Distinct sources / kinds / subjects for portal filters."""
samagra\catalog.py:199:        "subjects": [r[0] for r in con.execute(
samagra\catalog.py:200:            "select distinct subject from catalog where subject is not null order by 1")],
samagra\notify.py:47:def _email(subject: str, body: str) -> tuple[bool, str]:
samagra\notify.py:57:        msg["Subject"] = subject
samagra\adapters\booklets.py:23:    def summary(self) -> dict:
samagra\adapters\booklets.py:33:                title=p.stem, subject="Physics", path=str(p),
samagra\adapters\base.py:15:    "uid", "source", "kind", "title", "subject", "unit",
samagra\adapters\base.py:26:    subject: Optional[str] = None
samagra\adapters\base.py:37:            self.uid, self.source, self.kind, self.title, self.subject,
samagra\adapters\base.py:53:    def summary(self) -> dict:
samagra\api\app.py:82:def api_questions(q: str = "", subject: str | None = None,
samagra\api\app.py:89:        q, subject=subject, chapter=chapter, qtype=qtype, limit=limit)}
samagra\api\app.py:238:        return {"subjects": []}
samagra\api\app.py:239:    subjects = (qx.summary() or {}).get("subjects") or {}
samagra\api\app.py:240:    # Only human-meaningful subject names (must contain a letter). Some QX corpora
samagra\api\app.py:241:    # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
samagra\api\app.py:243:    names = [str(s) for s in subjects.keys() if any(ch.isalpha() for ch in str(s))]
samagra\api\app.py:244:    return {"subjects": names}
samagra\adapters\base.py:15:    "uid", "source", "kind", "title", "subject", "unit",
samagra\adapters\base.py:26:    subject: Optional[str] = None
samagra\adapters\base.py:37:            self.uid, self.source, self.kind, self.title, self.subject,
samagra\adapters\base.py:53:    def summary(self) -> dict:
samagra\portal\static\app.js:7:let FACETS = { kinds: [], subjects: [] };
samagra\portal\static\app.js:143:  const subjects = [...new Set(d.results.map(r => r.subject).filter(Boolean))].sort();
samagra\portal\static\app.js:145:    const rows = d.results.filter(r => !filter || r.subject === filter).slice(0, 600).map(r =>
samagra\portal\static\app.js:147:        <td>${esc(r.subject || "-")}</td><td>${esc(r.meta.grade || "-")}</td></tr>`);
samagra\portal\static\app.js:148:    $("#simres").innerHTML = table(["Simulation", "Subject", "Grade"], rows) +
samagra\portal\static\app.js:152:    <div class="toolbar"><select id="simsubj"><option value="">all subjects</option>
samagra\portal\static\app.js:153:      ${subjects.map(s => `<option>${esc(s)}</option>`).join("")}</select></div>
samagra\portal\static\app.js:225:      <td>${esc(r.title)}</td><td>${esc(r.subject || "-")}</td><td>${link}</td></tr>`;
samagra\portal\static\app.js:229:    table(["Source", "Kind", "Title", "Subject", ""], rows);
samagra\adapters\booklets.py:23:    def summary(self) -> dict:
samagra\adapters\booklets.py:33:                title=p.stem, subject="Physics", path=str(p),
samagra\adapters\textbook.py:26:    def summary(self) -> dict:
samagra\adapters\textbook.py:47:                title=c.get("title", slug), subject="Physics", unit=c.get("unit"),
samagra\adapters\sims.py:24:    def summary(self) -> dict:
samagra\adapters\sims.py:32:            subject = grade = None
samagra\adapters\sims.py:37:                    subject = after[0]
samagra\adapters\sims.py:42:                title=p.stem, subject=subject, unit=grade, path=str(p),
samagra\adapters\qx.py:3:Content DB (`qx_content.sqlite`) holds documents + questions but its subject/chapter
samagra\adapters\qx.py:30:    def _subject_by_slug(self) -> dict:
samagra\adapters\qx.py:37:                "select slug, coalesce(ov_subject, subject) from search_index"
samagra\adapters\qx.py:50:    def summary(self) -> dict:
samagra\adapters\qx.py:57:        subjects: dict[str, int] = {}
samagra\adapters\qx.py:62:                    "select coalesce(ov_subject, subject) s, count(*) "
samagra\adapters\qx.py:66:                        subjects[s] = n
samagra\adapters\qx.py:69:        return {"documents": docs, "questions": qs, "subjects": subjects,
samagra\adapters\qx.py:73:        subj_map = self._subject_by_slug()
samagra\adapters\qx.py:83:                    title=title or slug, subject=subj_map.get(slug),
samagra\adapters\qx.py:92:    def search_questions(self, q="", subject=None, chapter=None, qtype=None, limit=50):
samagra\adapters\qx.py:97:            sql = ("select q_uid, slug, q_type, coalesce(ov_subject,subject), "
samagra\adapters\qx.py:104:            if subject:
samagra\adapters\qx.py:105:                sql += " and coalesce(ov_subject,subject)=?"
samagra\adapters\qx.py:106:                args.append(subject)
samagra\adapters\qx.py:115:            cols = ["q_uid", "slug", "q_type", "subject", "chapter", "difficulty", "text"]
samagra\adapters\questiondb.py:22:    def summary(self) -> dict:
samagra\adapters\munshi.py:77:                subject="physics",
samagra\adapters\mcd.py:39:                subject="physics",
samagra\adapters\insp.py:27:                    title=child.name, subject="Physics", path=str(child),
samagra\adapters\insp.py:33:                    title=child.stem, subject="Physics", path=str(child),
samagra\adapters\insp.py:36:    def summary(self) -> dict:
docs\superpowers\plans\2026-06-19-samagra-evolution.md:31:**Adapter contract (existing slice-1):** subclass `samagra.adapters.base.Adapter` — `name:str`, `label:str`, `available()->bool`, `summary()->dict`, `artifacts()->Iterator[Artifact]`. `Artifact` fields (exact order): `uid, source, kind, title, subject, unit, chapter, status, path, url, updated_at, meta` (`meta` is a dict, serialized inline by `Artifact.row()`). Register adapters in `samagra/adapters/__init__.py` → `ALL_ADAPTERS`.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1357:    assert a.subject == "physics"
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1416:                subject="physics",
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1499:    assert a.subject == "physics"
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1581:                subject="physics",
docs\superpowers\plans\2026-06-19-samagra-evolution.md:3387:              "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
docs\superpowers\plans\2026-06-19-samagra-evolution.md:3615:                  title=it["payload"].get("text", "")[:60], subject="physics",
docs\superpowers\_research\samagra-os\api.md:37:| GET | `/api/facets` | `{sources:[str], kinds:[str], subjects:[str]}` | Filter dropdowns / facet chips |
docs\superpowers\_research\samagra-os\api.md:38:| GET | `/api/search?q=&source=&kind=&limit=` | `{results:[{uid,source,kind,title,subject,unit,chapter,status,path,url,updated_at, meta:{…}}]}` | Lectures, Booklets, INSP, Sims, global search (all driven by `source=` filter) |
docs\superpowers\_research\samagra-os\api.md:39:| GET | `/api/questions?q=&subject=&chapter=&qtype=&limit=` | `{results:[{q_uid,slug,q_type,subject,chapter,difficulty,text}]}` or `{results:[], error}` | Questions app (LIVE QX search, not the catalog) |
docs\superpowers\_research\samagra-os\api.md:49:  `summary()` returns a different dict — see §3). The Dashboard already reads it; do
docs\superpowers\_research\samagra-os\api.md:130:- `GET /api/questions?q=&subject=&chapter=&qtype=&limit=` (LIVE QX). Facets come from
docs\superpowers\_research\samagra-os\api.md:131:  `/api/facets` (`subjects[]`) and the static `qtype` list already in the portal:
docs\superpowers\_research\samagra-os\api.md:135:  (only `q_uid,slug,q_type,subject,chapter,difficulty,text`) — the README's "exam"
docs\superpowers\_research\samagra-os\api.md:167:- `GET /api/search?source=sims&limit=2000`. `subject` + `meta.grade` per row;
docs\superpowers\_research\samagra-os\api.md:168:  open the `.html` via `/open?path=`. Subjects derived client-side (current portal
docs\superpowers\_research\samagra-os\api.md:169:  builds the subject filter from the result set). The README's gradient thumbnail
docs\superpowers\_research\samagra-os\api.md:246:come from each adapter's `summary()` (and `n_artifacts`), recomputed on
docs\superpowers\_research\samagra-os\api.md:260:| QX subjects breakdown | `group by coalesce(ov_subject,subject)` | `sources[qx].summary.subjects` (dict subj→count) |
docs\superpowers\_research\samagra-os\api.md:367:4. **Questions search lacks an `exam` field** (only `q_uid,slug,q_type,subject,chapter,difficulty,text`) and **Booklets lacks a theory/workbook field** — both are minor additive enrichments to existing adapters, not new endpoints.
docs\superpowers\_research\samagra-os\conventions.md:83:- **Conventional Commits** prefix: `type(scope): subject`. Observed types in history/plan: `feat`, `fix`,
docs\superpowers\_research\samagra-os\conventions.md:85:  `handoff`, `status`, `os`, `frontend`, …). Subject is imperative, lower-case, no trailing period.
docs\superpowers\_research\samagra-os\conventions.md:306:3. **Commits:** Conventional Commits `type(scope): subject`, imperative, no trailing period, multi-line via heredoc/here-string, always ending with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; never amend, never `--no-verify`.
docs\superpowers\loops\deepak-loop.js:84:// `commit`: the conventional-commit subject (trailer appended automatically).
docs\superpowers\loops\deepak-loop.js:712:      subject: task.commit,
docs\superpowers\loops\deepak-loop.js:868:    summary() {
docs\superpowers\loops\deepak-loop.js:961:  const s = metrics.summary();
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:121:Both follow the **verified** slice-1 adapter contract: subclass `adapters.base.Adapter` (`name`, `label`, `available() -> bool`, `summary() -> dict`, `artifacts() -> Iterator[Artifact]`), register in `samagra.adapters.ALL_ADAPTERS` (`adapters/__init__.py`). `Artifact` fields: `uid, source, kind, title, subject, unit, chapter, status, path, url, updated_at, meta` (dict; serialised inline by `Artifact.row()`). `available()` gates `artifacts()` — guard on creds/reachability so a missing key degrades gracefully.
docs\superpowers\specs\2026-06-20-samagra-os-experience-design.md:370:(grep/build/import/file-exists). Commits = Conventional Commits `type(scope): subject`,
docs\superpowers\plans\2026-06-20-samagra-os.md:168:**Commits:** Conventional Commits `type(scope): subject` (imperative, lower-case, no trailing
docs\superpowers\_research\samagra-os\e2-grounding.md:19:| `GET /api/facets` (`api_facets`) | — | `{ sources: string[], kinds: string[], subjects: string[] }` | Match. |
docs\superpowers\_research\samagra-os\e2-grounding.md:20:| `GET /api/search` (`api_search`) | `q="", source=None, kind=None, limit=200` | `{ results: [{ uid, source, kind, title, subject, unit, chapter, status, path, url, updated_at, meta_json, meta }] }` | **Each result carries BOTH `meta_json` (raw string) AND `meta` (parsed dict). `meta_json` is an undocumented 13th key.** **Route default `limit=200`.** |
docs\superpowers\_research\samagra-os\e2-grounding.md:21:| `GET /api/questions` (`api_questions`) | `q="", subject=None, chapter=None, qtype=None, limit=50` | Happy: `{ results: [{ q_uid, slug, q_type, subject, chapter, difficulty, text }] }` | **`text` value is `text_projection` aliased to `text` — a snippet, not full text.** **TWO distinct empty bodies, both HTTP 200:** `{results:[], error:"QX source not present"}` (adapter absent) vs `{results:[]}` with **NO `error` key** (adapter present, `config.QX_BUILDER_DB` missing). |
docs\superpowers\_research\samagra-os\e2-grounding.md:234:  subject: string | null; unit: string | null; chapter: string | null;
docs\superpowers\_research\samagra-os\e2-grounding.md:241:export interface Facets { sources: string[]; kinds: string[]; subjects: string[]; }
docs\superpowers\_research\samagra-os\e2-grounding.md:246:  subject: string | null; chapter: string | null;
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:58:   browser, and its **subject facets bug is fixed** (question-scoped subjects, not catalog-wide
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:125:| `lib/sims/deployed.ts` | shape/sort/filter/search over the deployed-sims rows returned by `GET /api/sims` (group by grade/subject, text filter) | pure array transforms over plain rows |
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:144:- **Sims app** is rewired to `GET /api/sims` (deployed manifest), rendering grade/subject groups,
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:145:  a search box, and live links. The old `/api/search?source=sims` path + `SIM0xxx` subject chips
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:147:- **Questions app** reads `GET /api/questions/facets` for its subject chips instead of the
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:192:- **Source:** `pratyaksh-May-deploy/deployed-sims-by-grade.md` (grade → subject → `- <id> — <title>`
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:197:- **Parser:** `samagra/sims_manifest.py` — pure `parse_deployed_sims(text) → [{id,title,subject,
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:199:- **FastAPI:** `GET /api/sims` → `{sims:[{id,title,subject,grade,url}], total}` (manifest read +
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:205:- **Cause (already diagnosed):** `/api/facets.subjects` is catalog-wide (`catalog.py:191`), and
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:206:  `adapters/sims.py:37` writes `SIM0xxx` folder ids into `subject`, so the chips are dominated by
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:209:  `qx.summary()`-derived **question-scoped** `{subjects, chapters, q_types}` (`adapters/qx.py:57`).
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:244:  QX facets show real subjects — with preview/screenshot proof.
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:304:   `SIM0xxx` scan + bogus subject chips are gone.
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:305:4. **Questions facets fixed** — subject chips are real question subjects (no `SIM0xxx`), and
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:21:- **Sims** = parse `{SIMS_ROOT}/deployed-sims-by-grade.md` (`## <grade>` / `### <subject>` / `- <id> — <title>`), 482 entries. URL = `https://pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim.html` (`<NNNN>` = 4-digit zero-padded id; confirmed `public/sims/SIM0018/SIM0018_sim.html`).
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:22:- **QX facets** = `qx.summary()["subjects"]` is a **dict** `{subject: count}` of question-scoped subjects (from the builder DB `search_index`); empty `{}` when the builder DB is absent (`adapters/qx.py:50-70`).
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:43:export interface SimRow { id: string; title: string; subject: string | null; grade: string | null; url: string; }
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:45:export interface QuestionFacets { subjects: string[]; }
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:521:    bio = [r for r in rows if r["subject"] == "Biology"]
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:524:    phys = [r for r in rows if r["subject"] == "Physics"][0]
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:539:_SUBJECT = re.compile(r"^###\s+(.*?)\s*(?:\(\d+\))?\s*$")
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:549:    grade = subject = None
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:552:        ms = _SUBJECT.match(line)
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:554:            subject = ms.group(1).strip()
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:564:                        "subject": subject, "grade": grade, "url": sim_url(sid)})
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:567:> Note `_SUBJECT` is tested before `_GRADE` so `###` never matches the grade rule; `_GRADE`'s `(?!#)` also guards it.
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:616:  { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11", url: "u1" },
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:617:  { id: "0466", title: "Osmosis Lab", subject: "Biology", grade: "Class 9", url: "u2" },
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:619:it("filters by title/subject/id", () => {
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:638:    (r.subject ?? "").toLowerCase().includes(t) ||
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:657:- [ ] **Step 1: Write failing test:** render with a mocked `/api/sims` → `{sims:[{...}],total:1}`; assert a `catalog-row` with an `<a href>` pointing at `pratyakshsims.com`; assert NO `/api/search?source=sims` fetch and no `SIM0xxx` subject chips.
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:659:- [ ] **Step 3: Implement.** Replace the `/api/search?source=sims` wiring with `useApi<SimsResponse>("/api/sims")`; render `groupByGrade(filterSims(rows, query))`; a search `<input>`; each row shows title + subject + an `open` link to `r.url` (target=_blank). Remove `catalogRows`/`subjectsOf`/SIM0xxx chips.
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:679:def test_questions_facets_uses_qx_summary(monkeypatch):
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:682:        def summary(self): return {"subjects": {"Mechanics": 40, "Optics": 12}}
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:686:    assert sorted(r.json()["subjects"]) == ["Mechanics", "Optics"]
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:687:    assert not any(s.startswith("SIM") for s in r.json()["subjects"])
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:692:    assert r.status_code == 200 and r.json() == {"subjects": []}
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:701:        return {"subjects": []}
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:702:    subjects = (qx.summary() or {}).get("subjects") or {}
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:703:    return {"subjects": list(subjects.keys())}
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:710:- [ ] **Step 1: Write/adjust failing test:** mock `/api/questions/facets` → `{subjects:["Mechanics"]}` and `/api/facets` → `{subjects:["SIM0018"]}`; assert the rendered chips show `Mechanics` and NOT `SIM0018`; assert the app fetches `/api/questions/facets` (not `/api/facets`).
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:712:- [ ] **Step 3: Implement.** Change `useApi<Facets>("/api/facets")` → `useApi<QuestionFacets>("/api/questions/facets")`; keep the rest (chip rendering, subject-filter wiring) unchanged.
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:714:- [ ] **Step 5: Commit.** `git commit -m "fix(questions): source subject chips from question-scoped facets"`
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:752:- [ ] **Step 2:** Questions app subject chips are real subjects (no `SIM0xxx`); selecting one returns rows. Screenshot.
docs\superpowers\loops\khanak-loop.js:380:      subject: task.commit,
docs\superpowers\loops\khanak-loop.js:439:    summary() {
docs\superpowers\loops\khanak-loop.js:587:  const s = metrics.summary();
docs\superpowers\loops\README.md:105:- Conventional-commit subjects + the `Co-Authored-By: Claude Opus 4.8` trailer;
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:11:> pushed), but its subject chips render ~600 `SIM0xxx` **sim-ids** instead of subjects: `/api/facets.subjects`
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:12:> is **catalog-wide** (`catalog.py:191`) and the sims adapter writes each sim's folder id into `subject`
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:13:> (`sims.py:37`). Clicking one → `/api/questions?subject=SIM0xxx` → 0 rows. Fix **read-only** next session — a
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:14:> question-scoped subject source (QX `summary().subjects`, `qx.py:57`), or intersect `facets.subjects` with the
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:118:**Commits.** Conventional Commits `type(scope): subject`. New scopes for E2: `org`, `api`, `catalog`, `pipelines`,
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:342:  subject: string | null; unit: string | null; chapter: string | null;
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:349:export interface Facets { sources: string[]; kinds: string[]; subjects: string[]; }
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:354:  subject: string | null; chapter: string | null;
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:426:link arbitrary paths — grounding §7.8), and derives the distinct subject list (Sims filter). Defensive: tolerates
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:432:import { catalogRows, openHref, subjectsOf } from "./rows";
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:437:    { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:440:    { uid: "u2", source: "textbook", kind: "chapter", title: "Kinematics", subject: "Maths",
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:450:    expect(rows[0]).toMatchObject({ uid: "u1", title: "Vectors", subject: "Physics", status: "approved" });
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:468:describe("subjectsOf", () => {
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:470:    expect(subjectsOf(catalogRows(sample))).toEqual(["Maths", "Physics"]);
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:486:  subject: string | null;
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:507:    subject: r.subject ?? null,
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:523:export function subjectsOf(rows: CatalogRow[]): string[] {
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:525:  for (const r of rows) if (r.subject) set.add(r.subject);
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:924:    const data = { results: [{ q_uid: "q1", slug: "s", q_type: "integer", subject: "P",
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:1251:  { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:1374:  { uid: "s1", source: "mycontentdev", kind: "concept", title: "Seed A", subject: null,
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:1486:  { uid: "m1", source: "munshi", kind: "todo", title: "Call vendor", subject: null,
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:1828:  { q_uid: "q1", slug: "s1", q_type: "integer", subject: "Physics", chapter: "1",
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:1905:              {[q.q_type, q.subject, q.chapter, q.difficulty].filter(Boolean).join(" · ")}
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:1950:  { uid: "b1", source: "booklets", kind: "booklet", title: "Mechanics WB", subject: "Physics",
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2019:              <div style={{ color: V.muted, fontSize: 12 }}>{[r.subject, r.status].filter(Boolean).join(" · ")}</div>
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2067:  { uid: "i1", source: "insp", kind: "exam-set", title: "NSEP 2024", subject: null,
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2172:Catalog wrapper over `GET /api/search?source=sims&limit=2000` using `catalogRows` + `subjectsOf` (for a subject
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2184:  { uid: "s1", source: "sims", kind: "sim", title: "Projectile", subject: "Physics",
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2190:  it("calls /api/search?source=sims and lists rows + subject chips", () => {
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2196:    expect(screen.getByTestId("subject-chip")).toHaveTextContent("Physics");
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2221:import { catalogRows, subjectsOf } from "../../lib/catalog/rows";
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2235:  const subjects = subjectsOf(rows);
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2246:        {subjects.map((s) => (
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2247:          <span key={s} data-testid="subject-chip"
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2262:              <div style={{ color: V.muted, fontSize: 12 }}>{r.subject ?? ""}</div>
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:2285:git commit -m "feat(apps): Simulations app over /api/search?source=sims (subject chips)
docs\superpowers\loops\RUBRIC.md:52:| **Code-quality / Review** | **25** | clean Codex review (no CRITICAL, ≤1 HIGH); pure module has zero React/DOM imports; no dead code; conventional-commit subject correct | confirmed-CRITICAL (→ 0 on this dimension, hard stop); ≥2 HIGH; DOM in a pure module; `any` without cause |
docs\superpowers\loops\RUBRIC.md:80:Emitted by each loop's `makeMetrics()` / `summary()`:
docs\superpowers\loops\samagra-os-e1.js:494:    summary() {
docs\superpowers\loops\samagra-os-e1.js:807:const s = metrics.summary();
docs\superpowers\loops\samagra-os-fidelity.js:278:    summary() {
docs\superpowers\loops\samagra-os-fidelity.js:454:const s = metrics.summary();
docs\codex-reviews\16-sims-deployed.report.md:13:subject chips. Now it calls a new `GET /api/sims`, which reads
docs\codex-reviews\16-sims-deployed.report.md:15:`samagra/sims_manifest.py`, and returns `{id,title,subject,grade,url}` rows that
docs\codex-reviews\16-sims-deployed.report.md:35:  grade headings, **16** `### ` subject headings — matching the "482 deployed
docs\codex-reviews\16-sims-deployed.report.md:41:  **False**; `_SUBJECT.match("## Class 9 (57)")` → **False**;
docs\codex-reviews\16-sims-deployed.report.md:49:- **Subject-leak edge (real, confirms Codex L1):** an item under a new `##`
docs\codex-reviews\16-sims-deployed.report.md:50:  grade before any `###` inherits the previous grade's subject — reproduced.
docs\codex-reviews\16-sims-deployed.report.md:60:### LOW-1 — `subject` not reset on a new grade heading
docs\codex-reviews\16-sims-deployed.report.md:62:grade heading is parsed, `subject` is left unchanged. If a future manifest
docs\codex-reviews\16-sims-deployed.report.md:63:places an item directly under a grade before its first `###` subject, that item
docs\codex-reviews\16-sims-deployed.report.md:64:inherits the *previous* grade's subject. Not reachable in the current real
docs\codex-reviews\16-sims-deployed.report.md:65:manifest (every grade is immediately followed by a subject), and verified to
docs\codex-reviews\16-sims-deployed.report.md:66:leak in a synthetic case. **Fix:** set `subject = None` inside the grade branch.
docs\codex-reviews\16-sims-deployed.report.md:83:blank non-data lines being ignored, and the subject-reset-on-grade behavior
docs\codex-reviews\16-sims-deployed.report.md:85:`subject == "Biology"` (counts stripped) and a multi-dash title round-trips.
docs\codex-reviews\16-sims-deployed.report.md:88:`frontend/src/apps/Sims/index.test.tsx`. The new app renders no `subject-chip`
docs\codex-reviews\16-sims-deployed.report.md:89:elements at all, so `queryAllByTestId("subject-chip")` is empty and the
docs\codex-reviews\16-sims-deployed.report.md:93:and by the diff removing the `catalogRows`/`subjectsOf`/`buildQuery` imports.
docs\codex-reviews\16-sims-deployed.report.md:100:  row matches `SimRow { id, title, subject|null, grade|null, url }`. `total ==
docs\codex-reviews\16-sims-deployed.report.md:103:  `catalogRows`, `subjectsOf`, or `SearchResponse`; the `/api/search?source=sims`
docs\codex-reviews\16-sims-deployed.report.md:104:  string and the `subject-chip` UI are gone from the Sims app.
docs\codex-reviews\16-sims-deployed.report.md:111:  a `\d{3,4}` id. `title`/`subject` render as React text (auto-escaped); `href`
docs\codex-reviews\16-sims-deployed.report.md:124:- LOW `samagra/sims_manifest.py:23-26`: When a new `##` grade heading is parsed, `subject` is not reset. If a future manifest has an item directly under a grade before the next `###` subject, or a malformed subject heading, those rows inherit the previous grade's subject. Current real manifest is fine per grounding facts, but the parser is less robust than intended. Fix: set `subject = None` inside the grade-heading branch.
docs\codex-reviews\16-sims-deployed.report.md:128:- LOW `tests/test_sims_manifest.py:5-23`: The parser tests cover normal grouping, middot titles, and padding, but not the most important robustness edges named in this slice: h2/h3 disambiguation, exact stripping of trailing `(NN)`, internal em-dash titles such as `0128 — Change of State — Heating Curve`, ignored non-data lines, and subject reset on grade transition. Fix: add targeted unit cases for those; especially assert `grade == "Class 9"` and `subject == "Biology"` without counts.
docs\codex-reviews\16-sims-deployed.report.md:130:- LOW `frontend/src/apps/Sims/index.test.tsx:17-29`: The "No SIM0xxx subject chips" assertion is vacuous if no `subject-chip` elements exist, which is currently the implementation. That is acceptable as a removal check only because the test also asserts the new endpoint, but it would not catch a different residual SIM-chip UI rendered under another test id. Fix: prefer explicit assertions that the old `/api/search?source=sims` path is not called and that old catalog helper imports are gone via code review/lint; the diff already removes those imports.
docs\codex-reviews\16-sims-deployed.report.md:134:- `_GRADE` does not match `###` lines: `^##\s+` already fails on `###` because the third character is `#`, not whitespace. `_SUBJECT` does not steal `##` lines because it requires exactly three leading hashes before whitespace. The subject-before-grade order is safe for those headings.
docs\codex-reviews\16-sims-deployed.report.md:140:- No visible network call, DB write, path traversal, or secret leak is introduced. The manifest path is fixed under `config.SIMS_ROOT`; URLs are derived from numeric ids and a hardcoded origin. React text rendering protects title/subject from DOM XSS, and `href` injection is not reachable through parsed manifest content.
docs\codex-reviews\17-qx-facets.report.md:13:Read-only bugfix. The Questions React app was rendering subject chips from `GET /api/facets`
docs\codex-reviews\17-qx-facets.report.md:14:→ `catalog.facets()` (catalog-wide). The sims adapter writes sim folder-ids as `subject`
docs\codex-reviews\17-qx-facets.report.md:15:(`samagra/adapters/sims.py:37`), so ~498 `SIM0xxx` ids leaked into the Questions subject chips.
docs\codex-reviews\17-qx-facets.report.md:18:subjects from `qx.summary()["subjects"]` (a `{subjectName: count}` dict sourced from
docs\codex-reviews\17-qx-facets.report.md:19:`search_index` via `coalesce(ov_subject, subject)` — real subject names, never SIM ids). The
docs\codex-reviews\17-qx-facets.report.md:26:- `tests/test_api_questions_facets.py` — NEW: happy path (qx.summary subjects, no SIM) + QX-absent empty state.
docs\codex-reviews\17-qx-facets.report.md:32:- **Bug source confirmed:** `samagra/api/app.py:69-71` `/api/facets` → `catalog.facets()` (`samagra/catalog.py:191`) is catalog-wide; `samagra/adapters/sims.py:37` writes sim folder-ids into the `subject` field. This is the leak path.
docs\codex-reviews\17-qx-facets.report.md:33:- **Fix grounding confirmed:** `samagra/adapters/qx.py:50-70` `summary()` returns `{"documents", "questions", "subjects": {subj: count}, "online"}`, where `subjects` is grouped over `search_index` `coalesce(ov_subject, subject)` — real subject names. `list(subjects.keys())` therefore yields actual subjects, never SIM ids. **Correct fix.**
docs\codex-reviews\17-qx-facets.report.md:35:- **Contract type matches payload:** `frontend/src/types/contracts.ts:111` `interface QuestionFacets { subjects: string[]; }` matches backend `{"subjects": [...]}`.
docs\codex-reviews\17-qx-facets.report.md:36:- **Empty-state robustness:** the endpoint guards three degradation branches — `not qx`, `not qx.available()`, and `(qx.summary() or {}).get("subjects") or {}` — so a missing adapter, an unavailable QX, a `None` summary, a missing `subjects` key, or an empty dict all collapse to `{"subjects": []}`. No `KeyError`/`AttributeError` path.
docs\codex-reviews\17-qx-facets.report.md:48:| LOW | `tests/test_api_questions_facets.py:16` | Backend empty-state coverage only exercises `get_adapter("qx") is None`. The implementation (`samagra/api/app.py:236-239`) also safely handles `available() == False`, `summary() is None`, missing `"subjects"`, and empty `{"subjects": {}}`, but no test locks those regressions down. A future refactor could drop one of those guards without a failing test. | Add a parametrized backend test covering `FakeQx.available() -> False`, `summary() -> None`, `summary() -> {}`, and `summary() -> {"subjects": {}}`, all asserting `{"subjects": []}`. |
docs\codex-reviews\17-qx-facets.report.md:74:`summary() is None`, and missing/empty `subjects`, but tests do not lock those regressions down.
docs\codex-reviews\17-qx-facets.report.md:76:`summary() -> None`, `summary() -> {}`, and `summary() -> {"subjects": {}}`, all expecting
docs\codex-reviews\17-qx-facets.report.md:77:`{"subjects": []}`.
docs\codex-reviews\17-qx-facets.report.md:82:payload shape matches `QuestionFacets { subjects: string[] }`, and the old SIM-id source is no
docs\codex-reviews\17-qx-facets.report.md:92:The fix is correct, complete, and well-scoped. It returns question-scoped subjects from
docs\codex-reviews\17-qx-facets.report.md:93:`qx.summary()` (no SIM0xxx), handles the QX-absent / degraded cases with an empty-state
docs\codex-reviews\17-qx-facets.report.md:94:`{"subjects": []}`, the Questions app reads the new `/api/questions/facets` path and no longer
docs\codex-reviews\18-capture-final.report.md:14:The git diff on stdin is the set of inline additions to branch feature/control-plane-capture of the samagra repo, made AFTER the per-slice reviews. They add: (1) live-read passthroughs GET /api/munshi/library and GET /api/mcd/seeds in samagra/api/app.py that serialize the existing read-only adapters' artifacts() via dataclasses.asdict, are creds-gated, and wrap iteration in try/except returning a generic error (must NOT leak upstream/secret detail); (2) Munshi & Mycontentdev apps rewired to read those live endpoints instead of /api/search; (3) a QX facets filter in GET /api/questions/facets that drops non-alphabetic subject codes; (4) a canonical extensionless pratyaksh sim URL in samagra/sims_manifest.py sim_url. Do an INDEPENDENT adversarial review. Verify: no secret/upstream-detail leak on the read passthroughs; asdict output matches the frontend SearchResult/catalogRows contract (uid,title,subject,unit,chapter,status,kind,url,path,meta); the facet filter is correct/safe; the sim URL is right; no regression to the already-reviewed write paths. Output findings as CRITICAL/HIGH/MEDIUM/LOW with file:line and a concrete fix, then a final one-line verdict: GO / GO-WITH-FIXES / NO-GO. Be concise.
docs\codex-reviews\18-capture-final.report.md:139:         return {"subjects": []}
docs\codex-reviews\18-capture-final.report.md:140:     subjects = (qx.summary() or {}).get("subjects") or {}
docs\codex-reviews\18-capture-final.report.md:141:-    return {"subjects": list(subjects.keys())}
docs\codex-reviews\18-capture-final.report.md:142:+    # Only human-meaningful subject names (must contain a letter). Some QX corpora
docs\codex-reviews\18-capture-final.report.md:143:+    # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
docs\codex-reviews\18-capture-final.report.md:145:+    names = [str(s) for s in subjects.keys() if any(ch.isalpha() for ch in str(s))]
docs\codex-reviews\18-capture-final.report.md:146:+    return {"subjects": names}
docs\codex-reviews\18-capture-final.report.md:296:     assert r.status_code == 200 and r.json() == {"subjects": []}
docs\codex-reviews\18-capture-final.report.md:299:+def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:300:+    # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
docs\codex-reviews\18-capture-final.report.md:301:+    # chip is useless. Only alphabetic subject names should survive.
docs\codex-reviews\18-capture-final.report.md:304:+        def summary(self): return {"subjects": {1: 32285, "Mechanics": 40, "2": 9}}
docs\codex-reviews\18-capture-final.report.md:307:+    assert r.status_code == 200 and r.json()["subjects"] == ["Mechanics"]
docs\codex-reviews\18-capture-final.report.md:344:     phys = [r for r in rows if r["subject"] == "Physics"][0]
docs\codex-reviews\18-capture-final.report.md:582:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "function catalogRows|export function catalogRows|type SearchResponse|interface SearchResponse|CatalogRow|uid|subject|unit|chapter|status|kind|url|path|meta" frontend/src -S' in C:\SandBox\claude_box\TeachingOS
docs\codex-reviews\18-capture-final.report.md:640:frontend/src\apps\Munshi\index.test.tsx:8:  { uid: "m1", source: "munshi", kind: "todo", title: "Call vendor", subject: null,
docs\codex-reviews\18-capture-final.report.md:648:frontend/src\lib\catalog\rows.ts:6:  subject: string | null;
docs\codex-reviews\18-capture-final.report.md:666:frontend/src\lib\catalog\rows.ts:36:    subject: r.subject ?? null,
docs\codex-reviews\18-capture-final.report.md:675:frontend/src\lib\catalog\rows.ts:53:export function subjectsOf(rows: CatalogRow[]): string[] {
docs\codex-reviews\18-capture-final.report.md:676:frontend/src\lib\catalog\rows.ts:55:  for (const r of rows) if (r.subject) set.add(r.subject);
docs\codex-reviews\18-capture-final.report.md:677:frontend/src\lib\catalog\rows.test.ts:2:import { catalogRows, openHref, safeUrl, subjectsOf } from "./rows";
docs\codex-reviews\18-capture-final.report.md:678:frontend/src\lib\catalog\rows.test.ts:7:    { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
docs\codex-reviews\18-capture-final.report.md:681:frontend/src\lib\catalog\rows.test.ts:10:    { uid: "u2", source: "textbook", kind: "chapter", title: "Kinematics", subject: "Maths",
docs\codex-reviews\18-capture-final.report.md:684:frontend/src\lib\catalog\rows.test.ts:20:    expect(rows[0]).toMatchObject({ uid: "u1", title: "Vectors", subject: "Physics", status: "approved" });
docs\codex-reviews\18-capture-final.report.md:689:frontend/src\lib\catalog\rows.test.ts:38:describe("subjectsOf", () => {
docs\codex-reviews\18-capture-final.report.md:690:frontend/src\lib\catalog\rows.test.ts:40:    expect(subjectsOf(catalogRows(sample))).toEqual(["Maths", "Physics"]);
docs\codex-reviews\18-capture-final.report.md:692:frontend/src\lib\catalog\rows.test.ts:56:      { uid: "f", source: "s", kind: "k", title: "file", subject: null, unit: null, chapter: null,
docs\codex-reviews\18-capture-final.report.md:694:frontend/src\lib\catalog\rows.test.ts:58:      { uid: "w", source: "mycontentdev", kind: "concept", title: "seed", subject: null, unit: null,
docs\codex-reviews\18-capture-final.report.md:696:frontend/src\lib\catalog\rows.test.ts:60:      { uid: "x", source: "s", kind: "k", title: "xss", subject: null, unit: null, chapter: null,
docs\codex-reviews\18-capture-final.report.md:704:frontend/src\types\contracts.ts:43:  subject: string | null; unit: string | null; chapter: string | null;
docs\codex-reviews\18-capture-final.report.md:709:frontend/src\types\contracts.ts:50:export interface Facets { sources: string[]; kinds: string[]; subjects: string[]; }
docs\codex-reviews\18-capture-final.report.md:711:frontend/src\types\contracts.ts:55:  subject: string | null; chapter: string | null;
docs\codex-reviews\18-capture-final.report.md:716:frontend/src\types\contracts.ts:109:export interface SimRow { id: string; title: string; subject: string | null; grade: string | null; url: string; }
docs\codex-reviews\18-capture-final.report.md:717:frontend/src\types\contracts.ts:111:export interface QuestionFacets { subjects: string[]; }
docs\codex-reviews\18-capture-final.report.md:721:frontend/src\apps\Lectures\index.test.tsx:8:  { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
docs\codex-reviews\18-capture-final.report.md:737:frontend/src\apps\Insp\index.test.tsx:8:  { uid: "i1", source: "insp", kind: "exam-set", title: "NSEP 2024", subject: null,
docs\codex-reviews\18-capture-final.report.md:817:frontend/src\apps\Booklets\index.tsx:37:              <div style={{ color: V.muted, fontSize: 12 }}>{[r.subject, r.status].filter(Boolean).join(" · ")}</div>
docs\codex-reviews\18-capture-final.report.md:818:frontend/src\apps\Booklets\index.test.tsx:8:  { uid: "b1", source: "booklets", kind: "booklet", title: "Mechanics WB", subject: "Physics",
docs\codex-reviews\18-capture-final.report.md:843:frontend/src\apps\Sims\index.test.tsx:8:  { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11",
docs\codex-reviews\18-capture-final.report.md:845:frontend/src\apps\Sims\index.test.tsx:25:    // No SIM0xxx subject chips.
docs\codex-reviews\18-capture-final.report.md:846:frontend/src\apps\Sims\index.test.tsx:26:    for (const chip of screen.queryAllByTestId("subject-chip")) {
docs\codex-reviews\18-capture-final.report.md:919:frontend/src\apps\Mycontentdev\index.test.tsx:8:  { uid: "s1", source: "mycontentdev", kind: "concept", title: "Seed A", subject: null,
docs\codex-reviews\18-capture-final.report.md:925:frontend/src\lib\questions\facets.test.ts:16:    const data = { results: [{ q_uid: "q1", slug: "s", q_type: "integer", subject: "P",
docs\codex-reviews\18-capture-final.report.md:963:frontend/src\apps\Questions\index.test.tsx:8:  { q_uid: "q1", slug: "s1", q_type: "integer", subject: "Physics", chapter: "1",
docs\codex-reviews\18-capture-final.report.md:964:frontend/src\apps\Questions\index.test.tsx:11:// Question-scoped facets (the fix): subject chips must come from here.
docs\codex-reviews\18-capture-final.report.md:965:frontend/src\apps\Questions\index.test.tsx:12:const qFacets = { subjects: ["Physics", "Chemistry"] };
docs\codex-reviews\18-capture-final.report.md:966:frontend/src\apps\Questions\index.test.tsx:14:const catalogFacets = { sources: ["qx"], kinds: ["question"], subjects: ["SIM0018"] };
docs\codex-reviews\18-capture-final.report.md:968:frontend/src\apps\Questions\index.test.tsx:40:  it("fetches /api/questions/facets and renders a chip per question-scoped subject", () => {
docs\codex-reviews\18-capture-final.report.md:969:frontend/src\apps\Questions\index.test.tsx:45:    const chips = screen.getAllByTestId("subject-chip");
docs\codex-reviews\18-capture-final.report.md:970:frontend/src\apps\Questions\index.test.tsx:50:  it("selecting a subject bakes it into the /api/questions path so the list refetches", () => {
docs\codex-reviews\18-capture-final.report.md:971:frontend/src\apps\Questions\index.test.tsx:55:    expect(useApiMock).toHaveBeenCalledWith("/api/questions?subject=Physics&limit=50");
docs\codex-reviews\18-capture-final.report.md:972:frontend/src\apps\Questions\index.test.tsx:58:  it("re-selecting the active subject clears the filter back to the base path", () => {
docs\codex-reviews\18-capture-final.report.md:973:frontend/src\apps\Questions\index.test.tsx:66:    expect(useApiMock).not.toHaveBeenCalledWith("/api/questions?subject=Physics&limit=50");
docs\codex-reviews\18-capture-final.report.md:974:frontend/src\apps\Questions\index.tsx:17:  // Selected subject is baked into the /api/questions path; empty = no filter.
docs\codex-reviews\18-capture-final.report.md:976:frontend/src\apps\Questions\index.tsx:19:  const [subject, setSubject] = useState("");
docs\codex-reviews\18-capture-final.report.md:977:frontend/src\apps\Questions\index.tsx:20:  const qPath = "/api/questions" + buildQuery({ subject, limit: 50 });
docs\codex-reviews\18-capture-final.report.md:978:frontend/src\apps\Questions\index.tsx:23:  const subjects = Array.isArray(facetData?.subjects) ? facetData!.subjects : [];
docs\codex-reviews\18-capture-final.report.md:979:frontend/src\apps\Questions\index.tsx:36:      {subjects.length ? (
docs\codex-reviews\18-capture-final.report.md:980:frontend/src\apps\Questions\index.tsx:37:        <div data-testid="subject-filters" style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
docs\codex-reviews\18-capture-final.report.md:981:frontend/src\apps\Questions\index.tsx:38:          {subjects.map((s) => {
docs\codex-reviews\18-capture-final.report.md:982:frontend/src\apps\Questions\index.tsx:39:            const active = subject === s;
docs\codex-reviews\18-capture-final.report.md:983:frontend/src\apps\Questions\index.tsx:41:              <button key={s} type="button" data-testid="subject-chip"
docs\codex-reviews\18-capture-final.report.md:985:frontend/src\apps\Questions\index.tsx:67:              {[q.q_type, q.subject, q.chapter, q.difficulty].filter(Boolean).join(" · ")}
docs\codex-reviews\18-capture-final.report.md:995:frontend/src\lib\sims\deployed.test.ts:3:  { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11", url: "u1" },
docs\codex-reviews\18-capture-final.report.md:996:frontend/src\lib\sims\deployed.test.ts:4:  { id: "0466", title: "Osmosis Lab", subject: "Biology", grade: "Class 9", url: "u2" },
docs\codex-reviews\18-capture-final.report.md:997:frontend/src\lib\sims\deployed.test.ts:6:it("filters by title/subject/id", () => {
docs\codex-reviews\18-capture-final.report.md:998:frontend/src\apps\Sims\index.tsx:31:          placeholder="Search title, subject, or id…"
docs\codex-reviews\18-capture-final.report.md:999:frontend/src\apps\Sims\index.tsx:53:                    <div style={{ color: V.muted, fontSize: 12 }}>{r.subject ?? ""}</div>
docs\codex-reviews\18-capture-final.report.md:1001:frontend/src\lib\sims\deployed.ts:7:    (r.subject ?? "").toLowerCase().includes(t) ||
docs\codex-reviews\18-capture-final.report.md:1023:tests\test_spine.py:41:    s = get_adapter("qx").summary()
docs\codex-reviews\18-capture-final.report.md:1025:tests\test_spine.py:48:    s = get_adapter("textbook").summary()
docs\codex-reviews\18-capture-final.report.md:1165:  82: def api_questions(q: str = "", subject: str | None = None,
docs\codex-reviews\18-capture-final.report.md:1172:  89:         q, subject=subject, chapter=chapter, qtype=qtype, limit=limit)}
docs\codex-reviews\18-capture-final.report.md:1321: 238:         return {"subjects": []}
docs\codex-reviews\18-capture-final.report.md:1322: 239:     subjects = (qx.summary() or {}).get("subjects") or {}
docs\codex-reviews\18-capture-final.report.md:1323: 240:     # Only human-meaningful subject names (must contain a letter). Some QX corpora
docs\codex-reviews\18-capture-final.report.md:1324: 241:     # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
docs\codex-reviews\18-capture-final.report.md:1326: 243:     names = [str(s) for s in subjects.keys() if any(ch.isalpha() for ch in str(s))]
docs\codex-reviews\18-capture-final.report.md:1327: 244:     return {"subjects": names}
docs\codex-reviews\18-capture-final.report.md:1386:  15:     "uid", "source", "kind", "title", "subject", "unit",
docs\codex-reviews\18-capture-final.report.md:1397:  26:     subject: Optional[str] = None
docs\codex-reviews\18-capture-final.report.md:1408:  37:             self.uid, self.source, self.kind, self.title, self.subject,
docs\codex-reviews\18-capture-final.report.md:1424:  53:     def summary(self) -> dict:
docs\codex-reviews\18-capture-final.report.md:1438:   6:   subject: string | null;
docs\codex-reviews\18-capture-final.report.md:1468:  36:     subject: r.subject ?? null,
docs\codex-reviews\18-capture-final.report.md:1485:  53: export function subjectsOf(rows: CatalogRow[]): string[] {
docs\codex-reviews\18-capture-final.report.md:1487:  55:   for (const r of rows) if (r.subject) set.add(r.subject);
docs\codex-reviews\18-capture-final.report.md:1534:  43:   subject: string | null; unit: string | null; chapter: string | null;
docs\codex-reviews\18-capture-final.report.md:1541:  50: export interface Facets { sources: string[]; kinds: string[]; subjects: string[]; }
docs\codex-reviews\18-capture-final.report.md:1546:  55:   subject: string | null; chapter: string | null;
docs\codex-reviews\18-capture-final.report.md:1600: 109: export interface SimRow { id: string; title: string; subject: string | null; grade: string | null; url: string; }
docs\codex-reviews\18-capture-final.report.md:1602: 111: export interface QuestionFacets { subjects: string[]; }
docs\codex-reviews\18-capture-final.report.md:1681:  77:                 subject="physics",
docs\codex-reviews\18-capture-final.report.md:1735:  39:                 subject="physics",
docs\codex-reviews\18-capture-final.report.md:1933:   5: def test_questions_facets_uses_qx_summary(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:1936:   8:         def summary(self): return {"subjects": {"Mechanics": 40, "Optics": 12}}
docs\codex-reviews\18-capture-final.report.md:1940:  12:     assert sorted(r.json()["subjects"]) == ["Mechanics", "Optics"]
docs\codex-reviews\18-capture-final.report.md:1941:  13:     assert not any(s.startswith("SIM") for s in r.json()["subjects"])
docs\codex-reviews\18-capture-final.report.md:1947:  19:     assert r.status_code == 200 and r.json() == {"subjects": []}
docs\codex-reviews\18-capture-final.report.md:1950:  22: def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:1951:  23:     # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
docs\codex-reviews\18-capture-final.report.md:1952:  24:     # chip is useless. Only alphabetic subject names should survive.
docs\codex-reviews\18-capture-final.report.md:1955:  27:         def summary(self): return {"subjects": {1: 32285, "Mechanics": 40, "2": 9}}
docs\codex-reviews\18-capture-final.report.md:1958:  30:     assert r.status_code == 200 and r.json()["subjects"] == ["Mechanics"]
docs\codex-reviews\18-capture-final.report.md:2035:   7: _SUBJECT = re.compile(r"^###\s+(.*?)\s*(?:\(\d+\))?\s*$")
docs\codex-reviews\18-capture-final.report.md:2047:  19:     grade = subject = None
docs\codex-reviews\18-capture-final.report.md:2050:  22:         ms = _SUBJECT.match(line)
docs\codex-reviews\18-capture-final.report.md:2052:  24:             subject = ms.group(1).strip()
docs\codex-reviews\18-capture-final.report.md:2062:  34:                         "subject": subject, "grade": grade, "url": sim_url(sid)})
docs\codex-reviews\18-capture-final.report.md:2149:One adversarial edge is worth checking: the filter says “contains a letter,” which solves numeric subject codes but would still allow alphanumeric identifiers. I’m inspecting the QX summary source to see what values can actually arrive there.
docs\codex-reviews\18-capture-final.report.md:2153:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"summary\\(|subjects|subject\" samagra\\adapters samagra tests docs -S" in C:\SandBox\claude_box\TeachingOS
docs\codex-reviews\18-capture-final.report.md:2157:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "SIM0|subject.*SIM|questions/facets|numeric subject|facets" docs samagra frontend tests -S' in C:\SandBox\claude_box\TeachingOS
docs\codex-reviews\18-capture-final.report.md:2161:   3: Content DB (`qx_content.sqlite`) holds documents + questions but its subject/chapter
docs\codex-reviews\18-capture-final.report.md:2188:  30:     def _subject_by_slug(self) -> dict:
docs\codex-reviews\18-capture-final.report.md:2195:  37:                 "select slug, coalesce(ov_subject, subject) from search_index"
docs\codex-reviews\18-capture-final.report.md:2208:  50:     def summary(self) -> dict:
docs\codex-reviews\18-capture-final.report.md:2215:  57:         subjects: dict[str, int] = {}
docs\codex-reviews\18-capture-final.report.md:2220:  62:                     "select coalesce(ov_subject, subject) s, count(*) "
docs\codex-reviews\18-capture-final.report.md:2224:  66:                         subjects[s] = n
docs\codex-reviews\18-capture-final.report.md:2227:  69:         return {"documents": docs, "questions": qs, "subjects": subjects,
docs\codex-reviews\18-capture-final.report.md:2231:  73:         subj_map = self._subject_by_slug()
docs\codex-reviews\18-capture-final.report.md:2241:  83:                     title=title or slug, subject=subj_map.get(slug),
docs\codex-reviews\18-capture-final.report.md:2250:  92:     def search_questions(self, q="", subject=None, chapter=None, qtype=None, limit=50):
docs\codex-reviews\18-capture-final.report.md:2255:  97:             sql = ("select q_uid, slug, q_type, coalesce(ov_subject,subject), "
docs\codex-reviews\18-capture-final.report.md:2262: 104:             if subject:
docs\codex-reviews\18-capture-final.report.md:2263: 105:                 sql += " and coalesce(ov_subject,subject)=?"
docs\codex-reviews\18-capture-final.report.md:2264: 106:                 args.append(subject)
docs\codex-reviews\18-capture-final.report.md:2273: 115:             cols = ["q_uid", "slug", "q_type", "subject", "chapter", "difficulty", "text"]

 succeeded in 1992ms:
tests\test_api_questions_facets.py:5:def test_questions_facets_uses_qx_summary(monkeypatch):
tests\test_api_questions_facets.py:10:    r = TestClient(api_app.app).get("/api/questions/facets")
tests\test_api_questions_facets.py:16:def test_questions_facets_absent_qx(monkeypatch):
tests\test_api_questions_facets.py:18:    r = TestClient(api_app.app).get("/api/questions/facets")
tests\test_api_questions_facets.py:22:def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
tests\test_api_questions_facets.py:23:    # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
tests\test_api_questions_facets.py:29:    r = TestClient(api_app.app).get("/api/questions/facets")
tests\test_api_sims.py:13:    assert body["sims"][0]["url"].endswith("/sims/SIM0020/SIM0020_sim")
samagra\catalog.py:191:def facets() -> dict:
samagra\api\app.py:70:@app.get("/api/facets")
samagra\api\app.py:71:def api_facets():
samagra\api\app.py:72:    return catalog.facets()
samagra\api\app.py:234:@app.get("/api/questions/facets")
samagra\api\app.py:235:def api_questions_facets():
samagra\api\app.py:241:    # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
samagra\api\app.py:242:    # was the eyesore replacing the old SIM0xxx leak — drop non-alphabetic keys.
tests\test_sims_manifest.py:22:    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
tests\test_sims_manifest.py:23:    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"
samagra\portal\static\app.js:247:  try { FACETS = await jget("/api/facets"); } catch { }
frontend\src\types\contracts.ts:40:// ── Catalog / search (GET /api/search, /api/facets) ──────────────────────────
frontend\src\types\contracts.ts:102:// ── Capture / sims / facets (control-plane: POST capture + read-only sims/facets) ──
docs\superpowers\_research\samagra-os\api.md:37:| GET | `/api/facets` | `{sources:[str], kinds:[str], subjects:[str]}` | Filter dropdowns / facet chips |
docs\superpowers\_research\samagra-os\api.md:131:  `/api/facets` (`subjects[]`) and the static `qtype` list already in the portal:
docs\superpowers\_research\samagra-os\api.md:223:| Questions | ✅ | `/api/questions` (+ `/api/facets`) | optional `exam` field in QX SELECT |
frontend\src\apps\Sims\index.test.tsx:9:    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
frontend\src\apps\Sims\index.test.tsx:25:    // No SIM0xxx subject chips.
frontend\src\apps\Questions\index.tsx:5:import { QTYPES, questionRows, questionError } from "../../lib/questions/facets";
frontend\src\apps\Questions\index.tsx:22:  const { data: facetData } = useApi<QuestionFacets>("/api/questions/facets");
docs\superpowers\specs\2026-06-20-samagra-os-experience-design.md:283:| Questions (E2) | `GET /api/questions` (LIVE QX) + `/api/facets` | optional `exam` field in the QX SELECT (additive) |
frontend\src\apps\Questions\index.test.tsx:11:// Question-scoped facets (the fix): subject chips must come from here.
frontend\src\apps\Questions\index.test.tsx:13:// Catalog-wide facets (the old bug source): leaks SIM ids — must NOT be used.
frontend\src\apps\Questions\index.test.tsx:14:const catalogFacets = { sources: ["qx"], kinds: ["question"], subjects: ["SIM0018"] };
frontend\src\apps\Questions\index.test.tsx:16:// Route the mock per path: question-scoped facets for /api/questions/facets,
frontend\src\apps\Questions\index.test.tsx:17:// catalog-wide for /api/facets, questions payload for the rest.
frontend\src\apps\Questions\index.test.tsx:20:    p === "/api/questions/facets"
frontend\src\apps\Questions\index.test.tsx:22:      : p === "/api/facets"
frontend\src\apps\Questions\index.test.tsx:40:  it("fetches /api/questions/facets and renders a chip per question-scoped subject", () => {
frontend\src\apps\Questions\index.test.tsx:43:    expect(useApiMock).toHaveBeenCalledWith("/api/questions/facets");
frontend\src\apps\Questions\index.test.tsx:44:    expect(useApiMock).not.toHaveBeenCalledWith("/api/facets");
frontend\src\apps\Questions\index.test.tsx:47:    expect(screen.queryByText("SIM0018")).not.toBeInTheDocument();
frontend\src\lib\questions\facets.test.ts:2:import { QTYPES, questionRows, questionError } from "./facets";
docs\superpowers\plans\2026-06-20-samagra-os.md:2157:> `lib/questions/facets`); the apps are thin wrappers over these + `useApi`. **Test gate (just-run):** backend
docs\superpowers\plans\2026-06-20-samagra-os.md:2178:> non-blocking follow-up: the Questions app could also consume `/api/facets`.
docs\superpowers\plans\2026-06-20-samagra-os.md:2183:`/api/questions`, `/api/facets` (per `api.md`). Optional additive read endpoints
docs\superpowers\plans\2026-06-20-samagra-os.md:2203:  `GET /api/questions` (LIVE QX) + `/api/facets`; in-body `error` handling.
docs\superpowers\_research\samagra-os\e2-grounding.md:19:| `GET /api/facets` (`api_facets`) | — | `{ sources: string[], kinds: string[], subjects: string[] }` | Match. |
docs\superpowers\_research\samagra-os\e2-grounding.md:231:// ── Catalog / search (GET /api/search, /api/facets) ──────────────────────────
docs\superpowers\_research\samagra-os\e2-grounding.md:312:| `apps/Questions/index.tsx` | `questions` | **khanak** | `GET /api/questions` (+ `/api/facets`) |
docs\superpowers\_research\samagra-os\e2-grounding.md:317:> The exact `source`/`kind` filter values should be confirmed against live `/api/facets.kinds` (distinct DB
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:58:   browser, and its **subject facets bug is fixed** (question-scoped subjects, not catalog-wide
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:59:   `SIM0xxx` ids).
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:79:| 4 | QX facets fix (read) | read | ✅ |
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:127:QX facets need no new TS logic module — the existing `lib/questions/facets.ts` is reused; only the
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:145:  a search box, and live links. The old `/api/search?source=sims` path + `SIM0xxx` subject chips
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:147:- **Questions app** reads `GET /api/questions/facets` for its subject chips instead of the
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:148:  catalog-wide `/api/facets`.
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:195:  zero-padded id (`0018` → `SIM0018`). **Confirm the canonical public link** (`/sims/SIM0018/`
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:203:### Slice 4 — QX facets fix
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:205:- **Cause (already diagnosed):** `/api/facets.subjects` is catalog-wide (`catalog.py:191`), and
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:206:  `adapters/sims.py:37` writes `SIM0xxx` folder ids into `subject`, so the chips are dominated by
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:208:- **Fix (read-only, durable):** `GET /api/questions/facets` →
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:210:  Empty/absent QX → empty lists. The Questions app reads this instead of `/api/facets`.
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:240:  the new facets path).
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:244:  QX facets show real subjects — with preview/screenshot proof.
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:304:   `SIM0xxx` scan + bogus subject chips are gone.
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:305:4. **Questions facets fixed** — subject chips are real question subjects (no `SIM0xxx`), and
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:21:- **Sims** = parse `{SIMS_ROOT}/deployed-sims-by-grade.md` (`## <grade>` / `### <subject>` / `- <id> — <title>`), 482 entries. URL = `https://pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim.html` (`<NNNN>` = 4-digit zero-padded id; confirmed `public/sims/SIM0018/SIM0018_sim.html`).
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:22:- **QX facets** = `qx.summary()["subjects"]` is a **dict** `{subject: count}` of question-scoped subjects (from the builder DB `search_index`); empty `{}` when the builder DB is absent (`adapters/qx.py:50-70`).
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:33:- New routes: `POST /api/munshi/capture`, `POST /api/mcd/seeds`, `GET /api/sims`, `GET /api/questions/facets`
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:55:| `tests/test_api_questions_facets.py` | `frontend/src/types/contracts.ts` |
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:87:git commit -m "feat(contracts): capture/sims/facets types"
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:527:    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim.html"
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:528:    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim.html"
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:587:    assert body["sims"][0]["url"].endswith("/sims/SIM0020/SIM0020_sim.html")
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:657:- [ ] **Step 1: Write failing test:** render with a mocked `/api/sims` → `{sims:[{...}],total:1}`; assert a `catalog-row` with an `<a href>` pointing at `pratyakshsims.com`; assert NO `/api/search?source=sims` fetch and no `SIM0xxx` subject chips.
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:659:- [ ] **Step 3: Implement.** Replace the `/api/search?source=sims` wiring with `useApi<SimsResponse>("/api/sims")`; render `groupByGrade(filterSims(rows, query))`; a search `<input>`; each row shows title + subject + an `open` link to `r.url` (target=_blank). Remove `catalogRows`/`subjectsOf`/SIM0xxx chips.
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:670:## Slice 4 — QX facets fix (read-only)
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:672:### Task 4.1: `GET /api/questions/facets`
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:673:**Files:** Modify `samagra/api/app.py`, Test `tests/test_api_questions_facets.py`
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:679:def test_questions_facets_uses_qx_summary(monkeypatch):
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:684:    r = TestClient(api_app.app).get("/api/questions/facets")
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:689:def test_questions_facets_absent_qx(monkeypatch):
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:691:    r = TestClient(api_app.app).get("/api/questions/facets")
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:694:- [ ] **Step 2: Run — expect FAIL.** `.venv\Scripts\python -m pytest tests/test_api_questions_facets.py -q`
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:697:@app.get("/api/questions/facets")
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:698:def api_questions_facets():
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:705:- [ ] **Step 4: Run — expect PASS.** `.venv\Scripts\python -m pytest tests/test_api_questions_facets.py -q`
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:706:- [ ] **Step 5: Commit.** `git add samagra/api/app.py tests/test_api_questions_facets.py && git commit -m "fix(api): question-scoped GET /api/questions/facets"`
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:708:### Task 4.2: Questions app reads the new facets path
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:710:- [ ] **Step 1: Write/adjust failing test:** mock `/api/questions/facets` → `{subjects:["Mechanics"]}` and `/api/facets` → `{subjects:["SIM0018"]}`; assert the rendered chips show `Mechanics` and NOT `SIM0018`; assert the app fetches `/api/questions/facets` (not `/api/facets`).
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:712:- [ ] **Step 3: Implement.** Change `useApi<Facets>("/api/facets")` → `useApi<QuestionFacets>("/api/questions/facets")`; keep the rest (chip rendering, subject-filter wiring) unchanged.
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:714:- [ ] **Step 5: Commit.** `git commit -m "fix(questions): source subject chips from question-scoped facets"`
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:718:- [ ] **Step 2:** Codex review of the Slice-4 diff (facets correctness, empty state, that the fix actually removes SIM ids). Save `docs/codex-reviews/17-qx-facets.report.md`.
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:752:- [ ] **Step 2:** Questions app subject chips are real subjects (no `SIM0xxx`); selecting one returns rows. Screenshot.
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:10:> (`apps/Questions/index.tsx`) now consumes `/api/facets` (the E2 LOW follow-up, commit `e1cb22a`, merged +
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:11:> pushed), but its subject chips render ~600 `SIM0xxx` **sim-ids** instead of subjects: `/api/facets.subjects`
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:13:> (`sims.py:37`). Clicking one → `/api/questions?subject=SIM0xxx` → 0 rows. Fix **read-only** next session — a
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:14:> question-scoped subject source (QX `summary().subjects`, `qx.py:57`), or intersect `facets.subjects` with the
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:154:                           └─ E2.8 lib/questions/facets ── E2.16 Questions
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:339:// ── Catalog / search (GET /api/search, /api/facets) ──────────────────────────
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:897:### Task E2.8: `lib/questions/facets` — qtype list + defensive rows (TDD) [owner: deepak] [verify: headless] [blockedBy: E2.2]
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:900:- Create: `frontend/src/lib/questions/facets.ts`
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:901:- Test: `frontend/src/lib/questions/facets.test.ts`
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:907:- [ ] **Step 1: Write the failing test.** Create `frontend/src/lib/questions/facets.test.ts`:
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:910:import { QTYPES, questionRows, questionError } from "./facets";
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:940:Run: `cd frontend && npm test -- questions/facets`
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:941:Expected: `Cannot find module './facets'` (red).
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:943:- [ ] **Step 3: Implement `frontend/src/lib/questions/facets.ts`.**
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:965:Run: `cd frontend && npm test -- questions/facets`
docs\superpowers\plans\2026-06-21-samagra-os-e2.md:1864:import { QTYPES, questionRows, questionError } from "../../lib/questions/facets";
docs\codex-reviews\01-adversarial-code-review.log:263:- `samagra/catalog.py` â€” `samagra.db` unified catalog (FTS5) + search/overview/facets.
docs\codex-reviews\01-adversarial-code-review.log:910: 222:   try { FACETS = await jget("/api/facets"); } catch { }
docs\codex-reviews\01-adversarial-code-review.log:1946: 135: def facets() -> dict:
docs\codex-reviews\01-adversarial-code-review.log:2431:  69: @app.get("/api/facets")
docs\codex-reviews\01-adversarial-code-review.log:2432:  70: def api_facets():
docs\codex-reviews\01-adversarial-code-review.log:2433:  71:     return catalog.facets()
docs\codex-reviews\01-adversarial-code-review.log:3158:samagra\api\app.py:69:@app.get("/api/facets")
docs\codex-reviews\01-adversarial-code-review.log:3159:samagra\api\app.py:70:def api_facets():
docs\codex-reviews\02-vision-architecture-review.log:4766:- `samagra/catalog.py` â€” `samagra.db` unified catalog (FTS5) + search/overview/facets.
docs\codex-reviews\02-vision-architecture-review.log:5113:HANDOFF.md:29:- `samagra/catalog.py` — `samagra.db` unified catalog (FTS5) + search/overview/facets.
docs\codex-reviews\02-vision-architecture-review.log:6500:def facets() -> dict:
docs\codex-reviews\02-vision-architecture-review.log:6584:@app.get("/api/facets")
docs\codex-reviews\02-vision-architecture-review.log:6585:def api_facets():
docs\codex-reviews\02-vision-architecture-review.log:6586:    return catalog.facets()
docs\codex-reviews\02-vision-architecture-review.log:7077:  try { FACETS = await jget("/api/facets"); } catch { }
docs\codex-reviews\02-vision-architecture-review.log:7362:  try { FACETS = await jget("/api/facets"); } catch { }
docs\codex-reviews\03-loop-plan-ceo-khanak.log:6782:def facets() -> dict:
docs\codex-reviews\03-loop-plan-ceo-khanak.log:13948:def facets() -> dict:
docs\codex-reviews\04-premerge-review.run.log:1916: 191: def facets() -> dict:
docs\codex-reviews\04-premerge-review.run.log:2622:  69: @app.get("/api/facets")
docs\codex-reviews\04-premerge-review.run.log:2623:  70: def api_facets():
docs\codex-reviews\04-premerge-review.run.log:2624:  71:     return catalog.facets()
docs\codex-reviews\05-premerge-rereview.run.log:3234:def facets() -> dict:
docs\codex-reviews\05-premerge-rereview.run.log:3318:@app.get("/api/facets")
docs\codex-reviews\05-premerge-rereview.run.log:3319:def api_facets():
docs\codex-reviews\05-premerge-rereview.run.log:3320:    return catalog.facets()
docs\codex-reviews\06-premerge-final.run.log:3802:191:def facets() -> dict:
docs\codex-reviews\16-sims-deployed.report.md:12:`GET /api/search?source=sims&limit=2000` and rendered catalog rows + `SIM0xxx`
docs\codex-reviews\16-sims-deployed.report.md:46:- **Zero-pad:** `sim_url("18")` → `.../SIM0018/SIM0018_sim.html`;
docs\codex-reviews\16-sims-deployed.report.md:47:  `sim_url("0466")` → `.../SIM0466/...`. `_ITEM` rejects a 5-digit bullet, so the
docs\codex-reviews\16-sims-deployed.report.md:87:### LOW-4 — "No `SIM0xxx` chips" assertion is structurally vacuous
docs\codex-reviews\16-sims-deployed.report.md:130:- LOW `frontend/src/apps/Sims/index.test.tsx:17-29`: The "No SIM0xxx subject chips" assertion is vacuous if no `subject-chip` elements exist, which is currently the implementation. That is acceptable as a removal check only because the test also asserts the new endpoint, but it would not catch a different residual SIM-chip UI rendered under another test id. Fix: prefer explicit assertions that the old `/api/search?source=sims` path is not called and that old catalog helper imports are gone via code review/lint; the diff already removes those imports.
docs\codex-reviews\17-qx-facets.report.md:1:# Adversarial Code Review — Slice 17: QX question-scoped facets (SIM-id chip bugfix)
docs\codex-reviews\17-qx-facets.report.md:13:Read-only bugfix. The Questions React app was rendering subject chips from `GET /api/facets`
docs\codex-reviews\17-qx-facets.report.md:14:→ `catalog.facets()` (catalog-wide). The sims adapter writes sim folder-ids as `subject`
docs\codex-reviews\17-qx-facets.report.md:15:(`samagra/adapters/sims.py:37`), so ~498 `SIM0xxx` ids leaked into the Questions subject chips.
docs\codex-reviews\17-qx-facets.report.md:17:The fix introduces a **new question-scoped endpoint** `GET /api/questions/facets` that returns
docs\codex-reviews\17-qx-facets.report.md:19:`search_index` via `coalesce(ov_subject, subject)` — real subject names, never SIM ids). The
docs\codex-reviews\17-qx-facets.report.md:20:Questions app now reads that path instead of `/api/facets`.
docs\codex-reviews\17-qx-facets.report.md:23:- `samagra/api/app.py` — new `GET /api/questions/facets` (declared before the SPA catch-all).
docs\codex-reviews\17-qx-facets.report.md:24:- `frontend/src/apps/Questions/index.tsx` — `useApi<Facets>("/api/facets")` → `useApi<QuestionFacets>("/api/questions/facets")`.
docs\codex-reviews\17-qx-facets.report.md:25:- `frontend/src/apps/Questions/index.test.tsx` — retargeted facets mock; asserts new path is called, `/api/facets` is NOT, and `SIM0018` is not in the document.
docs\codex-reviews\17-qx-facets.report.md:26:- `tests/test_api_questions_facets.py` — NEW: happy path (qx.summary subjects, no SIM) + QX-absent empty state.
docs\codex-reviews\17-qx-facets.report.md:32:- **Bug source confirmed:** `samagra/api/app.py:69-71` `/api/facets` → `catalog.facets()` (`samagra/catalog.py:191`) is catalog-wide; `samagra/adapters/sims.py:37` writes sim folder-ids into the `subject` field. This is the leak path.
docs\codex-reviews\17-qx-facets.report.md:33:- **Fix grounding confirmed:** `samagra/adapters/qx.py:50-70` `summary()` returns `{"documents", "questions", "subjects": {subj: count}, "online"}`, where `subjects` is grouped over `search_index` `coalesce(ov_subject, subject)` — real subject names. `list(subjects.keys())` therefore yields actual subjects, never SIM ids. **Correct fix.**
docs\codex-reviews\17-qx-facets.report.md:34:- **Frontend no longer consults `/api/facets`:** `frontend/src/apps/Questions/index.tsx` only calls `/api/questions` (line 21) and `/api/questions/facets` (line 22). The old path is fully removed from this component, so the sim-id chips cannot reappear.
docs\codex-reviews\17-qx-facets.report.md:40:  - Backend `pytest tests/test_api_questions_facets.py` → **2 passed** (an initial run showed a Windows pytest temp-dir teardown `PermissionError` unrelated to the tests; re-running with an isolated `--basetemp` gave a clean `2 passed`).
docs\codex-reviews\17-qx-facets.report.md:48:| LOW | `tests/test_api_questions_facets.py:16` | Backend empty-state coverage only exercises `get_adapter("qx") is None`. The implementation (`samagra/api/app.py:236-239`) also safely handles `available() == False`, `summary() is None`, missing `"subjects"`, and empty `{"subjects": {}}`, but no test locks those regressions down. A future refactor could drop one of those guards without a failing test. | Add a parametrized backend test covering `FakeQx.available() -> False`, `summary() -> None`, `summary() -> {}`, and `summary() -> {"subjects": {}}`, all asserting `{"subjects": []}`. |
docs\codex-reviews\17-qx-facets.report.md:65:[read frontend/src/apps/Questions/index.tsx, index.test.tsx, tests/test_api_questions_facets.py,
docs\codex-reviews\17-qx-facets.report.md:72:LOW: tests/test_api_questions_facets.py:16 only covers `get_adapter("qx") is None` for the empty
docs\codex-reviews\17-qx-facets.report.md:81:GO. The diff correctly moves Questions from `/api/facets` to `/api/questions/facets`, the backend
docs\codex-reviews\17-qx-facets.report.md:82:payload shape matches `QuestionFacets { subjects: string[] }`, and the old SIM-id source is no
docs\codex-reviews\17-qx-facets.report.md:93:`qx.summary()` (no SIM0xxx), handles the QX-absent / degraded cases with an empty-state
docs\codex-reviews\17-qx-facets.report.md:94:`{"subjects": []}`, the Questions app reads the new `/api/questions/facets` path and no longer
docs\codex-reviews\17-qx-facets.report.md:95:consults `/api/facets`, and the sim-id chips are genuinely removed (both verified by the new
docs\codex-reviews\18-capture-final.report.md:14:The git diff on stdin is the set of inline additions to branch feature/control-plane-capture of the samagra repo, made AFTER the per-slice reviews. They add: (1) live-read passthroughs GET /api/munshi/library and GET /api/mcd/seeds in samagra/api/app.py that serialize the existing read-only adapters' artifacts() via dataclasses.asdict, are creds-gated, and wrap iteration in try/except returning a generic error (must NOT leak upstream/secret detail); (2) Munshi & Mycontentdev apps rewired to read those live endpoints instead of /api/search; (3) a QX facets filter in GET /api/questions/facets that drops non-alphabetic subject codes; (4) a canonical extensionless pratyaksh sim URL in samagra/sims_manifest.py sim_url. Do an INDEPENDENT adversarial review. Verify: no secret/upstream-detail leak on the read passthroughs; asdict output matches the frontend SearchResult/catalogRows contract (uid,title,subject,unit,chapter,status,kind,url,path,meta); the facet filter is correct/safe; the sim URL is right; no regression to the already-reviewed write paths. Output findings as CRITICAL/HIGH/MEDIUM/LOW with file:line and a concrete fix, then a final one-line verdict: GO / GO-WITH-FIXES / NO-GO. Be concise.
docs\codex-reviews\18-capture-final.report.md:137:@@ -236,7 +237,38 @@ def api_questions_facets():
docs\codex-reviews\18-capture-final.report.md:143:+    # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
docs\codex-reviews\18-capture-final.report.md:144:+    # was the eyesore replacing the old SIM0xxx leak — drop non-alphabetic keys.
docs\codex-reviews\18-capture-final.report.md:289:diff --git a/tests/test_api_questions_facets.py b/tests/test_api_questions_facets.py
docs\codex-reviews\18-capture-final.report.md:291:--- a/tests/test_api_questions_facets.py
docs\codex-reviews\18-capture-final.report.md:292:+++ b/tests/test_api_questions_facets.py
docs\codex-reviews\18-capture-final.report.md:293:@@ -17,3 +17,14 @@ def test_questions_facets_absent_qx(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:295:     r = TestClient(api_app.app).get("/api/questions/facets")
docs\codex-reviews\18-capture-final.report.md:299:+def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:300:+    # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
docs\codex-reviews\18-capture-final.report.md:306:+    r = TestClient(api_app.app).get("/api/questions/facets")
docs\codex-reviews\18-capture-final.report.md:316:-    assert body["sims"][0]["url"].endswith("/sims/SIM0020/SIM0020_sim.html")
docs\codex-reviews\18-capture-final.report.md:317:+    assert body["sims"][0]["url"].endswith("/sims/SIM0020/SIM0020_sim")
docs\codex-reviews\18-capture-final.report.md:347:-    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim.html"
docs\codex-reviews\18-capture-final.report.md:348:-    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim.html"
docs\codex-reviews\18-capture-final.report.md:349:+    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
docs\codex-reviews\18-capture-final.report.md:350:+    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"
docs\codex-reviews\18-capture-final.report.md:576:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"TeachingOS|samagra|munshi|mycontentdev|questions/facets|sim_url|Artifact\" C:\\Users\\abc\\.codex\\memories\\MEMORY.md" in C:\SandBox\claude_box\TeachingOS
docs\codex-reviews\18-capture-final.report.md:580:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "class Artifact|@dataclass|def artifacts|def api_questions_facets|api_munshi_library|api_mcd_seeds|def sim_url|get_adapter|create_seed|create_item" samagra frontend tests -S' in C:\SandBox\claude_box\TeachingOS
docs\codex-reviews\18-capture-final.report.md:598:23:- TeachingOS, samagra-os, merge recommendation, GO, Questions app, /api/facets, /* @vite-ignore */, current branch state, updated grounding doc
docs\codex-reviews\18-capture-final.report.md:844:frontend/src\apps\Sims\index.test.tsx:9:    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
docs\codex-reviews\18-capture-final.report.md:845:frontend/src\apps\Sims\index.test.tsx:25:    // No SIM0xxx subject chips.
docs\codex-reviews\18-capture-final.report.md:925:frontend/src\lib\questions\facets.test.ts:16:    const data = { results: [{ q_uid: "q1", slug: "s", q_type: "integer", subject: "P",
docs\codex-reviews\18-capture-final.report.md:926:frontend/src\lib\questions\facets.test.ts:17:      chapter: "1", difficulty: "easy", text: "snippet…" }] } as QuestionsResponse;
docs\codex-reviews\18-capture-final.report.md:964:frontend/src\apps\Questions\index.test.tsx:11:// Question-scoped facets (the fix): subject chips must come from here.
docs\codex-reviews\18-capture-final.report.md:966:frontend/src\apps\Questions\index.test.tsx:14:const catalogFacets = { sources: ["qx"], kinds: ["question"], subjects: ["SIM0018"] };
docs\codex-reviews\18-capture-final.report.md:967:frontend/src\apps\Questions\index.test.tsx:16:// Route the mock per path: question-scoped facets for /api/questions/facets,
docs\codex-reviews\18-capture-final.report.md:968:frontend/src\apps\Questions\index.test.tsx:40:  it("fetches /api/questions/facets and renders a chip per question-scoped subject", () => {
docs\codex-reviews\18-capture-final.report.md:1015:tests\test_api_questions_facets.py:9:    monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
docs\codex-reviews\18-capture-final.report.md:1016:tests\test_api_questions_facets.py:17:    monkeypatch.setattr(api_app, "get_adapter", lambda name: None)
docs\codex-reviews\18-capture-final.report.md:1017:tests\test_api_questions_facets.py:28:    monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
docs\codex-reviews\18-capture-final.report.md:1043:samagra\api\app.py:235:def api_questions_facets():
docs\codex-reviews\18-capture-final.report.md:1153:  70: @app.get("/api/facets")
docs\codex-reviews\18-capture-final.report.md:1154:  71: def api_facets():
docs\codex-reviews\18-capture-final.report.md:1155:  72:     return catalog.facets()
docs\codex-reviews\18-capture-final.report.md:1317: 234: @app.get("/api/questions/facets")
docs\codex-reviews\18-capture-final.report.md:1318: 235: def api_questions_facets():
docs\codex-reviews\18-capture-final.report.md:1324: 241:     # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
docs\codex-reviews\18-capture-final.report.md:1325: 242:     # was the eyesore replacing the old SIM0xxx leak â€” drop non-alphabetic keys.
docs\codex-reviews\18-capture-final.report.md:1531:  40: // â”€â”€ Catalog / search (GET /api/search, /api/facets) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
docs\codex-reviews\18-capture-final.report.md:1593: 102: // â”€â”€ Capture / sims / facets (control-plane: POST capture + read-only sims/facets) â”€â”€
docs\codex-reviews\18-capture-final.report.md:1750:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content tests'"\\test_api_questions_facets.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
docs\codex-reviews\18-capture-final.report.md:1933:   5: def test_questions_facets_uses_qx_summary(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:1938:  10:     r = TestClient(api_app.app).get("/api/questions/facets")
docs\codex-reviews\18-capture-final.report.md:1944:  16: def test_questions_facets_absent_qx(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:1946:  18:     r = TestClient(api_app.app).get("/api/questions/facets")
docs\codex-reviews\18-capture-final.report.md:1950:  22: def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:1951:  23:     # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
docs\codex-reviews\18-capture-final.report.md:1957:  29:     r = TestClient(api_app.app).get("/api/questions/facets")
docs\codex-reviews\18-capture-final.report.md:2149:One adversarial edge is worth checking: the filter says “contains a letter,” which solves numeric subject codes but would still allow alphanumeric identifiers. I’m inspecting the QX summary source to see what values can actually arrive there.
docs\codex-reviews\18-capture-final.report.md:2155:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"pratyakshsims.com/sims/SIM[0-9]+/SIM[0-9]+_sim(\\.html)?|308|extensionless|SIM0018_sim\" . -S" in C:\SandBox\claude_box\TeachingOS
docs\codex-reviews\18-capture-final.report.md:2157:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "SIM0|subject.*SIM|questions/facets|numeric subject|facets" docs samagra frontend tests -S' in C:\SandBox\claude_box\TeachingOS
docs\codex-reviews\18-capture-final.report.md:2280:.\docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:21:- **Sims** = parse `{SIMS_ROOT}/deployed-sims-by-grade.md` (`## <grade>` / `### <subject>` / `- <id> — <title>`), 482 entries. URL = `https://pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim.html` (`<NNNN>` = 4-digit zero-padded id; confirmed `public/sims/SIM0018/SIM0018_sim.html`).
docs\codex-reviews\18-capture-final.report.md:2281:.\docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:527:    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim.html"
docs\codex-reviews\18-capture-final.report.md:2282:.\docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:528:    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim.html"
docs\codex-reviews\18-capture-final.report.md:2283:.\frontend\src\apps\Sims\index.test.tsx:9:    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
docs\codex-reviews\18-capture-final.report.md:2285:.\tests\test_sims_manifest.py:22:    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
docs\codex-reviews\18-capture-final.report.md:2286:.\tests\test_sims_manifest.py:23:    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"
docs\codex-reviews\18-capture-final.report.md:2287:.\docs\codex-reviews\16-sims-deployed.report.md:46:- **Zero-pad:** `sim_url("18")` → `.../SIM0018/SIM0018_sim.html`;
docs\codex-reviews\18-capture-final.report.md:2288:.\docs\codex-reviews\18-capture-final.report.md:14:The git diff on stdin is the set of inline additions to branch feature/control-plane-capture of the samagra repo, made AFTER the per-slice reviews. They add: (1) live-read passthroughs GET /api/munshi/library and GET /api/mcd/seeds in samagra/api/app.py that serialize the existing read-only adapters' artifacts() via dataclasses.asdict, are creds-gated, and wrap iteration in try/except returning a generic error (must NOT leak upstream/secret detail); (2) Munshi & Mycontentdev apps rewired to read those live endpoints instead of /api/search; (3) a QX facets filter in GET /api/questions/facets that drops non-alphabetic subject codes; (4) a canonical extensionless pratyaksh sim URL in samagra/sims_manifest.py sim_url. Do an INDEPENDENT adversarial review. Verify: no secret/upstream-detail leak on the read passthroughs; asdict output matches the frontend SearchResult/catalogRows contract (uid,title,subject,unit,chapter,status,kind,url,path,meta); the facet filter is correct/safe; the sim URL is right; no regression to the already-reviewed write paths. Output findings as CRITICAL/HIGH/MEDIUM/LOW with file:line and a concrete fix, then a final one-line verdict: GO / GO-WITH-FIXES / NO-GO. Be concise.
docs\codex-reviews\18-capture-final.report.md:2290:.\docs\codex-reviews\18-capture-final.report.md:347:-    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim.html"
docs\codex-reviews\18-capture-final.report.md:2291:.\docs\codex-reviews\18-capture-final.report.md:348:-    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim.html"
docs\codex-reviews\18-capture-final.report.md:2292:.\docs\codex-reviews\18-capture-final.report.md:349:+    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim"
docs\codex-reviews\18-capture-final.report.md:2293:.\docs\codex-reviews\18-capture-final.report.md:350:+    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim"
docs\codex-reviews\18-capture-final.report.md:2295:.\docs\codex-reviews\18-capture-final.report.md:844:frontend/src\apps\Sims\index.test.tsx:9:    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
docs\codex-reviews\18-capture-final.report.md:2297:.\docs\codex-reviews\18-capture-final.report.md:2155:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"pratyakshsims.com/sims/SIM[0-9]+/SIM[0-9]+_sim(\\.html)?|308|extensionless|SIM0018_sim\" . -S" in C:\SandBox\claude_box\TeachingOS
docs\codex-reviews\18-capture-final.report.md:2334:tests\test_api_questions_facets.py:5:def test_questions_facets_uses_qx_summary(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:2335:tests\test_api_questions_facets.py:8:        def summary(self): return {"subjects": {"Mechanics": 40, "Optics": 12}}
docs\codex-reviews\18-capture-final.report.md:2336:tests\test_api_questions_facets.py:12:    assert sorted(r.json()["subjects"]) == ["Mechanics", "Optics"]
docs\codex-reviews\18-capture-final.report.md:2337:tests\test_api_questions_facets.py:13:    assert not any(s.startswith("SIM") for s in r.json()["subjects"])
docs\codex-reviews\18-capture-final.report.md:2338:tests\test_api_questions_facets.py:19:    assert r.status_code == 200 and r.json() == {"subjects": []}
docs\codex-reviews\18-capture-final.report.md:2339:tests\test_api_questions_facets.py:22:def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:2340:tests\test_api_questions_facets.py:23:    # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
docs\codex-reviews\18-capture-final.report.md:2341:tests\test_api_questions_facets.py:24:    # chip is useless. Only alphabetic subject names should survive.
docs\codex-reviews\18-capture-final.report.md:2342:tests\test_api_questions_facets.py:27:        def summary(self): return {"subjects": {1: 32285, "Mechanics": 40, "2": 9}}
docs\codex-reviews\18-capture-final.report.md:2343:tests\test_api_questions_facets.py:30:    assert r.status_code == 200 and r.json()["subjects"] == ["Mechanics"]
docs\codex-reviews\18-capture-final.report.md:2373:samagra\api\app.py:241:    # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
docs\codex-reviews\18-capture-final.report.md:2426:docs\superpowers\_research\samagra-os\api.md:37:| GET | `/api/facets` | `{sources:[str], kinds:[str], subjects:[str]}` | Filter dropdowns / facet chips |
docs\codex-reviews\18-capture-final.report.md:2431:docs\superpowers\_research\samagra-os\api.md:131:  `/api/facets` (`subjects[]`) and the static `qtype` list already in the portal:
docs\codex-reviews\18-capture-final.report.md:2449:docs\superpowers\_research\samagra-os\e2-grounding.md:19:| `GET /api/facets` (`api_facets`) | — | `{ sources: string[], kinds: string[], subjects: string[] }` | Match. |
docs\codex-reviews\18-capture-final.report.md:2455:docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:58:   browser, and its **subject facets bug is fixed** (question-scoped subjects, not catalog-wide
docs\codex-reviews\18-capture-final.report.md:2458:docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:145:  a search box, and live links. The old `/api/search?source=sims` path + `SIM0xxx` subject chips
docs\codex-reviews\18-capture-final.report.md:2459:docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:147:- **Questions app** reads `GET /api/questions/facets` for its subject chips instead of the
docs\codex-reviews\18-capture-final.report.md:2463:docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:205:- **Cause (already diagnosed):** `/api/facets.subjects` is catalog-wide (`catalog.py:191`), and
docs\codex-reviews\18-capture-final.report.md:2464:docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:206:  `adapters/sims.py:37` writes `SIM0xxx` folder ids into `subject`, so the chips are dominated by
docs\codex-reviews\18-capture-final.report.md:2466:docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:244:  QX facets show real subjects — with preview/screenshot proof.
docs\codex-reviews\18-capture-final.report.md:2467:docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:304:   `SIM0xxx` scan + bogus subject chips are gone.
docs\codex-reviews\18-capture-final.report.md:2468:docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:305:4. **Questions facets fixed** — subject chips are real question subjects (no `SIM0xxx`), and
docs\codex-reviews\18-capture-final.report.md:2469:docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:21:- **Sims** = parse `{SIMS_ROOT}/deployed-sims-by-grade.md` (`## <grade>` / `### <subject>` / `- <id> — <title>`), 482 entries. URL = `https://pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim.html` (`<NNNN>` = 4-digit zero-padded id; confirmed `public/sims/SIM0018/SIM0018_sim.html`).
docs\codex-reviews\18-capture-final.report.md:2470:docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:22:- **QX facets** = `qx.summary()["subjects"]` is a **dict** `{subject: count}` of question-scoped subjects (from the builder DB `search_index`); empty `{}` when the builder DB is absent (`adapters/qx.py:50-70`).
docs\codex-reviews\18-capture-final.report.md:2485:docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:657:- [ ] **Step 1: Write failing test:** render with a mocked `/api/sims` → `{sims:[{...}],total:1}`; assert a `catalog-row` with an `<a href>` pointing at `pratyakshsims.com`; assert NO `/api/search?source=sims` fetch and no `SIM0xxx` subject chips.
docs\codex-reviews\18-capture-final.report.md:2486:docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:659:- [ ] **Step 3: Implement.** Replace the `/api/search?source=sims` wiring with `useApi<SimsResponse>("/api/sims")`; render `groupByGrade(filterSims(rows, query))`; a search `<input>`; each row shows title + subject + an `open` link to `r.url` (target=_blank). Remove `catalogRows`/`subjectsOf`/SIM0xxx chips.
docs\codex-reviews\18-capture-final.report.md:2487:docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:679:def test_questions_facets_uses_qx_summary(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:2495:docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:710:- [ ] **Step 1: Write/adjust failing test:** mock `/api/questions/facets` → `{subjects:["Mechanics"]}` and `/api/facets` → `{subjects:["SIM0018"]}`; assert the rendered chips show `Mechanics` and NOT `SIM0018`; assert the app fetches `/api/questions/facets` (not `/api/facets`).
docs\codex-reviews\18-capture-final.report.md:2496:docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:712:- [ ] **Step 3: Implement.** Change `useApi<Facets>("/api/facets")` → `useApi<QuestionFacets>("/api/questions/facets")`; keep the rest (chip rendering, subject-filter wiring) unchanged.
docs\codex-reviews\18-capture-final.report.md:2497:docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:714:- [ ] **Step 5: Commit.** `git commit -m "fix(questions): source subject chips from question-scoped facets"`
docs\codex-reviews\18-capture-final.report.md:2498:docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:752:- [ ] **Step 2:** Questions app subject chips are real subjects (no `SIM0xxx`); selecting one returns rows. Screenshot.
docs\codex-reviews\18-capture-final.report.md:2503:docs\superpowers\plans\2026-06-21-samagra-os-e2.md:11:> pushed), but its subject chips render ~600 `SIM0xxx` **sim-ids** instead of subjects: `/api/facets.subjects`
docs\codex-reviews\18-capture-final.report.md:2505:docs\superpowers\plans\2026-06-21-samagra-os-e2.md:13:> (`sims.py:37`). Clicking one → `/api/questions?subject=SIM0xxx` → 0 rows. Fix **read-only** next session — a
docs\codex-reviews\18-capture-final.report.md:2506:docs\superpowers\plans\2026-06-21-samagra-os-e2.md:14:> question-scoped subject source (QX `summary().subjects`, `qx.py:57`), or intersect `facets.subjects` with the
docs\codex-reviews\18-capture-final.report.md:2570:docs\codex-reviews\16-sims-deployed.report.md:130:- LOW `frontend/src/apps/Sims/index.test.tsx:17-29`: The "No SIM0xxx subject chips" assertion is vacuous if no `subject-chip` elements exist, which is currently the implementation. That is acceptable as a removal check only because the test also asserts the new endpoint, but it would not catch a different residual SIM-chip UI rendered under another test id. Fix: prefer explicit assertions that the old `/api/search?source=sims` path is not called and that old catalog helper imports are gone via code review/lint; the diff already removes those imports.
docs\codex-reviews\18-capture-final.report.md:2573:docs\codex-reviews\17-qx-facets.report.md:13:Read-only bugfix. The Questions React app was rendering subject chips from `GET /api/facets`
docs\codex-reviews\18-capture-final.report.md:2574:docs\codex-reviews\17-qx-facets.report.md:14:→ `catalog.facets()` (catalog-wide). The sims adapter writes sim folder-ids as `subject`
docs\codex-reviews\18-capture-final.report.md:2575:docs\codex-reviews\17-qx-facets.report.md:15:(`samagra/adapters/sims.py:37`), so ~498 `SIM0xxx` ids leaked into the Questions subject chips.
docs\codex-reviews\18-capture-final.report.md:2576:docs\codex-reviews\17-qx-facets.report.md:18:subjects from `qx.summary()["subjects"]` (a `{subjectName: count}` dict sourced from
docs\codex-reviews\18-capture-final.report.md:2577:docs\codex-reviews\17-qx-facets.report.md:19:`search_index` via `coalesce(ov_subject, subject)` — real subject names, never SIM ids). The
docs\codex-reviews\18-capture-final.report.md:2578:docs\codex-reviews\17-qx-facets.report.md:26:- `tests/test_api_questions_facets.py` — NEW: happy path (qx.summary subjects, no SIM) + QX-absent empty state.
docs\codex-reviews\18-capture-final.report.md:2579:docs\codex-reviews\17-qx-facets.report.md:32:- **Bug source confirmed:** `samagra/api/app.py:69-71` `/api/facets` → `catalog.facets()` (`samagra/catalog.py:191`) is catalog-wide; `samagra/adapters/sims.py:37` writes sim folder-ids into the `subject` field. This is the leak path.
docs\codex-reviews\18-capture-final.report.md:2580:docs\codex-reviews\17-qx-facets.report.md:33:- **Fix grounding confirmed:** `samagra/adapters/qx.py:50-70` `summary()` returns `{"documents", "questions", "subjects": {subj: count}, "online"}`, where `subjects` is grouped over `search_index` `coalesce(ov_subject, subject)` — real subject names. `list(subjects.keys())` therefore yields actual subjects, never SIM ids. **Correct fix.**
docs\codex-reviews\18-capture-final.report.md:2581:docs\codex-reviews\17-qx-facets.report.md:35:- **Contract type matches payload:** `frontend/src/types/contracts.ts:111` `interface QuestionFacets { subjects: string[]; }` matches backend `{"subjects": [...]}`.
docs\codex-reviews\18-capture-final.report.md:2582:docs\codex-reviews\17-qx-facets.report.md:36:- **Empty-state robustness:** the endpoint guards three degradation branches — `not qx`, `not qx.available()`, and `(qx.summary() or {}).get("subjects") or {}` — so a missing adapter, an unavailable QX, a `None` summary, a missing `subjects` key, or an empty dict all collapse to `{"subjects": []}`. No `KeyError`/`AttributeError` path.
docs\codex-reviews\18-capture-final.report.md:2583:docs\codex-reviews\17-qx-facets.report.md:48:| LOW | `tests/test_api_questions_facets.py:16` | Backend empty-state coverage only exercises `get_adapter("qx") is None`. The implementation (`samagra/api/app.py:236-239`) also safely handles `available() == False`, `summary() is None`, missing `"subjects"`, and empty `{"subjects": {}}`, but no test locks those regressions down. A future refactor could drop one of those guards without a failing test. | Add a parametrized backend test covering `FakeQx.available() -> False`, `summary() -> None`, `summary() -> {}`, and `summary() -> {"subjects": {}}`, all asserting `{"subjects": []}`. |
docs\codex-reviews\18-capture-final.report.md:2584:docs\codex-reviews\17-qx-facets.report.md:74:`summary() is None`, and missing/empty `subjects`, but tests do not lock those regressions down.
docs\codex-reviews\18-capture-final.report.md:2585:docs\codex-reviews\17-qx-facets.report.md:76:`summary() -> None`, `summary() -> {}`, and `summary() -> {"subjects": {}}`, all expecting
docs\codex-reviews\18-capture-final.report.md:2586:docs\codex-reviews\17-qx-facets.report.md:77:`{"subjects": []}`.
docs\codex-reviews\18-capture-final.report.md:2587:docs\codex-reviews\17-qx-facets.report.md:82:payload shape matches `QuestionFacets { subjects: string[] }`, and the old SIM-id source is no
docs\codex-reviews\18-capture-final.report.md:2588:docs\codex-reviews\17-qx-facets.report.md:92:The fix is correct, complete, and well-scoped. It returns question-scoped subjects from
docs\codex-reviews\18-capture-final.report.md:2589:docs\codex-reviews\17-qx-facets.report.md:93:`qx.summary()` (no SIM0xxx), handles the QX-absent / degraded cases with an empty-state
docs\codex-reviews\18-capture-final.report.md:2590:docs\codex-reviews\17-qx-facets.report.md:94:`{"subjects": []}`, the Questions app reads the new `/api/questions/facets` path and no longer
docs\codex-reviews\18-capture-final.report.md:2591:docs\codex-reviews\18-capture-final.report.md:14:The git diff on stdin is the set of inline additions to branch feature/control-plane-capture of the samagra repo, made AFTER the per-slice reviews. They add: (1) live-read passthroughs GET /api/munshi/library and GET /api/mcd/seeds in samagra/api/app.py that serialize the existing read-only adapters' artifacts() via dataclasses.asdict, are creds-gated, and wrap iteration in try/except returning a generic error (must NOT leak upstream/secret detail); (2) Munshi & Mycontentdev apps rewired to read those live endpoints instead of /api/search; (3) a QX facets filter in GET /api/questions/facets that drops non-alphabetic subject codes; (4) a canonical extensionless pratyaksh sim URL in samagra/sims_manifest.py sim_url. Do an INDEPENDENT adversarial review. Verify: no secret/upstream-detail leak on the read passthroughs; asdict output matches the frontend SearchResult/catalogRows contract (uid,title,subject,unit,chapter,status,kind,url,path,meta); the facet filter is correct/safe; the sim URL is right; no regression to the already-reviewed write paths. Output findings as CRITICAL/HIGH/MEDIUM/LOW with file:line and a concrete fix, then a final one-line verdict: GO / GO-WITH-FIXES / NO-GO. Be concise.
docs\codex-reviews\18-capture-final.report.md:2596:docs\codex-reviews\18-capture-final.report.md:143:+    # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
docs\codex-reviews\18-capture-final.report.md:2600:docs\codex-reviews\18-capture-final.report.md:299:+def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:2601:docs\codex-reviews\18-capture-final.report.md:300:+    # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
docs\codex-reviews\18-capture-final.report.md:2631:docs\codex-reviews\18-capture-final.report.md:845:frontend/src\apps\Sims\index.test.tsx:25:    // No SIM0xxx subject chips.
docs\codex-reviews\18-capture-final.report.md:2634:docs\codex-reviews\18-capture-final.report.md:925:frontend/src\lib\questions\facets.test.ts:16:    const data = { results: [{ q_uid: "q1", slug: "s", q_type: "integer", subject: "P",
docs\codex-reviews\18-capture-final.report.md:2636:docs\codex-reviews\18-capture-final.report.md:964:frontend/src\apps\Questions\index.test.tsx:11:// Question-scoped facets (the fix): subject chips must come from here.
docs\codex-reviews\18-capture-final.report.md:2638:docs\codex-reviews\18-capture-final.report.md:966:frontend/src\apps\Questions\index.test.tsx:14:const catalogFacets = { sources: ["qx"], kinds: ["question"], subjects: ["SIM0018"] };
docs\codex-reviews\18-capture-final.report.md:2639:docs\codex-reviews\18-capture-final.report.md:968:frontend/src\apps\Questions\index.test.tsx:40:  it("fetches /api/questions/facets and renders a chip per question-scoped subject", () => {
docs\codex-reviews\18-capture-final.report.md:2668:docs\codex-reviews\18-capture-final.report.md:1324: 241:     # store numeric subject codes (e.g. {1: 32285}); a bare "1" chip is useless and
docs\codex-reviews\18-capture-final.report.md:2686:docs\codex-reviews\18-capture-final.report.md:1933:   5: def test_questions_facets_uses_qx_summary(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:2691:docs\codex-reviews\18-capture-final.report.md:1950:  22: def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
docs\codex-reviews\18-capture-final.report.md:2692:docs\codex-reviews\18-capture-final.report.md:1951:  23:     # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
docs\codex-reviews\18-capture-final.report.md:2701:docs\codex-reviews\18-capture-final.report.md:2149:One adversarial edge is worth checking: the filter says “contains a letter,” which solves numeric subject codes but would still allow alphanumeric identifiers. I’m inspecting the QX summary source to see what values can actually arrive there.
docs\codex-reviews\18-capture-final.report.md:2703:docs\codex-reviews\18-capture-final.report.md:2157:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "SIM0|subject.*SIM|questions/facets|numeric subject|facets" docs samagra frontend tests -S' in C:\SandBox\claude_box\TeachingOS

web search: 
web search: https://pratyakshsims.com/sims/SIM0018/SIM0018_sim
codex
I can’t prove the Pratyaksh redirect with the browser fetch tool here; it returned cache-miss fetch errors for both forms. I’m checking local committed evidence and route construction, and I’ll call out the verification limit if it matters to the verdict.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'try { curl.exe -I -L --max-redirs 0 --connect-timeout 10 https://pratyakshsims.com/sims/SIM0018/SIM0018_sim 2>&1 } catch { $_.Exception.Message }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content HANDOFF.md | ForEach-Object { '"'{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'try { curl.exe -I --max-redirs 0 --connect-timeout 10 https://pratyakshsims.com/sims/SIM0018/SIM0018_sim.html 2>&1 } catch { $_.Exception.Message }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content docs'"\\superpowers\\specs\\2026-06-21-samagra-control-plane-capture-design.md | Select-Object -First 330 | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 893ms:
   1: # SAMAGRA â€” Handoff
   2: 
   3: > **â–¶â–¶ LATEST â€” Capture control plane is LIVE (2026-06-21).** The SAMAGRA OS now does **real
   4: > owner-initiated captures end-to-end** and browses every read-only surface with live data, on branch
   5: > **`feature/control-plane-capture`** (not yet merged). Built TDD + an **independent Codex review per
   6: > implementation** (reports `docs/codex-reviews/14â€“17`).
   7: > - **Munshi capture (write):** `POST /api/munshi/capture` â†’ live `MunshiClient.create_item` â†’
   8: >   `POST {MUNSHI_API_URL}/api/item` (cookie auth). Kinds **todo/note/followup** only (the worker's
   9: >   deterministic set), per-kind required fields, server-validated, creds-gated.
  10: > - **mycontentdev seed capture (write):** `POST /api/mcd/seeds` â†’ live `McdClient.create_seed` â†’
  11: >   `POST {apiUrl}/api/seeds` **form-encoded**, `x-mcd-admin: <adminKey>` (the existing read key
  12: >   authorizes the write â€” verified; **no `APP_PASSWORD` needed**).
  13: > - **Live-read passthroughs** `GET /api/munshi/library` + `GET /api/mcd/seeds` â€” the capture apps read
  14: >   the **live deployed workers** (not the catalog), so real data shows without a refresh and a fresh
  15: >   capture appears on refetch. (`/api/search?source=munshi|mycontentdev` was catalog-backed â†’ empty.)
  16: > - **Simulations = deployed-only:** `GET /api/sims` parses `pratyaksh-May-deploy/deployed-sims-by-grade.md`
  17: >   (**482 sims**), grade-grouped, linking the canonical extensionless `pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim`.
  18: > - **QX browser fixed + separate:** `GET /api/questions/facets` is question-scoped (`qx.summary()`),
  19: >   the SIM-id chip bug is gone, and degenerate numeric subject codes are filtered (clean chips). The
  20: >   Questions app stays a standalone read-only browser (50 live QX rows, real q-type chips).
  21: > - **LIVE-VERIFIED this session:** captured a real Munshi todo (`item_id 53`, library 13â†’14) and a real
  22: >   mcd seed (`seed_01KVNN90â€¦`, status `captured`, seeds 1â†’2) through the running server; both appear in
  23: >   the live-read apps. Negative guards (bad kind / empty text) â†’ 400. Backend **134 pytest** + frontend
  24: >   **514 vitest / 60 files** green; advisory gate clean. Two benign labelled smoke records remain in
  25: >   prod (owner can dismiss/archive). **Pending: merge `feature/control-plane-capture` (PR).**
  26: >
  27: > **âœ… DEC-3 AMENDMENT (2026-06-21, Chairman Deepak).** The morning's DEC-3 read-only firewall is amended:
  28: > **owner-initiated capture** (a munshi item + an mcd seed) is now **in-scope** â€” the project's only two
  29: > subsystem write paths. **Still binding & unchanged:** the human publish gate is **never automated**;
  30: > **no automated munshiâ†’mcd bridge** (promotion is a later explicit Chairman action); no app-platform
  31: > scope (DEC-1); attention-ROI north-star + kill-criterion (DEC-2) + the pre-E3 gate (DEC-4) hold;
  32: > Phase-3's full active loop stays parked (DEC-5). **New invariant wording: "read-only *except
  33: > owner-initiated capture*."** Spec/plan: `docs/superpowers/{specs/2026-06-21-samagra-control-plane-capture-design.md,plans/2026-06-21-samagra-control-plane-capture.md}`.
  34: >
  35: > **â–¶ STATUS:** The project is **SAMAGRA** (package `samagra`) â€” a company-structured agent org
  36: > folding in `mycontentdev` + `munshi`, with an advisory pre-commit Codex review and a CEO prompt-outbox.
  37: > **Phase 0 (rename), Track A (stabilize) and Phase 1 (read-only subsystem adapters) are merged to `main`
  38: > and pushed to `origin/main`.** **Phase 2 (governance) is now BUILT TDD on `main` (suite 63 â†’ 98 green)**,
  39: > reconciled to the runbook: **D6** (governance state lives in its own durable `governance.db`, separate from
  40: > the rebuildable catalog `samagra.db`) and **D5** (the Codex pre-commit hook is **advisory-local** â€”
  41: > confirmed-CRITICAL only, diff-hash cached, audited break-glass, never wedges; real enforcement = CI). The
  42: > plan's Phase-2 code was stale (it self-flagged `SUPERSEDED by D5/D9`) and was reconciled before building.
  43: > The live plan is under `docs/superpowers/` (original brief: [`SAMAGRA-HANDOFF.md`](SAMAGRA-HANDOFF.md)).
  44: > **Pre-merge review: APPROVE** (Codex gpt-5.5/xhigh, 6 rounds + a CEO adversarial Workflow audit â€” see
  45: > `docs/codex-reviews/07â€“13` + `12-workflow-invariant-audit.md`; all findings fixed TDD).
  46: > **Phase 2 SHIPPED (2026-06-19):** `origin/main` holds Phase 2 through `da9cab3` (the end-of-session doc-sync
  47: > commits after it are local-ahead until the next `git push origin main`); the advisory
  48: > hook is ACTIVE (`core.hooksPath=.githooks`, so every commit + worktree now runs it â€” `codex` 0.140.0 on PATH);
  49: > the three agent worktrees exist (`../samagra-{deepak,khanak,codex}` on `agent/{deepak,khanak,codex}`).
  50: > **â–¶ NEW TOP PRIORITY (2026-06-20): SAMAGRA OS â€” the Experience track.** Replace the plain tabbed portal with
  51: > an OS-style windowing GUI (17 apps Â· 3 themes Â· 2 device modes) in React + TypeScript + Vite, served by
  52: > FastAPI. Own spec + phased plan + agent division + two autonomous loop scripts under `docs/superpowers/`
  53: > (spec `specs/2026-06-20-samagra-os-experience-design.md`; plan `plans/2026-06-20-samagra-os.md`; division
  54: > `plans/2026-06-20-samagra-os-division.md`; loops `loops/{deepak,khanak}-loop.js` + `RUBRIC.md`).
  55: > **E1 (shell + ALL 3 themes + OS utilities) is BUILT, fidelity-passed, and MERGED to `main` (2026-06-20,
  56: > `06d88a3`, fast-forward; 96 files / ~19k insertions).** On top of the fidelity layer the main session added
  57: > draggable/resizable windows, the advisory HIGH#4 theme-index guard, Notes to-do keyboard a11y, and the
  58: > owner's two asks: the **chairman renamed Devesh â†’ Deepak Bhardwaj** (Dashboard greeting, terminal prompt
  59: > `deepak@samagra:~$`, board + `whoami`) and **right-click context menus for all 3 themes** (desktop Â· window Â·
  60: > dock-icon; theme-driven surface, verified live in aqua/console/samagra). **PUSHED to `origin/main` 2026-06-21
  61: > (`557e6a4..6d09693`, incl. the tracker doc-sync).**
  62: > **â–¶ E2 (data/control apps) is now MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` on
  63: > 2026-06-21.** The **eleven data/control
  64: > apps** shipped as thin, **read-only** React wrappers over the existing FastAPI `/api/*` contract, plus the one
  65: > new backend endpoint **`GET /api/org`** (static `samagra/org.py`). Apps: **Org Chart Â· Pipelines Â· Lectures Â·
  66: > mycontentdev Â· Munshi** (owner claude-deepak) and **Assignments (kanban) Â· Activity Â· Questions Â· Booklets Â·
  67: > INSP/Olympiad Â· Simulations** (owner claude-khanak). No new write paths; mcd/munshi render empty-or-unavailable
  68: > states; Munshi capture/write is OUT of scope. All real logic lives in **seven pure-TS linchpin modules**
  69: > (`lib/api/query` Â· `lib/catalog/rows` Â· `lib/pipelines/stages` Â· `lib/org/resolve` Â· `lib/kanban/columns` Â·
  70: > `lib/activity/format` Â· `lib/questions/facets`); the 11 app components are thin wrappers over these + `useApi`.
  71: > Built TDD on branch **`e2/samagra-os`** as a single-tree DAG driven by two background Workflows (backend + 7
  72: > linchpin modules, then the 11 app wrappers) with phase-boundary review â€” **22 commits**. A live-source
  73: > verification workflow produced `docs/superpowers/_research/samagra-os/e2-grounding.md` â€” the verified `/api`
  74: > contract, which **SUPERSEDES the stale `api.md`** (it caught 11 deltas: dual `meta_json`/`summary_json` keys,
  75: > two empty-question bodies, hyphenated `in-review` status, a name-keyed `phases` Record, 7 owner ids, the
  76: > chairman name living only in `dispatch.ts`, etc.). The dedicated plan
  77: > `plans/2026-06-21-samagra-os-e2.md` cleared a **4-critic adversarial pass** (0 CRITICAL / 0 MAJOR; 6 minor
  78: > polish fixes applied).
  79: > **E2 test gate (just-run): BACKEND 106 pytest passing** (102 E1 + 4 new `tests/test_api_org.py`); **FRONTEND
  80: > 501 vitest passing across 56 files** (497 at the E2 merge; the +4 are the post-merge `e1cb22a` Questions `/api/facets` tests) (439 E1 + 25 new lib tests incl. the catalog href/safeUrl tests + 33 app
  81: > render-smoke), `tsc --noEmit` clean, `vite build` green emitting **22 lazy chunks** (one per app), no
  82: > `.only`/`.skip`. **A Codex pre-merge review returned GO and three MEDIUM findings were fixed (commit
  83: > `31aa5bb`):** **(a)** `org.py`'s worker roster shows "Gemini+NotebookLM" as ONE line (the owners map keeps the
  84: > two tokens distinct); **(b)** the Pipelines app humanizes pipeline owner tokens via `GET /api/org` + `ownerName`;
  85: > **(c)** `lib/catalog/rows` exposes a unified, scheme-guarded `href` so url-only mycontentdev/munshi rows are
  86: > actionable. **Also reconciled during review:** `org.py` owner mapping is OWNER-CONFIRMED â€” `claude1` =
  87: > **Claude-Deepak** (CEO â€” substrate & engine), `claude2` = **Claude-Khanak** (CTO â€” leaf apps & UX) â€” locked by
  88: > `tests/test_api_org.py`; and a **pre-existing E1 production-serve bundling bug** â€” `App.tsx`'s
  89: > `/* @vite-ignore */` dynamic import left every `apps/*/index.tsx` OUT of the production bundle, so FastAPI-served
  90: > app windows rendered empty (only `npm run dev` worked) â€” was fixed by dropping `@vite-ignore` so Vite emits a
  91: > lazy chunk per app (22 chunks); this affected all 17 apps in production, now fixed.
  92: > **E2 status right now:** **MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` on 2026-06-21**
  93: > after the Codex pre-merge review (GO; 3 MEDIUMs fixed) â€” see the merged PR
  94: > <https://github.com/dbhardwaj86/samagra/pull/2>. **Pixel/interaction parity of the 11 apps is a
  95: > separate owner-run browser-vision pass â€” NOT yet run, NOT claimed** (some E2 glyphs may still be unregistered
  96: > in `components/icons-data` â†’ empty-icon fallback; a visual-polish follow-up). **Next planned action: the
  97: > owner-run browser-vision pixel-QA pass over the 11 E2 apps (now that the bundling fix makes them render when
  98: > FastAPI-served, not just under `npm run dev`), then Phase E3 (mobile device mode + remaining per-theme re-skin
  99: > polish â€” the 3 themes already shipped in E1).** The E2 LOW follow-up â€” the Questions app consuming
 100: > `/api/facets` â€” was IMPLEMENTED this session (commit `e1cb22a`, pushed to `origin/main`) but **introduced a
 101: > known bug; see âš  KNOWN BUG below.**
 102: > The full `frontend/` app (React 18 + TS + Vite) shipped TDD across E1.1â€“E1.25: the bootstrap + frozen
 103: > 17-app registry, every pure `lib/` engine (`wm/{geometry,zorder}`, `snake/{engine,cell}`,
 104: > `clock/{analog,stopwatch,timer,world}`, `terminal/{parser,dispatch}`, `notes/model`, `persistence`), the
 105: > `windowManager`/`theme` Zustand stores (thin over `lib/`), the aqua chrome shell (top bar Â· dock Â· window
 106: > frame Â· context menu), the six OS-utility apps (Dashboard Â· Settings Â· Terminal Â· Clock Â· Notes Â· Snake) +
 107: > shared leaf components, and the FastAPI serve seam (Vite `dist/` + SPA fallback, jinja portal route retired).
 108: > **Fidelity layer (2026-06-20):** theme-driven chrome for all three themes â€” **aqua** (top bar + bottom-centre
 109: > Dock + left traffic-lights), **console** (no top bar; bottom Taskbar + Start menu + right-side neon icon
 110: > controls), **samagra** (Devanagari top strip + left **Rail** dock + warm window frame) â€” every colour/size
 111: > driven by the `themes/` token map (**FD1**), plus the `Icon`/`AppIcon` SVG components (**FD2**) wired through
 112: > every dock/rail/Start launcher and the six apps (no letter badges anywhere). The RTL suite was adapted to the
 113: > new markup and pins the fidelity hooks: per-launcher inline `<svg>`, control aria-labels
 114: > (Close/Minimize/Maximize), exact traffic-light token colours (`#ff5f57` live / `#cdcdd4` inactive), the 28Ã—23
 115: > right-side control geometry, the Devanagari wordmarks, and the full theme swap exercised through the real
 116: > stores.
 117: > **E1-merge gate (2026-06-20): `npm run verify` clean â€” lint + `tsc --noEmit` + 439 Vitest tests across
 118: > 38 files + `vite build` writing `dist/`, no `.only`/`.skip` in the diff â€” and the backend `pytest` suite at
 119: > 102/102 green (incl. `test_serve_seam.py`).** Linchpin held: all real behaviour lives in pure-TS
 120: > headless-testable modules; **pixel/interaction fidelity is a separate browser-vision QA pass** (owner-run,
 121: > never a loop completion signal) â€” **it has NOT run; pixel parity is NOT claimed.** The headless gate proves
 122: > the markup, tokens and icon wiring are correct, not that the rendered pixels match the screenshots.
 123: > **Next steps:** the **owner-run browser-vision pixel-QA pass over the 11 E2 apps** (now that the bundling fix
 124: > makes them render when FastAPI-served, not just under `npm run dev`), then **E3** (mobile device mode + remaining
 125: > per-theme re-skin polish + the deferred Dashboard narrow-grid HIGH#2). The **browser-vision pixel pass**
 126: > (owner-run, per-surface vs the prototype + `screenshots/`) â€” now spanning the E1 shell + the 11 E2 apps â€”
 127: > remains outstanding.
 128: > **Phase 3 (active loop) is PARKED** (plan complete, resumes after the Experience track; will need live
 129: > `MUNSHI_API_URL`/`MUNSHI_SECRET` in `.env`). Carried into Phase 3: F1/F4 refresh hardening.
 130: >
 131: > **âš  KNOWN BUG (open â€” take up next session): Questions app subject chips show sim-ids, not subjects.**
 132: > The Questions app (`frontend/src/apps/Questions/index.tsx`) renders its subject filter chips from
 133: > `GET /api/facets`, whose `subjects` is **catalog-wide** (`select distinct subject from catalog`,
 134: > `samagra/catalog.py:191`). The sims adapter writes each simulation's folder id (`SIM0018`â€¦`SIM0626`) into the
 135: > `subject` column (`samagra/adapters/sims.py:37`, `subject = after[0]`), so **~500 `SIM0xxx` ids dominate the
 136: > chip list** (498 measured against `samagra.db` â€” 502 of 504 distinct catalog subjects come from the sims source). Global catalog facets â‰  the question bank's subject vocabulary;
 137: > clicking a `SIM0xxx` chip filters `/api/questions?subject=SIM0xxx` â†’ 0 QX rows. Compounded by QX's own
 138: > `subject` column being physics-only/unpopulated (see Gotchas). **Introduced this session by the E2 LOW-finding
 139: > fix `e1cb22a`** (already merged + pushed to `origin/main`). **Fix options (next session â€” keep it read-only,
 140: > tests + `npm run verify` green):** (a) source the chips from a **question-scoped** subject list â€” QX
 141: > `summary().subjects` (`samagra/adapters/qx.py:57`) via a new `/api/questions/facets` or the existing qx
 142: > overview summary; (b) intersect `facets.subjects` with the subjects actually present in the returned
 143: > questions; or (c) drop subject chips and facet on chapter/q_type per the Gotcha. **Deeper cause (audit 2026-06-21):**
 144: > the `subject` column has *uneven semantics across adapters* â€” sims writes a folder id (`sims.py:37`),
 145: > mcd/munshi hardcode `physics`, qx derives from the builder DB â€” so a catalog-wide `DISTINCT subject`
 146: > (`catalog.py:199`) can never equal the question bank's subject vocabulary; the durable read-only fix is
 147: > question-scoped facets (`qx.summary().subjects`), not catalog-wide facets.
 148: 
 149: ## âœ… Direction-coherence DECISION (RATIFIED 2026-06-21 by Deepak, Founder & Chairman)
 150: 
 151: A dedicated coherence audit this session â€” an independent **Codex vision review** plus a **multi-agent
 152: implementation audit** (4 mappers + 4 verifiers, live test runs) â€” found **execution coherence strong but
 153: strategic direction drifting.** Execution verified clean: every merge claim holds (E1 `06d88a3`, E2 `31aa5bb`,
 154: HEAD `e1cb22a`), the **read-only safety invariant held exactly at the time of that audit** (no `create_seed`
 155: shipped; `GET /api/org` static; `useApi` GET-only; the 3 POST routes control-plane) â€” **superseded 2026-06-21
 156: by the DEC-3 amendment** (see the LATEST banner at the top): the invariant is now *"read-only except
 157: owner-initiated capture"* with exactly two write paths (`/api/munshi/capture`, `/api/mcd/seeds`), the
 158: specâ†”code mapping is exact (17 apps Â· 7 linchpin `lib/` modules Â· 12 engines Â· 3 themes Â· 8 shell components),
 159: and live suites are **backend 106 pytest + frontend 501 vitest** green. **The drift is strategic, not factual:**
 160: 
 161: - The **2026-06-19 evolution spec deliberately retired the word "OS"** â€” *"the word 'OS' is retired because it
 162:   silently licenses OS-sized scope"* â€” and bound the project to an **attention-ROI north-star + a kill-criterion**
 163:   (freeze if not demonstrably saving the owner ~3 hrs/wk by Phase 2). One day later the project pivoted to a
 164:   literal **17-app "SAMAGRA OS"** windowing GUI (incl. a Snake game, 3 themes, mobile mode) as the **top
 165:   priority** and **parked the value-producing active loop** (munshi â†’ seed â†’ board-approve â†’ publish â€” the
 166:   mechanism that actually saves owner attention).
 167: - The OS experience spec **half-reconciles** this (it argues the windowing metaphor is "the honest shape of the
 168:   work" and firewalls write paths) but **never restates the attention-ROI metric or the kill-criterion**, and
 169:   STATUS / SUMMARY / HANDOFF did not surface the tension at all until this audit.
 170: - **Codex vision verdict: `DRIFTING`. Audit verdict: `COHERENT-WITH-CAVEATS`** (this is the caveat). Full
 171:   reviews: `docs/superpowers/_research/samagra-os/_vision-review-output.md` (+ `_vision-review-prompt.md`,
 172:   `_vision-review.log`); audit synthesis is summarised in STATUS.html â†’ *Direction coherence*.
 173: 
 174: **Decision (ratified 2026-06-21 by Deepak â€” these are now BINDING):**
 175: 1. **DEC-1 Â· Scope.** SAMAGRA OS is a **bounded operator console â€” a UI metaphor only.** SAMAGRA remains a
 176:    control plane; it does **not** acquire app-platform scope. The windowing GUI is inward-facing operator
 177:    infrastructure, never a product.
 178: 2. **DEC-2 Â· North-star binding.** The **attention-ROI north-star** (minutes-of-owner-attention per published
 179:    artifact) and the **kill-criterion** from the 2026-06-19 vision remain **BINDING** and are not voided by the
 180:    OS track. Data source = the governance `events`/`review_overlay` ledger. (The ~3 hrs/wk figure stays the seed
 181:    proposal; the owner ratifies the exact threshold when the DEC-4 gauge first runs.)
 182: 3. **DEC-3 Â· Scope firewall** (now a hard non-goal, mirrored into OS spec Â§3): **no** entertainment apps beyond
 183:    E1's Snake; **no** third-party apps / app marketplace; **no** process- or scheduler-as-platform model; **no**
 184:    user-facing product identity. Adding any of these is a Chairman decision, not routine engineering.
 185: 4. **DEC-4 Â· Attention-ROI acceptance gate before E3.** Before any E3 work (mobile device mode / further theme
 186:    polish) begins, a gate must pass: pick **2â€“3 representative operator tasks** (e.g. (a) triage the day's munshi
 187:    captures into seed-candidates vs ops; (b) read pipeline + gate status across all 5 pipelines; (c) locate and
 188:    open a specific catalog artifact â€” owner-confirmable), **measure owner wall-clock time** doing each via
 189:    SAMAGRA OS vs the prior tabbed portal / point tools. **Pass** = the GUI demonstrably *reduces* total owner
 190:    time (net-positive attention-ROI). **Fail** = freeze GUI expansion (per DEC-2's kill-criterion) and
 191:    reprioritize Phase 3.
 192: 5. **DEC-5 Â· Phase 3 is the primary value engine.** The active loop (munshi â†’ seed â†’ board-approve â†’ publish)
 193:    restarts **after the E2 visual-QA pass and the DEC-4 gate**, ahead of further theme/mobile polish â€” it is not
 194:    optional. (No calendar date is set; it is gated on those two conditions.)
 195: 
 196: This decision is recorded across STATUS.html (*Direction coherence*), SUMMARY.html, both specs and CLAUDE.md, so
 197: it travels with the project. Reviews that informed it: `docs/superpowers/_research/samagra-os/_vision-review-output.md`.
 198: 
 199: **Single next-action order (reconciled this session):**
 200: 1. Fix the Questions facets bug (read-only; `npm run verify` green) â€” see âš  KNOWN BUG above.
 201: 2. Owner **browser-vision pixel-QA** pass over the E1 shell + the 11 E2 apps.
 202: 3. **Run the DEC-4 attention-ROI acceptance gate** â€” required to pass before any E3 work begins.
 203: 4. **E3** â€” mobile device mode + remaining per-theme re-skin polish (gated on DEC-4).
 204: 
 205: (Backend pytest exits 1 on Windows from a tmpdir symlink-cleanup teardown *after* all 106 pass â€” cosmetic, not
 206: a failure; run with `--basetemp` to silence.)
 207: 
 208: ---
 209: 
 210: **Repo:** github.com/dbhardwaj86/samagra Â· `main` (E1 merged, `06d88a3`; **E2 merged, `31aa5bb`**) Â· **E2 MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` 2026-06-21 (Codex pre-merge review GO; 3 MEDIUMs fixed)** Â· local-first Python+FastAPI.
 211: **State:** Spine + portal + thin/thick exporter + semi-autonomous loop + two read-only subsystem adapters
 212: (mycontentdev seeds, munshi `library()`) reflecting into the catalog, **+ Phase-2 governance**: durable
 213: `governance.db` store (assignments / events ledger / review overlay), `GET /api/assignments` + the
 214: Assignments portal tab, an advisory Codex pre-commit gate (`samagra/review/`), the committed
 215: `.githooks/pre-commit` shim, and per-agent board files (`board/{deepak,khanak,codex}/`), **+ SAMAGRA OS E1
 216: + fidelity layer**: the `frontend/` React+TS+Vite windowing shell (three themes â€” aqua/console/samagra chrome
 217: Â· `Icon`/`AppIcon` SVG system Â· WM Â· six OS utilities on tested pure-TS engines) served by FastAPI from
 218: `frontend/dist/`, + the chairman rename and right-click context menus. **Backend 102/102 pytest green; frontend 439/439 Vitest green.**
 219: 
 220: ## Run it
 221: 
 222: ```bash
 223: cd C:\SandBox\claude_box\TeachingOS
 224: set PYTHONPATH=%CD%                 # or: export PYTHONPATH=$(pwd) in bash
 225: .venv\Scripts\python -m samagra refresh        # rebuild catalog (7,044 artifacts)
 226: .venv\Scripts\python -m samagra status
 227: .venv\Scripts\python -m samagra export --chapter vectors --variant both
 228: .venv\Scripts\python -m samagra tick [--dry-run]
 229: .venv\Scripts\python -m samagra gate textbook approve
 230: # portal: preview harness (.claude/launch.json -> "samagra") OR:
 231: .venv\Scripts\python -m uvicorn samagra.api.app:app --port 8799   # http://127.0.0.1:8799
 232: ```
 233: 
 234: ```bash
 235: # SAMAGRA OS (E1) frontend â€” from frontend/
 236: cd frontend
 237: npm install                      # first run only (generates node_modules from tracked lockfile)
 238: npm run dev                      # Vite :5173, proxies /api,/lecture,/open -> uvicorn :8799
 239: npm run verify                   # the gate: lint + tsc --noEmit + vitest run (439) + vite build
 240: npm run build                    # writes frontend/dist/ (FastAPI serves it at / with an SPA fallback)
 241: ```
 242: 
 243: ## Layout (source of truth)
 244: 
 245: - `samagra/adapters/` â€” read-only source adapters â†’ common `Artifact` (incl. Phase 1 `mcd.py`, `munshi.py`).
 246: - `samagra/clients/` â€” read-only subsystem HTTP clients: `McdClient` (mycontentdev admin API), `MunshiClient` (`library()`); secret-safe, never logged.
 247: - `samagra/governance/store.py` â€” Phase 2 durable `governance.db` store (D6): `assignments`, `events`, `review_overlay` + `schema_version`/migration hook + `backup()`. **Never delete `governance.db` as a "catalog reset".**
 248: - `samagra/review/` â€” Phase 2 advisory pre-commit Codex review (D5): `codex_dispatch.py` (vendored subprocess shim, lazy exe) + `precommit.py` (confirmed-CRITICAL + `state/review/` diff-hash cache + `SAMAGRA_REVIEW_BREAKGLASS` audit). CLI: `samagra review-staged`.
 249: - `.githooks/pre-commit` â€” committed shim â†’ `python -m samagra.review.precommit`. Activate (owner) with `git config core.hooksPath .githooks`.
 250: - `board/{deepak,khanak,codex}/` â€” per-agent `AGENTS.md` + `outbox/` (indexed by `assignments`).
 251: - `samagra/catalog.py` â€” `samagra.db` unified catalog (FTS5) + search/overview/facets.
 252: - `samagra/state.py` â€” phase state machine; `state/<pipeline>.orchestrator_state.json` + `tracker.txt`.
 253: - `samagra/scheduler.py` â€” `tick()`, `gate()`, Task Scheduler installer.
 254: - `samagra/notify.py` â€” Telegram + email (creds-gated, always logs `state/notifications.log`).
 255: - `samagra/lectures/` â€” `render.py` (content.jsonâ†’HTML), `thin.py`, `export.py` (HTML/DOCX/GDocs), `gdocs.py`.
 256: - `samagra/api/app.py` â€” FastAPI; serves the Vite build at `/` (mounts `frontend/dist/assets`, SPA fallback `GET /{full_path}` declared LAST, 404s `api/*`, 503 if not built); `/api/*`, `/lecture/{slug}`, `/open` are a frozen contract.
 257: - `frontend/` â€” **SAMAGRA OS E1 + fidelity layer** (React 18 + TS + Vite; own `package.json`, lockfile tracked, `dist/` gitignored). `src/lib/**` = pure headless-testable engines (WM geometry/z-order, snake, clock, terminal, notes, persistence) each co-located with a `*.test.ts`; `src/stores/**` = thin Zustand over `lib/`; `src/themes/**` = the per-theme token map (aqua/console/samagra â€” **FD1**); `src/components/{Icon,AppIcon}.tsx` = the SVG icon system (**FD2**, `icons-data.ts`); `src/shell/**` = theme-driven chrome (`ThemeRoot` Â· `TopBar` Â· `Dock` Â· `Taskbar` Â· `StartMenu` Â· `Rail` Â· `WindowFrame` Â· `ContextMenu`); `src/apps/**` = the six OS utilities; `src/registry.ts` = the frozen 17-app table.
 258: 
 259: ## Sources (read-only, paths in samagra/config.py / .env)
 260: 
 261: QX `C:\SandBox\gpt_box\gpt-extract-ques` Â· textbook `C:\SandBox\gpt_box\physics-textbook`
 262: Â· booklets `claude-booklet-proofer` Â· INSP `claude-INSP-extract` Â· sims `pratyaksh-May-deploy` (never write).
 263: 
 264: ## Gotchas
 265: 
 266: - Python 3.11 venv (`.venv`) for the portal; system Python is 3.14 (stdlib-only CLI works there too).
 267: - Do **not** use `uvicorn --reload` here â€” an orphaned reload worker held the port once. Use the preview harness or plain uvicorn.
 268: - QX `subject` column is unpopulated (physics-only); facet on chapter/q_type instead. **(Directly relevant to the âš  KNOWN BUG â€” `/api/facets.subjects` is catalog-wide, so the Questions chips surface sims `SIM0xxx` ids, not question subjects.)**
 269: - DOCX math: Pandoc `html+tex_math_dollars` converts `$...$` â†’ OMML (verified: 130 eqns in vectors-thick).
 270: - Don't write to `physics-textbook/queue.json` â€” SAMAGRA tracks approvals in its own `state/`.
 271: 
 272: ## Open / needs user consent
 273: 
 274: **SAMAGRA OS (Experience track):**
 275: - **E2 (2026-06-21): MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main`** â€” the 11 data apps
 276:   + `GET /api/org`, after a Codex pre-merge review (GO; 3 MEDIUMs fixed) (backend 106/106 + frontend 501/501).
 277:   Owner to-do = the browser-vision pixel-QA pass over the 11 E2 apps, then E3 (see the â–¶ STATUS banner above for
 278:   the full E2 write-up). The E1 detail below is retained for history.
 279: 0. **E1 BUILT + GREEN + 3-theme/icon fidelity layer landed (2026-06-20) on `e1/samagra-os`.** The full
 280:    `frontend/` app shipped TDD (E1.1â€“E1.25); a fidelity layer then added theme-driven chrome for **aqua Â·
 281:    console Â· samagra** (all colours/sizes from the `themes/` token map â€” FD1) and the `Icon`/`AppIcon` SVG
 282:    system (FD2) across every launcher + the six apps. **QA1 fidelity gate clean:** `npm run verify` (lint +
 283:    `tsc` + **439 Vitest / 38 files** + `vite build`, no `.only`/`.skip`) and backend `pytest` 102/102 (incl.
 284:    `test_serve_seam.py`). **Owner to-do now:** (a) the **browser-vision pixel QA pass** over the three-theme
 285:    shell + apps (pixel/interaction parity â€” outside any loop, never a loop gate; **NOT yet run â€” pixel parity
 286:    NOT claimed**); (b) the merge/integration decision for `e1/samagra-os` (see
 287:    `superpowers:finishing-a-development-branch`). **Next build = E2** (data/control apps â€” read-only wiring
 288:    over `/api/*`; one hard backend gap = `GET /api/org` via static `samagra/org.py`). **No new creds needed**
 289:    (the GUI reads existing `/api/*`); E2's mcd/munshi apps render graceful creds-gated empty states.
 290: 
 291:    **Browser-vision pixel QA sign-off (fidelity boundary â€” owner-run, RUBRIC Â§6).** Per spec Â§7.4/Â§10-item-9
 292:    and `docs/superpowers/loops/RUBRIC.md` Â§6, pixel & interaction parity is a **human / browser-vision QA
 293:    pass, never a loop gate** â€” run once per surface with `npm run dev` (Vite :5173) or a built `samagra
 294:    serve`, against the extracted prototype + `screenshots/`. The owner (deepak) signs each row here. **Status:
 295:    all rows PENDING** (logic green, theming + icon wiring green, build green â€” *not yet* "looks right"; the
 296:    headless gate proves the markup/tokens/icons, not the pixels). Surfaces:
 297:    - [ ] **Theme chrome (Ã—3)** â€” aqua (top bar **30px** Â· bottom-centre Dock **radius 20** + hover lift Â· left traffic-lights), console (no top bar Â· bottom Taskbar **50px** + Start menu Â· right-side neon icon controls Â· active glow ring), samagra (Devanagari **à¤¸à¤®à¤—à¥à¤°** top strip Â· left **Rail 66px** + active accent bar Â· warm window frame). WindowFrame radii aqua **13** / console **10** / samagra **15**; **38px** title bar; right controls 28Ã—23; double-click maximize; ContextMenu **width 216**.
 298:    - [ ] **Icons (FD2)** â€” every dock/rail/Start/app glyph is an inline 24Ã—24 stroke `<svg>` via `Icon`/`AppIcon` (no letter badges); per-app accent colours from `APPS[id].accent`.
 299:    - [ ] **Dashboard** â€” hero-stat layout, pipeline-bar density, board + recent-activity spacing.
 300:    - [ ] **Settings** â€” Appearance (3 theme swatch cards) / Device toggle / Integration rows; pill active vs needs-creds states; this is the production theme + device switcher.
 301:    - [ ] **Terminal** â€” prompt rendering, line-class colors from the per-theme palette, welcome banner.
 302:    - [ ] **Clock** â€” hand sweep, ring depletion, chime, tab visuals.
 303:    - [ ] **Notes/To-dos** â€” list/editor split, "â— Autosaved" footer, filter chrome.
 304:    - [ ] **Snake** â€” movement feel, speed ramp, death visuals, D-pad, themed board (cream in samagra).
 305:    - [ ] **Components** â€” Pill/Card/Chip/IconButton accent + spacing parity across all three themes.
 306: 
 307: **Phase-2 owner-gated â€” ALL DONE (2026-06-19):**
 308: 1. **Pre-merge Codex review â†’ APPROVE** (gpt-5.5, xhigh): 6 rounds + a CEO adversarial Workflow audit. Caught a never-wedge HIGH, a recurring "outer guard downgrades a confirmed-CRITICAL block" class (5 ever-deeper instances: cache prune, malformed cached findings, broken-stderr warnings, pathological exception str/repr, and a finding's raising `__eq__` on the dedup), + 2 MEDIUM + nits â€” all fixed TDD (+11 invariant regressions, suite 98). Reports `docs/codex-reviews/07â€“13` + `12-workflow-invariant-audit.md`.
 309: 2. **Hook ACTIVE** â€” `core.hooksPath=.githooks` set; every commit + worktree now runs the advisory gate (`codex` 0.140.0 on PATH).
 310: 3. **Worktrees created** â€” `../samagra-{deepak,khanak,codex}` on `agent/{deepak,khanak,codex}`.
 311: 4. **Pushed** â€” `origin/main` holds Phase 2 through `da9cab3`. (NOTE: this end-of-session tracker-sync commit is local-only/unpushed â€” `git push origin main` it at the start of the next session.)
 312: 
 313: **Creds (slice-1, unchanged):**
 314: 5. **Notification creds** â€” fill `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` + gmail `SMTP_PASS` in `.env`.
 315: 6. **Google Docs** â€” set `GOOGLE_OAUTH_CLIENT` (Desktop OAuth JSON); run an export to complete consent flow.
 316: 7. **Phase 3 munshi** â€” drop `MUNSHI_API_URL` + `MUNSHI_SECRET` into `.env` (live worker secret value) to switch on the active loop's munshi reads. mcd already reads live via `mcd-cloud.json`.
 317: 
 318: ## Slice 2 (planned)
 319: 
 320: Real worker dispatch for `questions`/`papers`/`media` pipelines (Codex/Gemini/NotebookLM/Grok);
 321: deploy QX + portal online (HF Space `QuestionDB` / Docker).

 succeeded in 1017ms:
   1: # SAMAGRA control plane â€” Capture + read-only surfaces (Design Spec)
   2: 
   3: > **Status:** Design artifact (no code). Authored 2026-06-21.
   4: > **Decision basis:** Chairman directive 2026-06-21 â€” *"wire all the remaining apps (munshi and
   5: > mycontentdev), pratyaksh sims (only the deployed ones) and QX browser separate. check everything
   6: > (independent codex review for each implementation). At the end I should have the full samagra
   7: > control plane working (real captures end to end) and browsing all the read-only surfaces."*
   8: > **Inputs read & verified (live where noted):** `samagra/clients/{munshi_client,mcd_client}.py`,
   9: > `samagra/adapters/{munshi,mcd,sims,qx}.py`, `samagra/api/app.py`, the 4 frontend apps
  10: > (`Munshi`, `Mycontentdev`, `Sims`, `Questions`), `myProd/src/index.ts` (munshi Worker â€” auth +
  11: > write routes), `mycontentdev/server/app.mjs` (seed routes + auth), and `pratyaksh-May-deploy/`
  12: > (`deployed-sims.md`, `deployed-sims-by-grade.md`, `wrangler.toml`, `public/sims/`).
  13: > **Live-verified this session:** munshi prod `GET /api/library` over the cookie secret returned
  14: > 13 items / 12 people; item shape `{id,kind,payload,person,due,tags,status,ts}`; nothing fronts
  15: > the Worker (cookie alone authorizes).
  16: 
  17: This spec is the **what + why + where**. The phased, paste-ready **how** lives in the companion
  18: implementation plan (`docs/superpowers/plans/2026-06-21-samagra-control-plane-capture.md`).
  19: 
  20: ---
  21: 
  22: ## 0. The DEC-3 amendment (Chairman, 2026-06-21)
  23: 
  24: This track **deliberately reopens write paths that DEC-3 firewalled earlier the same day.** Recorded
  25: as a Chairman amendment, not a silent reversal:
  26: 
  27: - **AMEND DEC-3.** *Owner-initiated capture* becomes **in-scope**: the OS may create a **munshi
  28:   front-desk item** (`POST /api/item`) and a **mycontentdev seed** (`POST /api/seeds`). These are
  29:   the only two new subsystem write paths.
  30: - **Unchanged & still binding:** the **human publish gate stays never-automated** (the sole sacred
  31:   mutation); **no automated munshiâ†’mcd bridge** (promotion happens only on an explicit later
  32:   Chairman request); **no app-platform scope** (DEC-1); the **attention-ROI north-star +
  33:   kill-criterion** (DEC-2) and the **pre-E3 attention-ROI gate** (DEC-4) remain binding; Phase 3's
  34:   full active loop (auto-proposal, scheduling) stays parked (DEC-5).
  35: - **New invariant wording:** *"read-only **except owner-initiated capture**."* Every other backend
  36:   touch in this track is read-only.
  37: 
  38: This amendment is recorded across `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, both OS specs,
  39: `CLAUDE.md`, and project memory (Slice 5).
  40: 
  41: ---
  42: 
  43: ## 1. Overview & goal
  44: 
  45: Make the SAMAGRA OS the **working control plane**: real captures flow *out* to the live subsystems,
  46: and every read-only surface browses *real* data.
  47: 
  48: Four functional outcomes:
  49: 
  50: 1. **Munshi capture (write).** From the Munshi app, the owner captures a front-desk item
  51:    (`todo` / `note` / `followup` â€” the deterministic kinds the worker accepts) written to the **live prod munshi Worker**
  52:    and appears in `library()`.
  53: 2. **mycontentdev seed capture (write).** From the mycontentdev app, the owner creates a **seed**
  54:    (type + title + raw_text) written to the **live mycontentdev** backend.
  55: 3. **Simulations = deployed-only.** The Sims app shows **only the 482 deployed sims** (from the
  56:    pratyaksh deploy manifest) with live `pratyakshsims.com` links â€” not the local folder scan.
  57: 4. **QX browser, separate + correct.** The Questions app stays a standalone **read-only** QX
  58:    browser, and its **subject facets bug is fixed** (question-scoped subjects, not catalog-wide
  59:    `SIM0xxx` ids).
  60: 
  61: The **linchpin discipline holds**: all real logic lives in pure, headlessly-tested TS modules +
  62: read-only-or-creds-gated Python; React components/endpoints are thin. Each implementation gets an
  63: **independent Codex review** before it is accepted.
  64: 
  65: ---
  66: 
  67: ## 2. Scope â€” six slices
  68: 
  69: Slices run **sequentially on one branch** (`feature/control-plane-capture`). Rationale: the writes
  70: hit production, `samagra/api/app.py` is a shared file every slice appends to, and "independent
  71: codex review for each implementation" maps cleanly to one review per finished slice. Correctness
  72: over wall-clock.
  73: 
  74: | # | Slice | Kind | Independent Codex review |
  75: |---|---|---|---|
  76: | 1 | Munshi capture (write) | write | âœ… |
  77: | 2 | mycontentdev seed capture (write) | write | âœ… |
  78: | 3 | Sims â€” deployed-only (read) | read | âœ… |
  79: | 4 | QX facets fix (read) | read | âœ… |
  80: | 5 | Decision record + pointer-file sync | docs | â€” (doc consistency check) |
  81: | 6 | Live end-to-end verification | verify | final integrated review |
  82: 
  83: ---
  84: 
  85: ## 3. Non-goals
  86: 
  87: - **No automated munshiâ†’mcd bridge.** Promotion of a munshi item into an mcd seed is a manual,
  88:   later, explicit Chairman action â€” not built here.
  89: - **No publish automation.** The human publish/approve gate is untouched and never automated.
  90: - **No new write paths beyond the two capture endpoints.** No edit/delete/status-change of munshi
  91:   items or mcd seeds from the OS in this track (the underlying APIs exist, but they stay out of
  92:   scope until asked).
  93: - **No active-loop scheduling.** No tick, no auto-proposal, no `scheduler` changes. Phase 3 stays
  94:   parked.
  95: - **No catalog schema change.** `samagra.db` / `governance.db` untouched. New reads either query
  96:   the catalog or parse a manifest / call QX directly.
  97: - **No pixel-fidelity gate in the loop.** Visual parity is a separate owner pass (consistent with
  98:   the OS spec Â§7.4). The capture composers reuse existing component patterns.
  99: 
 100: ---
 101: 
 102: ## 4. Architecture
 103: 
 104: ### 4.1 The write seam (new)
 105: 
 106: ```
 107: React app  â”€â”€POST /api/munshi/captureâ”€â”€â–º  FastAPI route  â”€â”€â–º  MunshiClient.create_item â”€â”€â–º  munshi Worker  POST /api/item   (cookie)
 108: React app  â”€â”€POST /api/mcd/seedsâ”€â”€â”€â”€â”€â”€â–º  FastAPI route  â”€â”€â–º  McdClient.create_seed   â”€â”€â–º  mycontentdev    POST /api/seeds  (x-mcd-key)
 109: ```
 110: 
 111: - **Single origin.** The frontend only ever calls SAMAGRA's own FastAPI (`/api/*`); FastAPI holds
 112:   the secrets and talks to the subsystems server-side. No subsystem secret ever reaches the browser.
 113: - **Creds-gated.** Each write route returns **503** with a clear message when its client
 114:   `available()` is false (no crash, graceful UI).
 115: - **Validated server-side.** Reject empty/invalid `kind` (munshi) / `type` (mcd) with **400**.
 116: - **Secret-safe.** Clients never log/`repr` secret values (already true for reads; preserved for
 117:   writes).
 118: 
 119: ### 4.2 The linchpin â€” pure TS modules (new)
 120: 
 121: | Pure module | Owns | Headlessly testable because |
 122: |---|---|---|
 123: | `lib/capture/munshi.ts` | `buildMunshiCapture(form) â†’ {ok, body} \| {ok:false, error}`: kind enum (`todo`/`note`/`followup` only), per-kind required fields (`todo`â†’assignee+task, `note`â†’student+issue, `followup`â†’date+note), per-kind optional passthrough (due/label/person), non-empty validation | pure `(formState) â†’ result`; assert per-kind body shape + missing-field error |
 124: | `lib/capture/seed.ts` | `buildSeed(form) â†’ {ok, body} \| {ok:false, error}`: type enum (`concept/question/snippet/simulation_idea/experiment/notebooklm_link/rough_idea`), title-optional-derive-from-raw_text, raw_text required | pure; assert body + validation |
 125: | `lib/sims/deployed.ts` | shape/sort/filter/search over the deployed-sims rows returned by `GET /api/sims` (group by grade/subject, text filter) | pure array transforms over plain rows |
 126: 
 127: QX facets need no new TS logic module â€” the existing `lib/questions/facets.ts` is reused; only the
 128: endpoint the app reads changes.
 129: 
 130: ### 4.3 The write hook (new, thin)
 131: 
 132: `hooks/useApiPost.ts` â€” a minimal POST companion to `useApi` (GET-only today): `post(path, body)`
 133: â†’ `{loading, error, data, post}`; JSON in/out; surfaces non-2xx as an error string. No retry, no
 134: caching. Components call `buildX(form)` (pure) â†’ `post(...)` â†’ on success refetch the read list.
 135: 
 136: ### 4.4 Components stay thin
 137: 
 138: - **Munshi app** gains a **capture composer** (kind `<select>` of `todo`/`note`/`followup` +
 139:   the selected kind's per-field inputs + Capture button) above the existing read-only library list.
 140:   Submit â†’ `buildMunshiCapture` â†’ `POST /api/munshi/capture` â†’ refetch `library()`. *(Mic/photo FAB
 141:   from the prototype is **not** in scope â€” text capture only; noted as a future option.)*
 142: - **mycontentdev app** gains a **New seed composer** (type `<select>` + title `<input>` +
 143:   raw_text `<textarea>` + Create button) â†’ `buildSeed` â†’ `POST /api/mcd/seeds` â†’ refetch.
 144: - **Sims app** is rewired to `GET /api/sims` (deployed manifest), rendering grade/subject groups,
 145:   a search box, and live links. The old `/api/search?source=sims` path + `SIM0xxx` subject chips
 146:   are removed.
 147: - **Questions app** reads `GET /api/questions/facets` for its subject chips instead of the
 148:   catalog-wide `/api/facets`.
 149: 
 150: ---
 151: 
 152: ## 5. Verified contracts (per slice)
 153: 
 154: ### Slice 1 â€” Munshi capture
 155: 
 156: - **Read (live-verified):** `GET /api/library` (cookie `munshi=<urlencoded secret>`) â†’
 157:   `{items[], people[], total}`; item `{id,kind,payload,person,due,tags,status,ts}`.
 158: - **Write (grounded `agent.ts:227-236` + `tools.ts`):** `POST {MUNSHI_API_URL}/api/item` (same
 159:   cookie; `content-type: application/json`), **flat JSON** body `{kind, ...fields}`. The worker
 160:   accepts **only** `kind âˆˆ {todo, note, followup}` (others â†’ 400) with kind-specific fields:
 161:   `todo`â†’`{assignee, task, due?}`, `note`â†’`{student, issue, label?}`, `followup`â†’`{date, note, person?}`.
 162: - **Client:** add `MunshiClient.create_item(kind, fields)` â†’ `POST /api/item` with
 163:   `json={"kind": kind, **fields}`, reusing the existing `_cookie()` auth. Secret never logged.
 164: - **FastAPI:** `POST /api/munshi/capture` â€” body `{kind, ...fields}`; validates `kind` âˆˆ the three
 165:   + that each kind's required fields are non-empty (400 otherwise), 503 if unavailable, returns the
 166:   created item.
 167: 
 168: ### Slice 2 â€” mycontentdev seed capture
 169: 
 170: > **Live-verified this session (deployed `mycontentdev.pages.dev`):** the **existing `adminKey`**
 171: > (header `x-mcd-admin`) authorizes `/api/seeds` â€” `GET /api/seeds?limit=1` returned 200 with real
 172: > rows. `functions/_middleware.js` gates `/api/*` on `keyOk` (APP_PASSWORD) **OR** `adminOk`
 173: > (ADMIN_KEY), and `functions/api/seeds/index.js` adds **no** per-route re-check â€” so the seed
 174: > *write* is authorized by the same `adminKey` reads already use. **No `APP_PASSWORD` / `MCD_APP_KEY`
 175: > is needed.** (`ADMIN_KEY` is the intended Claude-session write credential.)
 176: 
 177: - **Write (contract read from deployed `functions/api/seeds/index.js`):** `POST {apiUrl}/api/seeds`
 178:   with header **`x-mcd-admin: <adminKey>`**, body as **`multipart/form-data` / form-encoded**
 179:   (the worker calls `request.formData()` â€” **not** JSON): fields `type` (required), `raw_text`,
 180:   `title?` (server-derives from `raw_text` when blank), `detail?` (a JSON *string*), `source_ref?`,
 181:   `files?` (**out of scope â€” text-only capture**) â†’ **201** with the seed.
 182: - **Client:** add `McdClient.create_seed(fields: dict)` â†’ `requests.post(.../api/seeds,
 183:   headers={"x-mcd-admin": adminKey}, data=fields)` (form-encoded; let `requests` set the content
 184:   type â€” **do not** send JSON). Reuses the already-resolved `adminKey`; never logs it. *(The
 185:   evolution-plan draft that POSTed JSON with `x-mcd-key` is superseded by this verified contract.)*
 186: - **FastAPI:** `POST /api/mcd/seeds` â€” body `{type, title?, raw_text, detail?, source_ref?}`; 503
 187:   when `McdClient.available()` is false (admin creds absent), 400 on bad/empty `type` or `raw_text`,
 188:   returns the created seed.
 189: 
 190: ### Slice 3 â€” Sims (deployed-only)
 191: 
 192: - **Source:** `pratyaksh-May-deploy/deployed-sims-by-grade.md` (grade â†’ subject â†’ `- <id> â€” <title>`
 193:   for all 482). Fallback/complement: `deployed-sims.md` (flat id+title).
 194: - **URL:** `https://pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim.html` where `<NNNN>` is the
 195:   zero-padded id (`0018` â†’ `SIM0018`). **Confirm the canonical public link** (`/sims/SIM0018/`
 196:   vs the explicit `_sim.html`) against `public/_redirects` / `public/_worker.js` in the build.
 197: - **Parser:** `samagra/sims_manifest.py` â€” pure `parse_deployed_sims(text) â†’ [{id,title,subject,
 198:   grade}]`; testable against a fixture string.
 199: - **FastAPI:** `GET /api/sims` â†’ `{sims:[{id,title,subject,grade,url}], total}` (manifest read +
 200:   cached; SITE_URL base `https://pratyakshsims.com`). Read-only; absent manifest â†’ empty list, not
 201:   a crash.
 202: 
 203: ### Slice 4 â€” QX facets fix
 204: 
 205: - **Cause (already diagnosed):** `/api/facets.subjects` is catalog-wide (`catalog.py:191`), and
 206:   `adapters/sims.py:37` writes `SIM0xxx` folder ids into `subject`, so the chips are dominated by
 207:   sim ids and clicking one yields 0 QX rows.
 208: - **Fix (read-only, durable):** `GET /api/questions/facets` â†’
 209:   `qx.summary()`-derived **question-scoped** `{subjects, chapters, q_types}` (`adapters/qx.py:57`).
 210:   Empty/absent QX â†’ empty lists. The Questions app reads this instead of `/api/facets`.
 211: 
 212: ---
 213: 
 214: ## 6. Safety model
 215: 
 216: - **Owner-initiated only.** Both writes fire on an explicit button click in the owner's console.
 217:   Per the approved default, capture submits **directly on click** (no extra confirm dialog); the
 218:   button label is the confirmation. (Trivially upgradable to a confirm step if desired.)
 219: - **Server holds secrets.** Browser never sees a subsystem secret; FastAPI is the only caller of
 220:   the clients.
 221: - **Creds-gated, never crash.** Missing creds â†’ 503 + a clear empty/disabled composer state.
 222: - **Validated + bounded.** Server validates kind/type and non-empty text; reasonable length caps.
 223: - **Publish gate sacred.** No publish/approve automation anywhere in this track.
 224: - **No secret logging.** Preserved from the read clients; asserted in tests.
 225: 
 226: ---
 227: 
 228: ## 7. Testing strategy
 229: 
 230: Per slice: **RED â†’ GREEN â†’ VERIFY â†’ independent Codex review â†’ fix**, one focused commit per step.
 231: 
 232: - **pytest** (`.venv\Scripts\python -m pytest -q`, PYTHONPATH=repo root): client write methods with
 233:   a **mocked** `requests` (assert URL, method, headers incl. cookie/`x-mcd-key`, body, secret never
 234:   logged); new routes via FastAPI `TestClient` with a **mocked client** (assert 201/200, 400 on bad
 235:   input, 503 when unavailable). The sims manifest parser tested against a fixture string. **No live
 236:   HTTP in the test suite.**
 237: - **Vitest** (`npm run verify` = lint â†’ tsc â†’ vitest â†’ build): pure `lib/capture/*` + `lib/sims/
 238:   deployed.ts` assertions (body shapes, validation, grouping); thin component smoke tests (composer
 239:   renders, submit calls `post`, list refetches; Sims renders deployed rows + links; Questions reads
 240:   the new facets path).
 241: - **Gate:** backend `pytest` green + frontend `npm run verify` green, no `.only`/`.skip`.
 242: - **Live (Slice 6, outside the unit suite):** real munshi capture round-trip (write â†’ it appears in
 243:   `library()`), real mcd seed create (once `MCD_APP_KEY` is provided), deployed-sims links resolve,
 244:   QX facets show real subjects â€” with preview/screenshot proof.
 245: 
 246: ---
 247: 
 248: ## 8. Execution & review model
 249: 
 250: - **Branch:** `feature/control-plane-capture` off `main`. Sequential slices; one focused commit per
 251:   RED/GREEN/VERIFY/review-fix step; Conventional Commits ending with the `Co-Authored-By` trailer.
 252: - **Independent Codex review per slice** (the established pattern: `codex exec`, gpt-5.5 / xhigh,
 253:   adversarial prompt scoped to that slice's diff). Findings are triaged via
 254:   `superpowers:receiving-code-review` and fixed TDD before the slice is accepted. Reports saved
 255:   under `docs/codex-reviews/`.
 256: - **Advisory pre-commit gate** stays active (`core.hooksPath=.githooks` â†’ `samagra review-staged`);
 257:   never `--no-verify`, never self-break-glass.
 258: - **Orchestration:** a Workflow drives the slice pipeline (build â†’ per-slice Codex review â†’ triage),
 259:   with the main session running the **live** verification (Slice 6) since it needs `.env` creds and
 260:   a browser preview.
 261: - **Merge:** after all slices + the final integrated review, present the
 262:   `superpowers:finishing-a-development-branch` options (PR per the usual flow).
 263: 
 264: ---
 265: 
 266: ## 9. Creds & operational dependencies
 267: 
 268: | Cred | For | Status |
 269: |---|---|---|
 270: | `MUNSHI_API_URL` + `MUNSHI_SECRET` | munshi read **and** capture write | âœ… in `.env` (prod Worker; live-verified read) |
 271: | `mcd-cloud.json` `adminKey` | mcd **reads** *and* **seed write** | âœ… present; live-verified to authorize `/api/seeds` |
 272: | ~~`MCD_APP_KEY` / `APP_PASSWORD`~~ | ~~mcd write~~ | âŒ **not needed** â€” `adminKey` authorizes the write (verified); the legacy `test-my-ship` candidate was rejected by `/api/auth/status` |
 273: | (none) | sims, QX | read existing local sources / live QX |
 274: 
 275: **All creds for both capture paths are in place** â€” the full live end-to-end verification (Munshi
 276: *and* mcd) can run this session.
 277: 
 278: ---
 279: 
 280: ## 10. Risks & mitigations
 281: 
 282: | Risk | Mitigation |
 283: |---|---|
 284: | Writing to **production** munshi/mcd | Server-side validation, creds-gating, owner-initiated only, no delete/edit/publish; live verification done deliberately in Slice 6 with the owner |
 285: | `/api/item` body shape guessed wrong | Ground it against `myProd/src/agent.ts` + `tools.ts insertItem` before writing live; unit-test the built body; first live write is a single benign item the owner can dismiss |
 286: | mcd write auth (which key?) | **Resolved** â€” deployed middleware accepts `adminKey` for `/api/seeds` (live-verified GET 200); no per-route re-check. `create_seed` uses `x-mcd-admin: adminKey`. First live write is a single benign seed the owner can archive |
 287: | mcd seed body format | **Resolved** â€” deployed worker uses `request.formData()`, so `create_seed` sends form-encoded, not JSON (the plan's JSON draft would have failed) |
 288: | Sims URL form wrong â†’ dead links | Confirm canonical link against `public/_redirects`/`_worker.js`; the link is the only externally-visible artifact, easy to eyeball in Slice 6 |
 289: | Secret leakage | Browser never receives secrets; clients never log values; tests assert `repr`/log safety |
 290: | Shared `app.py` churn across slices | Sequential slices on one branch â€” additive route appends, no parallel edits |
 291: | Scope creep back toward the active loop | Explicit non-goals (Â§3); no scheduler/bridge/publish work |
 292: 
 293: ---
 294: 
 295: ## 11. Acceptance criteria
 296: 
 297: This track is **done** when:
 298: 
 299: 1. **Munshi capture works live** â€” a capture submitted from the OS appears in the prod munshi
 300:    `library()` (verified Slice 6).
 301: 2. **mcd seed capture works live** â€” a seed created from the OS appears via the mcd read path
 302:    (`adminKey` authorizes the write; no extra cred needed).
 303: 3. **Sims shows only the 482 deployed sims** with working `pratyakshsims.com` links; the local
 304:    `SIM0xxx` scan + bogus subject chips are gone.
 305: 4. **Questions facets fixed** â€” subject chips are real question subjects (no `SIM0xxx`), and
 306:    selecting one returns QX rows; QX browser remains standalone read-only.
 307: 5. **Each implementation passed an independent Codex review**, findings triaged + fixed; reports in
 308:    `docs/codex-reviews/`.
 309: 6. **Gates green** â€” backend `pytest` + frontend `npm run verify`, no `.only`/`.skip`; advisory
 310:    pre-commit gate clean (no break-glass).
 311: 7. **DEC-3 amendment + pointer files synced** â€” `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, both
 312:    OS specs, `CLAUDE.md`, and project memory record the amendment and the new
 313:    "read-only except owner-initiated capture" invariant.
 314: 8. **Branch integrated** per `superpowers:finishing-a-development-branch` (PR per the usual flow).

2026-06-21T18:37:47.218951Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 1.4 seconds
Output:
curl.exe :   % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current
At line:2 char:7
+ try { curl.exe -I -L --max-redirs 0 --connect-timeout 10 https://prat ...
+       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ... Time   Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload  Total   Spent   Left   Speed
  0      0   0      0   0      0      0      0                              0
curl: (7) Failed to connect to pratyakshsims.com port 443 after 292 ms: Could not connect to server

 exited 1 in 1367ms:
curl.exe :   % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current
At line:2 char:7
+ try { curl.exe -I -L --max-redirs 0 --connect-timeout 10 https://prat ...
+       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ... Time   Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload  Total   Spent   Left   Speed
  0      0   0      0   0      0      0      0                              0
curl: (7) Failed to connect to pratyakshsims.com port 443 after 292 ms: Could not connect to server

2026-06-21T18:37:47.292748Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 1.2 seconds
Output:
curl.exe :   % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current
At line:2 char:7
+ try { curl.exe -I --max-redirs 0 --connect-timeout 10 https://pratyak ...
+       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ... Time   Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload  Total   Spent   Left   Speed
  0      0   0      0   0      0      0      0                              0
curl: (7) Failed to connect to pratyakshsims.com port 443 after 6 ms: Could not connect to server

 exited 1 in 1198ms:
curl.exe :   % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current
At line:2 char:7
+ try { curl.exe -I --max-redirs 0 --connect-timeout 10 https://pratyak ...
+       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ... Time   Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload  Total   Spent   Left   Speed
  0      0   0      0   0      0      0      0                              0
curl: (7) Failed to connect to pratyakshsims.com port 443 after 6 ms: Could not connect to server

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content frontend'"\\src\\apps\\Munshi\\index.test.tsx | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content frontend'"\\src\\apps\\Mycontentdev\\index.test.tsx | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$env:PYTHONDONTWRITEBYTECODE='"'1'; .\\.venv\\Scripts\\python.exe -m pytest tests/test_api_live_reads.py tests/test_api_questions_facets.py tests/test_api_sims.py tests/test_sims_manifest.py tests/test_api_capture.py -q -p no:cacheprovider" in C:\SandBox\claude_box\TeachingOS
 succeeded in 600ms:
   1: import { render, screen, fireEvent, waitFor } from "@testing-library/react";
   2: import { vi, describe, it, expect, beforeEach } from "vitest";
   3: const useApiMock = vi.fn();
   4: vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
   5: import Munshi from "./index";
   6: 
   7: const data = { results: [
   8:   { uid: "m1", source: "munshi", kind: "todo", title: "Call vendor", subject: null,
   9:     unit: null, chapter: null, status: "open", path: null, url: null, updated_at: null, meta: {} },
  10: ] };
  11: 
  12: describe("Munshi app", () => {
  13:   beforeEach(() => useApiMock.mockReset());
  14:   it("reads /api/munshi/library (live) and lists items", () => {
  15:     useApiMock.mockReturnValue({ data, loading: false, error: null });
  16:     render(<Munshi />);
  17:     expect(useApiMock).toHaveBeenCalledWith("/api/munshi/library");
  18:     expect(screen.getByTestId("munshi")).toBeInTheDocument();
  19:     expect(screen.getByText("Call vendor")).toBeInTheDocument();
  20:   });
  21:   it("creds-gated empty state when no rows", () => {
  22:     useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
  23:     render(<Munshi />);
  24:     expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/creds|available/i);
  25:   });
  26:   it("error inline + still mounts", () => {
  27:     useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
  28:     render(<Munshi />);
  29:     expect(screen.getByRole("alert")).toBeInTheDocument();
  30:     expect(screen.getByTestId("munshi")).toBeInTheDocument();
  31:   });
  32: });
  33: 
  34: describe("Munshi capture composer", () => {
  35:   beforeEach(() => {
  36:     useApiMock.mockReset();
  37:     useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
  38:     vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
  39:       Promise.resolve(new Response(
  40:         String(url).includes("/api/munshi/capture")
  41:           ? JSON.stringify({ ok: true, item: { item_id: 1 } })
  42:           : JSON.stringify({ results: [] }),
  43:         { status: 200, headers: { "content-type": "application/json" } })));
  44:   });
  45:   it("captures a todo", async () => {
  46:     render(<Munshi />);
  47:     fireEvent.change(screen.getByTestId("capture-kind"), { target: { value: "todo" } });
  48:     fireEvent.change(screen.getByLabelText("assignee"), { target: { value: "Ravi" } });
  49:     fireEvent.change(screen.getByLabelText("task"), { target: { value: "Call parent" } });
  50:     fireEvent.click(screen.getByTestId("capture-submit"));
  51:     await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/munshi/capture", expect.objectContaining({ method: "POST" })));
  52:   });
  53: });

 succeeded in 621ms:
   1: import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
   2: import { vi, describe, it, expect, beforeEach } from "vitest";
   3: const useApiMock = vi.fn();
   4: vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
   5: import Mcd from "./index";
   6: 
   7: const data = { results: [
   8:   { uid: "s1", source: "mycontentdev", kind: "concept", title: "Seed A", subject: null,
   9:     unit: null, chapter: null, status: "captured", path: null, url: "x", updated_at: null, meta: {} },
  10: ] };
  11: 
  12: describe("mycontentdev app", () => {
  13:   beforeEach(() => useApiMock.mockReset());
  14:   it("reads /api/mcd/seeds (live) and lists seeds", () => {
  15:     useApiMock.mockReturnValue({ data, loading: false, error: null });
  16:     render(<Mcd />);
  17:     expect(useApiMock).toHaveBeenCalledWith("/api/mcd/seeds");
  18:     expect(screen.getByTestId("mycontentdev")).toBeInTheDocument();
  19:     expect(screen.getByText("Seed A")).toBeInTheDocument();
  20:   });
  21:   it("creds-gated empty state when no rows", () => {
  22:     useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
  23:     render(<Mcd />);
  24:     expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/available|adminKey/i);
  25:   });
  26:   it("error inline + still mounts", () => {
  27:     useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
  28:     render(<Mcd />);
  29:     expect(screen.getByRole("alert")).toBeInTheDocument();
  30:     expect(screen.getByTestId("mycontentdev")).toBeInTheDocument();
  31:   });
  32:   it("captures a seed", async () => {
  33:     useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
  34:     const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
  35:       new Response(JSON.stringify({ ok: true, seed: { id: "s1", status: "captured" } }),
  36:         { status: 200, headers: { "content-type": "application/json" } }));
  37:     render(<Mcd />);
  38:     fireEvent.change(screen.getByTestId("seed-type"), { target: { value: "rough_idea" } });
  39:     fireEvent.change(screen.getByLabelText("raw_text"), { target: { value: "tidal locking demo" } });
  40:     fireEvent.click(screen.getByTestId("seed-submit"));
  41:     await waitFor(() => expect(spy).toHaveBeenCalledWith("/api/mcd/seeds", expect.objectContaining({ method: "POST" })));
  42:     spy.mockRestore();
  43:   });
  44:   it("ignores rapid double-submit (no duplicate production write)", async () => {
  45:     useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
  46:     let resolve!: (r: Response) => void;
  47:     const spy = vi.spyOn(globalThis, "fetch").mockReturnValue(
  48:       new Promise<Response>((r) => { resolve = r; }) as Promise<Response>);
  49:     render(<Mcd />);
  50:     fireEvent.change(screen.getByLabelText("raw_text"), { target: { value: "dup demo" } });
  51:     const btn = screen.getByTestId("seed-submit");
  52:     // Two clicks in the SAME synchronous tick â€” before React re-renders and the
  53:     // disabled={posting} flag can take effect. This is the production race
  54:     // (Enter+click / rapid double-click). A ref guard must block the second.
  55:     act(() => {
  56:       btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  57:       btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  58:     });
  59:     expect(spy).toHaveBeenCalledTimes(1);
  60:     resolve(new Response(JSON.stringify({ ok: true, seed: { id: "s1", status: "captured" } }),
  61:       { status: 200, headers: { "content-type": "application/json" } }));
  62:     await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  63:     spy.mockRestore();
  64:   });
  65: });

2026-06-21T18:37:58.517858Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 1.1 seconds
Output:
Traceback (most recent call last):
  File "<frozen runpy>", line 198, in _run_module_as_main
  File "<frozen runpy>", line 88, in _run_code
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pytest\__main__.py", line 9, in <module>
    raise SystemExit(_console_main())
                     ^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 253, in _console_main
    code = _main(prog=_get_prog_name(sys.argv))
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 223, in _main
    config = _prepareconfig(new_args, plugins, prog=prog)
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 410, in _prepareconfig
    config: Config = pluginmanager.hook.pytest_cmdline_parse(
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_hooks.py", line 512, in __call__
    return self._hookexec(self.name, self._hookimpls.copy(), kwargs, firstresult)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_manager.py", line 120, in _hookexec
    return self._inner_hookexec(hook_name, methods, kwargs, firstresult)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 167, in _multicall
    raise exception
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 139, in _multicall
    teardown.throw(exception)
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\helpconfig.py", line 124, in pytest_cmdline_parse
    config = yield
             ^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 121, in _multicall
    res = hook_impl.function(*args)
          ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 1232, in pytest_cmdline_parse
    self.parse(args)
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 1605, in parse
    self.hook.pytest_load_initial_conftests(
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_hooks.py", line 512, in __call__
    return self._hookexec(self.name, self._hookimpls.copy(), kwargs, firstresult)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_manager.py", line 120, in _hookexec
    return self._inner_hookexec(hook_name, methods, kwargs, firstresult)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 167, in _multicall
    raise exception
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 139, in _multicall
    teardown.throw(exception)
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\warnings.py", line 129, in pytest_load_initial_conftests
    return (yield)
            ^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 116, in _multicall
    next(function_gen)  # first yield
    ^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\capture.py", line 170, in pytest_load_initial_conftests
    capman.start_global_capturing()
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\capture.py", line 773, in start_global_capturing
    self._global_capturing = _get_multicapture(self._method)
                             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\capture.py", line 714, in _get_multicapture
    return MultiCapture(in_=FDCapture(0), out=FDCapture(1), err=FDCapture(2))
                                              ^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\capture.py", line 493, in __init__
    TemporaryFile(buffering=0),
    ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 562, in NamedTemporaryFile
    prefix, suffix, dir, output_type = _sanitize_params(prefix, suffix, dir)
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 127, in _sanitize_params
    dir = gettempdir()
          ^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 316, in gettempdir
    return _os.fsdecode(_gettempdir())
                        ^^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 309, in _gettempdir
    tempdir = _get_default_tempdir()
              ^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 224, in _get_default_tempdir
    raise FileNotFoundError(_errno.ENOENT,
FileNotFoundError: [Errno 2] No usable temporary directory found in ['C:\\Users\\abc\\AppData\\Local\\Temp', 'C:\\Users\\abc\\AppData\\Local\\Temp', 'C:\\Users\\abc\\AppData\\Local\\Temp', 'C:\\WINDOWS\\Temp', 'c:\\temp', 'c:\\tmp', '\\temp', '\\tmp', 'C:\\SandBox\\claude_box\\TeachingOS']

 exited 1 in 1109ms:
Traceback (most recent call last):
  File "<frozen runpy>", line 198, in _run_module_as_main
  File "<frozen runpy>", line 88, in _run_code
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pytest\__main__.py", line 9, in <module>
    raise SystemExit(_console_main())
                     ^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 253, in _console_main
    code = _main(prog=_get_prog_name(sys.argv))
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 223, in _main
    config = _prepareconfig(new_args, plugins, prog=prog)
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 410, in _prepareconfig
    config: Config = pluginmanager.hook.pytest_cmdline_parse(
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_hooks.py", line 512, in __call__
    return self._hookexec(self.name, self._hookimpls.copy(), kwargs, firstresult)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_manager.py", line 120, in _hookexec
    return self._inner_hookexec(hook_name, methods, kwargs, firstresult)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 167, in _multicall
    raise exception
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 139, in _multicall
    teardown.throw(exception)
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\helpconfig.py", line 124, in pytest_cmdline_parse
    config = yield
             ^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 121, in _multicall
    res = hook_impl.function(*args)
          ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 1232, in pytest_cmdline_parse
    self.parse(args)
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\config\__init__.py", line 1605, in parse
    self.hook.pytest_load_initial_conftests(
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_hooks.py", line 512, in __call__
    return self._hookexec(self.name, self._hookimpls.copy(), kwargs, firstresult)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_manager.py", line 120, in _hookexec
    return self._inner_hookexec(hook_name, methods, kwargs, firstresult)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 167, in _multicall
    raise exception
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 139, in _multicall
    teardown.throw(exception)
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\warnings.py", line 129, in pytest_load_initial_conftests
    return (yield)
            ^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\pluggy\_callers.py", line 116, in _multicall
    next(function_gen)  # first yield
    ^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\capture.py", line 170, in pytest_load_initial_conftests
    capman.start_global_capturing()
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\capture.py", line 773, in start_global_capturing
    self._global_capturing = _get_multicapture(self._method)
                             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\capture.py", line 714, in _get_multicapture
    return MultiCapture(in_=FDCapture(0), out=FDCapture(1), err=FDCapture(2))
                                              ^^^^^^^^^^^^
  File "C:\SandBox\claude_box\TeachingOS\.venv\Lib\site-packages\_pytest\capture.py", line 493, in __init__
    TemporaryFile(buffering=0),
    ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 562, in NamedTemporaryFile
    prefix, suffix, dir, output_type = _sanitize_params(prefix, suffix, dir)
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 127, in _sanitize_params
    dir = gettempdir()
          ^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 316, in gettempdir
    return _os.fsdecode(_gettempdir())
                        ^^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 309, in _gettempdir
    tempdir = _get_default_tempdir()
              ^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\abc\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\Lib\tempfile.py", line 224, in _get_default_tempdir
    raise FileNotFoundError(_errno.ENOENT,
FileNotFoundError: [Errno 2] No usable temporary directory found in ['C:\\Users\\abc\\AppData\\Local\\Temp', 'C:\\Users\\abc\\AppData\\Local\\Temp', 'C:\\Users\\abc\\AppData\\Local\\Temp', 'C:\\WINDOWS\\Temp', 'c:\\temp', 'c:\\tmp', '\\temp', '\\tmp', 'C:\\SandBox\\claude_box\\TeachingOS']

codex
The targeted pytest run was blocked before collection by this read-only environment’s missing writable temp directory, not by a test failure. I’m doing the remaining verification by static inspection and only treating issues as findings when they create a real behavioral or safety risk.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content frontend'"\\src\\apps\\Sims\\index.test.tsx | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content frontend'"\\src\\hooks\\useApi.ts | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content frontend'"\\src\\lib\\sims\\deployed.ts | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content frontend'"\\src\\apps\\Sims\\index.tsx | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content frontend'"\\src\\hooks\\useApiPost.ts | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 858ms:
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

 succeeded in 881ms:
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

 succeeded in 939ms:
   1: import { useState } from "react";
   2: import { useApi } from "../../hooks/useApi";
   3: import Icon from "../../components/Icon";
   4: import { filterSims, groupByGrade } from "../../lib/sims/deployed";
   5: import type { SimsResponse } from "../../types/contracts";
   6: 
   7: const V = {
   8:   text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
   9:   cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  10:   accent: "var(--samagra-accent)", font: "var(--samagra-font)",
  11: } as const;
  12: 
  13: export default function Sims() {
  14:   const { data, loading, error } = useApi<SimsResponse>("/api/sims");
  15:   const [query, setQuery] = useState("");
  16:   const rows = Array.isArray(data?.sims) ? data!.sims : [];
  17:   const groups = groupByGrade(filterSims(rows, query));
  18:   return (
  19:     <div data-testid="sims" style={{ padding: 20, fontFamily: V.font }}>
  20:       <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
  21:         <span style={{ color: V.accent, display: "inline-flex" }}>
  22:           <Icon name="sims" size={26} label="Simulations" />
  23:         </span>
  24:         <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Simulations</h1>
  25:       </header>
  26:       {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
  27:       <div style={{ marginTop: 10 }}>
  28:         <input
  29:           data-testid="sims-search"
  30:           aria-label="search"
  31:           placeholder="Search title, subject, or idâ€¦"
  32:           value={query}
  33:           onChange={(e) => setQuery(e.target.value)}
  34:           style={{ width: "100%", background: V.subBg, color: V.text, border: `1px solid ${V.line}`,
  35:                    borderRadius: 8, padding: "6px 10px", fontFamily: V.font, fontSize: 13 }}
  36:         />
  37:       </div>
  38:       <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 14, display: "grid", gap: 12 }}>
  39:         {groups.length === 0 ? (
  40:           <div data-testid="catalog-empty" style={{ color: V.muted }}>
  41:             {loading ? "Loadingâ€¦" : "No simulations to show."}
  42:           </div>
  43:         ) : groups.map((g) => (
  44:           <div key={g.grade}>
  45:             <div style={{ color: V.muted, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{g.grade}</div>
  46:             <div style={{ display: "grid", gap: 8 }}>
  47:               {g.rows.map((r) => (
  48:                 <article key={r.id} data-testid="catalog-row"
  49:                          style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
  50:                                   padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
  51:                   <div>
  52:                     <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
  53:                     <div style={{ color: V.muted, fontSize: 12 }}>{r.subject ?? ""}</div>
  54:                   </div>
  55:                   <a href={r.url} target="_blank" rel="noreferrer"
  56:                      style={{ color: V.accent, fontSize: 13, alignSelf: "center" }}>open</a>
  57:                 </article>
  58:               ))}
  59:             </div>
  60:           </div>
  61:         ))}
  62:       </section>
  63:     </div>
  64:   );
  65: }

 succeeded in 978ms:
   1: import { render, screen } from "@testing-library/react";
   2: import { vi, describe, it, expect, beforeEach } from "vitest";
   3: const useApiMock = vi.fn();
   4: vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
   5: import Sims from "./index";
   6: 
   7: const data = { sims: [
   8:   { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11",
   9:     url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
  10: ], total: 1 };
  11: 
  12: describe("Sims app", () => {
  13:   beforeEach(() => useApiMock.mockReset());
  14:   it("reads /api/sims and links rows to pratyakshsims.com", () => {
  15:     useApiMock.mockReturnValue({ data, loading: false, error: null });
  16:     render(<Sims />);
  17:     expect(useApiMock).toHaveBeenCalledWith("/api/sims");
  18:     expect(useApiMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/search?source=sims"));
  19:     expect(screen.getByTestId("sims")).toBeInTheDocument();
  20:     expect(screen.getByText("Vector Lab")).toBeInTheDocument();
  21:     const row = screen.getByTestId("catalog-row");
  22:     const link = row.querySelector("a");
  23:     expect(link).not.toBeNull();
  24:     expect(link!.getAttribute("href")).toContain("pratyakshsims.com");
  25:     // No SIM0xxx subject chips.
  26:     for (const chip of screen.queryAllByTestId("subject-chip")) {
  27:       expect(chip.textContent ?? "").not.toMatch(/^SIM\d/);
  28:     }
  29:   });
  30:   it("error inline + still mounts", () => {
  31:     useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
  32:     render(<Sims />);
  33:     expect(screen.getByRole("alert")).toBeInTheDocument();
  34:     expect(screen.getByTestId("sims")).toBeInTheDocument();
  35:   });
  36:   it("empty state when no rows", () => {
  37:     useApiMock.mockReturnValue({ data: { sims: [], total: 0 }, loading: false, error: null });
  38:     render(<Sims />);
  39:     expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  40:   });
  41: });

 succeeded in 999ms:
   1: import type { SimRow } from "../../types/contracts";
   2: export function filterSims(rows: SimRow[], q: string): SimRow[] {
   3:   const t = q.trim().toLowerCase();
   4:   if (!t) return rows;
   5:   return rows.filter((r) =>
   6:     r.title.toLowerCase().includes(t) ||
   7:     (r.subject ?? "").toLowerCase().includes(t) ||
   8:     r.id.includes(t));
   9: }
  10: export function groupByGrade(rows: SimRow[]): { grade: string; rows: SimRow[] }[] {
  11:   const map = new Map<string, SimRow[]>();
  12:   for (const r of rows) {
  13:     const g = r.grade ?? "Other";
  14:     const list = map.get(g) ?? [];
  15:     list.push(r);
  16:     map.set(g, list);
  17:   }
  18:   return [...map.entries()].map(([grade, rs]) => ({ grade, rows: rs }));
  19: }

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\clients\\__init__.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\adapters\\__init__.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content tests'"\\test_clients.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
 succeeded in 654ms:
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
  13: 
  14: __all__ = ["McdClient", "MunshiClient"]

 succeeded in 689ms:
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

 succeeded in 697ms:
   1: """Read-only source adapters and their registry."""
   2: from __future__ import annotations
   3: 
   4: from .base import Adapter, Artifact, CATALOG_COLUMNS
   5: from .booklets import BookletAdapter
   6: from .insp import INSPAdapter
   7: from .mcd import McdAdapter
   8: from .munshi import MunshiAdapter
   9: from .qx import QXAdapter
  10: from .questiondb import QuestionDBAdapter
  11: from .sims import SimsAdapter
  12: from .textbook import TextbookAdapter
  13: 
  14: ALL_ADAPTERS: list[Adapter] = [
  15:     QXAdapter(),
  16:     TextbookAdapter(),
  17:     BookletAdapter(),
  18:     INSPAdapter(),
  19:     SimsAdapter(),
  20:     QuestionDBAdapter(),
  21:     McdAdapter(),
  22:     MunshiAdapter(),
  23: ]
  24: 
  25: 
  26: def get_adapter(name: str) -> Adapter | None:
  27:     for adapter in ALL_ADAPTERS:
  28:         if adapter.name == name:
  29:             return adapter
  30:     return None
  31: 
  32: 
  33: __all__ = ["Adapter", "Artifact", "CATALOG_COLUMNS", "ALL_ADAPTERS", "get_adapter"]

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content samagra'"\\config.py | ForEach-Object { '{0,4}: {1}' -f "'$i++, $_ }' in C:\SandBox\claude_box\TeachingOS
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "load_dotenv|dotenv|MUNSHI_API_URL|MUNSHI_SECRET|MCD_ADMIN_KEY|mcd-cloud" samagra .env* docs -S' in C:\SandBox\claude_box\TeachingOS
2026-06-21T18:38:39.299364Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.6 seconds
Output:
samagra\api\app.py:190:        raise HTTPException(503, "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET")
samagra\api\app.py:212:        raise HTTPException(503, "mycontentdev not configured — set mcd-cloud.json adminKey")
samagra\api\app.py:256:        return {"results": [], "error": "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET"}
samagra\api\app.py:267:        return {"results": [], "error": "mycontentdev not configured — set mcd-cloud.json adminKey"}
samagra\clients\munshi_client.py:4:Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
samagra\clients\munshi_client.py:5:MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
samagra\clients\munshi_client.py:19:        url = api_url or os.environ.get("MUNSHI_API_URL") or ""
samagra\clients\munshi_client.py:21:        self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:158:- **Write (grounded `agent.ts:227-236` + `tools.ts`):** `POST {MUNSHI_API_URL}/api/item` (same
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:270:| `MUNSHI_API_URL` + `MUNSHI_SECRET` | munshi read **and** capture write | ✅ in `.env` (prod Worker; live-verified read) |
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:271:| `mcd-cloud.json` `adminKey` | mcd **reads** *and* **seed write** | ✅ present; live-verified to authorize `/api/seeds` |
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:115:**Safety:** no secrets/content/machine-paths committed; `.env`, `mcd-cloud.json`, `.dev.vars`, `*.db`, `state/` stay gitignored.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:124:- Reads the **cloud admin API** (production D1): `POST /api/admin/query` with body `{ sql: "SELECT … " }` (validated `^(select|with|pragma)` — read-only by construction), and `GET /api/admin/pending`. Auth header **`x-mcd-admin`**; admin key from gitignored `mcd-cloud.json` (`{apiUrl, adminKey}`) or env `MCD_ADMIN_KEY`.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:129:- Reads `{people, total, items}` via `GET /api/library`. Reuse `stress/driver.mjs` `MunshiClient.library()` (shell out to Node, or port the single GET). Auth = **`Cookie: munshi=<secret>`** (URL-encoded; constant-time SHA-256 vs **`MUNSHI_SECRET`** — *one* env var name for dev and prod). Secret from gitignored `.env`, **never echoed/logged/committed**.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:184:- **Never** echo/log/commit secret *values*: `MUNSHI_SECRET`, the mcd **admin key** + **app password**, any `.env` / `mcd-cloud.json` content. Names only in docs.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:205:2. **munshi auth is a cookie, not a header.** The adapter must send `Cookie: munshi=<MUNSHI_SECRET>`; simplest is to drive the existing `MunshiClient` (which already does this) rather than re-implement.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:224:| munshi read | `myProd/stress/driver.mjs:146` `library()`; auth `myProd/src/index.ts:18`; `MUNSHI_SECRET` |
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:15:- **Munshi write** = `POST {MUNSHI_API_URL}/api/item`, **JSON** body, cookie `munshi=<urlencoded secret>` (same stateless auth as `library()`; live-verified). Deterministic kinds **only** (`agent.ts:227-236` → `tools.ts`):
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:258:        raise HTTPException(503, "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET")
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:434:        raise HTTPException(503, "mycontentdev not configured — set mcd-cloud.json adminKey")
samagra\clients\mcd_client.py:3:Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
samagra\clients\mcd_client.py:5:MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
samagra\clients\mcd_client.py:28:    p = _MCD_ROOT / "mcd-cloud.json"
samagra\clients\mcd_client.py:42:        self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
docs\superpowers\_research\samagra-os\api.md:186:  `meta` = `{payload, tags, person, due}`. Requires `MUNSHI_API_URL` +
docs\superpowers\_research\samagra-os\api.md:187:  `MUNSHI_SECRET` (`clients/munshi_client.py`).
docs\superpowers\plans\2026-06-19-samagra-evolution.md:34:- `McdClient(api_url=None, admin_key=None, app_key=None)` — **Phase-1 surface is READ-ONLY:** `query(sql)->list[dict]` (`POST /api/admin/query`, header `x-mcd-admin`, body `{"sql":...}`); `pending()->list[dict]` (`GET /api/admin/pending`, `x-mcd-admin`); `available()->bool`; secret-free `__repr__`. **`create_seed(payload)` is NOT built or tested in Phase 1 — DEFERRED to Phase 3 per runbook D2/D9** (a read-only phase must not ship a write method into prod-adjacent code before governance + idempotency D7 exist). This supersedes the earlier "built now, used only in Phase 3" note and the `test_mcd_create_seed_posts_with_app_key` test in Task 1.2 below, both of which predate D2. Loads `mcd-cloud.json` `{apiUrl,adminKey}` or env `MCD_API_URL`/`MCD_ADMIN_KEY`/`MCD_APP_KEY`. Never logs key values.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:35:- `MunshiClient(api_url=None, secret=None)` — `library()->dict` (`GET /api/library`, header `Cookie: munshi=<urlencoded secret>`, returns `{"people":[...],"total":int,"items":[...]}`); `available()->bool`. Env `MUNSHI_API_URL`/`MUNSHI_SECRET`. Never logs the secret.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:856:- **Create** `samagra/clients/mcd_client.py` — `McdClient`: read-only admin-API client for mycontentdev (loads `mcd-cloud.json`/env, never logs key values); plus `create_seed` (built now, used only in Phase 3).
docs\superpowers\plans\2026-06-19-samagra-evolution.md:918:`McdClient` wraps the mycontentdev admin API. `query(sql)` POSTs to `{apiUrl}/api/admin/query` with header `x-mcd-admin: <adminKey>` and body `{"sql": sql}`, returning the raw array. `pending()` GETs `{apiUrl}/api/admin/pending` with the same header. `create_seed(payload)` POSTs to `{apiUrl}/api/seeds` with header `x-mcd-key: <appKey>` (used only in Phase 3). `available()` is True iff `api_url` and the needed key are set. Config loads from `mcd-cloud.json {apiUrl,adminKey}` or env `MCD_API_URL`/`MCD_ADMIN_KEY`/`MCD_APP_KEY`. The client trims trailing slashes off the URL (mirroring `_cloud.mjs`) and never logs key values.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:975:    monkeypatch.delenv("MCD_ADMIN_KEY", raising=False)
docs\superpowers\plans\2026-06-19-samagra-evolution.md:984:    monkeypatch.setenv("MCD_ADMIN_KEY", "ADMIN-SECRET")
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1051:Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1053:MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1074:    p = _MCD_ROOT / "mcd-cloud.json"
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1088:        self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1153:`MunshiClient.library()` GETs `{api_url}/api/library` with header `Cookie: munshi=<urlencoded(secret)>` (mirroring `driver.mjs` `cookie()`), returning `{"people":[...], "total":int, "items":[...]}`. Config from env `MUNSHI_API_URL` / `MUNSHI_SECRET`. `available()` is True iff both are set. The secret is never logged.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1161:    monkeypatch.delenv("MUNSHI_API_URL", raising=False)
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1162:    monkeypatch.delenv("MUNSHI_SECRET", raising=False)
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1168:    monkeypatch.setenv("MUNSHI_API_URL", "https://munshi.example.dev/")
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1169:    monkeypatch.setenv("MUNSHI_SECRET", "COOKIE-SECRET")
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1209:Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1210:MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1224:        url = api_url or os.environ.get("MUNSHI_API_URL") or ""
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1226:        self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""
docs\superpowers\plans\2026-06-19-samagra-evolution.md:4074:  Expected: only `samagra/bridge/*.py`, `samagra/__main__.py`, `tests/test_bridge.py` changed; manually confirm no admin key / app password / `MUNSHI_SECRET` literal is present (clients own creds; the bridge only calls `McdClient()` / `MunshiAdapter()` which load from gitignored config).
docs\codex-reviews\07-premerge-phase2.report.md:63:- `.githooks/pre-commit` is LF, executable in git metadata, and runs `python -m samagra.review.precommit`; that direct import path is stdlib-only apart from optional caught `dotenv`.
docs\codex-reviews\03-loop-plan-ceo-khanak.report.md:28:- Do not read, print, or commit secret values from `.env`, `mcd-cloud.json`, `.dev.vars`, or similar files.
docs\codex-reviews\03-loop-plan-ceo-khanak.report.md:75:**Implementation outline:** Load config from env or `config.CLAUDE_BOX / "mycontentdev" / "mcd-cloud.json"` through a helper that tests can monkeypatch. Implement `query`, `pending`, `create_seed`, `available`, and redacted `__repr__`. `create_seed` is built for Phase 3 only and must only be tested with fake HTTP.
docs\codex-reviews\03-loop-plan-ceo-khanak.report.md:91:**Implementation outline:** Load `MUNSHI_API_URL` and `MUNSHI_SECRET` from env. Use `urllib.parse.quote(secret, safe="")`. Implement `available`, `library`, and redacted `__repr__`.
docs\codex-reviews\03-loop-plan-ceo-khanak.report.md:212:- Do not read, print, or commit secret values from .env, mcd-cloud.json, .dev.vars, or similar files.
docs\codex-reviews\14-capture-munshi.report.md:40:`client.create_item` then sends `json={"kind": kind, **fields}` to `POST {MUNSHI_API_URL}/api/item`.
samagra\config.py:12:# Optional .env loading (python-dotenv is only required once you install deps).
samagra\config.py:14:    from dotenv import load_dotenv
samagra\config.py:16:    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
docs\codex-reviews\_prompts\07-premerge-phase2.md:76:  third-party dep (requests/dotenv) that would break a clean `python -m samagra.review.precommit`?
docs\codex-reviews\_prompts\03-loop-plan-ceo-khanak.md:27:`driver.mjs library()`, cookie auth, env `MUNSHI_SECRET`).
docs\codex-reviews\PHASE1-loop-runbook.md:200:- Do NOT read/print/commit secrets (.env, mcd-cloud.json, .dev.vars, MUNSHI_SECRET).
docs\codex-reviews\PHASE1-loop-runbook.md:307:3. Implement mcd_client.py: load base URL + admin secret via a tiny helper that tests monkeypatch (env first, then config.CLAUDE_BOX/'mycontentdev'/'mcd-cloud.json'); query/pending/available/__repr__ only. NO create_seed.
docs\codex-reviews\18-capture-final.report.md:63:+            {loading ? "Loading…" : "Munshi not available — set MUNSHI_API_URL / MUNSHI_SECRET."}
docs\codex-reviews\18-capture-final.report.md:121:+            {loading ? "Loading…" : "mycontentdev not available — set mcd-cloud.json adminKey."}
docs\codex-reviews\18-capture-final.report.md:158:+        return {"results": [], "error": "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET"}
docs\codex-reviews\18-capture-final.report.md:169:+        return {"results": [], "error": "mycontentdev not configured — set mcd-cloud.json adminKey"}
docs\codex-reviews\18-capture-final.report.md:185: Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
docs\codex-reviews\18-capture-final.report.md:187: MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
docs\codex-reviews\18-capture-final.report.md:1273: 190:         raise HTTPException(503, "munshi not configured â€” set MUNSHI_API_URL/MUNSHI_SECRET")
docs\codex-reviews\18-capture-final.report.md:1295: 212:         raise HTTPException(503, "mycontentdev not configured â€” set mcd-cloud.json adminKey")
docs\codex-reviews\18-capture-final.report.md:1339: 256:         return {"results": [], "error": "munshi not configured â€” set MUNSHI_API_URL/MUNSHI_SECRET"}
docs\codex-reviews\18-capture-final.report.md:1350: 267:         return {"results": [], "error": "mycontentdev not configured â€” set mcd-cloud.json adminKey"}
docs\codex-reviews\18-capture-final.report.md:1763:   4: Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
docs\codex-reviews\18-capture-final.report.md:1764:   5: MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
docs\codex-reviews\18-capture-final.report.md:1778:  19:         url = api_url or os.environ.get("MUNSHI_API_URL") or ""
docs\codex-reviews\18-capture-final.report.md:1780:  21:         self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""
docs\codex-reviews\18-capture-final.report.md:2068:   3: Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
docs\codex-reviews\18-capture-final.report.md:2070:   5: MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
docs\codex-reviews\18-capture-final.report.md:2093:  28:     p = _MCD_ROOT / "mcd-cloud.json"
docs\codex-reviews\18-capture-final.report.md:2107:  42:         self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
docs\codex-reviews\18-capture-final.report.md:3043:   8: >   `POST {MUNSHI_API_URL}/api/item` (cookie auth). Kinds **todo/note/followup** only (the worker's
docs\codex-reviews\18-capture-final.report.md:3164: 129: > `MUNSHI_API_URL`/`MUNSHI_SECRET` in `.env`). Carried into Phase 3: F1/F4 refresh hardening.
docs\codex-reviews\18-capture-final.report.md:3351: 316: 7. **Phase 3 munshi** â€” drop `MUNSHI_API_URL` + `MUNSHI_SECRET` into `.env` (live worker secret value) to switch on the active loop's munshi reads. mcd already reads live via `mcd-cloud.json`.
docs\codex-reviews\18-capture-final.report.md:3516: 158: - **Write (grounded `agent.ts:227-236` + `tools.ts`):** `POST {MUNSHI_API_URL}/api/item` (same
docs\codex-reviews\18-capture-final.report.md:3628: 270: | `MUNSHI_API_URL` + `MUNSHI_SECRET` | munshi read **and** capture write | âœ… in `.env` (prod Worker; live-verified read) |
docs\codex-reviews\18-capture-final.report.md:3629: 271: | `mcd-cloud.json` `adminKey` | mcd **reads** *and* **seed write** | âœ… present; live-verified to authorize `/api/seeds` |
docs\codex-reviews\18-capture-final.report.md:4309:  50:     monkeypatch.delenv("MCD_ADMIN_KEY", raising=False)
docs\codex-reviews\18-capture-final.report.md:4318:  59:     monkeypatch.setenv("MCD_ADMIN_KEY", "ADMIN-SECRET")
docs\codex-reviews\18-capture-final.report.md:4378: 119:     monkeypatch.delenv("MUNSHI_API_URL", raising=False)
docs\codex-reviews\18-capture-final.report.md:4379: 120:     monkeypatch.delenv("MUNSHI_SECRET", raising=False)
docs\codex-reviews\18-capture-final.report.md:4385: 126:     monkeypatch.setenv("MUNSHI_API_URL", "https://munshi.example.dev/")
docs\codex-reviews\18-capture-final.report.md:4386: 127:     monkeypatch.setenv("MUNSHI_SECRET", "COOKIE-SECRET")
docs\codex-reviews\18-capture-final.report.md:4468:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "load_dotenv|dotenv|MUNSHI_API_URL|MUNSHI_SECRET|MCD_ADMIN_KEY|mcd-cloud" samagra .env* docs -S' in C:\SandBox\claude_box\TeachingOS
rg: .env*: The filename, directory name, or volume label syntax is incorrect. (os error 123)

 exited 1 in 566ms:
samagra\api\app.py:190:        raise HTTPException(503, "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET")
samagra\api\app.py:212:        raise HTTPException(503, "mycontentdev not configured — set mcd-cloud.json adminKey")
samagra\api\app.py:256:        return {"results": [], "error": "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET"}
samagra\api\app.py:267:        return {"results": [], "error": "mycontentdev not configured — set mcd-cloud.json adminKey"}
samagra\clients\munshi_client.py:4:Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
samagra\clients\munshi_client.py:5:MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
samagra\clients\munshi_client.py:19:        url = api_url or os.environ.get("MUNSHI_API_URL") or ""
samagra\clients\munshi_client.py:21:        self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:158:- **Write (grounded `agent.ts:227-236` + `tools.ts`):** `POST {MUNSHI_API_URL}/api/item` (same
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:270:| `MUNSHI_API_URL` + `MUNSHI_SECRET` | munshi read **and** capture write | ✅ in `.env` (prod Worker; live-verified read) |
docs\superpowers\specs\2026-06-21-samagra-control-plane-capture-design.md:271:| `mcd-cloud.json` `adminKey` | mcd **reads** *and* **seed write** | ✅ present; live-verified to authorize `/api/seeds` |
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:115:**Safety:** no secrets/content/machine-paths committed; `.env`, `mcd-cloud.json`, `.dev.vars`, `*.db`, `state/` stay gitignored.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:124:- Reads the **cloud admin API** (production D1): `POST /api/admin/query` with body `{ sql: "SELECT … " }` (validated `^(select|with|pragma)` — read-only by construction), and `GET /api/admin/pending`. Auth header **`x-mcd-admin`**; admin key from gitignored `mcd-cloud.json` (`{apiUrl, adminKey}`) or env `MCD_ADMIN_KEY`.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:129:- Reads `{people, total, items}` via `GET /api/library`. Reuse `stress/driver.mjs` `MunshiClient.library()` (shell out to Node, or port the single GET). Auth = **`Cookie: munshi=<secret>`** (URL-encoded; constant-time SHA-256 vs **`MUNSHI_SECRET`** — *one* env var name for dev and prod). Secret from gitignored `.env`, **never echoed/logged/committed**.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:184:- **Never** echo/log/commit secret *values*: `MUNSHI_SECRET`, the mcd **admin key** + **app password**, any `.env` / `mcd-cloud.json` content. Names only in docs.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:205:2. **munshi auth is a cookie, not a header.** The adapter must send `Cookie: munshi=<MUNSHI_SECRET>`; simplest is to drive the existing `MunshiClient` (which already does this) rather than re-implement.
docs\superpowers\specs\2026-06-19-samagra-evolution-design.md:224:| munshi read | `myProd/stress/driver.mjs:146` `library()`; auth `myProd/src/index.ts:18`; `MUNSHI_SECRET` |
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:15:- **Munshi write** = `POST {MUNSHI_API_URL}/api/item`, **JSON** body, cookie `munshi=<urlencoded secret>` (same stateless auth as `library()`; live-verified). Deterministic kinds **only** (`agent.ts:227-236` → `tools.ts`):
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:258:        raise HTTPException(503, "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET")
docs\superpowers\plans\2026-06-21-samagra-control-plane-capture.md:434:        raise HTTPException(503, "mycontentdev not configured — set mcd-cloud.json adminKey")
samagra\clients\mcd_client.py:3:Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
samagra\clients\mcd_client.py:5:MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
samagra\clients\mcd_client.py:28:    p = _MCD_ROOT / "mcd-cloud.json"
samagra\clients\mcd_client.py:42:        self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
docs\superpowers\_research\samagra-os\api.md:186:  `meta` = `{payload, tags, person, due}`. Requires `MUNSHI_API_URL` +
docs\superpowers\_research\samagra-os\api.md:187:  `MUNSHI_SECRET` (`clients/munshi_client.py`).
docs\superpowers\plans\2026-06-19-samagra-evolution.md:34:- `McdClient(api_url=None, admin_key=None, app_key=None)` — **Phase-1 surface is READ-ONLY:** `query(sql)->list[dict]` (`POST /api/admin/query`, header `x-mcd-admin`, body `{"sql":...}`); `pending()->list[dict]` (`GET /api/admin/pending`, `x-mcd-admin`); `available()->bool`; secret-free `__repr__`. **`create_seed(payload)` is NOT built or tested in Phase 1 — DEFERRED to Phase 3 per runbook D2/D9** (a read-only phase must not ship a write method into prod-adjacent code before governance + idempotency D7 exist). This supersedes the earlier "built now, used only in Phase 3" note and the `test_mcd_create_seed_posts_with_app_key` test in Task 1.2 below, both of which predate D2. Loads `mcd-cloud.json` `{apiUrl,adminKey}` or env `MCD_API_URL`/`MCD_ADMIN_KEY`/`MCD_APP_KEY`. Never logs key values.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:35:- `MunshiClient(api_url=None, secret=None)` — `library()->dict` (`GET /api/library`, header `Cookie: munshi=<urlencoded secret>`, returns `{"people":[...],"total":int,"items":[...]}`); `available()->bool`. Env `MUNSHI_API_URL`/`MUNSHI_SECRET`. Never logs the secret.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:856:- **Create** `samagra/clients/mcd_client.py` — `McdClient`: read-only admin-API client for mycontentdev (loads `mcd-cloud.json`/env, never logs key values); plus `create_seed` (built now, used only in Phase 3).
docs\superpowers\plans\2026-06-19-samagra-evolution.md:918:`McdClient` wraps the mycontentdev admin API. `query(sql)` POSTs to `{apiUrl}/api/admin/query` with header `x-mcd-admin: <adminKey>` and body `{"sql": sql}`, returning the raw array. `pending()` GETs `{apiUrl}/api/admin/pending` with the same header. `create_seed(payload)` POSTs to `{apiUrl}/api/seeds` with header `x-mcd-key: <appKey>` (used only in Phase 3). `available()` is True iff `api_url` and the needed key are set. Config loads from `mcd-cloud.json {apiUrl,adminKey}` or env `MCD_API_URL`/`MCD_ADMIN_KEY`/`MCD_APP_KEY`. The client trims trailing slashes off the URL (mirroring `_cloud.mjs`) and never logs key values.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:975:    monkeypatch.delenv("MCD_ADMIN_KEY", raising=False)
docs\superpowers\plans\2026-06-19-samagra-evolution.md:984:    monkeypatch.setenv("MCD_ADMIN_KEY", "ADMIN-SECRET")
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1051:Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1053:MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1074:    p = _MCD_ROOT / "mcd-cloud.json"
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1088:        self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1153:`MunshiClient.library()` GETs `{api_url}/api/library` with header `Cookie: munshi=<urlencoded(secret)>` (mirroring `driver.mjs` `cookie()`), returning `{"people":[...], "total":int, "items":[...]}`. Config from env `MUNSHI_API_URL` / `MUNSHI_SECRET`. `available()` is True iff both are set. The secret is never logged.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1161:    monkeypatch.delenv("MUNSHI_API_URL", raising=False)
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1162:    monkeypatch.delenv("MUNSHI_SECRET", raising=False)
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1168:    monkeypatch.setenv("MUNSHI_API_URL", "https://munshi.example.dev/")
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1169:    monkeypatch.setenv("MUNSHI_SECRET", "COOKIE-SECRET")
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1209:Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1210:MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1224:        url = api_url or os.environ.get("MUNSHI_API_URL") or ""
docs\superpowers\plans\2026-06-19-samagra-evolution.md:1226:        self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""
docs\superpowers\plans\2026-06-19-samagra-evolution.md:4074:  Expected: only `samagra/bridge/*.py`, `samagra/__main__.py`, `tests/test_bridge.py` changed; manually confirm no admin key / app password / `MUNSHI_SECRET` literal is present (clients own creds; the bridge only calls `McdClient()` / `MunshiAdapter()` which load from gitignored config).
docs\codex-reviews\07-premerge-phase2.report.md:63:- `.githooks/pre-commit` is LF, executable in git metadata, and runs `python -m samagra.review.precommit`; that direct import path is stdlib-only apart from optional caught `dotenv`.
docs\codex-reviews\03-loop-plan-ceo-khanak.report.md:28:- Do not read, print, or commit secret values from `.env`, `mcd-cloud.json`, `.dev.vars`, or similar files.
docs\codex-reviews\03-loop-plan-ceo-khanak.report.md:75:**Implementation outline:** Load config from env or `config.CLAUDE_BOX / "mycontentdev" / "mcd-cloud.json"` through a helper that tests can monkeypatch. Implement `query`, `pending`, `create_seed`, `available`, and redacted `__repr__`. `create_seed` is built for Phase 3 only and must only be tested with fake HTTP.
docs\codex-reviews\03-loop-plan-ceo-khanak.report.md:91:**Implementation outline:** Load `MUNSHI_API_URL` and `MUNSHI_SECRET` from env. Use `urllib.parse.quote(secret, safe="")`. Implement `available`, `library`, and redacted `__repr__`.
docs\codex-reviews\03-loop-plan-ceo-khanak.report.md:212:- Do not read, print, or commit secret values from .env, mcd-cloud.json, .dev.vars, or similar files.
docs\codex-reviews\14-capture-munshi.report.md:40:`client.create_item` then sends `json={"kind": kind, **fields}` to `POST {MUNSHI_API_URL}/api/item`.
samagra\config.py:12:# Optional .env loading (python-dotenv is only required once you install deps).
samagra\config.py:14:    from dotenv import load_dotenv
samagra\config.py:16:    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
docs\codex-reviews\_prompts\07-premerge-phase2.md:76:  third-party dep (requests/dotenv) that would break a clean `python -m samagra.review.precommit`?
docs\codex-reviews\_prompts\03-loop-plan-ceo-khanak.md:27:`driver.mjs library()`, cookie auth, env `MUNSHI_SECRET`).
docs\codex-reviews\PHASE1-loop-runbook.md:200:- Do NOT read/print/commit secrets (.env, mcd-cloud.json, .dev.vars, MUNSHI_SECRET).
docs\codex-reviews\PHASE1-loop-runbook.md:307:3. Implement mcd_client.py: load base URL + admin secret via a tiny helper that tests monkeypatch (env first, then config.CLAUDE_BOX/'mycontentdev'/'mcd-cloud.json'); query/pending/available/__repr__ only. NO create_seed.
docs\codex-reviews\18-capture-final.report.md:63:+            {loading ? "Loading…" : "Munshi not available — set MUNSHI_API_URL / MUNSHI_SECRET."}
docs\codex-reviews\18-capture-final.report.md:121:+            {loading ? "Loading…" : "mycontentdev not available — set mcd-cloud.json adminKey."}
docs\codex-reviews\18-capture-final.report.md:158:+        return {"results": [], "error": "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET"}
docs\codex-reviews\18-capture-final.report.md:169:+        return {"results": [], "error": "mycontentdev not configured — set mcd-cloud.json adminKey"}
docs\codex-reviews\18-capture-final.report.md:185: Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
docs\codex-reviews\18-capture-final.report.md:187: MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
docs\codex-reviews\18-capture-final.report.md:1273: 190:         raise HTTPException(503, "munshi not configured â€” set MUNSHI_API_URL/MUNSHI_SECRET")
docs\codex-reviews\18-capture-final.report.md:1295: 212:         raise HTTPException(503, "mycontentdev not configured â€” set mcd-cloud.json adminKey")
docs\codex-reviews\18-capture-final.report.md:1339: 256:         return {"results": [], "error": "munshi not configured â€” set MUNSHI_API_URL/MUNSHI_SECRET"}
docs\codex-reviews\18-capture-final.report.md:1350: 267:         return {"results": [], "error": "mycontentdev not configured â€” set mcd-cloud.json adminKey"}
docs\codex-reviews\18-capture-final.report.md:1763:   4: Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
docs\codex-reviews\18-capture-final.report.md:1764:   5: MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
docs\codex-reviews\18-capture-final.report.md:1778:  19:         url = api_url or os.environ.get("MUNSHI_API_URL") or ""
docs\codex-reviews\18-capture-final.report.md:1780:  21:         self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""
docs\codex-reviews\18-capture-final.report.md:2068:   3: Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
docs\codex-reviews\18-capture-final.report.md:2070:   5: MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.
docs\codex-reviews\18-capture-final.report.md:2093:  28:     p = _MCD_ROOT / "mcd-cloud.json"
docs\codex-reviews\18-capture-final.report.md:2107:  42:         self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
docs\codex-reviews\18-capture-final.report.md:3043:   8: >   `POST {MUNSHI_API_URL}/api/item` (cookie auth). Kinds **todo/note/followup** only (the worker's
docs\codex-reviews\18-capture-final.report.md:3164: 129: > `MUNSHI_API_URL`/`MUNSHI_SECRET` in `.env`). Carried into Phase 3: F1/F4 refresh hardening.
docs\codex-reviews\18-capture-final.report.md:3351: 316: 7. **Phase 3 munshi** â€” drop `MUNSHI_API_URL` + `MUNSHI_SECRET` into `.env` (live worker secret value) to switch on the active loop's munshi reads. mcd already reads live via `mcd-cloud.json`.
docs\codex-reviews\18-capture-final.report.md:3516: 158: - **Write (grounded `agent.ts:227-236` + `tools.ts`):** `POST {MUNSHI_API_URL}/api/item` (same
docs\codex-reviews\18-capture-final.report.md:3628: 270: | `MUNSHI_API_URL` + `MUNSHI_SECRET` | munshi read **and** capture write | âœ… in `.env` (prod Worker; live-verified read) |
docs\codex-reviews\18-capture-final.report.md:3629: 271: | `mcd-cloud.json` `adminKey` | mcd **reads** *and* **seed write** | âœ… present; live-verified to authorize `/api/seeds` |
docs\codex-reviews\18-capture-final.report.md:4309:  50:     monkeypatch.delenv("MCD_ADMIN_KEY", raising=False)
docs\codex-reviews\18-capture-final.report.md:4318:  59:     monkeypatch.setenv("MCD_ADMIN_KEY", "ADMIN-SECRET")
docs\codex-reviews\18-capture-final.report.md:4378: 119:     monkeypatch.delenv("MUNSHI_API_URL", raising=False)
docs\codex-reviews\18-capture-final.report.md:4379: 120:     monkeypatch.delenv("MUNSHI_SECRET", raising=False)
docs\codex-reviews\18-capture-final.report.md:4385: 126:     monkeypatch.setenv("MUNSHI_API_URL", "https://munshi.example.dev/")
docs\codex-reviews\18-capture-final.report.md:4386: 127:     monkeypatch.setenv("MUNSHI_SECRET", "COOKIE-SECRET")
docs\codex-reviews\18-capture-final.report.md:4468:"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "load_dotenv|dotenv|MUNSHI_API_URL|MUNSHI_SECRET|MCD_ADMIN_KEY|mcd-cloud" samagra .env* docs -S' in C:\SandBox\claude_box\TeachingOS
rg: .env*: The filename, directory name, or volume label syntax is incorrect. (os error 123)

 succeeded in 698ms:
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
  54: # --- SAMAGRA-owned data (all gitignored) ---
  55: # DATA_DB is the REBUILDABLE catalog (FTS5 index over the subsystems); it may be
  56: # deleted and rebuilt at will. GOVERNANCE_DB is the DURABLE governance store
  57: # (assignments / events ledger / review overlay) and must NEVER be deleted as a
  58: # "catalog reset" â€” runbook D6 splits the two so irreplaceable governance state
  59: # never shares a file with the throwaway index.
  60: DATA_DB = REPO_ROOT / "samagra.db"
  61: GOVERNANCE_DB = REPO_ROOT / "governance.db"
  62: STATE_DIR = REPO_ROOT / "state"
  63: BUILD_DIR = REPO_ROOT / "build"
  64: EXPORT_DIR = BUILD_DIR / "lectures"
  65: 
  66: # --- portal ---
  67: HOST = os.environ.get("SAMAGRA_HOST", "127.0.0.1")
  68: PORT = int(os.environ.get("SAMAGRA_PORT", "8799"))
  69: 
  70: # --- optional python override ---
  71: try:  # pragma: no cover
  72:     import config_local  # type: ignore  # noqa: F401
  73: 
  74:     globals().update({k: v for k, v in vars(config_local).items() if k.isupper()})
  75: except Exception:  # noqa: BLE001
  76:     pass

codex
CRITICAL: none.

HIGH: none.

MEDIUM: none.

LOW: `frontend/src/apps/Munshi/index.tsx:34`, `frontend/src/apps/Mycontentdev/index.tsx:26` - the new read endpoints can return `200 {results: [], error: "… read failed"}`, but both apps type the payload as `SearchResponse` and only render the hook-level `error`. A generic upstream read failure will display as a misleading “not configured/available” empty state. Fix: use `SearchResponse & { error?: string }` for these reads and render `data?.error`, or have the backend return a generic non-2xx so `useApi.error` is set.

Checked: `asdict(Artifact)` matches the row contract, exception paths do not include exception text, QX numeric-code filtering is safe for the stated issue, write endpoints were not behaviorally changed. Sim URL static evidence points to extensionless canonical, but live curl/browser verification was blocked by network connect failure. Targeted pytest was blocked by this sandbox having no writable temp dir.

Verdict: GO-WITH-FIXES


tokens used
142,609
CRITICAL: none.

HIGH: none.

MEDIUM: none.

LOW: `frontend/src/apps/Munshi/index.tsx:34`, `frontend/src/apps/Mycontentdev/index.tsx:26` - the new read endpoints can return `200 {results: [], error: "… read failed"}`, but both apps type the payload as `SearchResponse` and only render the hook-level `error`. A generic upstream read failure will display as a misleading “not configured/available” empty state. Fix: use `SearchResponse & { error?: string }` for these reads and render `data?.error`, or have the backend return a generic non-2xx so `useApi.error` is set.

Checked: `asdict(Artifact)` matches the row contract, exception paths do not include exception text, QX numeric-code filtering is safe for the stated issue, write endpoints were not behaviorally changed. Sim URL static evidence points to extensionless canonical, but live curl/browser verification was blocked by network connect failure. Targeted pytest was blocked by this sandbox having no writable temp dir.

Verdict: GO-WITH-FIXES


