"""Optional Google Docs export via the Drive API.

Creds-gated: if GOOGLE_OAUTH_CLIENT is unset or the client-secret file is missing,
upload() returns None and the rest of the export still produces HTML + DOCX. To
enable, create an OAuth *Desktop* client in Google Cloud, point GOOGLE_OAUTH_CLIENT
at its JSON, and run an export once to complete the consent flow (token cached
next to the client secret).
"""
from __future__ import annotations

import os
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _client_path() -> Path | None:
    raw = os.environ.get("GOOGLE_OAUTH_CLIENT", "")
    if not raw:
        return None
    p = Path(raw)
    return p if p.exists() else None


def configured() -> bool:
    return _client_path() is not None


def upload(docx_path: Path, title: str) -> str | None:
    client = _client_path()
    if not client:
        return None
    try:
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError:
        print("  ! google api libs missing — pip install -r requirements.txt")
        return None

    token = client.parent / "google_token.json"
    creds = None
    if token.exists():
        creds = Credentials.from_authorized_user_file(str(token), SCOPES)
    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(str(client), SCOPES)
        creds = flow.run_local_server(port=0)
        token.write_text(creds.to_json(), encoding="utf-8")

    drive = build("drive", "v3", credentials=creds)
    meta = {"name": title, "mimeType": "application/vnd.google-apps.document"}
    folder = os.environ.get("GOOGLE_DOCS_FOLDER_ID")
    if folder:
        meta["parents"] = [folder]
    media = MediaFileUpload(str(docx_path), mimetype=DOCX_MIME, resumable=True)
    created = drive.files().create(
        body=meta, media_body=media, fields="id,webViewLink"
    ).execute()
    return created.get("webViewLink")
