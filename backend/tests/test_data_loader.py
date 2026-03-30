import tempfile
import os

from data_loader import DataLoader


REQUIRED_KEYS = [
    "id",
    "title",
    "text",
    "score",
    "upvote_ratio",
    "author",
    "author_flair",
    "created_utc",
    "created_date",
    "num_comments",
    "domain",
    "url",
    "subreddit",
    "permalink",
    "is_self",
    "post_hint",
    "link_flair",
    "is_crosspost",
    "crosspost_subreddit",
]


def test_loads_without_crash():
    loader = DataLoader()
    posts = loader.get_posts()
    assert isinstance(posts, list)


def test_post_has_required_fields():
    loader = DataLoader()
    posts = loader.get_posts()
    if not posts:
        return
    for post in posts:
        for key in REQUIRED_KEYS:
            assert key in post


def test_no_null_crashes():
    loader = DataLoader()
    posts = loader.get_posts()
    if not posts:
        return
    string_keys = [
        "id",
        "title",
        "text",
        "author",
        "author_flair",
        "created_date",
        "domain",
        "url",
        "subreddit",
        "permalink",
        "post_hint",
        "link_flair",
        "crosspost_subreddit",
    ]
    for post in posts:
        for key in string_keys:
            val = post.get(key)
            assert val is not None
            assert isinstance(val, str)


def test_stats_returns_expected_keys():
    loader = DataLoader()
    stats = loader.get_stats()
    for key in ["total_posts", "date_range", "top_authors", "top_domains", "avg_score", "total_comments"]:
        assert key in stats


def test_empty_data_dir_handled(monkeypatch):
    with tempfile.TemporaryDirectory() as tmpdir:
        import data_loader as dl

        monkeypatch.setattr(dl, "DATA_DIR", tmpdir)
        monkeypatch.setattr(dl, "CACHE_DIR", tmpdir)
        loader = dl.DataLoader()
        posts = loader.get_posts()
        assert posts == []
