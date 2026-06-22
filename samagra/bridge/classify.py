"""Heuristic: is a munshi item a content-seed candidate or an ops todo?

Pure function over the item dict. No I/O. Conservative: when in doubt, 'ops'
(ops items just stay in munshi; mis-routing a note to ops is cheaper than
proposing a junk seed). The board reviews every content proposal anyway.
"""
from __future__ import annotations

import re

from .text import item_text

# Physics-ish vocabulary — coarse on purpose.
_PHYSICS_TERMS = (
    "force", "energy", "work", "friction", "momentum", "velocity",
    "acceleration", "gravity", "gravitation", "field", "electric",
    "magnetic", "flux", "gauss", "charge", "current", "voltage", "ohm",
    "circuit", "wave", "optics", "lens", "mirror", "refraction", "diffraction",
    "thermodynamics", "entropy", "heat", "temperature", "pressure",
    "rotational", "torque", "kinetic", "potential", "oscillation", "pendulum",
    "capacitor", "inductor", "resistor", "photon", "quantum", "nucleus",
    "physics", "newton", "joule", "kepler", "doppler",
)

# Match on a LEFT word boundary (\bterm) rather than a raw substring: this keeps
# morphological recall ("work" → "working", "electric" → "electrical") while no
# longer firing on embedded substrings ("work" inside "paperwork"/"network").
_PHYSICS_RE = re.compile(r"\b(" + "|".join(_PHYSICS_TERMS) + r")", re.IGNORECASE)


def _looks_physics(text: str) -> bool:
    return _PHYSICS_RE.search(text) is not None


def classify_item(item: dict) -> str:
    """Return 'content' or 'ops' for a single munshi item dict."""
    kind = (item.get("kind") or "").lower()
    text = item_text(item)

    # Person-directed work, issues, and followups are operational.
    if kind in {"issue", "followup"}:
        return "ops"
    if item.get("person"):
        return "ops"

    if kind == "question":
        return "content"
    if kind == "note":
        return "content" if (_looks_physics(text) or "?" in text) else "ops"
    if kind == "todo":
        return "content" if _looks_physics(text) else "ops"
    return "ops"
