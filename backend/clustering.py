import os
import time
from typing import List, Dict, Any

import numpy as np
import asyncio
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from groq import Groq, AsyncGroq

from config import CACHE_DIR, GROQ_API_KEY, GROQ_MODEL
from database import get_collection

COLOR_PALETTE = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4",
]

class TopicClusterer:
    def __init__(self) -> None:
        self.collection = get_collection()
        self._summary_cache: Dict[str, Dict[str, Any]] = {}
        self._cluster_cache: Dict[int, List[Dict[str, Any]]] = {}
        self._last_labels = None
        self._last_points = None
        
        # In-memory storage for the current cluster run
        self.posts: List[Dict[str, Any]] = []
        self.embeddings: np.ndarray = np.array([])
        self._last_sync = 0

    def sync_data(self):
        # Only sync if more than 5 minutes passed to avoid spamming DB during multiple cluster requests
        if time.time() - self._last_sync < 300 and len(self.posts) > 0:
            return
            
        # Fetching top 2000 recent posts with embeddings to limit memory usage
        cursor = list(self.collection.find({}, {"_id": 0}).sort("created_utc", -1))
        
        self.posts = []
        embeds = []
        
        if not cursor:
            self.embeddings = np.array([])
            return

        from database import get_pinecone_index
        index = get_pinecone_index()
        
        fetch_ids = [f"{doc['id']}-content" for doc in cursor] + [f"{doc['id']}-title" for doc in cursor]
        
        vector_results = {}
        for i in range(0, len(fetch_ids), 500):
            batch = fetch_ids[i:i+500]
            try:
                resp = index.fetch(ids=batch)
                vector_results.update(resp.get("vectors", {}))
            except Exception as e:
                print(f"Error fetching Pinecone vectors: {e}")
        
        for doc in cursor:
            pid = doc["id"]
            v_dict = vector_results.get(f"{pid}-content")
            if not v_dict:
                v_dict = vector_results.get(f"{pid}-title")
                
            if v_dict:
                vals = getattr(v_dict, "values", None)
                if vals is None and hasattr(v_dict, "get"):
                    vals = v_dict.get("values", None)
                    
                if vals:
                    self.posts.append(doc)
                    embeds.append(vals)
                
        if embeds:
            self.embeddings = np.array(embeds)
        else:
            self.embeddings = np.array([])
            
        self._last_sync = time.time()
        self._cluster_cache = {}

    def _umap_path(self, n_components: int) -> str:
        if n_components == 2:
            return os.path.join(CACHE_DIR, "umap_2d.npy")
        if n_components == 5:
            return os.path.join(CACHE_DIR, "umap_5d.npy")
        return os.path.join(CACHE_DIR, f"umap_{n_components}d.npy")

    def reduce_dimensions(self, n_components: int = 2, n_neighbors: int = 15) -> np.ndarray:
        if self.embeddings is None or len(self.embeddings) == 0:
            return np.zeros((0, n_components))

        # We will not cache UMAP to disk in a dynamic system since data shifts every 10 min.
        # We process in-memory.
        import umap

        reducer = umap.UMAP(
            n_components=n_components,
            n_neighbors=n_neighbors,
            min_dist=0.1,
            metric="cosine",
        )
        reduced = reducer.fit_transform(self.embeddings)
        return reduced

    def cluster(self, n_clusters: int = 8) -> np.ndarray:
        self.sync_data()
        
        if n_clusters < 4:
            n_clusters = 4
        if n_clusters > 10:
            n_clusters = 10
            
        if self.embeddings is None or len(self.embeddings) == 0:
            self._last_labels = np.array([])
            return self._last_labels
            
        if len(self.embeddings) < 2:
            self._last_labels = np.zeros(len(self.embeddings), dtype=int)
            return self._last_labels
            
        if n_clusters > len(self.embeddings):
            n_clusters = len(self.embeddings)

        reduced_5d = self.reduce_dimensions(n_components=5)
        model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = model.fit_predict(reduced_5d)
        self._last_labels = labels
        return labels

    def get_cluster_keywords(self, labels: np.ndarray, n_words: int = 8) -> Dict[int, List[str]]:
        if len(labels) == 0:
            return {}
        documents = [f"{p.get('title','')} {p.get('text','')}" for p in self.posts]
        vectorizer = TfidfVectorizer(max_features=1000, stop_words="english")
        tfidf = vectorizer.fit_transform(documents)
        terms = np.array(vectorizer.get_feature_names_out())

        cluster_keywords: Dict[int, List[str]] = {}
        for cluster_id in np.unique(labels):
            idx = np.where(labels == cluster_id)[0]
            if len(idx) == 0:
                cluster_keywords[int(cluster_id)] = []
                continue
            mean_tfidf = tfidf[idx].mean(axis=0)
            mean_arr = np.asarray(mean_tfidf).ravel()
            top_idx = mean_arr.argsort()[::-1][:n_words]
            cluster_keywords[int(cluster_id)] = terms[top_idx].tolist()
        return cluster_keywords

    def precompute_all_clusters(self):
        import logging
        log = logging.getLogger("simppl_clusterer")
        log.info("Beginning precomputation loops from N=4 to N=10")
        self.sync_data()
        if len(self.embeddings) == 0:
            return
            
        from database import get_db
        db = get_db()
        coll = db["precomputed_clusters"]
        
        for n in range(4, 11):
            log.info(f"Precomputing configuration N={n}")
            labels = self.cluster(n_clusters=n)
            coords_2d = self.reduce_dimensions(n_components=2)
            keywords = self.get_cluster_keywords(labels)
            
            clusters: List[Dict[str, Any]] = []
            for cluster_id in np.unique(labels):
                idx = np.where(labels == cluster_id)[0]
                cluster_posts = [self.posts[i] for i in idx]
                top_posts = sorted(cluster_posts, key=lambda p: p.get("score", 0), reverse=True)[:5]
                centroid_x = float(np.mean(coords_2d[idx, 0]))
                centroid_y = float(np.mean(coords_2d[idx, 1]))
                color = COLOR_PALETTE[int(cluster_id) % len(COLOR_PALETTE)]
                
                clusters.append({
                    "cluster_id": int(cluster_id),
                    "size": len(cluster_posts),
                    "keywords": keywords.get(int(cluster_id), []),
                    "posts": top_posts,
                    "centroid_x": centroid_x,
                    "centroid_y": centroid_y,
                    "color": color,
                    "_titles_for_summary": [p.get("title", "") for p in cluster_posts[:10]]
                })
            
            points = []
            for i, post in enumerate(self.posts):
                if i >= len(coords_2d): continue
                points.append({
                    "id": post.get("id", ""),
                    "x": float(coords_2d[i, 0]),
                    "y": float(coords_2d[i, 1]),
                    "cluster_id": int(labels[i]) if len(labels) > i else 0,
                    "title": post.get("title", ""),
                    "score": post.get("score", 0),
                    "author": post.get("author", ""),
                    "is_self": bool(post.get("is_self")),
                })

            struct_payload = {"n_clusters": n, "clusters": clusters, "points": points, "timestamp": time.time()}
            coll.update_one({"n_clusters": n}, {"$set": struct_payload}, upsert=True)
            
        log.info("Precomputations flawless. Stored arrays to MongoDB.")

async def _fetch_summary_async(client, c_id, titles):
    prompt = (
        "Summarize in just 2 snappy sentences what these Reddit posts discuss: "
        f"{titles}. Connect the topics organically. No generic filler."
    )
    try:
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.4,
        )
        return c_id, response.choices[0].message.content.strip()
    except Exception as e:
        return c_id, f"[Summary unavailable: {str(e)[:50]}]"

async def generate_dynamic_summaries(structured_data: Dict[str, Any]) -> Dict[str, Any]:
    client = AsyncGroq(api_key=GROQ_API_KEY)
    
    tasks = []
    for c in structured_data.get("clusters", []):
        titles = c.pop("_titles_for_summary", [])
        tasks.append(_fetch_summary_async(client, c["cluster_id"], titles))
        
    results = await asyncio.gather(*tasks)
    
    summary_map = dict(results)
    for c in structured_data.get("clusters", []):
        c["summary"] = summary_map.get(c["cluster_id"], "No summary generated")
        
    return structured_data
