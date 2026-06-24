"""Pure text helpers + the closed marker vocabularies. Single source of truth so
the StyleSeed is BUILT and later SCORED on exactly the same features."""
from __future__ import annotations

import html as _html
import re

_TAG = re.compile(r"<[^>]+>")
_SENT = re.compile(r"[^.!?]+[.!?]?")
_WORD = re.compile(r"[a-z]+(?:'[a-z]+)*")

# Second-person / inclusive address (Deepak teaches AT the student).
SECOND_PERSON = frozenset({"you", "your", "yours", "we", "our", "us", "let's"})
# Hedging / approximation markers.
HEDGES = frozenset({"may", "might", "perhaps", "roughly", "approximately", "often",
                    "usually", "tends", "tend", "generally", "typically"})
# Sentence-initial cue words for an imperative/directive opening.
# note: "imagine" also in ANALOGY_MARKERS — counts toward both facets by design
IMPERATIVE_STARTERS = frozenset({"consider", "note", "recall", "imagine", "observe",
                                 "notice", "remember", "suppose", "think", "look"})
# Analogy / everyday-example markers — substring-matched, so all are unambiguous
# as substrings (no bare "like").
ANALOGY_MARKERS = frozenset({"imagine", "picture", "think of", "analogy", "everyday",
                             "real life", "real-world", "as if", "similar to"})


def strip_html(s) -> str:
    """Drop tags, unescape entities, collapse whitespace. None/'' -> ''."""
    return re.sub(r"\s+", " ", _html.unescape(_TAG.sub("", s or ""))).strip()


def sentences(text: str) -> list[str]:
    """Split into trimmed non-empty sentences on terminal . ! ? (simple heuristic;
    abbreviation periods, e.g. Fig./Eq., will cause false splits)."""
    return [s.strip() for s in _SENT.findall(text or "") if s.strip()]


def words(text: str) -> list[str]:
    """Lowercased word tokens (apostrophes kept, e.g. let's)."""
    return _WORD.findall((text or "").lower())


def round4(x: float) -> float:
    return round(float(x), 4)
