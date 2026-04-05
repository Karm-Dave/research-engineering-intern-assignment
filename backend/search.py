import json
import time
import re
import logging
import math
from datetime import datetime
from typing import List, Dict, Any, Optional

import numpy as np
from groq import Groq

from config import GROQ_API_KEY, GROQ_MODEL
from embeddings import EmbeddingEngine
from database import get_collection

logger = logging.getLogger("simppl")

class SemanticSearch:
    def __init__(self, posts: List[Dict[str, Any]], embeddings: np.ndarray, engine: EmbeddingEngine):
        self.engine = engine
        self.last_message = ""
        self._related_cache: Dict[str, Dict[str, Any]] = {}
        self.collection = get_collection()

    def _build_reddit_url(self, post: Dict[str, Any]) -> str:
        permalink = post.get("permalink")
        if permalink:
            return f"https://www.reddit.com{permalink}"
        subreddit = post.get("subreddit")
        pid = post.get("id")
        if subreddit and pid:
            return f"https://www.reddit.com/r/{subreddit}/comments/{pid}/"
        url = post.get("url", "")
        if isinstance(url, str) and ("reddit.com" in url or "redd.it" in url):
            return url
        return ""

    def _with_reddit_url(self, post: Dict[str, Any]) -> Dict[str, Any]:
        enriched = dict(post)
        enriched["reddit_url"] = self._build_reddit_url(post)
        return enriched

    def search(self, query: str, top_k: int = 10, filter_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        self.last_message = ""
        if not query or len(query.strip()) < 3:
            self.last_message = "Query too short"
            return []

        try:
            query_vec = self.engine.get_embedding_for_query(query)
        except Exception as e:
            self.last_message = f"Embeddings engine error: {e}"
            return []

        try:
            query_vec = self.engine.get_embedding_for_query(query).tolist()
            from database import get_pinecone_index
            index = get_pinecone_index()
            
            pinecone_filter = {}
            if filter_domain:
                pinecone_filter["domain"] = filter_domain
                
            res = index.query(
                vector=query_vec,
                top_k=top_k * 2, # Increase to account for title/content dual duplicates
                include_metadata=False,
                filter=pinecone_filter if pinecone_filter else None
            )
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            self.last_message = "Vector search index missing or loading, falling back to keyword search."
            return self.search_lexical(query, top_k, filter_domain)

        # Map to original post IDs and deduct duplicates (keep highest score)
        best_scores = {}
        for match in res.get("matches", []):
            post_id = match["id"].rsplit("-", 1)[0]
            score = match.get("score", 0.0)
            if post_id not in best_scores or score > best_scores[post_id]:
                best_scores[post_id] = score
                
        # Sort by score descending
        sorted_ids = sorted(best_scores.keys(), key=lambda x: best_scores[x], reverse=True)[:top_k]
        
        if not sorted_ids:
            self.last_message = "No results found"
            return []
            
        # MongoDB Hydration
        mongo_docs = list(self.collection.find({"id": {"$in": sorted_ids}}, {"_id": 0}))
        doc_map = {d["id"]: d for d in mongo_docs}
        
        out = []
        for rank, pid in enumerate(sorted_ids):
            if pid in doc_map:
                post = self._with_reddit_url(doc_map[pid])
                out.append({
                    "post": post,
                    "score": float(best_scores[pid]),
                    "rank": rank + 1
                })
        
        if not out:
            self.last_message = "No results found"
        return out

    def search_lexical(self, query: str, top_k: int = 10, filter_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        self.last_message = ""
        if not query or len(query.strip()) < 3:
            self.last_message = "Query too short"
            return []
        
        match_stage = {}
        if filter_domain:
            match_stage["domain"] = filter_domain
            
        q = query.lower().strip()
        match_stage["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"text": {"$regex": q, "$options": "i"}}
        ]
        
        results = list(self.collection.find(match_stage, {"_id": 0, "embedding": 0}).limit(top_k))
        
        if not results:
            self.last_message = "No results found"
            return []
            
        out = []
        for rank, r in enumerate(results):
            post = self._with_reddit_url(r)
            out.append({"post": post, "score": 1.0, "rank": rank + 1})
        
        logger.info("Lexical search fallback used for query: %s", query)
        return out

    def _get_post_ts(self, post: Dict[str, Any]) -> Optional[float]:
        created_utc = post.get("created_utc")
        if isinstance(created_utc, (int, float)):
            return float(created_utc)
        created_date = post.get("created_date")
        if created_date:
            try:
                dt = datetime.strptime(created_date, "%Y-%m-%d")
                return dt.timestamp()
            except Exception:
                return None
        return None

    def _merge_candidates(
        self,
        semantic_results: List[Dict[str, Any]],
        lexical_results: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        merged: Dict[str, Dict[str, Any]] = {}
        for item in semantic_results:
            post = item.get("post", {})
            pid = post.get("id")
            if not pid:
                continue
            merged[pid] = {
                "post": post,
                "semantic_score": float(item.get("score", 0.0)),
                "lexical_match": False,
            }
        for item in lexical_results:
            post = item.get("post", {})
            pid = post.get("id")
            if not pid:
                continue
            if pid not in merged:
                merged[pid] = {
                    "post": post,
                    "semantic_score": 0.0,
                    "lexical_match": True,
                }
            else:
                merged[pid]["lexical_match"] = True
        return list(merged.values())

    def _rerank_candidates(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not candidates:
            return []

        semantic_scores = [c.get("semantic_score", 0.0) for c in candidates]
        sem_min = min(semantic_scores) if semantic_scores else 0.0
        sem_max = max(semantic_scores) if semantic_scores else 1.0
        sem_range = (sem_max - sem_min) or 1.0

        upvotes = [max(0, (c.get("post", {}).get("score") or 0)) for c in candidates]
        max_log = math.log1p(max(upvotes)) if upvotes else 1.0

        timestamps = [self._get_post_ts(c.get("post", {})) for c in candidates]
        ts_vals = [t for t in timestamps if t is not None]
        ts_min = min(ts_vals) if ts_vals else None
        ts_max = max(ts_vals) if ts_vals else None

        def recency_score(ts: Optional[float]) -> float:
            if ts is None or ts_min is None or ts_max is None:
                return 0.0
            if ts_max == ts_min:
                return 1.0
            return (ts - ts_min) / (ts_max - ts_min)

        def text_length_score(post: Dict[str, Any]) -> float:
            text = (post.get("text") or "").strip()
            if not text:
                return 0.0
            return min(len(text) / 400.0, 1.0)

        reranked = []
        for c, ts in zip(candidates, timestamps):
            post = c.get("post", {})
            sem_norm = (c.get("semantic_score", 0.0) - sem_min) / sem_range if sem_range else 0.0
            score_val = max(0, post.get("score", 0) or 0)
            upvote_norm = math.log1p(score_val) / max_log if max_log else 0.0
            recency_norm = recency_score(ts)
            text_norm = text_length_score(post)

            final_score = (
                0.5 * sem_norm
                + 0.2 * upvote_norm
                + 0.2 * recency_norm
                + 0.1 * text_norm
            )
            reranked.append({
                "post": post,
                "score": float(final_score),
                "semantic_score": float(c.get("semantic_score", 0.0)),
                "lexical_match": bool(c.get("lexical_match")),
            })

        reranked.sort(key=lambda x: x["score"], reverse=True)
        for idx, item in enumerate(reranked, start=1):
            item["rank"] = idx
        return reranked

    def search_reranked(self, query: str, top_k: int = 10, filter_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            semantic_results = self.search(query, top_k=20, filter_domain=filter_domain)
            lexical_results = self.search_lexical(query, top_k=20, filter_domain=filter_domain)
            candidates = self._merge_candidates(semantic_results, lexical_results)
            reranked = self._rerank_candidates(candidates)
            return reranked[:top_k]
        except Exception as e:
            logger.warning("Reranking failed: %s", e)
            return self.search(query, top_k=top_k, filter_domain=filter_domain)

    def get_related_queries(self, query: str, results: List[Dict[str, Any]]) -> List[str]:
        if not query:
            return []
        cached = self._related_cache.get(query)
        if cached and (time.time() - cached["ts"]) < 3600:
            return cached["data"]

        titles = [r["post"].get("title", "") for r in results[:3]]
        if not titles:
            return []

        prompt = (
            f'Given the search query "{query}" and these post titles: {titles}, '
            'suggest exactly 3 related search queries a researcher might want to explore next. '
            'Return ONLY a JSON array of 3 strings, nothing else. '
            'Example: ["query1","query2","query3"]'
        )

        try:
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3,
            )
            content = response.choices[0].message.content
            data = json.loads(content)
            if isinstance(data, list) and len(data) == 3:
                self._related_cache[query] = {"ts": time.time(), "data": data}
                return data
        except Exception:
            return []

        return []

    def get_related_queries_from_history(self, query: str, history: List[str]) -> List[str]:
        if not query:
            return []

        history_clean = [h.strip() for h in (history or []) if isinstance(h, str) and h.strip()]
        history_clean = history_clean[-5:]
        cache_key = f"{query}::{'|'.join(history_clean)}"
        cached = self._related_cache.get(cache_key)
        if cached and (time.time() - cached["ts"]) < 3600:
            return cached["data"]

        prompt = f"""You are helping users explore a dataset through search queries.

Based on the current query and previous queries, suggest 3 relevant follow-up questions the user might want to ask next.

Rules:
* Suggestions must be related to the current topic.
* Do NOT bring back old unrelated topics.
* Suggestions should help explore trends, causes, comparisons, or related topics.
* Keep each suggestion short (one sentence).

Current query: {query}
Previous queries: {history_clean}
Return ONLY a JSON array of 3 strings."""

        try:
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3,
            )
            content = response.choices[0].message.content
            data = json.loads(content)
            if isinstance(data, list) and len(data) == 3:
                self._related_cache[cache_key] = {"ts": time.time(), "data": data}
                return data
        except Exception:
            return []

        return []
