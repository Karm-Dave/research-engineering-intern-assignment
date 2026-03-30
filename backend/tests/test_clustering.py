import tempfile
import numpy as np

import embeddings as emb
import clustering as cl
from tests import make_test_posts


def _setup_clusterer(tmpdir, posts):
    emb.CACHE_DIR = tmpdir
    cl.CACHE_DIR = tmpdir
    engine = emb.EmbeddingEngine(posts)
    vectors = engine.compute_embeddings()
    clusterer = cl.TopicClusterer(posts, vectors)
    # Avoid Groq API calls in tests
    clusterer.get_cluster_summary = lambda cluster_id, posts_in_cluster: "summary"

    # Speed up tests by bypassing UMAP
    def _fast_reduce(n_components=2, n_neighbors=15):
        rng = np.random.RandomState(42)
        return rng.rand(len(posts), n_components)

    clusterer.reduce_dimensions = _fast_reduce
    return clusterer


def test_cluster_returns_labels():
    posts = make_test_posts(10)
    with tempfile.TemporaryDirectory() as tmpdir:
        clusterer = _setup_clusterer(tmpdir, posts)
        data = clusterer.get_full_cluster_data(n_clusters=4)
        assert isinstance(data, list)
        if data:
            assert "cluster_id" in data[0]
            assert "keywords" in data[0]


def test_n_clusters_clamped_low():
    posts = make_test_posts(6)
    with tempfile.TemporaryDirectory() as tmpdir:
        clusterer = _setup_clusterer(tmpdir, posts)
        labels = clusterer.cluster(n_clusters=1)
        assert len(labels) == len(posts)
        assert len(set(labels)) <= 2


def test_n_clusters_clamped_high():
    posts = make_test_posts(8)
    with tempfile.TemporaryDirectory() as tmpdir:
        clusterer = _setup_clusterer(tmpdir, posts)
        labels = clusterer.cluster(n_clusters=100)
        assert len(labels) == len(posts)
        assert len(set(labels)) <= len(posts)


def test_keywords_returned():
    posts = make_test_posts(8)
    with tempfile.TemporaryDirectory() as tmpdir:
        clusterer = _setup_clusterer(tmpdir, posts)
        labels = clusterer.cluster(n_clusters=3)
        keywords = clusterer.get_cluster_keywords(labels)
        assert len(keywords) > 0
        for kw in keywords.values():
            assert len(kw) > 0


def test_umap_points_have_xy():
    posts = make_test_posts(8)
    with tempfile.TemporaryDirectory() as tmpdir:
        clusterer = _setup_clusterer(tmpdir, posts)
        clusterer.cluster(n_clusters=3)
        points = clusterer.get_umap_points()
        assert len(points) == len(posts)
        for p in points:
            assert isinstance(p["x"], float)
            assert isinstance(p["y"], float)


def test_cluster_ids_consistent():
    posts = make_test_posts(10)
    with tempfile.TemporaryDirectory() as tmpdir:
        clusterer = _setup_clusterer(tmpdir, posts)
        clusters = clusterer.get_full_cluster_data(n_clusters=4)
        points = clusterer.get_umap_points()
        cluster_ids = {c["cluster_id"] for c in clusters}
        point_ids = {p["cluster_id"] for p in points}
        assert point_ids.issubset(cluster_ids)
