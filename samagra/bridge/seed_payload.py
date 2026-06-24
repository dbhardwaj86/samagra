"""DEPRECATED home — relocated to samagra/factory/seed_payload.py (Phase C3 /
F-C2: the factory seed lane is the canonical mcd writer). Re-exported here so
existing imports keep working; prefer importing from samagra.factory.seed_payload.
"""
from __future__ import annotations

from ..factory.seed_payload import (  # noqa: F401
    SEED_TYPES, build_seed_payload, validate_seed_payload, _source_ref)

__all__ = ["SEED_TYPES", "build_seed_payload", "validate_seed_payload"]
