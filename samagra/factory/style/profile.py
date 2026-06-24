"""The StyleSeed: a durable, versioned, owner-curated voice profile, persisted as
a git-COMMITTED styleseed-v<N>.json (fork F-D3 — git is the review surface)."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from .extract import FACETS  # re-export: single source of truth for the facet names


@dataclass(frozen=True)
class StyleSeed:
    version: int
    facets: dict
    source_corpus_hash: str
    created_at: str


def _canon(obj) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _sha(obj) -> str:
    return hashlib.sha256(_canon(obj).encode("utf-8")).hexdigest()


def content_hash(facets: dict) -> str:
    """Stable, key-order-independent sha256 over the facet payload."""
    return _sha(facets)


def corpus_hash(chapters: list[dict]) -> str:
    """Tamper-evident pointer to the exact corpus a profile was built from."""
    return _sha(sorted([c.get("slug", ""), _sha(c)] for c in chapters))


def _dir() -> Path:
    from ... import config
    return config.STYLESEED_DIR


def path_for(version: int) -> Path:
    return _dir() / f"styleseed-v{version}.json"


def _to_dict(seed: StyleSeed) -> dict:
    return {"version": seed.version, "facets": seed.facets,
            "source_corpus_hash": seed.source_corpus_hash, "created_at": seed.created_at}


def save(seed: StyleSeed) -> Path:
    d = _dir()
    d.mkdir(parents=True, exist_ok=True)
    p = path_for(seed.version)
    p.write_text(json.dumps(_to_dict(seed), sort_keys=True, ensure_ascii=False, indent=2),
                 encoding="utf-8")
    return p


def load(version: int) -> StyleSeed:
    d = json.loads(path_for(version).read_text(encoding="utf-8"))
    return StyleSeed(
        version=d["version"],
        facets=d["facets"],
        source_corpus_hash=d["source_corpus_hash"],
        created_at=d["created_at"],
    )


def current_version() -> int | None:
    d = _dir()
    if not d.exists():
        return None
    versions = []
    for p in d.glob("styleseed-v*.json"):
        try:
            versions.append(int(p.stem.rsplit("v", 1)[-1]))
        except ValueError:
            continue
    return max(versions) if versions else None


def load_current() -> StyleSeed | None:
    v = current_version()
    return load(v) if v is not None else None
