import asyncio
import os
import time
from typing import Dict, Any

from fastapi import FastAPI, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from data_loader import DataLoader
from embeddings import EmbeddingEngine
from search import SemanticSearch
from clustering import TopicClusterer
from network_analysis import NetworkAnalyzer
from timeseries import TimeSeriesAnalyzer
from chatbot import DataChatbot
from config import GROQ_MODEL


app = FastAPI(title="SimPPL Research Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    loader = DataLoader()
    posts = loader.get_posts()

    engine = EmbeddingEngine(posts)
    embeddings = engine.get_embeddings()
    search = SemanticSearch(posts, embeddings, engine)
    clusterer = TopicClusterer(posts, embeddings)
    network = NetworkAnalyzer(posts)
    ts = TimeSeriesAnalyzer(posts)
    chatbot = DataChatbot(posts, search)

    app.state.loader = loader
    app.state.posts = posts
    app.state.engine = engine
    app.state.search = search
    app.state.clusterer = clusterer
    app.state.network = network
    app.state.timeseries = ts
    app.state.chatbot = chatbot

    app.state.cache_timeseries = {"ts": 0, "data": None}
    app.state.cache_clusters: Dict[int, Dict[str, Any]] = {}


@app.get("/api/health")
async def health():
    posts = getattr(app.state, "posts", [])
    return {"status": "ok", "posts_loaded": len(posts), "model": GROQ_MODEL}


@app.get("/api/stats")
async def stats():
    loader = app.state.loader
    base = loader.get_stats()

    network = app.state.network
    domain_graph = network.build_domain_network()
    author_graph = network.build_author_network()

    base["network"] = {
        "domain": {
            "nodes": domain_graph.number_of_nodes(),
            "edges": domain_graph.number_of_edges(),
        },
        "author": {
            "nodes": author_graph.number_of_nodes(),
            "edges": author_graph.number_of_edges(),
        },
    }
    return base


@app.get("/api/posts")
async def posts(page: int = 1, per_page: int = 20, sort_by: str = "score"):
    all_posts = app.state.posts
    total = len(all_posts)

    if sort_by == "date":
        sorted_posts = sorted(all_posts, key=lambda p: p.get("created_utc", 0), reverse=True)
    elif sort_by == "comments":
        sorted_posts = sorted(all_posts, key=lambda p: p.get("num_comments", 0), reverse=True)
    else:
        sorted_posts = sorted(all_posts, key=lambda p: p.get("score", 0), reverse=True)

    start = max((page - 1) * per_page, 0)
    end = start + per_page
    return {"posts": sorted_posts[start:end], "total": total, "page": page, "per_page": per_page}


@app.get("/api/timeseries")
async def timeseries(granularity: str = "day"):
    ts_cache = app.state.cache_timeseries
    if ts_cache["data"] and (time.time() - ts_cache["ts"]) < 600:
        return ts_cache["data"]

    ts = app.state.timeseries
    data = ts.get_all_timeseries_data()
    if granularity == "week":
        data["active_granularity"] = "week"
    else:
        data["active_granularity"] = "day"

    ts_cache["ts"] = time.time()
    ts_cache["data"] = data
    return data


@app.get("/api/timeseries/topic")
async def topic_timeseries(keyword: str = Query(...)):
    ts = app.state.timeseries
    data = ts.get_topic_trend(keyword)
    summary = ts.generate_timeseries_summary(data, f"topic trend for {keyword}") if data else ""
    return {"keyword": keyword, "data": data, "summary": summary}


@app.get("/api/network")
async def network(type: str = "domain", top_n: int = 50, metric: str = "pagerank"):
    analyzer = app.state.network
    if type == "author":
        G = analyzer.build_author_network()
    else:
        G = analyzer.build_domain_network()

    if metric == "betweenness":
        metric_dict = analyzer.compute_betweenness(G)
    else:
        metric_dict = analyzer.compute_pagerank(G)

    graph_json = analyzer.get_graph_json(G, metric_dict, top_n_nodes=top_n)
    return graph_json


@app.get("/api/network/remove-top-node")
async def network_remove_top_node(type: str = "domain"):
    analyzer = app.state.network
    if type == "author":
        G = analyzer.build_author_network()
    else:
        G = analyzer.build_domain_network()
    metric_dict = analyzer.compute_pagerank(G)
    return analyzer.remove_top_node_analysis(G, metric_dict)


@app.get("/api/clusters")
async def clusters(n_clusters: int = 8):
    clusterer = app.state.clusterer
    cache = app.state.cache_clusters

    n = n_clusters
    if n < 2:
        n = 2
    if n > 50:
        n = 50

    if n in cache and (time.time() - cache[n]["ts"]) < 3600:
        return cache[n]["data"]

    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, lambda: clusterer.get_full_cluster_data(n_clusters=n))
    cache[n] = {"ts": time.time(), "data": data}
    return data


@app.get("/api/embeddings-viz")
async def embeddings_viz():
    clusterer = app.state.clusterer
    loop = asyncio.get_event_loop()
    points = await loop.run_in_executor(None, clusterer.get_umap_points)
    clusters = await loop.run_in_executor(None, lambda: clusterer.get_full_cluster_data(n_clusters=8))
    return {"points": points, "clusters": clusters}


@app.post("/api/search")
async def search(payload: Dict[str, Any] = Body(...)):
    query = payload.get("query", "")
    top_k = int(payload.get("top_k", 10))
    filter_domain = payload.get("filter_domain")

    searcher = app.state.search
    results = searcher.search(query, top_k=top_k, filter_domain=filter_domain)
    related = searcher.get_related_queries(query, results) if results else []

    return {
        "results": results,
        "related_queries": related,
        "count": len(results),
        "message": searcher.last_message,
    }


@app.post("/api/chat")
async def chat(payload: Dict[str, Any] = Body(...)):
    query = payload.get("query", "")
    history = payload.get("conversation_history", [])
    if not isinstance(query, str):
        return {"response": "Invalid query", "sources": [], "related_queries": [], "search_results_count": 0}
    if not isinstance(history, list):
        history = []

    bot = app.state.chatbot
    return bot.chat(query, conversation_history=history)


@app.get("/api/domains")
async def domains():
    posts = app.state.posts
    counts: Dict[str, int] = {}
    for post in posts:
        domain = post.get("domain") or ""
        if not domain:
            continue
        counts[domain] = counts.get(domain, 0) + 1
    out = [{"domain": d, "count": c} for d, c in sorted(counts.items(), key=lambda x: x[1], reverse=True)]
    return out


@app.get("/api/authors")
async def authors():
    posts = app.state.posts
    counts: Dict[str, int] = {}
    for post in posts:
        author = post.get("author") or "[deleted]"
        counts[author] = counts.get(author, 0) + 1
    out = [{"author": a, "count": c} for a, c in sorted(counts.items(), key=lambda x: x[1], reverse=True)[:50]]
    return out


# Mount static files after API routes
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
