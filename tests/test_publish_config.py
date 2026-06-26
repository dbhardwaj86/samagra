from samagra import config


def test_published_dir_is_a_durable_repo_root_sibling():
    assert config.PUBLISHED_DIR == config.REPO_ROOT / "published"
