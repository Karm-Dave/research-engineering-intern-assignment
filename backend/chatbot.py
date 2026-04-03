from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

from groq import Groq
import logging

from config import GROQ_API_KEY, GROQ_MODEL, SIMILARITY_THRESHOLD
from search import SemanticSearch


logger = logging.getLogger("simppl")


class DataChatbot:
    def _call_groq(self, messages):
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=500,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()

    def _fallback_response(self, results: List[Dict[str, Any]]) -> str:
        titles = [r.get('post', {}).get('title', '') for r in results[:3] if r.get('post')]
        titles = [t for t in titles if t]
        if not titles:
            return 'I found related posts but could not reach the LLM right now.'
        joined = '; '.join(titles)
        return f'LLM response timed out. Top matching posts include: {joined}.'


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
            text = post.get("text", "") or ""
            if not text.strip():
                url = f"https://reddit.com{post.get('permalink', '')}" if post.get('permalink') else post.get('url', '')
            else:
                url = post.get("url", "")
            
            lines.append(
                f"POST {i}: Title: {title} | Score: {score} | Date: {date} | URL: {url} | Text snippet: {text}"
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

        results = self.search_engine.search(query, top_k=100)
        
        filtered_results = [r for r in results if r.get("score", 0.0) >= SIMILARITY_THRESHOLD]
        if not filtered_results and results:
            filtered_results = results[:2]
        
        # Prioritize posts with actual text over purely linked posts
        filtered_results.sort(
            key=lambda x: (bool((x.get("post", {}).get("text") or "").strip()), x.get("score", 0.0)),
            reverse=True
        )
        
        results = filtered_results
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
            "Answer questions based on the provided post data. You MUST base your analysis PRIMARILY on posts that contain actual paragraph 'Text snippet' content. "
            "Avoid citing posts with empty or missing Text snippets unless absolutely necessary to mention a highly relevant Title. "
            "IMPORTANT: Whenever you refer to a post, explicitly format it as an inline Markdown link targeting its exact URL, like this: [POST 1](URL). "
            "Provide comprehensive, in-depth analysis while strictly maintaining absolute accuracy. "
            "Data from posts is provided as context - only use this data, do not hallucinate."
        )

        messages = [{"role": "system", "content": system_prompt}]
        if isinstance(conversation_history, list):
            for turn in conversation_history[-6:]:
                if isinstance(turn, dict) and "role" in turn and "content" in turn:
                    messages.append({"role": turn["role"], "content": turn["content"]})

        context = self._build_context(results, top_k=len(results))
        user_message = f"Question: {query}\n\nContext:\n{context}"
        messages.append({"role": "user", "content": user_message})

        if not GROQ_API_KEY:
            answer = self._fallback_response(results)
        else:
            try:
                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(self._call_groq, messages)
                    answer = future.result(timeout=12)
            except FuturesTimeout:
                logger.warning("Groq timeout - using fallback response")
                answer = self._fallback_response(results)
            except Exception as e:
                answer = f"[Response unavailable: {str(e)[:50]}]"

        related_queries = self.search_engine.get_related_queries(query, results)

        return {
            "response": answer,
            "sources": sources,
            "related_queries": related_queries,
            "search_results_count": len(results),
        }
