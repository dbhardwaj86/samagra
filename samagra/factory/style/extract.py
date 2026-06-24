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
