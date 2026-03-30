import os
import json
import pickle
import html
import re
from datetime import datetime
from collections import Counter
from typing import List, Dict, Any

import pandas as pd

from config import DATA_DIR, CACHE_DIR


class DataLoader:
    def __init__(self) -> None:
        self._posts: List[Dict[str, Any]] = []
        self._data_files = self._get_data_files()
        self._cache_path = os.path.join(CACHE_DIR, "posts.pkl")
        self._load_posts()

    def _get_data_files(self) -> List[str]:
        if not os.path.exists(DATA_DIR):
            return []
        files = []
        for name in os.listdir(DATA_DIR):
            if name.endswith(".jsonl") or name.endswith(".json"):
                files.append(os.path.join(DATA_DIR, name))
        return files

    def _cache_is_valid(self) -> bool:
        if not os.path.exists(self._cache_path):
            return False
        if not self._data_files:
            return True
        cache_mtime = os.path.getmtime(self._cache_path)
        latest_data_mtime = max(os.path.getmtime(p) for p in self._data_files)
        return cache_mtime >= latest_data_mtime

    def _load_posts(self) -> None:
        if self._cache_is_valid():
            try:
                with open(self._cache_path, "rb") as f:
                    self._posts = pickle.load(f)
                    return
            except Exception:
                # Fall back to reload if cache corrupt
                self._posts = []

        posts: List[Dict[str, Any]] = []
        for path in self._data_files:
            posts.extend(self._load_file(path))

        self._posts = posts
        try:
            with open(self._cache_path, "wb") as f:
                pickle.dump(self._posts, f)
        except Exception:
            # Cache failures should not crash load
            pass

    def _load_file(self, path: str) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        if path.endswith(".jsonl"):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            obj = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        items.extend(self._extract_posts(obj))
            except FileNotFoundError:
                return []
        elif path.endswith(".json"):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    obj = json.load(f)
                if isinstance(obj, list):
                    for entry in obj:
                        items.extend(self._extract_posts(entry))
                elif isinstance(obj, dict):
                    items.extend(self._extract_posts(obj))
            except Exception:
                return []
        return items

    def _extract_posts(self, obj: Dict[str, Any]) -> List[Dict[str, Any]]:
        if not isinstance(obj, dict):
            return []
        if obj.get("kind") != "t3":
            return []
        data = obj.get("data") or {}
        if not data:
            return []
        return [self._normalize_post(data)]

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        cleaned = html.unescape(text)
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        cleaned = cleaned.replace("\n", " ")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned[:2000]

    def _normalize_post(self, data: Dict[str, Any]) -> Dict[str, Any]:
        title = (data.get("title") or "").strip()[:500]
        selftext = data.get("selftext") or ""
        if not selftext and data.get("selftext_html"):
            selftext = data.get("selftext_html") or ""
        text = self._clean_text(selftext)

        created_utc = data.get("created_utc") or 0
        try:
            created_ts = float(created_utc)
            created_date = datetime.utcfromtimestamp(created_ts).strftime("%Y-%m-%d")
        except Exception:
            created_ts = 0.0
            created_date = ""

        subreddit = data.get("subreddit") or ""
        is_self = bool(data.get("is_self"))
        domain = data.get("domain") or ""
        if is_self:
            if subreddit:
                domain = f"reddit.com/r/{subreddit}"
            else:
                domain = "reddit.com"

        url = data.get("url_overridden_by_dest") or data.get("url") or ""
        author = data.get("author") or "[deleted]"
        author_flair = data.get("author_flair_text") or ""
        permalink = data.get("permalink") or ""
        post_hint = data.get("post_hint") or ""
        link_flair = data.get("link_flair_text") or ""

        crosspost_parent_list = data.get("crosspost_parent_list") or []
        is_crosspost = bool(crosspost_parent_list)
        crosspost_subreddit = ""
        if is_crosspost and isinstance(crosspost_parent_list, list):
            try:
                crosspost_subreddit = crosspost_parent_list[0].get("subreddit") or ""
            except Exception:
                crosspost_subreddit = ""

        return {
            "id": data.get("id") or "",
            "title": title,
            "text": text,
            "score": int(data.get("score") or 0),
            "upvote_ratio": float(data.get("upvote_ratio") or 0.0),
            "author": author,
            "author_flair": author_flair,
            "created_utc": created_ts,
            "created_date": created_date,
            "num_comments": int(data.get("num_comments") or 0),
            "domain": domain,
            "url": url,
            "subreddit": subreddit,
            "permalink": permalink,
            "is_self": is_self,
            "post_hint": post_hint,
            "link_flair": link_flair,
            "is_crosspost": is_crosspost,
            "crosspost_subreddit": crosspost_subreddit,
        }

    def get_posts(self) -> List[Dict[str, Any]]:
        return self._posts

    def get_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(self._posts)

    def search_text(self, query: str) -> List[Dict[str, Any]]:
        if not query:
            return []
        q = query.lower().strip()
        if not q:
            return []
        results = []
        for post in self._posts:
            hay = f"{post.get('title','')} {post.get('text','')}".lower()
            if q in hay:
                results.append(post)
        return results

    def get_stats(self) -> Dict[str, Any]:
        total_posts = len(self._posts)
        if total_posts == 0:
            return {
                "total_posts": 0,
                "date_range": {"start": "", "end": ""},
                "top_authors": [],
                "top_domains": [],
                "avg_score": 0,
                "total_comments": 0,
            }

        dates = [p.get("created_date") for p in self._posts if p.get("created_date")]
        dates_sorted = sorted(dates)
        date_range = {
            "start": dates_sorted[0] if dates_sorted else "",
            "end": dates_sorted[-1] if dates_sorted else "",
        }

        author_counts = Counter(p.get("author") or "[deleted]" for p in self._posts)
        domain_counts = Counter(p.get("domain") or "" for p in self._posts)
        top_authors = [
            {"author": a, "count": c} for a, c in author_counts.most_common(10)
        ]
        top_domains = [
            {"domain": d, "count": c} for d, c in domain_counts.most_common(10)
        ]

        avg_score = sum(p.get("score", 0) for p in self._posts) / total_posts
        total_comments = sum(p.get("num_comments", 0) for p in self._posts)

        return {
            "total_posts": total_posts,
            "date_range": date_range,
            "top_authors": top_authors,
            "top_domains": top_domains,
            "avg_score": round(avg_score, 2),
            "total_comments": int(total_comments),
        }
