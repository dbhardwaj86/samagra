"""Deterministic ADVISORY style-fit scorer. Scores only the facets measurable from
free prose (voice, analogy). Hard-wired never to gate — surfaced for the owner."""
from __future__ import annotations

from . import text as T


def _closeness(a: float, b: float, scale: float) -> float:
    """1.0 when equal, decaying linearly to 0 at `scale` apart."""
    return max(0.0, 1.0 - abs(a - b) / scale)


def _voice_features(text: str) -> dict:
    sents = T.sentences(text)
    n = len(sents) or 1
    lens = [len(T.words(s)) for s in sents]
    return {
        "mean_sentence_len": sum(lens) / n if sents else 0.0,
        "second_person_rate": sum(1 for s in sents if set(T.words(s)) & T.SECOND_PERSON) / n,
        "hedge_rate": sum(1 for s in sents if set(T.words(s)) & T.HEDGES) / n,
    }


def style_fit(text: str, seed) -> dict:
    """Return {"overall": 0..1, "facets": {"voice": 0..1, "analogy": 0..1}}."""
    v = seed.facets["voice"]
    tv = _voice_features(text)
    voice_fit = (
        _closeness(tv["mean_sentence_len"], v["mean_sentence_len"], 20.0)
        + _closeness(tv["second_person_rate"], v["second_person_rate"], 1.0)
        + _closeness(tv["hedge_rate"], v["hedge_rate"], 1.0)
    ) / 3

    target = seed.facets["analogy"]["analogy_block_rate"]
    present = 1.0 if any(m in text.lower() for m in T.ANALOGY_MARKERS) else 0.0
    analogy_fit = 1.0 - abs(present - target)

    overall = (voice_fit + analogy_fit) / 2
    return {"overall": T.round4(overall),
            "facets": {"voice": T.round4(voice_fit), "analogy": T.round4(analogy_fit)}}
