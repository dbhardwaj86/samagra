"""Minimal vendored Codex subprocess wrapper for the pre-commit review.

Adapted from claude-booklet-proofer/scripts/codex_dispatch.py. Only the bits the
pre-commit hook needs: a single `dispatch_codex(prompt, *, schema=...)` call that
shells `codex exec`, reads the structured final message from a temp JSON file,
and retries on malformed JSON. The exe is resolved lazily so this module imports
cleanly even when `codex` is not on PATH (the advisory hook then warns and
allows the commit — it does NOT wedge — per runbook D5).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class CodexError(RuntimeError):
    pass


@dataclass
class CodexResult:
    parsed: dict[str, Any]
    raw: str
    elapsed_s: float
    attempts: int


def _resolve_codex_exe() -> str:
    exe = os.environ.get("CODEX_BIN") or shutil.which("codex")
    if not exe:
        raise CodexError(
            "Could not locate `codex` on PATH. Install Codex CLI "
            "(`npm i -g @openai/codex`) or set the CODEX_BIN environment variable."
        )
    return exe


def _strip_fences(raw: str) -> str:
    s = raw.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s


def dispatch_codex(
    prompt: str,
    *,
    schema: dict | None = None,
    timeout_s: int = 90,
    max_attempts: int = 2,
) -> CodexResult:
    """Invoke `codex exec` (read-only sandbox) and return the parsed JSON.

    The prompt is passed on stdin to avoid Windows shell-quoting issues. When a
    `schema` dict is given it is written to a temp file and passed via
    --output-schema. Raises CodexError on non-zero exit, empty output, or JSON
    parse failure after `max_attempts`.
    """
    exe = _resolve_codex_exe()
    schema_path: Path | None = None
    if schema is not None:
        sfd, sname = tempfile.mkstemp(suffix=".schema.json", prefix="codex_sch_")
        os.close(sfd)
        schema_path = Path(sname)
        schema_path.write_text(json.dumps(schema), encoding="utf-8")

    last_error: Exception | None = None
    raw_text = ""
    t0 = time.monotonic()
    attempt = 0
    try:
        while attempt < max_attempts:
            attempt += 1
            ofd, oname = tempfile.mkstemp(suffix=".json", prefix="codex_out_")
            os.close(ofd)
            out_path = Path(oname)
            try:
                args = [
                    exe, "exec", "--ephemeral", "--skip-git-repo-check",
                    "--sandbox", "read-only",
                    "--output-last-message", str(out_path),
                    "--color", "never",
                ]
                if schema_path is not None:
                    args += ["--output-schema", str(schema_path)]
                args.append("-")  # prompt on stdin
                proc = subprocess.run(
                    args, input=prompt, capture_output=True, text=True,
                    timeout=timeout_s, encoding="utf-8",
                )
                if proc.returncode != 0:
                    raise CodexError(
                        f"codex exited {proc.returncode}\nstderr tail:\n"
                        f"{(proc.stderr or '')[-2000:]}"
                    )
                raw_text = (out_path.read_text(encoding="utf-8").strip()
                            if out_path.exists() else "")
                if not raw_text:
                    raise CodexError("codex produced empty output-last-message")
                parsed = json.loads(_strip_fences(raw_text))
                return CodexResult(parsed=parsed, raw=raw_text,
                                   elapsed_s=time.monotonic() - t0,
                                   attempts=attempt)
            except (json.JSONDecodeError, CodexError) as e:
                last_error = e
                print(f"[codex-precommit] attempt={attempt} failed: {e}",
                      file=sys.stderr)
                if attempt < max_attempts:
                    time.sleep(2)
            finally:
                try:
                    out_path.unlink()
                except FileNotFoundError:
                    pass
    finally:
        if schema_path is not None:
            try:
                schema_path.unlink()
            except FileNotFoundError:
                pass

    raise CodexError(
        f"codex dispatch failed after {attempt} attempts "
        f"({time.monotonic() - t0:.1f}s). Last error: {last_error}"
    )
