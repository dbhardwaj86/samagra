"""HTTP clients for external subsystems (read-only in Phase 1).

mycontentdev (editorial) and munshi (front desk). Both clients are read-only in
Phase 1. The single subsystem write path (McdClient.create_seed) is DEFERRED to
Phase 3 per runbook D2/D9 — it is NOT built here, because a read-only phase must
not ship a prod-adjacent write method before governance + idempotency exist. No
client ever logs a secret value.
"""
from __future__ import annotations

from .mcd_client import McdClient
from .munshi_client import MunshiClient

__all__ = ["McdClient", "MunshiClient"]
