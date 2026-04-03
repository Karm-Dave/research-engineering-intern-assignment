import json
import time
import re
import logging
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
                out.append({
                    "post": doc_map[pid],
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
            out.append({"post": r, "score": 1.0, "rank": rank + 1})
        
        logger.info("Lexical search fallback used for query: %s", query)
        return out

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
            f"Given the search query \"{query}\" and these Reddit post titles from multiple "
            f"political subreddits: {titles}, suggest exactly 3 related search queries a researcher "
            "might want to explore next. Return ONLY a JSON array of 3 strings, nothing else. "
            "Example: [\"query1\",\"query2\",\"query3\"]"
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
