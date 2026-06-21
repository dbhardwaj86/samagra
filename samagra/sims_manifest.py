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
    n = str(sim_id).strip().zfill(4)
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
            continue
        mi = _ITEM.match(line)
        if mi:
            sid = mi.group(1).strip()
            out.append({"id": sid, "title": mi.group(2).strip(),
                        "subject": subject, "grade": grade, "url": sim_url(sid)})
    return out
