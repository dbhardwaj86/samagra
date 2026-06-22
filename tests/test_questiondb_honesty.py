"""W3.4 — the questiondb adapter is an offline stub yielding 0 artifacts, so it
must not report available()=True. An operator console that lists a permanently
empty source as "OK" is dishonest. The stub stays (it records the deploy target),
but reports unavailable until the HF Space actually serves.
"""
from __future__ import annotations

from samagra.adapters.questiondb import QuestionDBAdapter


def test_offline_stub_reports_unavailable():
    ad = QuestionDBAdapter()
    assert ad.available() is False


def test_summary_still_records_the_target_url():
    ad = QuestionDBAdapter()
    summ = ad.summary()
    assert "url" in summ and summ["url"]
    assert "offline" in summ["status"].lower()


def test_yields_no_artifacts():
    assert list(QuestionDBAdapter().artifacts()) == []
