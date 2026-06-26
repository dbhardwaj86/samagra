# samagra/factory/publish/store.py
"""I/O for the publish boundary — everything that touches PUBLISHED_DIR.

Layout (config.PUBLISHED_DIR, durable + gitignored):
    manifest.json                          # derived CURRENT view (the export contract)
    _publications/pub_<NNNNNNNN>_<id>.json # immutable per-action records (append-only)
    <chapter>/<basename>                   # frozen artifact copies (current published bytes)

PUBLISHED_DIR is resolved at call time so tests can repoint it.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

from ... import config

_SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def _validate_segment(name: str, label: str) -> str:
    """Reject a path segment that could escape PUBLISHED_DIR (separators, '..',
    leading dot, drive letters). Returns the validated name. The publish boundary
    is a write firewall — it enforces its own safety invariant, never trusting the
    caller."""
    if not isinstance(name, str) or not _SAFE_SEGMENT.match(name):
        raise ValueError(
            f"unsafe {label} {name!r}: must be non-empty, start alphanumeric, "
            f"and contain only letters, digits, '.', '-', '_'")
    return name


def now() -> str:
    """UTC ISO 'YYYY-MM-DDTHH:MM:SSZ' — matches governance.store._now()."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _root() -> Path:
    return config.PUBLISHED_DIR


def _pubs_dir() -> Path:
    return _root() / "_publications"


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def _atomic_write_text(path: Path, text: str) -> None:
    _atomic_write_bytes(path, text.encode("utf-8"))


def read_manifest() -> dict | None:
    p = _root() / "manifest.json"
    if not p.is_file():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def write_manifest(manifest: dict) -> Path:
    p = _root() / "manifest.json"
    _atomic_write_text(p, json.dumps(manifest, ensure_ascii=False, indent=2))
    return p


def read_publications() -> list[dict]:
    """Every immutable publication record, ordered by sequence (filename sorts
    lexically because the sequence is zero-padded to 8 digits)."""
    d = _pubs_dir()
    if not d.is_dir():
        return []
    return [json.loads(f.read_text(encoding="utf-8")) for f in sorted(d.glob("pub_*.json"))]


def next_sequence() -> int:
    """Next 1-based publication sequence. Count-based (not max+1): assumes records
    in _publications/ are never manually deleted — a deletion would make this
    collide with an existing file, caught by write_publication's overwrite guard."""
    d = _pubs_dir()
    return (len(list(d.glob("pub_*.json"))) if d.is_dir() else 0) + 1


def write_publication(record: dict, *, sequence: int) -> Path:
    """Write ONE immutable record. Refuses to overwrite an existing file —
    publication history is append-only."""
    pub_id = _validate_segment(record.get("publication_id") or "", "publication_id")
    p = _pubs_dir() / f"pub_{sequence:08d}_{pub_id}.json"
    if p.exists():
        raise FileExistsError(f"publication record already exists: {p.name}")
    _atomic_write_text(p, json.dumps(record, ensure_ascii=False, indent=2))
    return p


def write_published_file(chapter: str, basename: str, data: bytes) -> str:
    """Copy one artifact file into published/<chapter>/<basename>; returns its
    manifest-relative path. Overwrites only on a deliberate re-publish."""
    _validate_segment(chapter, "chapter")
    _validate_segment(basename, "basename")
    _atomic_write_bytes(_root() / chapter / basename, data)
    return f"{chapter}/{basename}"
