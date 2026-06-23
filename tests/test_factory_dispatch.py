import pytest
from samagra.factory import dispatch

def test_run_line_invokes_export_with_the_lane_variant(monkeypatch, tmp_path):
    calls = {}
    html = tmp_path / "circular-motion-thin.html"
    html.write_text("<h1>Circular Motion</h1>", encoding="utf-8")
    def fake_export_one(slug, variant, **kw):
        calls["args"] = (slug, variant)
        calls["kw"] = kw
        return {"variant": variant, "html": str(html), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)

    result = dispatch.run_line("revision", "circular-motion")
    assert calls["args"] == ("circular-motion", "thin")   # revision -> thin
    assert calls["kw"].get("upload_gdocs") is False        # H1: factory never uploads
    assert result["html"] == str(html)

def test_validate_product_passes_for_nonempty_html(tmp_path):
    html = tmp_path / "x.html"; html.write_text("<p>ok</p>", encoding="utf-8")
    dispatch.validate_product("revision", {"html": str(html)})  # no raise

def test_validate_product_raises_on_missing_or_empty(tmp_path):
    with pytest.raises(ValueError):
        dispatch.validate_product("revision", {"html": str(tmp_path / "nope.html")})
    empty = tmp_path / "e.html"; empty.write_text("", encoding="utf-8")
    with pytest.raises(ValueError):
        dispatch.validate_product("revision", {"html": str(empty)})

def test_validate_seed_for_line_rejects_wrong_prefix():
    with pytest.raises(ValueError):
        dispatch.validate_seed_for_line("revision", "mcd:1")
    dispatch.validate_seed_for_line("revision", "textbook:circular-motion")  # no raise
