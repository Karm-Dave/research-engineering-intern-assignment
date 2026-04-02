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

        pipeline = [
            {
                "$vectorSearch": {
                    "index": "vector_index",
                    "path": "embedding",
                    "queryVector": query_vec.tolist(),
                    "numCandidates": top_k * 10,
                    "limit": top_k
                }
            }
        ]

        # Note: In Atlas, $vectorSearch must be the extremely first stage.
        # Filtering is done inside $vectorSearch if needed, but for simplicity,
        # we can $match afterwards if dataset is relatively small, or build an exact filter block.
        # It's better to filter directly in vectorSearch if possible.
        if filter_domain:
            pipeline[0]["$vectorSearch"]["filter"] = {"domain": filter_domain}

        pipeline.append({
            "$addFields": {
                "score": {"$meta": "vectorSearchScore"}
            }
        })
        pipeline.append({
            "$project": {
                "_id": 0,
                "embedding": 0
            }
        })

        try:
            results = list(self.collection.aggregate(pipeline))
        except Exception as e:
            logger.error(f"Vector search failed (index might not be ready): {e}")
            self.last_message = "Vector search index missing or loading, falling back to keyword search."
            return self.search_lexical(query, top_k, filter_domain)

        out = []
        for rank, r in enumerate(results):
            score = r.pop("score", 0.0)
            out.append({"post": r, "score": float(score), "rank": rank + 1})

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
