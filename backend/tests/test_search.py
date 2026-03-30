import os
import tempfile
import numpy as np

import embeddings as emb
from tests import make_test_posts


def _setup_engine(tmpdir, posts):
    emb.CACHE_DIR = tmpdir
    return emb.EmbeddingEngine(posts)


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
