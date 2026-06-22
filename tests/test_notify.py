"""W3.2 — cover the notification channels. The existing scheduler test mocks
`notify.notify` out, so `_telegram` / `_email` were never exercised. Mock the
network/SMTP boundary and pin the wiring.
"""
from __future__ import annotations

import types

import pytest

from samagra import config, notify


# --- telegram -----------------------------------------------------------
def test_telegram_unconfigured_is_skipped(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    ok, msg = notify._telegram("hi")
    assert ok is False and "not configured" in msg


def test_telegram_posts_to_bot_api(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "TOK")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")
    sent = {}

    def fake_post(url, json=None, timeout=None):
        sent.update(url=url, json=json, timeout=timeout)
        return types.SimpleNamespace(ok=True, status_code=200)

    monkeypatch.setattr("requests.post", fake_post)
    ok, msg = notify._telegram("hello")
    assert ok is True and "200" in msg
    assert sent["url"] == "https://api.telegram.org/botTOK/sendMessage"
    assert sent["json"] == {"chat_id": "42", "text": "hello"}


def test_telegram_network_error_is_caught(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "TOK")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")

    def boom(*a, **k):
        raise RuntimeError("down")

    monkeypatch.setattr("requests.post", boom)
    ok, msg = notify._telegram("hello")
    assert ok is False and "error" in msg


# --- email --------------------------------------------------------------
def test_email_unconfigured_is_skipped(monkeypatch):
    for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS", "NOTIFY_EMAIL_TO"):
        monkeypatch.delenv(k, raising=False)
    ok, msg = notify._email("subj", "body")
    assert ok is False and "not configured" in msg


def test_email_sends_via_smtp(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_USER", "me@example.com")
    monkeypatch.setenv("SMTP_PASS", "pw")
    actions = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            actions.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self, context=None):
            actions.append(("starttls",))

        def login(self, user, pw):
            actions.append(("login", user))

        def send_message(self, msg):
            actions.append(("send", msg["To"], msg["Subject"]))

    monkeypatch.setattr("smtplib.SMTP", FakeSMTP)
    ok, msg = notify._email("Hi", "Body")
    assert ok is True and msg == "email sent"
    verbs = [a[0] for a in actions]
    assert verbs == ["connect", "starttls", "login", "send"]


# --- notify orchestration ----------------------------------------------
def test_notify_always_logs_even_with_no_channels(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "STATE_DIR", tmp_path)
    for k in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
              "SMTP_HOST", "SMTP_USER", "SMTP_PASS"):
        monkeypatch.delenv(k, raising=False)
    res = notify.notify("evt", "message body")
    log = (tmp_path / "notifications.log").read_text(encoding="utf-8")
    assert "[evt] message body" in log
    assert res["results"]["telegram"][0] is False
    assert res["results"]["email"][0] is False
