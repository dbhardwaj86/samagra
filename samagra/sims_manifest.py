"""Parse the Pratyaksh deployed-sims manifest (read-only). No network, no DB."""
from __future__ import annotations
import re

SITE = "https://pratyakshsims.com"
_GRADE = re.compile(r"^##\s+(?!#)(.*?)\s*(?:\(\d+\))?\s*$")
_SUBJECT = re.compile(r"^###\s+(.*?)\s*(?:\(\d+\))?\s*$")
_ITEM = re.compile(r"^-\s*(\d{3,4})\s*[—-]\s*(.+?)\s*$")


def sim_url(sim_id: str) -> str:
    # Canonical deployed URL is extensionless — the .html form 308-redirects to
    # this; linking directly avoids the redirect hop and lands on a 200.
    # Enforce the parser-validated id space (1–4 digits, _ITEM accepts \d{3,4}):
    # a non-conforming id (letters, >4 digits, empty) would otherwise zero-pad
    # into a malformed canonical URL silently (S3 LOW-2).
    sid = str(sim_id).strip()
    if not re.fullmatch(r"\d{1,4}", sid):
        raise ValueError(f"sim id must be 1-4 digits, got {sim_id!r}")
    n = sid.zfill(4)
    return f"{SITE}/sims/SIM{n}/SIM{n}_sim"


def parse_deployed_sims(text: str) -> list[dict]:
    grade = subject = None
    out: list[dict] = []
    for line in text.splitlines():
        ms = _SUBJECT.match(line)
        if ms:
            subject = ms.group(1).strip()
            continue
        mg = _GRADE.match(line)
        if mg:
            grade = mg.group(1).strip()
            subject = None  # a new grade starts fresh — don't bleed the prior grade's subject
            continue
        mi = _ITEM.match(line)
        if mi:
            sid = mi.group(1).strip()
            out.append({"id": sid, "title": mi.group(2).strip(),
                        "subject": subject, "grade": grade, "url": sim_url(sid)})
    return out
