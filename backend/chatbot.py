from typing import List, Dict, Any

from groq import Groq

from config import GROQ_API_KEY, GROQ_MODEL
from search import SemanticSearch


class DataChatbot:
    def __init__(self, posts: List[Dict[str, Any]], search_engine: SemanticSearch) -> None:
        self.posts = posts
        self.search_engine = search_engine

    def _build_context(self, results: List[Dict[str, Any]], top_k: int = 5) -> str:
        lines = []
        for i, item in enumerate(results[:top_k], start=1):
            post = item.get("post", {})
            title = post.get("title", "")
            score = post.get("score", 0)
            date = post.get("created_date", "")
            text = (post.get("text", "") or "")[:200]
            lines.append(
                f"POST {i}: Title: {title} | Score: {score} | Date: {date} | Text snippet: {text}"
            )
        return "\n".join(lines)

    def chat(self, query: str, conversation_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        if not isinstance(query, str) or not query.strip():
            return {
                "response": "Please provide a non-empty query.",
                "sources": [],
                "related_queries": [],
                "search_results_count": 0,
            }

        results = self.search_engine.search(query, top_k=5)
        sources = [r.get("post", {}) for r in results]

        if not sources:
            return {
                "response": "No relevant posts found in the dataset for that query.",
                "sources": [],
                "related_queries": [],
                "search_results_count": 0,
            }

        system_prompt = (
            "You are an expert researcher analyzing Reddit posts from multiple political subreddits. "
            "Answer questions based on the provided post data. Be factual and cite specific posts when possible. "
            "If the data doesn't contain relevant information, say so. Keep responses concise (2-4 sentences unless more detail is needed). "
            "Data from posts is provided as context - only use this data, do not hallucinate."
        )

        messages = [{"role": "system", "content": system_prompt}]
        if isinstance(conversation_history, list):
            for turn in conversation_history[-6:]:
                if isinstance(turn, dict) and "role" in turn and "content" in turn:
                    messages.append({"role": turn["role"], "content": turn["content"]})

        context = self._build_context(results, top_k=5)
        user_message = f"Question: {query}\n\nContext:\n{context}"
        messages.append({"role": "user", "content": user_message})

        try:
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                max_tokens=300,
                temperature=0.3,
            )
            answer = response.choices[0].message.content.strip()
        except Exception as e:
            answer = f"[Response unavailable: {str(e)[:50]}]"

        related_queries = self.search_engine.get_related_queries(query, results)

        return {
            "response": answer,
            "sources": sources,
            "related_queries": related_queries,
            "search_results_count": len(results),
        }
