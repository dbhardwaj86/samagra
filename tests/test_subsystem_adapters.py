"""Adapter tests for mycontentdev + munshi.

The HTTP clients are replaced with hand-rolled fakes that return canned JSON,
so artifacts() is exercised over known data with NO network access. We assert
exact Artifact field values against the SHARED CONTRACTS.
"""
from __future__ import annotations

from samagra.adapters import ALL_ADAPTERS, get_adapter
from samagra.adapters.mcd import McdAdapter
from samagra.adapters.munshi import MunshiAdapter


class FakeMcdClient:
    def __init__(self, api_url="https://mcd.example.dev", rows=None, avail=True):
        self.api_url = api_url
        self._rows = rows or []
        self._avail = avail
        self.last_sql = None

    def available(self):
        return self._avail

    def query(self, sql):
        self.last_sql = sql
        return self._rows


class FakeMunshiClient:
    def __init__(self, library=None, avail=True):
        self._library = library or {"people": [], "total": 0, "items": []}
        self._avail = avail

    def available(self):
        return self._avail

    def library(self):
        return self._library


# ---------------- McdAdapter ----------------

def test_mcd_adapter_identity():
    ad = McdAdapter()
    assert ad.name == "mycontentdev"
    assert ad.label == "Editorial (mycontentdev)"


def test_mcd_adapter_available_delegates_to_client():
    assert McdAdapter(client=FakeMcdClient(avail=True)).available() is True
    assert McdAdapter(client=FakeMcdClient(avail=False)).available() is False


def test_mcd_adapter_query_excludes_archived():
    fake = FakeMcdClient(rows=[])
    list(McdAdapter(client=fake).artifacts())
    assert fake.last_sql == (
        "SELECT id,type,title,status,created_at,updated_at "
        "FROM seeds WHERE status != 'archived'"
    )


def test_mcd_adapter_maps_row_to_artifact():
    rows = [{
        "id": "abc123",
        "type": "concept",
        "title": "Gauss's law flux",
        "status": "draft_ready",
        "created_at": "2026-06-10T00:00:00Z",
        "updated_at": "2026-06-15T09:00:00Z",
    }]
    ad = McdAdapter(client=FakeMcdClient(api_url="https://mcd.example.dev", rows=rows))
    arts = list(ad.artifacts())
    assert len(arts) == 1
    a = arts[0]
    assert a.uid == "mcd:abc123"
    assert a.source == "mycontentdev"
    assert a.kind == "concept"
    assert a.title == "Gauss's law flux"
    assert a.subject == "physics"
    assert a.unit is None
    assert a.chapter is None
    assert a.status == "draft_ready"
    assert a.path is None
    assert a.url == "https://mcd.example.dev/seed/abc123"
    assert a.updated_at == "2026-06-15T09:00:00Z"
    assert a.meta == {"seedId": "abc123"}


# ---------------- MunshiAdapter ----------------

def test_munshi_adapter_identity():
    ad = MunshiAdapter()
    assert ad.name == "munshi"
    assert ad.label == "Front Desk (munshi)"


def test_munshi_adapter_available_delegates_to_client():
    assert MunshiAdapter(client=FakeMunshiClient(avail=True)).available() is True
    assert MunshiAdapter(client=FakeMunshiClient(avail=False)).available() is False


def test_munshi_adapter_skips_dismissed():
    lib = {"people": [], "total": 2, "items": [
        {"id": 1, "kind": "note", "status": "dismissed",
         "ts": "2026-06-01T00:00:00Z", "payload": {"text": "ignore me"}},
        {"id": 2, "kind": "note", "status": "open",
         "ts": "2026-06-02T00:00:00Z", "payload": {"text": "keep me"}},
    ]}
    arts = list(MunshiAdapter(client=FakeMunshiClient(library=lib)).artifacts())
    assert [a.uid for a in arts] == ["munshi:2"]


def test_munshi_adapter_maps_item_to_artifact():
    lib = {"people": [], "total": 1, "items": [{
        "id": 7,
        "kind": "todo",
        "status": "open",
        "ts": "2026-06-12T11:00:00Z",
        "payload": {"text": "Draft a Gauss's law worksheet"},
        "tags": ["physics", "worksheet"],
        "person": "Khanak",
        "due": "2026-06-20",
    }]}
    arts = list(MunshiAdapter(client=FakeMunshiClient(library=lib)).artifacts())
    assert len(arts) == 1
    a = arts[0]
    assert a.uid == "munshi:7"
    assert a.source == "munshi"
    assert a.kind == "todo"
    assert a.title == "Draft a Gauss's law worksheet"
    assert a.subject == "physics"
    assert a.unit is None
    assert a.chapter is None
    assert a.status == "open"
    assert a.path is None
    assert a.url is None
    assert a.updated_at == "2026-06-12T11:00:00Z"
    assert a.meta == {
        "payload": {"text": "Draft a Gauss's law worksheet"},
        "tags": ["physics", "worksheet"],
        "person": "Khanak",
        "due": "2026-06-20",
    }


def test_munshi_adapter_title_falls_back_to_kind():
    lib = {"people": [], "total": 1, "items": [{
        "id": 8, "kind": "issue", "status": "open",
        "ts": "2026-06-12T11:00:00Z", "payload": {},
    }]}
    a = list(MunshiAdapter(client=FakeMunshiClient(library=lib)).artifacts())[0]
    assert a.title == "issue"
    assert a.meta["tags"] is None and a.meta["person"] is None and a.meta["due"] is None


# ---------------- registration ----------------

def test_subsystem_adapters_registered():
    names = {a.name for a in ALL_ADAPTERS}
    assert {"mycontentdev", "munshi"} <= names
    assert isinstance(get_adapter("mycontentdev"), McdAdapter)
    assert isinstance(get_adapter("munshi"), MunshiAdapter)
