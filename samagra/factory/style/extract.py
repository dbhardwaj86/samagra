"""The five deterministic facet functions + corpus assembly. Pure: a fixed corpus
yields byte-identical facets (sorted aggregates, no randomness)."""
from __future__ import annotations

from collections import Counter

from . import text as T


def _prose_texts(chapters: list[dict]) -> list[str]:
    out = []
    for ch in chapters:
        for sec in ch.get("sections", []) or []:
            for b in sec.get("blocks", []) or []:
                if b.get("type") == "prose":
                    out.append(T.strip_html(b.get("html", "")))
    return out


def voice(chapters: list[dict]) -> dict:
    """Diction/register over all prose: sentence length, person, hedging, openings."""
    sents: list[str] = []
    for txt in _prose_texts(chapters):
        sents.extend(T.sentences(txt))
    n = len(sents) or 1
    lens = [len(T.words(s)) for s in sents]
    short = sum(1 for L in lens if L <= 10)
    med = sum(1 for L in lens if 11 <= L <= 20)
    lng = sum(1 for L in lens if L > 20)

    def first_word(s: str) -> str:
        ws = T.words(s)
        return ws[0] if ws else ""

    return {
        "n_sentences": len(sents),
        "mean_sentence_len": T.round4(sum(lens) / n),
        "len_mix": {"short": T.round4(short / n), "medium": T.round4(med / n),
                    "long": T.round4(lng / n)},
        "second_person_rate": T.round4(
            sum(1 for s in sents if set(T.words(s)) & T.SECOND_PERSON) / n),
        "hedge_rate": T.round4(
            sum(1 for s in sents if set(T.words(s)) & T.HEDGES) / n),
        "imperative_rate": T.round4(
            sum(1 for s in sents if first_word(s) in T.IMPERATIVE_STARTERS) / n),
    }


def sequencing(chapters: list[dict]) -> dict:
    """Block-type rhythm within sections + section-count shape."""
    bigrams: Counter = Counter()
    sec_counts: list[int] = []
    for ch in chapters:
        secs = ch.get("sections", []) or []
        sec_counts.append(len(secs))
        for sec in secs:
            types = [b.get("type") for b in (sec.get("blocks", []) or [])]
            for a, b in zip(types, types[1:]):
                bigrams[f"{a}>{b}"] += 1
    total = sum(bigrams.values()) or 1
    n = len(sec_counts) or 1
    top = sorted(bigrams.items(), key=lambda kv: (-kv[1], kv[0]))[:8]
    return {
        "mean_sections_per_chapter": T.round4(sum(sec_counts) / n),
        "top_block_bigrams": [[k, T.round4(v / total)] for k, v in top],
    }


def analogy(chapters: list[dict]) -> dict:
    """Everyday-analogy reach over prose + callouts (substring marker match)."""
    texts: list[str] = []
    for ch in chapters:
        for sec in ch.get("sections", []) or []:
            for b in sec.get("blocks", []) or []:
                if b.get("type") in ("prose", "callout"):
                    texts.append(T.strip_html(b.get("html", "")).lower())
    n = len(texts) or 1
    hits = sum(1 for t in texts if any(m in t for m in T.ANALOGY_MARKERS))
    return {"n_blocks": len(texts), "analogy_block_rate": T.round4(hits / n)}


def rigor(chapters: list[dict]) -> dict:
    """Pedagogical rigor moves from the section-level flags[] array."""
    kinds: Counter = Counter()
    n_sections = 0
    n_flags = 0
    for ch in chapters:
        for sec in ch.get("sections", []) or []:
            n_sections += 1
            for f in sec.get("flags", []) or []:
                n_flags += 1
                kinds[f.get("kind") or "unknown"] += 1
    s = n_sections or 1
    total = n_flags or 1
    dist = sorted(kinds.items(), key=lambda kv: (-kv[1], kv[0]))
    return {
        "flags_per_section": T.round4(n_flags / s),
        "kind_mix": [[k, T.round4(v / total)] for k, v in dist],
    }


def selection(chapters: list[dict]) -> dict:
    """What gets foregrounded: callout-variant mix + equation/callout density."""
    variants: Counter = Counter()
    types: Counter = Counter()
    for ch in chapters:
        for sec in ch.get("sections", []) or []:
            for b in sec.get("blocks", []) or []:
                t = b.get("type")
                types[t] += 1
                if t == "callout":
                    variants[b.get("variant") or "note"] += 1
    n_blocks = sum(types.values()) or 1
    n_co = sum(variants.values()) or 1
    vmix = sorted(variants.items(), key=lambda kv: (-kv[1], kv[0]))
    return {
        "equation_density": T.round4(types.get("equation", 0) / n_blocks),
        "callout_density": T.round4(types.get("callout", 0) / n_blocks),
        "callout_variant_mix": [[k, T.round4(v / n_co)] for k, v in vmix],
    }


import json

FACETS = ("voice", "sequencing", "analogy", "rigor", "selection")


def load_corpus() -> list[dict]:
    """Load every chapter that has a content.json, in stable (sorted) slug order.
    Read-only over the textbook corpus — the firewall holds."""
    from ... import config
    from ...lectures import render

    q = json.loads(config.TEXTBOOK_QUEUE.read_text(encoding="utf-8"))
    slugs = sorted(c["slug"] for c in q.get("chapters", []) if c.get("slug"))
    chapters: list[dict] = []
    for slug in slugs:
        try:
            chapters.append(render.load_chapter(slug))
        except FileNotFoundError:
            continue
    return chapters


def build_profile(chapters: list[dict]) -> dict:
    """Assemble all five facets. Deterministic: order-independent aggregates."""
    return {
        "voice": voice(chapters),
        "sequencing": sequencing(chapters),
        "analogy": analogy(chapters),
        "rigor": rigor(chapters),
        "selection": selection(chapters),
    }
