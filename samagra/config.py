"""Central configuration.

All paths/secrets come from environment variables (optionally loaded from a .env
file at the repo root). Machine-specific Python overrides may live in config.local.py
(gitignored). Nothing here hardcodes secrets — see .env.example.
"""
from __future__ import annotations

import os
from pathlib import Path

# Optional .env loading (python-dotenv is only required once you install deps).
try:  # pragma: no cover - convenience only
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except Exception:  # noqa: BLE001
    pass

REPO_ROOT = Path(__file__).resolve().parents[1]


def _env_path(name: str, default: Path) -> Path:
    val = os.environ.get(name)
    return Path(val) if val else default


# --- source workspace roots ---
GPT_BOX = _env_path("SAMAGRA_GPT_BOX", Path(r"C:\SandBox\gpt_box"))
CLAUDE_BOX = _env_path("SAMAGRA_CLAUDE_BOX", Path(r"C:\SandBox\claude_box"))

# --- QX (question engine) ---
QX_ROOT = _env_path("SAMAGRA_QX_ROOT", GPT_BOX / "gpt-extract-ques")
QX_CONTENT_DB = QX_ROOT / "qx" / "qx_content.sqlite"
QX_BUILDER_DB = QX_ROOT / "qx" / "builder.sqlite"

# --- physics-textbook (lecture/notes engine) ---
TEXTBOOK_ROOT = _env_path("SAMAGRA_TEXTBOOK_ROOT", GPT_BOX / "physics-textbook")
TEXTBOOK_QUEUE = TEXTBOOK_ROOT / "textbook" / "queue.json"
TEXTBOOK_CHAPTERS = TEXTBOOK_ROOT / "textbook" / "chapters"
TEXTBOOK_THEME = TEXTBOOK_ROOT / "textbook" / "theme"
TEXTBOOK_LOCK = TEXTBOOK_ROOT / "textbook" / ".routine.lock"

# --- booklets / INSP / sims ---
BOOKLETS_ROOT = _env_path("SAMAGRA_BOOKLETS_ROOT", CLAUDE_BOX / "claude-booklet-proofer")
INSP_ROOT = _env_path("SAMAGRA_INSP_ROOT", CLAUDE_BOX / "claude-INSP-extract")
SIMS_ROOT = _env_path("SAMAGRA_SIMS_ROOT", CLAUDE_BOX / "pratyaksh-May-deploy")

# --- online target ---
QUESTIONDB_URL = os.environ.get(
    "SAMAGRA_QUESTIONDB_URL", "https://dbhardwaj86-questiondb.hf.space"
)

# --- SAMAGRA-owned data (all gitignored) ---
DATA_DB = REPO_ROOT / "samagra.db"
STATE_DIR = REPO_ROOT / "state"
BUILD_DIR = REPO_ROOT / "build"
EXPORT_DIR = BUILD_DIR / "lectures"

# --- portal ---
HOST = os.environ.get("SAMAGRA_HOST", "127.0.0.1")
PORT = int(os.environ.get("SAMAGRA_PORT", "8799"))

# --- optional python override ---
try:  # pragma: no cover
    import config_local  # type: ignore  # noqa: F401

    globals().update({k: v for k, v in vars(config_local).items() if k.isupper()})
except Exception:  # noqa: BLE001
    pass
