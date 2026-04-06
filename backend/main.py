import asyncio
import os
import time
import logging
from typing import Dict, Any

from fastapi import FastAPI, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import numpy as np
from data_loader import DataLoader
from embeddings import EmbeddingEngine
from search import SemanticSearch
from clustering import TopicClusterer
from network_analysis import NetworkAnalyzer
from timeseries import TimeSeriesAnalyzer
from chatbot import DataChatbot
from config import GROQ_MODEL
from database import init_db
from config import FRONTEND_URL

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="[%(asctime)s] %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("simppl")

app = FastAPI(title="SimPPL Research Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://arcanumdata.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Initialize MongoDB layout
    init_db()
    
    loader = DataLoader()
    engine = EmbeddingEngine()
    search = SemanticSearch([], np.array([]), engine) # Dummy lists, it queries DB
    bot = DataChatbot([], search)
    clusterer = TopicClusterer()

    app.state.loader = loader
    app.state.engine = engine
    app.state.search = search
    app.state.clusterer = clusterer
    app.state.chatbot = bot

    app.state.cache_timeseries = {"ts": 0, "data": None}
    app.state.cache_clusters: Dict[int, Dict[str, Any]] = {}
    app.state.embeddings_error = ""
    
    logger.info("Application initialized via MongoDB Atlas.")

def _ensure_embeddings():
    try:
        count = app.state.loader.collection.count_documents({})
        if count == 0:
            msg = "Fetching latest Reddit posts and computing embeddings in the background... Please wait a few minutes."
            app.state.embeddings_error = msg
            return None, msg
        app.state.embeddings_error = ""
        return None, None
    except Exception as exc:
        app.state.embeddings_error = str(exc)
        logger.exception("Database status failed")
        return None, str(exc)


@app.get("/api/health")
async def health():
    try:
        count = app.state.loader.collection.count_documents({})
        if count == 0:
            app.state.embeddings_error = "Fetching newest submissions and generating embeddings..."
    except Exception as e:
        app.state.embeddings_error = f"Database Error: {e}"
        count = 0
    return {"status": "ok", "posts_loaded": count, "model": GROQ_MODEL, "embeddings_error": app.state.embeddings_error}

@app.get("/api/stats")
async def stats():
    loader = app.state.loader
    base = loader.get_stats()

    # Network analyzer relies on static posts, so fetch top 500 recent posts for network preview
    recent_posts = list(app.state.loader.collection.find({}, {"_id": 0, "embedding": 0}).sort("created_utc", -1).limit(500))
    network = NetworkAnalyzer(recent_posts)
    
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
    collection = app.state.loader.collection
    total = collection.count_documents({})
    
    sort_dir = -1
    sort_field = "score"
    if sort_by == "date":
        sort_field = "created_utc"
    elif sort_by == "comments":
        sort_field = "num_comments"
        
    start = max((page - 1) * per_page, 0)
    sorted_posts = list(collection.find({}, {"_id": 0, "embedding": 0}).sort(sort_field, sort_dir).skip(start).limit(per_page))
    
    return {"posts": sorted_posts, "total": total, "page": page, "per_page": per_page}

@app.get("/api/timeseries")
async def timeseries(granularity: str = "day"):
    ts_cache = app.state.cache_timeseries
    if ts_cache["data"] and (time.time() - ts_cache["ts"]) < 600:
        return ts_cache["data"]

    # Remove limit(2000) to ensure historical data doesn't clip out artificially producing massive dips
    recent_posts = list(app.state.loader.collection.find({}, {"_id": 0, "embedding": 0}).sort("created_utc", -1))
    ts = TimeSeriesAnalyzer(recent_posts)
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
    recent_posts = list(app.state.loader.collection.find({}, {"_id": 0, "embedding": 0}).sort("created_utc", -1))
    ts = TimeSeriesAnalyzer(recent_posts)
    data = ts.get_topic_trend(keyword, include_gaps=True)
    summary_source = ts.strip_gap_markers(data)
    summary = ts.generate_timeseries_summary(summary_source, f"topic trend for {keyword}") if summary_source else ""
    return {"keyword": keyword, "data": data, "summary": summary}

@app.get("/api/network")
async def network(type: str = "domain", top_n: int = 50, metric: str = "pagerank"):
    recent_posts = list(app.state.loader.collection.find({}, {"_id": 0, "embedding": 0}).sort("created_utc", -1).limit(1000))
    analyzer = NetworkAnalyzer(recent_posts)
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
    recent_posts = list(app.state.loader.collection.find({}, {"_id": 0, "embedding": 0}).sort("created_utc", -1).limit(1000))
    analyzer = NetworkAnalyzer(recent_posts)
    if type == "author":
        G = analyzer.build_author_network()
    else:
        G = analyzer.build_domain_network()
    metric_dict = analyzer.compute_pagerank(G)
    return analyzer.remove_top_node_analysis(G, metric_dict)

@app.get("/api/clusters")
async def clusters(n_clusters: int = 8):
    _, err = _ensure_embeddings()
    if err:
        return []

    n = max(4, min(n_clusters, 10))

    from database import get_db
    db = get_db()
    coll = db["precomputed_clusters"]
    
    struct_data = coll.find_one({"n_clusters": n}, {"_id": 0})
    if not struct_data:
        # Fallback trigger if background pre-computation hasn't run yet
        clusterer = app.state.clusterer
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: clusterer.precompute_all_clusters())
        struct_data = coll.find_one({"n_clusters": n}, {"_id": 0})
        
    if not struct_data:
        return []

    # Generate the LLM stories actively and concurrently 
    from clustering import generate_dynamic_summaries
    final_data = await generate_dynamic_summaries(struct_data)
    
    return final_data.get("clusters", [])

@app.get("/api/embeddings-viz")
async def embeddings_viz():
    _, err = _ensure_embeddings()
    if err:
        return {"points": [], "clusters": [], "error": err}
        
    from database import get_db
    db = get_db()
    coll = db["precomputed_clusters"]
    
    struct_data = coll.find_one({"n_clusters": 8}, {"_id": 0})
    if not struct_data:
        return {"points": [], "clusters": []}
        
    from clustering import generate_dynamic_summaries
    final_data = await generate_dynamic_summaries(struct_data)
    
    return {"points": final_data.get("points", []), "clusters": final_data.get("clusters", [])}

@app.post("/api/search")
async def search(payload: Dict[str, Any] = Body(...)):
    _, err = _ensure_embeddings()
    query = payload.get("query", "")
    top_k = int(payload.get("top_k", 10))
    filter_domain = payload.get("filter_domain")

    searcher = app.state.search
    if err:
        results = searcher.search_lexical(query, top_k=top_k, filter_domain=filter_domain)
        return {
            "results": results,
            "related_queries": [],
            "count": len(results),
            "message": f"{err} Using keyword search.",
        }

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
    _, err = _ensure_embeddings()
    query = payload.get("query", "")
    query_history = payload.get("query_history")
    if not isinstance(query, str):
        return {"response": "Invalid query", "sources": [], "related_queries": [], "search_results_count": 0}
    if not isinstance(query_history, list):
        history = payload.get("conversation_history", [])
        if isinstance(history, list):
            query_history = [
                t.get("content") for t in history
                if isinstance(t, dict) and t.get("role") == "user" and isinstance(t.get("content"), str)
            ]
        else:
            query_history = []
    query_history = query_history[-5:]

    bot = app.state.chatbot
    if err:
        searcher = app.state.search
        results = searcher.search_lexical(query, top_k=5)
        sources = [r.get("post", {}) for r in results]
        response = bot._fallback_response(results) if results else err
        related = searcher.get_related_queries_from_history(query, query_history)
        return {"response": response, "sources": sources, "related_queries": related, "search_results_count": len(results)}

    return bot.chat(query, query_history=query_history)

@app.get("/api/domains")
async def domains():
    pipeline = [{"$group": {"_id": "$domain", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    counts = list(app.state.loader.collection.aggregate(pipeline))
    out = [{"domain": d["_id"], "count": d["count"]} for d in counts if d["_id"]]
    return out

@app.get("/api/authors")
async def authors():
    pipeline = [{"$group": {"_id": "$author", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 50}]
    counts = list(app.state.loader.collection.aggregate(pipeline))
    out = [{"author": d["_id"], "count": d["count"]} for d in counts if d["_id"]]
    return out

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

