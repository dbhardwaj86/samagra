"""Phase 2 pre-commit verdict tests (runbook D5 — advisory-local).

dispatch_codex + git diff are mocked: no real Codex call, no real git, and the
review cache / break-glass log are redirected to a temp STATE_DIR. The hook is
ADVISORY: it blocks only a *confirmed* CRITICAL (two agreeing Codex passes)
surviving the staged-diff-hash cache, honors an audited break-glass, and a
Codex that cannot run does NOT wedge the commit. (Supersedes the original
fail-closed assertions.)
"""
from __future__ import annotations

import json

import pytest

from samagra import config
from samagra.review import precommit
from samagra.review.codex_dispatch import CodexError, CodexResult


@pytest.fixture(autouse=True)
def isolate_review_state(monkeypatch, tmp_path):
    # Redirect the cache + break-glass log; ensure no stray break-glass env leaks.
    monkeypatch.setattr(config, "STATE_DIR", tmp_path / "state")
    monkeypatch.delenv("SAMAGRA_REVIEW_BREAKGLASS", raising=False)


def _result(findings):
    return CodexResult(parsed={"findings": findings}, raw="{}",
                       elapsed_s=0.1, attempts=1)


def _seq(*results):
    """A dispatch_codex stand-in that returns each result in turn."""
    box = list(results)

    def _call(*a, **k):
        return box.pop(0)

    return _call


def _no_call(*a, **k):
    raise AssertionError("dispatch_codex should not have been called")


def test_empty_diff_passes_without_calling_codex(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "")
    monkeypatch.setattr(precommit, "dispatch_codex", _no_call)
    assert precommit.review_staged_diff() == 0


def test_empty_findings_pass(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex", _seq(_result([])))
    assert precommit.review_staged_diff() == 0


def test_high_only_does_not_block(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex", _seq(_result(
        [{"severity": "HIGH", "file": "x.py", "line": 9, "issue": "broad except"}])))
    assert precommit.review_staged_diff() == 0


def test_confirmed_critical_blocks(monkeypatch):
    crit = [{"severity": "CRITICAL", "file": "x.py", "line": 3, "issue": "rm -rf"}]
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    # Two agreeing passes -> confirmed -> block.
    monkeypatch.setattr(precommit, "dispatch_codex",
                        _seq(_result(crit), _result(crit)))
    assert precommit.review_staged_diff() == 1


def test_unconfirmed_critical_does_not_block(monkeypatch):
    crit = [{"severity": "CRITICAL", "file": "x.py", "line": 3, "issue": "maybe?"}]
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    # Pass 1 flags CRITICAL, confirm pass disagrees -> not confirmed -> allow.
    monkeypatch.setattr(precommit, "dispatch_codex",
                        _seq(_result(crit), _result([])))
    assert precommit.review_staged_diff() == 0


def test_dispatch_error_does_not_wedge(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")

    def boom(*a, **k):
        raise CodexError("codex not on PATH")

    monkeypatch.setattr(precommit, "dispatch_codex", boom)
    # D5: a broken codex is advisory, not fail-closed -> allow the commit.
    assert precommit.review_staged_diff() == 0


def test_breakglass_allows_and_audits(monkeypatch):
    crit = [{"severity": "CRITICAL", "file": "x.py", "line": 3, "issue": "rm -rf"}]
    monkeypatch.setenv("SAMAGRA_REVIEW_BREAKGLASS", "hotfix prod outage")
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    # Break-glass short-circuits before Codex is ever called.
    monkeypatch.setattr(precommit, "dispatch_codex", _no_call)
    assert precommit.review_staged_diff() == 0
    log = config.STATE_DIR / "review" / "breakglass.log"
    assert log.exists()
    assert "hotfix prod outage" in log.read_text(encoding="utf-8")


def test_confirmed_block_is_cached_and_not_rerun(monkeypatch):
    crit = [{"severity": "CRITICAL", "file": "x.py", "line": 3, "issue": "rm -rf"}]
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex",
                        _seq(_result(crit), _result(crit)))
    assert precommit.review_staged_diff() == 1
    # Same staged diff again -> served from the diff-hash cache, Codex not re-run.
    monkeypatch.setattr(precommit, "dispatch_codex", _no_call)
    assert precommit.review_staged_diff() == 1


def test_pass_verdict_is_cached_and_not_rerun(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex", _seq(_result([])))
    assert precommit.review_staged_diff() == 0
    monkeypatch.setattr(precommit, "dispatch_codex", _no_call)
    assert precommit.review_staged_diff() == 0


# --- never-wedge hardening (pre-merge review HIGH + LOW) ---

def test_non_dict_cache_does_not_wedge(monkeypatch):
    # A valid-but-wrong-shape cache (a JSON list) must be ignored, not crash.
    cache_path = config.STATE_DIR / "review" / "diff_cache.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex", _seq(_result([])))
    assert precommit.review_staged_diff() == 0


def test_unwritable_cache_does_not_wedge(monkeypatch):
    # If the cache file can't be written (here: the path is a directory), a
    # passing review must still allow the commit, not raise.
    review_dir = config.STATE_DIR / "review"
    review_dir.mkdir(parents=True, exist_ok=True)
    (review_dir / "diff_cache.json").mkdir()  # write_text to a dir -> OSError
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex", _seq(_result([])))
    assert precommit.review_staged_diff() == 0


def test_unexpected_error_does_not_wedge(monkeypatch):
    # The outer never-wedge guard absorbs any unexpected hook-logic error.
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")

    def boom():
        raise RuntimeError("unexpected hook bug")

    monkeypatch.setattr(precommit, "_load_cache", boom)
    monkeypatch.setattr(precommit, "dispatch_codex", _no_call)
    assert precommit.review_staged_diff() == 0


def test_breakglass_reason_is_sanitized(monkeypatch):
    monkeypatch.setenv("SAMAGRA_REVIEW_BREAKGLASS", "line1\nline2\t" + "x" * 300)
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex", _no_call)
    assert precommit.review_staged_diff() == 0
    content = (config.STATE_DIR / "review" / "breakglass.log").read_text(encoding="utf-8")
    assert content.count("\n") == 1                 # single audit line (no forged lines)
    reason_field = content.rstrip("\n").split("\t")[-1]
    assert reason_field.startswith("line1 line2 ")  # whitespace collapsed to spaces
    assert len(reason_field) == 200                 # capped (raw reason was 300+ chars)
    assert "x" * 300 not in content                 # the long run was truncated


def test_confirmed_block_survives_malformed_cache(monkeypatch):
    # A dict-shaped cache with non-string `ts`, over the prune cap, previously made
    # _save_cache's sort raise TypeError -> swallowed by the outer guard ->
    # confirmed CRITICAL downgraded to allow. It must now still block (return 1).
    review_dir = config.STATE_DIR / "review"
    review_dir.mkdir(parents=True, exist_ok=True)
    poisoned = {f"h{i}": {"verdict": "pass", "ts": []}
                for i in range(precommit._CACHE_CAP + 5)}
    (review_dir / "diff_cache.json").write_text(json.dumps(poisoned), encoding="utf-8")
    crit = [{"severity": "CRITICAL", "file": "x.py", "line": 3, "issue": "rm -rf"}]
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex",
                        _seq(_result(crit), _result(crit)))
    assert precommit.review_staged_diff() == 1


def test_confirmed_block_survives_save_cache_failure(monkeypatch):
    # Defense in depth: even if cache persistence itself raises, a confirmed
    # CRITICAL must still block — the verdict is never gated on the cache write.
    crit = [{"severity": "CRITICAL", "file": "x.py", "line": 3, "issue": "rm -rf"}]
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex",
                        _seq(_result(crit), _result(crit)))

    def boom(*a, **k):
        raise TypeError("prune blew up")

    monkeypatch.setattr(precommit, "_save_cache", boom)
    assert precommit.review_staged_diff() == 1


def test_cached_block_with_malformed_findings_still_blocks(monkeypatch):
    # A cached block whose stored `findings` are malformed (non-dict) previously
    # raised in _print_findings and got swallowed by the outer guard -> downgrade
    # to allow. A cached verdict:"block" must return 1 regardless of findings shape.
    diff = "diff --git a b"
    dhash = precommit._diff_hash(diff)
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: diff)
    monkeypatch.setattr(
        precommit, "_load_cache",
        lambda: {dhash: {"verdict": "block", "findings": ["not-a-dict"], "ts": []}})
    monkeypatch.setattr(precommit, "dispatch_codex", _no_call)
    assert precommit.review_staged_diff() == 1
