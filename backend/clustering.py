import os
import time
from typing import List, Dict, Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from groq import Groq

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
        cursor = self.collection.find({}, {"_id": 0}).sort("created_utc", -1).limit(2000)
        
        self.posts = []
        embeds = []
        
        for doc in cursor:
            embedding = doc.pop("embedding", None)
            if embedding and len(embedding) > 0:
                self.posts.append(doc)
                embeds.append(embedding)
                
        if embeds:
            self.embeddings = np.array(embeds)
        else:
            self.embeddings = np.array([])
            
        self._last_sync = time.time()
        self._cluster_cache = {} # Invalidate memory cache when syncing new data

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
        
        if n_clusters < 2:
            n_clusters = 2
        if n_clusters > 50:
            n_clusters = 50
            
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

    def get_cluster_summary(self, cluster_id: int, posts_in_cluster: List[Dict[str, Any]]) -> str:
        cache_key = f"{cluster_id}:{len(posts_in_cluster)}"
        cached = self._summary_cache.get(cache_key)
        if cached and (time.time() - cached["ts"]) < 3600:
            return cached["data"]

        titles = [p.get("title", "") for p in posts_in_cluster[:10]]
        prompt = (
            "Summarize in 2 sentences what these Reddit posts from multiple political subreddits are about: "
            f"{titles}. Be specific and factual."
        )

        try:
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3,
            )
            summary = response.choices[0].message.content.strip()
        except Exception as e:
            summary = f"[Summary unavailable: {str(e)[:50]}]"

        self._summary_cache[cache_key] = {"ts": time.time(), "data": summary}
        return summary

    def get_full_cluster_data(self, n_clusters: int = 8) -> List[Dict[str, Any]]:
        self.sync_data()
        
        if n_clusters in self._cluster_cache:
            return self._cluster_cache[n_clusters]

        labels = self.cluster(n_clusters=n_clusters)
        if len(labels) == 0:
            return []

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
            summary = self.get_cluster_summary(int(cluster_id), cluster_posts)

            clusters.append(
                {
                    "cluster_id": int(cluster_id),
                    "size": len(cluster_posts),
                    "keywords": keywords.get(int(cluster_id), []),
                    "summary": summary,
                    "posts": top_posts,
                    "centroid_x": centroid_x,
                    "centroid_y": centroid_y,
                    "color": color,
                }
            )

        self._cluster_cache[n_clusters] = clusters
        return clusters

    def get_umap_points(self) -> List[Dict[str, Any]]:
        self.sync_data()
        
        if self._last_labels is None:
            self._last_labels = self.cluster(n_clusters=8)
        labels = self._last_labels if self._last_labels is not None else np.array([])
        
        if len(self.embeddings) == 0:
            return []
            
        coords_2d = self.reduce_dimensions(n_components=2)

        points: List[Dict[str, Any]] = []
        for i, post in enumerate(self.posts):
            if i >= len(coords_2d):
                continue
            points.append(
                {
                    "id": post.get("id", ""),
                    "x": float(coords_2d[i, 0]),
                    "y": float(coords_2d[i, 1]),
                    "cluster_id": int(labels[i]) if len(labels) > i else 0,
                    "title": post.get("title", ""),
                    "score": post.get("score", 0),
                    "author": post.get("author", ""),
                    "is_self": bool(post.get("is_self")),
                }
            )
        return points
