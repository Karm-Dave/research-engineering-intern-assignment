import json
import time
import re
import logging
from typing import List, Dict, Any, Optional

import numpy as np
from groq import Groq

from config import GROQ_API_KEY, GROQ_MODEL
from embeddings import EmbeddingEngine


logger = logging.getLogger("simppl")


class SemanticSearch:
    def __init__(self, posts: List[Dict[str, Any]], embeddings: np.ndarray, engine: EmbeddingEngine):
        self.posts = posts
        self.embeddings = embeddings
        self.engine = engine
        self.last_message = ""
        self._related_cache: Dict[str, Dict[str, Any]] = {}

    def search(self, query: str, top_k: int = 10, filter_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        self.last_message = ""
        if not query or len(query.strip()) < 3:
            self.last_message = "Query too short"
            return []
        if self.embeddings is None or len(self.embeddings) == 0:
            self.last_message = "No results found"
            return []

        query_vec = self.engine.get_embedding_for_query(query)
        scores = self.engine.cosine_similarity(query_vec, self.embeddings)
        ranked_idx = np.argsort(scores)[::-1]

        results: List[Dict[str, Any]] = []
        for rank, idx in enumerate(ranked_idx[: max(top_k * 5, top_k)]):
            post = self.posts[int(idx)]
            if filter_domain and post.get("domain") != filter_domain:
                continue
            results.append({"post": post, "score": float(scores[int(idx)]), "rank": rank + 1})
            if len(results) >= top_k:
                break

        if not results:
            self.last_message = "No results found"
        return results

    def search_lexical(self, query: str, top_k: int = 10, filter_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        self.last_message = ""
        if not query or len(query.strip()) < 3:
            self.last_message = "Query too short"
            return []
        terms = [t for t in re.split(r"\W+", query.lower().strip()) if t]
        if not terms:
            self.last_message = "Query too short"
            return []
        scored = []
        for post in self.posts:
            if filter_domain and post.get("domain") != filter_domain:
                continue
            hay = f"{post.get('title','')} {post.get('text','')}".lower()
            matches = sum(1 for t in terms if t in hay)
            if matches == 0:
                continue
            score = matches / max(len(terms), 1)
            scored.append((score, post))
        if not scored:
            self.last_message = "No results found"
            return []
        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for rank, (score, post) in enumerate(scored[:top_k], start=1):
            results.append({"post": post, "score": float(score), "rank": rank})
        logger.info("Lexical search fallback used for query: %s", query)
        return results

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
