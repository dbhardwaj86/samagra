"""Notifications — Telegram (via Hermes bot) + email, both creds-gated.

Every notification is always appended to state/notifications.log, so there is a
record even when no channel is configured. Telegram/email are attempted only when
their env vars are present, so the scheduler runs fine before creds are set up.
"""
from __future__ import annotations

import os
import smtplib
import ssl
import time
from email.message import EmailMessage

from . import config


def _stamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _log(event: str, message: str) -> str:
    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
    line = f"{_stamp()} [{event}] {message}"
    with open(config.STATE_DIR / "notifications.log", "a", encoding="utf-8") as f:
        f.write(line + "\n")
    return line


def _telegram(text: str) -> tuple[bool, str]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return False, "telegram not configured"
    try:
        import requests

        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat, "text": text}, timeout=15,
        )
        return r.ok, f"telegram {r.status_code}"
    except Exception as e:  # noqa: BLE001
        return False, f"telegram error: {e}"


def _email(subject: str, body: str) -> tuple[bool, str]:
    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    pwd = os.environ.get("SMTP_PASS")
    to = os.environ.get("NOTIFY_EMAIL_TO", user or "")
    if not (host and user and pwd and to):
        return False, "email not configured"
    try:
        port = int(os.environ.get("SMTP_PORT", "587"))
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = user
        msg["To"] = to
        msg.set_content(body)
        with smtplib.SMTP(host, port, timeout=20) as s:
            s.starttls(context=ssl.create_default_context())
            s.login(user, pwd)
            s.send_message(msg)
        return True, "email sent"
    except Exception as e:  # noqa: BLE001
        return False, f"email error: {e}"


def notify(event: str, message: str, channels=("telegram", "email")) -> dict:
    line = _log(event, message)
    results: dict[str, tuple[bool, str]] = {}
    text = f"SAMAGRA · {event}\n{message}"
    if "telegram" in channels:
        results["telegram"] = _telegram(text)
    if "email" in channels:
        results["email"] = _email(f"SAMAGRA: {event}", message)
    return {"logged": line, "results": results}


def test() -> dict:
    return notify("test", "SAMAGRA notification test — channels online.")
