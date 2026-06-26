from samagra.factory.publish import manifest


def test_schema_constant():
    assert manifest.SCHEMA == "samagra.published.v1"


def test_sha256_bytes_is_stable_and_distinguishes_content():
    a = manifest.sha256_bytes(b"hello")
    assert a == manifest.sha256_bytes(b"hello")          # deterministic
    assert a != manifest.sha256_bytes(b"hello!")         # content-sensitive
    assert len(a) == 64 and all(c in "0123456789abcdef" for c in a)
