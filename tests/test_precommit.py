"""Phase 2 pre-commit verdict tests (runbook D5 — advisory-local).

dispatch_codex + git diff are mocked: no real Codex call, no real git, and the
review cache / break-glass log are redirected to a temp STATE_DIR. The hook is
ADVISORY: it blocks only a *confirmed* CRITICAL (two agreeing Codex passes)
surviving the staged-diff-hash cache, honors an audited break-glass, and a
Codex that cannot run does NOT wedge the commit. (Supersedes the original
fail-closed assertions.)
"""
from __future__ import annotations

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
