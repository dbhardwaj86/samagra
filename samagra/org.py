"""Static SAMAGRA org chart (E2.1). No DB, no I/O — a human-authored registry.

`owners` maps every machine owner-token used in state.PIPELINES[*].owners to a
display identity, so the Org/Pipelines GUI apps can resolve a phase owner to a
person + role. The board hierarchy is the source-verified frontend roster
(terminal `agents`/`whoami`). Owner-confirmed (2026-06-21): claude1 = Claude-Deepak
(CEO), claude2 = Claude-Khanak (CTO).
"""
from __future__ import annotations

ORG: dict = {
    "chairman": {"id": "deepak", "name": "Deepak Bhardwaj", "role": "Founder & Chairman"},
    "board": [
        {"id": "claude-deepak", "name": "Claude-Deepak", "role": "CEO — substrate & engine"},
        {"id": "claude-khanak", "name": "Claude-Khanak", "role": "CTO — leaf apps & UX"},
        {"id": "codex", "name": "Codex", "role": "Reviewer — pre-merge gate"},
    ],
    "workers": [
        # Gemini+NotebookLM is ONE roster line per the source-verified frontend roster;
        # the two pipeline owner tokens stay distinct in `owners` below.
        {"id": "gemini-notebooklm", "name": "Gemini+NotebookLM", "role": "Research & synthesis"},
        {"id": "grok", "name": "Grok", "role": "Real-time search"},
        {"id": "hermes", "name": "Hermes", "role": "Kanban / scheduling"},
    ],
    # token -> identity; covers all 7 distinct state.PIPELINES owner ids.
    "owners": {
        "codex": {"name": "Codex", "role": "Reviewer — pre-merge gate"},
        "claude1": {"name": "Claude-Deepak", "role": "CEO — substrate & engine"},
        "claude2": {"name": "Claude-Khanak", "role": "CTO — leaf apps & UX"},
        "gemini": {"name": "Gemini", "role": "Research & synthesis"},
        "notebooklm": {"name": "NotebookLM", "role": "Research & synthesis"},
        "teachingos": {"name": "TeachingOS", "role": "Build / export automation"},
        "human": {"name": "Human", "role": "Manual gate / approval"},
    },
}
