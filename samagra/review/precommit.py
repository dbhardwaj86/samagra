"""Advisory pre-commit Codex review (runbook D5 — NOT fail-closed).

Logic: get the staged diff, ask Codex to review it against a findings schema, and
BLOCK the commit (exit 1) ONLY when a CRITICAL finding is *confirmed* — a second
Codex pass over the same diff independently agrees. Everything else allows
(exit 0). The verdict is cached by staged-diff hash so repeated commit attempts
of the identical diff are deterministic and do not re-prompt Codex.

D5 contract (supersedes the retired fail-closed / no-escape-hatch design):
  * Advisory-local: a Codex that errors / times out / can't be found does NOT
    wedge commits — it warns and allows. Real enforcement is CI / branch
    protection.
  * Confirmed-CRITICAL only: a lone (unconfirmed) CRITICAL is treated as
    advisory, not blocking, to absorb single-pass false positives.
  * Audited break-glass: SAMAGRA_REVIEW_BREAKGLASS="<reason>" allows the commit
    and appends an audited line to state/review/breakglass.log.
  * Empty diff -> allow without calling Codex. HIGH/MED/LOW print but never block.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from .. import config
from .codex_dispatch import dispatch_codex

FINDINGS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["findings"],
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["severity", "file", "line", "issue"],
                "properties": {
                    "severity": {"enum": ["CRITICAL", "HIGH", "MED", "LOW"]},
                    "file": {"type": "string"},
                    "line": {"type": "integer"},
                    "issue": {"type": "string"},
                },
            },
        }
    },
}

_PROMPT = """You are SAMAGRA's pre-commit code reviewer (Chief Architect / Codex).
Review the following STAGED git diff. Report only real defects in the changed
lines. Use severity CRITICAL only for: secret/credential leaks, destructive
shell/SQL (rm -rf, DROP/DELETE without WHERE), command/SQL injection, or code
that would corrupt data or break the build. Everything else is HIGH/MED/LOW.
Return JSON matching the schema: {{"findings": [{{"severity","file","line","issue"}}]}}.
Empty findings means the diff is safe to commit.

=== STAGED DIFF ===
{diff}
=== END DIFF ===
"""

_CACHE_CAP = 256  # keep the most recent N verdicts; prune older on write.


# -- git + hashing -------------------------------------------------------
def get_staged_diff() -> str:
    proc = subprocess.run(
        ["git", "diff", "--cached", "--unified=3"],
        capture_output=True, text=True, encoding="utf-8",
    )
    return proc.stdout or ""


def _diff_hash(diff: str) -> str:
    return hashlib.sha256(diff.encode("utf-8")).hexdigest()


# -- durable side files (state/ is gitignored) ---------------------------
def _review_dir() -> Path:
    d = config.STATE_DIR / "review"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cache_path() -> Path:
    return _review_dir() / "diff_cache.json"


def _load_cache() -> dict:
    # A corrupt OR wrong-shaped cache must never wedge a commit: return {} unless
    # it is a dict whose entries are themselves dicts (verdict records). A valid
    # but non-dict JSON value (e.g. `[]`) would otherwise blow up at `.get()`.
    p = _cache_path()
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 - unreadable/corrupt cache -> ignore it
        return {}
    if not isinstance(data, dict):
        return {}
    return {k: v for k, v in data.items() if isinstance(v, dict)}


def _save_cache(cache: dict) -> None:
    # FULLY best-effort: persisting the cache is an optimization, never a gate.
    # Nothing here — pruning, the sort key, JSON serialization, or IO — may raise,
    # because a confirmed-CRITICAL block calls this BEFORE `return 1`; an exception
    # escaping here would be swallowed by the outer guard and silently downgrade
    # the block to allow. The sort key is coerced with str() so a malformed entry
    # (e.g. a non-string `ts`) can't poison the prune.
    try:
        if len(cache) > _CACHE_CAP:
            keep = sorted(cache.items(),
                          key=lambda kv: str(kv[1].get("ts", "")))[-_CACHE_CAP:]
            cache = dict(keep)
        _cache_path().write_text(json.dumps(cache, indent=2), encoding="utf-8")
    except Exception as e:  # noqa: BLE001 - cache persistence must never flip a verdict
        print(f"[codex-precommit] warning: could not write review cache: {e}",
              file=sys.stderr)


def _remember(cache: dict, dhash: str, entry: dict) -> None:
    # Persist a verdict, best-effort. Belt-and-suspenders around _save_cache: even
    # if a future _save_cache regressed and raised, the verdict (esp. a confirmed
    # block returning 1) must still stand, so this can never propagate.
    try:
        cache[dhash] = entry
        _save_cache(cache)
    except Exception as e:  # noqa: BLE001 - verdict persistence is never a gate
        print(f"[codex-precommit] warning: could not persist verdict: {e}",
              file=sys.stderr)


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _sanitize_reason(reason: str) -> str:
    # Audit lines are single-line + bounded: collapse whitespace (no forged
    # extra lines) and cap length (don't echo a pasted secret in full).
    one_line = " ".join(str(reason).split())
    return one_line[:200]


def _audit_breakglass(diff_hash: str, reason: str) -> None:
    # Best-effort: a logging failure must not wedge a break-glass commit.
    line = f"{_now()}\t{diff_hash[:12]}\t{_sanitize_reason(reason)}\n"
    try:
        with (_review_dir() / "breakglass.log").open("a", encoding="utf-8") as fh:
            fh.write(line)
    except OSError as e:
        print(f"[codex-precommit] warning: could not write break-glass log: {e}",
              file=sys.stderr)


# -- verdict helpers -----------------------------------------------------
def _emit(fn) -> None:
    """Run a best-effort side-effect (printing / logging). Cosmetics must NEVER
    change a verdict: once a block is decided it returns 1 even if its banner
    fails to print. Swallow everything here so nothing on a decided path can be
    caught by the outer never-wedge guard and silently downgrade the result."""
    try:
        fn()
    except Exception as e:  # noqa: BLE001 - a side-effect must never flip a verdict
        print(f"[codex-precommit] warning: side-effect failed: {e}",
              file=sys.stderr)


def _criticals(findings) -> list[dict]:
    # Tolerant of malformed entries (a cache or Codex payload could be junk):
    # only dict findings with severity CRITICAL count.
    if not isinstance(findings, list):
        return []
    return [f for f in findings
            if isinstance(f, dict) and f.get("severity") == "CRITICAL"]


def _print_findings(findings, header: str) -> None:
    print(f"\n=== SAMAGRA pre-commit: {header} ===", file=sys.stderr)
    items = findings if isinstance(findings, list) else []
    for f in items:
        if isinstance(f, dict):
            print(f"  [{f.get('severity')}] {f.get('file')}:{f.get('line')} "
                  f"{f.get('issue')}", file=sys.stderr)
        else:
            print(f"  [?] {f!r}", file=sys.stderr)
    if not items:
        print("  (no findings)", file=sys.stderr)


def _review_once(diff: str) -> list[dict]:
    result = dispatch_codex(_PROMPT.format(diff=diff), schema=FINDINGS_SCHEMA,
                            timeout_s=90, max_attempts=2)
    return result.parsed.get("findings") or []


def review_staged_diff() -> int:
    """Return 0 to allow the commit, 1 to block it (confirmed CRITICAL only).

    Outer never-wedge guard (D5): ANY unexpected error in the local hook logic is
    advisory — it warns and ALLOWS the commit (returns 0). Only the deliberate
    confirmed-CRITICAL path returns 1. Real enforcement lives in CI.
    """
    try:
        return _review_staged_diff_inner()
    except Exception as e:  # noqa: BLE001 - the local hook must never wedge a commit
        print("\n=== SAMAGRA pre-commit: review error (advisory) ===",
              file=sys.stderr)
        print(f"  unexpected error in the local hook: {e!r}", file=sys.stderr)
        print("  Commit ALLOWED locally — enforcement is in CI / branch "
              "protection.", file=sys.stderr)
        return 0


def _review_staged_diff_inner() -> int:
    diff = get_staged_diff()
    if not diff.strip():
        return 0  # nothing staged -> nothing to review

    dhash = _diff_hash(diff)

    # Audited break-glass: allow + log, overriding even a confirmed-CRITICAL.
    reason = os.environ.get("SAMAGRA_REVIEW_BREAKGLASS")
    if reason:
        _emit(lambda: _audit_breakglass(dhash, reason))
        _emit(lambda: print(
            f"\n=== SAMAGRA pre-commit: BREAK-GLASS (audited) ===\n"
            f"  reason: {_sanitize_reason(reason)}\n"
            f"  logged to state/review/breakglass.log", file=sys.stderr))
        return 0

    # Diff-hash cache: a previously-confirmed verdict is deterministic. A cached
    # block must return 1 regardless of how malformed its stored findings are, so
    # all emission is best-effort and the return is decided first.
    cache = _load_cache()
    cached = cache.get(dhash)
    if isinstance(cached, dict):
        if cached.get("verdict") == "block":
            _emit(lambda: _print_findings(cached.get("findings", []),
                                          "COMMIT BLOCKED (cached confirmed-CRITICAL)"))
            _emit(_print_breakglass_help)
            return 1
        return 0

    # Cache miss -> run the review. A Codex that cannot run is ADVISORY (D5):
    # warn and allow; do NOT cache a transient failure, do NOT wedge.
    try:
        findings = _review_once(diff)
    except Exception as e:  # noqa: BLE001 - CodexError or any failure is advisory
        print("\n=== SAMAGRA pre-commit: review skipped (advisory) ===",
              file=sys.stderr)
        print(f"  Codex could not run: {e}", file=sys.stderr)
        print("  Commit ALLOWED locally — enforcement is in CI / branch "
              "protection.", file=sys.stderr)
        print("  (Restore `codex` on PATH or set CODEX_BIN to re-enable the "
              "local gate.)", file=sys.stderr)
        return 0

    crits = _criticals(findings)
    if not crits:
        if findings:
            _emit(lambda: _print_findings(findings, "advisory findings (non-blocking)"))
        _remember(cache, dhash, {"verdict": "pass", "ts": _now()})
        return 0

    # CRITICAL in pass 1 -> require a confirming second pass (the "confirmed" in
    # confirmed-CRITICAL). If confirm errors or disagrees, treat as advisory.
    try:
        confirm = _review_once(diff)
    except Exception as e:  # noqa: BLE001 - confirm failure -> advisory, not block
        _emit(lambda: _print_findings(crits, "UNCONFIRMED CRITICAL (confirm pass "
                                             "errored) — allowed"))
        print(f"  confirm pass could not run: {e}", file=sys.stderr)
        return 0

    if _criticals(confirm):
        confirmed = crits + [c for c in _criticals(confirm) if c not in crits]
        # Block is decided here; every side-effect below is best-effort so the
        # return value can never be downgraded by a failing print or cache write.
        _emit(lambda: _print_findings(confirmed, "COMMIT BLOCKED (confirmed CRITICAL)"))
        _emit(_print_breakglass_help)
        _remember(cache, dhash, {"verdict": "block", "findings": confirmed,
                                 "ts": _now()})
        return 1

    # Confirm pass disagreed -> single-pass false positive -> advisory.
    _emit(lambda: _print_findings(crits, "UNCONFIRMED CRITICAL (confirm pass "
                                         "disagreed) — allowed"))
    _remember(cache, dhash, {"verdict": "pass", "ts": _now()})
    return 0


def _print_breakglass_help() -> None:
    print("  Fix the issue and re-commit. Emergency override (audited):",
          file=sys.stderr)
    print('    SAMAGRA_REVIEW_BREAKGLASS="<reason>" git commit ...',
          file=sys.stderr)
    print("  Inspect what would be reviewed: git diff --cached --unified=3",
          file=sys.stderr)


def main() -> None:
    sys.exit(review_staged_diff())


if __name__ == "__main__":
    main()
