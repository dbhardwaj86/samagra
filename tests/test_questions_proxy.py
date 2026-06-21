"""absolutize_assets — rewrite QX's relative /asset URLs to absolute QX URLs so
the browser loads question figures (and equation-image fallbacks) directly from
the QX server, while the Questions app is served from SAMAGRA's own origin.
"""
from __future__ import annotations

from samagra import questions_proxy as qp


def test_rewrites_asset_src_to_absolute():
    payload = {"results": [
        {"html": '<div class="stem">x</div><img class="fig" src="/asset?slug=a&amp;id=f1">'},
    ]}
    out = qp.absolutize_assets(payload, "http://127.0.0.1:8783")
    assert out["results"][0]["html"] == (
        '<div class="stem">x</div>'
        '<img class="fig" src="http://127.0.0.1:8783/asset?slug=a&amp;id=f1">'
    )


def test_rewrites_every_asset_occurrence():
    payload = {"results": [
        {"html": '<img src="/asset?slug=a&amp;id=eq1"><img class="fig" src="/asset?slug=a&amp;id=f1">'},
    ]}
    out = qp.absolutize_assets(payload, "http://127.0.0.1:8783/")  # trailing slash tolerated
    assert out["results"][0]["html"].count('src="http://127.0.0.1:8783/asset?') == 2
    assert "/asset?" not in out["results"][0]["html"].replace("http://127.0.0.1:8783/asset?", "")


def test_tolerates_missing_html_and_results():
    assert qp.absolutize_assets({"mode": "exact"}, "http://x") == {"mode": "exact"}
    out = qp.absolutize_assets({"results": [{"q_uid": "q1"}]}, "http://x")
    assert out["results"][0] == {"q_uid": "q1"}
