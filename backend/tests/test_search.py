import os
import tempfile
import numpy as np

import embeddings as emb
from search import SemanticSearch
from tests import make_test_posts


def _setup_engine(tmpdir, posts):
    emb.CACHE_DIR = tmpdir
    return emb.EmbeddingEngine(posts)


def _setup_search(tmpdir, posts):
    engine = _setup_engine(tmpdir, posts)
    vectors = engine.compute_embeddings()
    return SemanticSearch(posts, vectors, engine)


def test_embeddings_computed():
    posts = make_test_posts(5)
    with tempfile.TemporaryDirectory() as tmpdir:
        engine = _setup_engine(tmpdir, posts)
        vecs = engine.compute_embeddings()
        assert vecs.shape == (len(posts), 384)


def test_embeddings_cached():
    posts = make_test_posts(5)
    with tempfile.TemporaryDirectory() as tmpdir:
        engine = _setup_engine(tmpdir, posts)
        first = engine.compute_embeddings()
        assert os.path.exists(os.path.join(tmpdir, "embeddings.npy"))
        assert os.path.exists(os.path.join(tmpdir, "post_ids.json"))

        engine2 = _setup_engine(tmpdir, posts)
        second = engine2.compute_embeddings()
        assert second.shape == first.shape
        assert np.allclose(first, second)


def test_query_embedding_shape():
    posts = make_test_posts(3)
    with tempfile.TemporaryDirectory() as tmpdir:
        engine = _setup_engine(tmpdir, posts)
        q = engine.get_embedding_for_query("mutual aid and solidarity")
        assert q.shape == (384,)


def test_cosine_similarity_range():
    posts = make_test_posts(5)
    with tempfile.TemporaryDirectory() as tmpdir:
        engine = _setup_engine(tmpdir, posts)
        vecs = engine.compute_embeddings()
        q = engine.get_embedding_for_query("community support")
        sims = engine.cosine_similarity(q, vecs)
        assert np.all(sims <= 1.0 + 1e-6)
        assert np.all(sims >= -1.0 - 1e-6)


def test_semantic_search_returns_results():
    posts = make_test_posts(8)
    with tempfile.TemporaryDirectory() as tmpdir:
        searcher = _setup_search(tmpdir, posts)
        results = searcher.search("mutual aid")
        assert isinstance(results, list)


def test_semantic_search_top_k_respected():
    posts = make_test_posts(10)
    with tempfile.TemporaryDirectory() as tmpdir:
        searcher = _setup_search(tmpdir, posts)
        results = searcher.search("protest", top_k=5)
        assert len(results) <= 5


def test_empty_query_handled():
    posts = make_test_posts(5)
    with tempfile.TemporaryDirectory() as tmpdir:
        searcher = _setup_search(tmpdir, posts)
        results = searcher.search("")
        assert results == []
        assert searcher.last_message == "Query too short"


def test_short_query_handled():
    posts = make_test_posts(5)
    with tempfile.TemporaryDirectory() as tmpdir:
        searcher = _setup_search(tmpdir, posts)
        results = searcher.search("hi")
        assert results == []
        assert searcher.last_message == "Query too short"


def test_non_english_input():
    posts = make_test_posts(5)
    with tempfile.TemporaryDirectory() as tmpdir:
        searcher = _setup_search(tmpdir, posts)
        results = searcher.search("solidaridad")
        assert isinstance(results, list)


def test_zero_overlap_semantic():
    posts = make_test_posts(6)
    with tempfile.TemporaryDirectory() as tmpdir:
        searcher = _setup_search(tmpdir, posts)
        results = searcher.search("collective resource sharing")
        assert isinstance(results, list)
        assert len(results) > 0


def test_domain_filter():
    posts = make_test_posts(6)
    for i in range(3):
        posts[i]["domain"] = "alpha.com"
    for i in range(3, 6):
        posts[i]["domain"] = "beta.com"
    with tempfile.TemporaryDirectory() as tmpdir:
        searcher = _setup_search(tmpdir, posts)
        results = searcher.search("community", top_k=10, filter_domain="alpha.com")
        assert len(results) <= 10
        assert all(r["post"].get("domain") == "alpha.com" for r in results)
