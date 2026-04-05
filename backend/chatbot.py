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

    def _get_reddit_url(self, post: Dict[str, Any]) -> str:
        reddit_url = post.get("reddit_url")
        if reddit_url:
            return reddit_url
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

    def _build_context(self, results: List[Dict[str, Any]], top_k: int = 5) -> str:
        lines = []
        for i, item in enumerate(results[:top_k], start=1):
            post = item.get("post", {})
            title = post.get("title", "")
            score = post.get("score", 0)
            date = post.get("created_date", "")
            text = post.get("text", "") or ""
            url = self._get_reddit_url(post)
            
            lines.append(
                f"POST {i}: Title: {title} | Score: {score} | Date: {date} | URL: {url} | Text snippet: {text}"
            )
        return "\n".join(lines)

    def chat(self, query: str, query_history: List[str] = None) -> Dict[str, Any]:
        if not isinstance(query, str) or not query.strip():
            return {
                "response": "Please provide a non-empty query.",
                "sources": [],
                "related_queries": [],
                "search_results_count": 0,
            }

        results = self.search_engine.search_reranked(query, top_k=10)

        if results:
            filtered_results = []
            for r in results:
                sem_score = r.get("semantic_score", r.get("score", 0.0))
                if sem_score >= SIMILARITY_THRESHOLD or r.get("lexical_match"):
                    filtered_results.append(r)
            if not filtered_results:
                filtered_results = results[:2]
        else:
            filtered_results = []

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

        system_prompt = """You are a data analyst analyzing a collection of posts and discussions.

Your job is NOT to simply answer questions, but to analyze the posts and extract insights, trends, and narratives from the data.

When responding:
1. Identify the main topic or theme.
2. Summarize the key discussions or viewpoints.
3. Highlight important or influential posts.
4. Describe any patterns or trends if visible.
5. Provide an overall insight or conclusion.

IMPORTANT RULES:
* Use only the provided post data.
* Do NOT hallucinate information.
* Prefer posts that contain actual text content over empty posts.
* Base your analysis strictly on the retrieved posts.
* Keep the response analytical and insight-focused, not conversational.

You MUST format your response exactly like this:

MAIN THEME:
...

KEY DISCUSSION POINTS:

* ...
* ...

IMPORTANT POSTS:

* Post title - why it matters

PATTERNS OR TRENDS:
...

OVERALL INSIGHT:
...

Whenever you refer to a post, explicitly format it as an inline Markdown link targeting its exact URL, like this: [POST 1](URL). Use only the Reddit post URL (permalink) when creating links."""

        messages = [{"role": "system", "content": system_prompt}]
        context = self._build_context(results, top_k=len(results))
        user_message = f"""Question: {query}

Context:
{context}"""
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

        related_queries = self.search_engine.get_related_queries_from_history(query, query_history or [])

        return {
            "response": answer,
            "sources": sources,
            "related_queries": related_queries,
            "search_results_count": len(results),
        }
