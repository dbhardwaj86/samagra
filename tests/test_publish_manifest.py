from samagra.factory.publish import manifest


def test_schema_constant():
    assert manifest.SCHEMA == "samagra.published.v1"


def test_sha256_bytes_is_stable_and_distinguishes_content():
    a = manifest.sha256_bytes(b"hello")
    assert a == manifest.sha256_bytes(b"hello")          # deterministic
    assert a != manifest.sha256_bytes(b"hello!")         # content-sensitive
    assert len(a) == 64 and all(c in "0123456789abcdef" for c in a)


def _entry(chapter, lane, sha):
    return {"uid": f"published:{chapter}:{lane}", "lane": lane,
            "assignment_id": f"a-{lane}",
            "files": [{"rel": f"{chapter}/{chapter}-{lane}.html",
                       "sha256": sha, "bytes": 10}],
            "source_seed_ref": f"textbook:{chapter}", "style_seed_version": None,
            "captured_at": "T0", "published_at": "T1", "publication_id": "pub_x"}


def _pub(chapter, action, lanes, *, shas=None):
    shas = shas or {l: f"sha-{l}" for l in lanes}
    return {"publication_id": "pub_" + "".join(lanes), "action": action,
            "actor": "owner", "chapter": chapter, "seed_ref": f"textbook:{chapter}",
            "title": chapter.title(), "lanes": list(lanes), "at": "T1",
            "artifacts": [_entry(chapter, l, shas[l]) for l in lanes]}


def test_derive_empty():
    m = manifest.derive_manifest([], generated_at="T")
    assert m == {"schema": manifest.SCHEMA, "generated_at": "T",
                 "publication_count": 0, "chapters": {}}


def test_derive_single_publish_lists_the_artifact():
    m = manifest.derive_manifest([_pub("circular-motion", "publish", ["revision"])],
                                 generated_at="T")
    ch = m["chapters"]["circular-motion"]
    assert [a["lane"] for a in ch["artifacts"]] == ["revision"]
    assert ch["seed_ref"] == "textbook:circular-motion"


def test_derive_accumulates_lanes_across_publications():
    pubs = [_pub("cm", "publish", ["revision"]), _pub("cm", "publish", ["deck"])]
    ch = manifest.derive_manifest(pubs, generated_at="T")["chapters"]["cm"]
    assert sorted(a["lane"] for a in ch["artifacts"]) == ["deck", "revision"]


def test_derive_same_lane_last_write_wins():
    pubs = [_pub("cm", "publish", ["revision"], shas={"revision": "OLD"}),
            _pub("cm", "publish", ["revision"], shas={"revision": "NEW"})]
    ch = manifest.derive_manifest(pubs, generated_at="T")["chapters"]["cm"]
    assert len(ch["artifacts"]) == 1
    assert ch["artifacts"][0]["files"][0]["sha256"] == "NEW"


def test_derive_unpublish_removes_lane():
    pubs = [_pub("cm", "publish", ["revision", "deck"]),
            _pub("cm", "unpublish", ["deck"])]
    ch = manifest.derive_manifest(pubs, generated_at="T")["chapters"]["cm"]
    assert [a["lane"] for a in ch["artifacts"]] == ["revision"]


def test_derive_drops_chapter_when_all_lanes_withdrawn():
    pubs = [_pub("cm", "publish", ["revision"]),
            _pub("cm", "unpublish", ["revision"])]
    assert manifest.derive_manifest(pubs, generated_at="T")["chapters"] == {}


def test_unchanged_lanes_none_manifest_is_empty():
    cands = [{"lane": "revision", "files": [{"sha256": "x"}]}]
    assert manifest.unchanged_lanes(None, "cm", cands) == set()


def test_unchanged_lanes_matches_identical_sha_set():
    m = manifest.derive_manifest([_pub("cm", "publish", ["revision"],
                                       shas={"revision": "SAME"})], generated_at="T")
    cands = [{"lane": "revision", "files": [{"sha256": "SAME"}]}]
    assert manifest.unchanged_lanes(m, "cm", cands) == {"revision"}


def test_unchanged_lanes_excludes_changed_sha():
    m = manifest.derive_manifest([_pub("cm", "publish", ["revision"],
                                       shas={"revision": "OLD"})], generated_at="T")
    cands = [{"lane": "revision", "files": [{"sha256": "NEW"}]}]
    assert manifest.unchanged_lanes(m, "cm", cands) == set()
