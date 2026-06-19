"""Pre-commit Codex review tooling (vendored dispatch + advisory verdict logic).

The local hook is ADVISORY (runbook D5): it blocks only a *confirmed* CRITICAL
surviving the staged-diff-hash cache, carries an audited break-glass
(`SAMAGRA_REVIEW_BREAKGLASS`), and a Codex that cannot run does NOT wedge
commits. Real enforcement lives in CI / branch protection.
"""
