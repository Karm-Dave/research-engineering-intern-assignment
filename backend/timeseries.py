import hashlib
import time
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Callable, Optional

from groq import Groq

from config import GROQ_API_KEY, GROQ_MODEL


class TimeSeriesAnalyzer:
    def __init__(self, posts: List[Dict[str, Any]]) -> None:
        self.posts = posts
        self._summary_cache: Dict[str, Dict[str, Any]] = {}

    def _hash_data(self, data: List[Dict[str, Any]]) -> str:
        sample = str(data[:50]).encode("utf-8")
        return hashlib.md5(sample).hexdigest()

    def _parse_day(self, date_str: str) -> Optional[datetime]:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d")
        except Exception:
            return None

    def _parse_week(self, week_str: str) -> Optional[datetime]:
        try:
            year_str, week_str = week_str.split("-W")
            return datetime.fromisocalendar(int(year_str), int(week_str), 1)
        except Exception:
            return None

    def _insert_gap_markers(
        self,
        data: List[Dict[str, Any]],
        date_key: str,
        value_keys: List[str],
        gap_days: int,
        parse_fn: Callable[[str], Optional[datetime]],
    ) -> List[Dict[str, Any]]:
        if not data:
            return []

        out: List[Dict[str, Any]] = []
        prev_dt: Optional[datetime] = None
        prev_date: Optional[str] = None

        for item in data:
            date_val = item.get(date_key)
            if not date_val:
                continue
            curr_dt = parse_fn(date_val)
            if prev_dt and curr_dt:
                if (curr_dt - prev_dt).days > gap_days:
                    marker = {date_key: f"gap-{prev_date}-to-{date_val}", "gap": True}
                    for k in value_keys:
                        marker[k] = None
                    out.append(marker)
            out.append(item)
            prev_dt = curr_dt
            prev_date = date_val

        return out

    def strip_gap_markers(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [d for d in data if not d.get("gap")]

    def _get_post_date(self, post):
        if post.get("created_date"):
            return post["created_date"]
        if post.get("created_utc"):
            return datetime.fromtimestamp(
                post["created_utc"], timezone.utc
            ).strftime("%Y-%m-%d")
        return None

    def get_posts_per_day(self) -> List[Dict[str, Any]]:
        counts: Dict[str, int] = {}
        for post in self.posts:
            date = self._get_post_date(post)
            if not date:
                continue
            counts[date] = counts.get(date, 0) + 1

        if not counts:
            return []

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
            date = self._get_post_date(post)
            if not date:
                continue
            if date not in buckets:
                buckets[date] = {"count": 0, "score_sum": 0}
            buckets[date]["count"] += 1
            buckets[date]["score_sum"] += post.get("score", 0)

        if not buckets:
            return []

        out = []
        for d in sorted(buckets.keys()):
            count = buckets[d]["count"]
            avg_score = buckets[d]["score_sum"] / count if count else 0
            out.append({"date": d, "avg_score": round(avg_score, 2), "total_posts": count})

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
            date = self._get_post_date(post)
            if not date:
                continue
            trends[domain][date] = trends[domain].get(date, 0) + 1

        out: Dict[str, List[Dict[str, Any]]] = {}
        for domain, counts in trends.items():
            out[domain] = [{"date": d, "count": counts[d]} for d in sorted(counts.keys())]
        return out

    def get_topic_trend(self, keyword: str, include_gaps: bool = True) -> List[Dict[str, Any]]:
        if not keyword:
            return []
        key = keyword.lower()
        buckets: Dict[str, Dict[str, Any]] = {}
        for post in self.posts:
            text = f"{post.get('title','')} {post.get('text','')}".lower()
            if key not in text:
                continue
            date = self._get_post_date(post)
            if not date:
                continue
            if date not in buckets:
                buckets[date] = {"count": 0, "titles": []}
            buckets[date]["count"] += 1
            buckets[date]["titles"].append(post.get("title", ""))

        out = []
        for date in sorted(buckets.keys()):
            out.append({"date": date, "count": buckets[date]["count"], "matching_posts_titles": buckets[date]["titles"]})

        if not include_gaps:
            return out

        return self._insert_gap_markers(out, "date", ["count"], 30, self._parse_day)

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
        gap_days = 30

        posts_per_day_raw = self.get_posts_per_day()
        posts_per_week_raw = self.get_posts_per_week()
        score_trend_raw = self.get_score_trend()
        domain_trend_raw = self.get_domain_trend()

        posts_per_day = self._insert_gap_markers(
            posts_per_day_raw, "date", ["count"], gap_days, self._parse_day
        )
        posts_per_week = self._insert_gap_markers(
            posts_per_week_raw, "week", ["count", "avg_score"], gap_days, self._parse_week
        )
        score_trend = self._insert_gap_markers(
            score_trend_raw, "date", ["avg_score", "total_posts"], gap_days, self._parse_day
        )

        domain_trend: Dict[str, List[Dict[str, Any]]] = {}
        for domain, series in domain_trend_raw.items():
            domain_trend[domain] = self._insert_gap_markers(
                series, "date", ["count"], gap_days, self._parse_day
            )

        return {
            "posts_per_day": posts_per_day,
            "posts_per_week": posts_per_week,
            "score_trend": score_trend,
            "domain_trend": domain_trend,
            "summaries": {
                "posts_per_day": self.generate_timeseries_summary(posts_per_day_raw, "posts per day"),
                "posts_per_week": self.generate_timeseries_summary(posts_per_week_raw, "posts per week"),
                "score_trend": self.generate_timeseries_summary(score_trend_raw, "average score per day"),
            },
        }
