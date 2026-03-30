import itertools
from typing import List, Dict, Any

import networkx as nx


EXCLUDED_DOMAINS = {"reddit.com", "i.redd.it", "v.redd.it", ""}


class NetworkAnalyzer:
    def __init__(self, posts: List[Dict[str, Any]]) -> None:
        self.posts = posts

    def build_domain_network(self) -> nx.DiGraph:
        G = nx.DiGraph()
        for post in self.posts:
            if post.get("is_self"):
                continue
            domain = post.get("domain") or ""
            if domain in EXCLUDED_DOMAINS:
                continue
            author = post.get("author") or "[deleted]"
            if not G.has_node(author):
                G.add_node(author, type="author")
            if not G.has_node(domain):
                G.add_node(domain, type="domain")
            if G.has_edge(author, domain):
                G[author][domain]["weight"] += 1
            else:
                G.add_edge(author, domain, weight=1)
        return G

    def build_author_network(self) -> nx.Graph:
        G = nx.Graph()

        # Crosspost edges (if original author known)
        for post in self.posts:
            author = post.get("author") or "[deleted]"
            original_author = post.get("crosspost_author") or ""
            if original_author and original_author != author:
                if not G.has_node(author):
                    G.add_node(author, type="author")
                if not G.has_node(original_author):
                    G.add_node(original_author, type="author")
                if G.has_edge(author, original_author):
                    G[author][original_author]["weight"] += 1
                else:
                    G.add_edge(author, original_author, weight=1)

        # Shared domain edges
        domain_authors: Dict[str, set] = {}
        for post in self.posts:
            if post.get("is_self"):
                continue
            domain = post.get("domain") or ""
            if domain in EXCLUDED_DOMAINS:
                continue
            author = post.get("author") or "[deleted]"
            domain_authors.setdefault(domain, set()).add(author)

        for authors in domain_authors.values():
            if len(authors) < 2:
                continue
            for a, b in itertools.combinations(sorted(authors), 2):
                if not G.has_node(a):
                    G.add_node(a, type="author")
                if not G.has_node(b):
                    G.add_node(b, type="author")
                if G.has_edge(a, b):
                    G[a][b]["weight"] += 1
                else:
                    G.add_edge(a, b, weight=1)

        return G

    def compute_pagerank(self, G: nx.Graph, alpha: float = 0.85) -> Dict[Any, float]:
        if G.number_of_nodes() == 0:
            return {}
        return nx.pagerank(G, alpha=alpha)

    def compute_betweenness(self, G: nx.Graph, sample_size: int = 200) -> Dict[Any, float]:
        if G.number_of_nodes() == 0:
            return {}
        if G.number_of_nodes() <= sample_size:
            return nx.betweenness_centrality(G)
        return nx.betweenness_centrality(G, k=sample_size)

    def get_top_nodes(self, G: nx.Graph, metric_dict: Dict[Any, float], top_n: int = 20) -> List[Dict[str, Any]]:
        ranked = sorted(metric_dict.items(), key=lambda x: x[1], reverse=True)[:top_n]
        out = []
        for node, score in ranked:
            node_type = G.nodes[node].get("type", "author") if node in G.nodes else "author"
            out.append({"node": node, "metric": float(score), "type": node_type})
        return out

    def _graph_stats(self, G: nx.Graph) -> Dict[str, Any]:
        num_nodes = G.number_of_nodes()
        num_edges = G.number_of_edges()
        density = nx.density(G) if num_nodes > 1 else 0
        if isinstance(G, nx.DiGraph):
            components = nx.number_weakly_connected_components(G) if num_nodes else 0
        else:
            components = nx.number_connected_components(G) if num_nodes else 0
        return {
            "num_nodes": num_nodes,
            "num_edges": num_edges,
            "density": round(density, 4) if density else 0,
            "components": components,
        }

    def get_graph_json(self, G: nx.Graph, metric_dict: Dict[Any, float], top_n_nodes: int = 50) -> Dict[str, Any]:
        if G.number_of_nodes() == 0:
            return {"nodes": [], "edges": [], "stats": self._graph_stats(G)}

        ranked = sorted(metric_dict.items(), key=lambda x: x[1], reverse=True)
        top_nodes = {node for node, _ in ranked[:top_n_nodes]}

        scores = [metric_dict.get(n, 0.0) for n in top_nodes]
        max_score = max(scores) if scores else 1.0
        min_score = min(scores) if scores else 0.0
        denom = (max_score - min_score) or 1.0

        nodes = []
        for node in top_nodes:
            node_type = G.nodes[node].get("type", "author") if node in G.nodes else "author"
            score = float(metric_dict.get(node, 0.0))
            norm = (score - min_score) / denom
            size = 5 + norm * 30
            color = "#60a5fa" if node_type == "author" else "#f59e0b"
            nodes.append(
                {
                    "id": node,
                    "label": node,
                    "score": score,
                    "type": node_type,
                    "size": size,
                    "color": color,
                }
            )

        edges = []
        for u, v, data in G.edges(data=True):
            if u in top_nodes and v in top_nodes:
                edges.append({"source": u, "target": v, "weight": data.get("weight", 1)})

        return {
            "nodes": nodes,
            "edges": edges,
            "stats": self._graph_stats(G),
        }

    def remove_top_node_analysis(self, G: nx.Graph, metric_dict: Dict[Any, float]):
        if not metric_dict:
            return {
                "removed_node": None,
                "before_stats": self._graph_stats(G),
                "after_stats": self._graph_stats(G),
            }

        top_node = max(metric_dict.items(), key=lambda x: x[1])[0]
        before_stats = self._graph_stats(G)

        G2 = G.copy()
        if top_node in G2:
            G2.remove_node(top_node)
        after_stats = self._graph_stats(G2)

        # Recompute PageRank after removal (for analysis consistency)
        _ = self.compute_pagerank(G2)

        return {
            "removed_node": top_node,
            "before_stats": before_stats,
            "after_stats": after_stats,
        }
