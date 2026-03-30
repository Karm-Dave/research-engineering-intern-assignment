import hashlib
import time
from datetime import datetime
from typing import List, Dict, Any

from groq import Groq

from config import GROQ_API_KEY, GROQ_MODEL


class TimeSeriesAnalyzer:
    def __init__(self, posts: List[Dict[str, Any]]) -> None:
        self.posts = posts
        self._summary_cache: Dict[str, Dict[str, Any]] = {}

    def _hash_data(self, data: List[Dict[str, Any]]) -> str:
        sample = str(data[:50]).encode("utf-8")
        return hashlib.md5(sample).hexdigest()

    def get_posts_per_day(self) -> List[Dict[str, Any]]:
        counts: Dict[str, int] = {}
        for post in self.posts:
            date = post.get("created_date") or ""
            if not date:
                continue
            counts[date] = counts.get(date, 0) + 1
        return [{"date": d, "count": counts[d]} for d in sorted(counts.keys())]

    def get_posts_per_week(self) -> List[Dict[str, Any]]:
        buckets: Dict[str, Dict[str, Any]] = {}
        for post in self.posts:
            date_str = post.get("created_date") or ""
            if not date_str:
                continue
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                year, week, _ = dt.isocalendar()
                key = f"{year}-W{week:02d}"
            except Exception:
                continue
            if key not in buckets:
                buckets[key] = {"count": 0, "score_sum": 0}
            buckets[key]["count"] += 1
            buckets[key]["score_sum"] += post.get("score", 0)
        out = []
        for key in sorted(buckets.keys()):
            count = buckets[key]["count"]
            avg_score = buckets[key]["score_sum"] / count if count else 0
            out.append({"week": key, "count": count, "avg_score": round(avg_score, 2)})
        return out

    def get_score_trend(self) -> List[Dict[str, Any]]:
        buckets: Dict[str, Dict[str, Any]] = {}
        for post in self.posts:
            date = post.get("created_date") or ""
            if not date:
                continue
            if date not in buckets:
                buckets[date] = {"count": 0, "score_sum": 0}
            buckets[date]["count"] += 1
            buckets[date]["score_sum"] += post.get("score", 0)
        out = []
        for date in sorted(buckets.keys()):
            count = buckets[date]["count"]
            avg_score = buckets[date]["score_sum"] / count if count else 0
            out.append({"date": date, "avg_score": round(avg_score, 2), "total_posts": count})
        return out

    def get_domain_trend(self, top_n: int = 10) -> Dict[str, List[Dict[str, Any]]]:
        domain_counts: Dict[str, int] = {}
        for post in self.posts:
            domain = post.get("domain") or ""
            if not domain:
                continue
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
        top_domains = [d for d, _ in sorted(domain_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]]

        trends: Dict[str, Dict[str, int]] = {d: {} for d in top_domains}
        for post in self.posts:
            domain = post.get("domain") or ""
            if domain not in trends:
                continue
            date = post.get("created_date") or ""
            if not date:
                continue
            trends[domain][date] = trends[domain].get(date, 0) + 1

        out: Dict[str, List[Dict[str, Any]]] = {}
        for domain, counts in trends.items():
            out[domain] = [{"date": d, "count": counts[d]} for d in sorted(counts.keys())]
        return out

    def get_topic_trend(self, keyword: str) -> List[Dict[str, Any]]:
        if not keyword:
            return []
        key = keyword.lower()
        buckets: Dict[str, Dict[str, Any]] = {}
        for post in self.posts:
            text = f"{post.get('title','')} {post.get('text','')}".lower()
            if key not in text:
                continue
            date = post.get("created_date") or ""
            if not date:
                continue
            if date not in buckets:
                buckets[date] = {"count": 0, "titles": []}
            buckets[date]["count"] += 1
            buckets[date]["titles"].append(post.get("title", ""))

        out = []
        for date in sorted(buckets.keys()):
            out.append({"date": date, "count": buckets[date]["count"], "matching_posts_titles": buckets[date]["titles"]})
        return out

    def generate_timeseries_summary(self, data: List[Dict[str, Any]], metric_name: str) -> str:
        data_hash = self._hash_data(data)
        cache_key = f"{metric_name}:{data_hash}"
        cached = self._summary_cache.get(cache_key)
        if cached and (time.time() - cached["ts"]) < 3600:
            return cached["data"]

        data_sample = data[:50]
        prompt = (
            "You are a data analyst. Here is a time series of "
            f"{metric_name} from multiple political subreddits: {data_sample}. "
            "Write 2-3 sentences describing the key trend, any notable spikes, and what might explain them. "
            "Be concise and specific."
        )
        try:
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
                temperature=0.3,
            )
            summary = response.choices[0].message.content.strip()
        except Exception as e:
            summary = f"[Summary unavailable: {str(e)[:50]}]"

        self._summary_cache[cache_key] = {"ts": time.time(), "data": summary}
        return summary

    def get_all_timeseries_data(self) -> Dict[str, Any]:
        posts_per_day = self.get_posts_per_day()
        posts_per_week = self.get_posts_per_week()
        score_trend = self.get_score_trend()
        domain_trend = self.get_domain_trend()

        return {
            "posts_per_day": posts_per_day,
            "posts_per_week": posts_per_week,
            "score_trend": score_trend,
            "domain_trend": domain_trend,
            "summaries": {
                "posts_per_day": self.generate_timeseries_summary(posts_per_day, "posts per day"),
                "posts_per_week": self.generate_timeseries_summary(posts_per_week, "posts per week"),
                "score_trend": self.generate_timeseries_summary(score_trend, "average score per day"),
            },
        }
