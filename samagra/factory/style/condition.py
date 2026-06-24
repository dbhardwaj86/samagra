"""The conditioning interface: render a StyleSeed into an LLM system prompt. This
is the large, STABLE block D2 prompt-caches across every chapter in a run."""
from __future__ import annotations

import json


def _voice_guidance(v: dict) -> list[str]:
    out = ["Voice:"]
    out.append(f"- Aim for ~{v['mean_sentence_len']:.0f}-word sentences on average; "
               f"keep most sentences short and declarative.")
    if v.get("second_person_rate", 0) >= 0.4:
        out.append("- Address the student directly in the second person "
                   "(\"you\", \"we\") — teach AT the reader.")
    if v.get("hedge_rate", 0) >= 0.2:
        out.append("- Hedge claims where the physics is approximate "
                   "(\"roughly\", \"usually\").")
    if v.get("imperative_rate", 0) >= 0.15:
        out.append("- Open with directive cues (\"Consider\", \"Notice\", "
                   "\"Imagine\") where it helps.")
    return out


def to_system_prompt(seed) -> str:
    """Render the profile to a style guide + the embedded canonical facet stats."""
    f = seed.facets
    parts: list[str] = [
        f"You are writing in a specific physics teacher's voice. Match the "
        f"following StyleSeed v{seed.version} profile.",
        "",
    ]
    parts += _voice_guidance(f["voice"])
    parts += [
        "",
        "Sequencing:",
        f"- Chapters run ~{f['sequencing']['mean_sections_per_chapter']:.0f} "
        f"sections; introduce ideas in prose, then formalize.",
        "",
        "Analogy:",
        f"- Reach for an everyday analogy in roughly "
        f"{f['analogy']['analogy_block_rate']*100:.0f}% of explanatory blocks.",
        "",
        "Rigor:",
        f"- Flag shortcuts and add generality caveats "
        f"(~{f['rigor']['flags_per_section']:.1f} rigor notes per section).",
        "",
        "Selection:",
        f"- Foreground key results in callouts "
        f"(callout density ~{f['selection']['callout_density']*100:.0f}%).",
        "",
        "Exact profile statistics (condition on these numbers, not just the prose):",
        "<facets>" + json.dumps(f, sort_keys=True, ensure_ascii=False) + "</facets>",
    ]
    return "\n".join(parts)
