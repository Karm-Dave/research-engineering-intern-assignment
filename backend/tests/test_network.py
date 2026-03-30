import networkx as nx

from network_analysis import NetworkAnalyzer
from tests import make_test_posts


def _make_posts():
    posts = make_test_posts(8)
    # Ensure some external domains and crosspost data
    posts[0]["is_self"] = False
    posts[0]["domain"] = "example.com"
    posts[1]["is_self"] = False
    posts[1]["domain"] = "example.com"
    posts[2]["is_self"] = False
    posts[2]["domain"] = "another.com"
    posts[3]["crosspost_author"] = "user_99"
    return posts


def test_domain_network_builds():
    posts = _make_posts()
    analyzer = NetworkAnalyzer(posts)
    G = analyzer.build_domain_network()
    assert isinstance(G, nx.DiGraph)
    assert G.number_of_nodes() > 0


def test_author_network_builds():
    posts = _make_posts()
    analyzer = NetworkAnalyzer(posts)
    G = analyzer.build_author_network()
    assert isinstance(G, nx.Graph)


def test_pagerank_sums_to_one():
    posts = _make_posts()
    analyzer = NetworkAnalyzer(posts)
    G = analyzer.build_domain_network()
    pr = analyzer.compute_pagerank(G)
    if pr:
        total = sum(pr.values())
        assert abs(total - 1.0) < 0.01


def test_graph_json_format():
    posts = _make_posts()
    analyzer = NetworkAnalyzer(posts)
    G = analyzer.build_domain_network()
    pr = analyzer.compute_pagerank(G)
    graph_json = analyzer.get_graph_json(G, pr, top_n_nodes=10)
    assert "nodes" in graph_json
    assert "edges" in graph_json
    assert "stats" in graph_json


def test_disconnected_components_handled():
    G = nx.Graph()
    G.add_edge("a", "b")
    G.add_edge("c", "d")
    analyzer = NetworkAnalyzer([])
    pr = analyzer.compute_pagerank(G)
    graph_json = analyzer.get_graph_json(G, pr, top_n_nodes=10)
    assert "stats" in graph_json


def test_remove_top_node():
    posts = _make_posts()
    analyzer = NetworkAnalyzer(posts)
    G = analyzer.build_domain_network()
    pr = analyzer.compute_pagerank(G)
    result = analyzer.remove_top_node_analysis(G, pr)
    assert "removed_node" in result
    assert "before_stats" in result
    assert "after_stats" in result
