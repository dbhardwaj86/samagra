"""PURE manifest logic for the publish boundary.

No I/O beyond hashing bytes the caller already read. Owns the published-corpus
schema, content hashing, the per-lane-last-write-wins manifest derivation over an
ordered list of immutable publication records, and the idempotency comparison.
"""
from __future__ import annotations

import hashlib

SCHEMA = "samagra.published.v1"


def sha256_bytes(data: bytes) -> str:
    """Hex sha256 of raw bytes — the per-file content fingerprint."""
    return hashlib.sha256(data).hexdigest()
