import html
import logging
import re
import time
from datetime import datetime
from typing import Dict, Any, List

import requests
from fastembed import TextEmbedding

from config import SUBREDDITS, EMBED_MODEL
from database import get_collection

logger = logging.getLogger("simppl_ingestion")

_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = TextEmbedding(model_name=EMBED_MODEL)
    return _embedding_model

def clean_text(text: str) -> str:
    if not text:
        return ""
    cleaned = html.unescape(text)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = cleaned.replace("\n", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:2000]

def normalize_post(data: Dict[str, Any]) -> Dict[str, Any]:
    title = (data.get("title") or "").strip()[:500]
    selftext = data.get("selftext") or ""
    if not selftext and data.get("selftext_html"):
        selftext = data.get("selftext_html") or ""
    text = clean_text(selftext)

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
    
    crosspost_parent_list = data.get("crosspost_parent_list") or []
    is_crosspost = bool(crosspost_parent_list)
    crosspost_subreddit = ""
    crosspost_author = ""
    if is_crosspost and isinstance(crosspost_parent_list, list):
        try:
            crosspost_subreddit = crosspost_parent_list[0].get("subreddit") or ""
            crosspost_author = crosspost_parent_list[0].get("author") or ""
        except Exception:
            crosspost_subreddit = ""
            crosspost_author = ""

    return {
        "id": data.get("id") or "",
        "title": title,
        "text": text,
        "score": int(data.get("score") or 0),
        "upvote_ratio": float(data.get("upvote_ratio") or 0.0),
        "author": author,
        "created_utc": created_ts,
        "created_date": created_date,
        "num_comments": int(data.get("num_comments") or 0),
        "domain": domain,
        "url": url,
        "subreddit": subreddit,
        "permalink": data.get("permalink") or "",
        "is_self": is_self,
        "is_crosspost": is_crosspost,
        "crosspost_subreddit": crosspost_subreddit,
        "crosspost_author": crosspost_author,
    }

def fetch_new_reddit_posts():
    logger.info("Starting scheduled ingestion of Reddit posts...")
    collection = get_collection()
    
    headers = {
        "User-Agent": "simppl-research-dashboard/1.0"
    }

    new_posts_inserted = 0

    for subreddit in SUBREDDITS:
        try:
            url = f"https://www.reddit.com/r/{subreddit}/new.json?limit=50"
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                logger.warning(f"Failed to fetch {subreddit}: HTTP {resp.status_code}")
                continue
            
            data = resp.json()
            children = data.get("data", {}).get("children", [])
            
            for child in children:
                if child.get("kind") != "t3":
                    continue
                    
                post_data = child.get("data", {})
                post_id = post_data.get("id")
                
                if not post_id:
                    continue
                
                # Check if exists
                if collection.find_one({"id": post_id}):
                    continue
                
                normalized = normalize_post(post_data)
                
                # Compute embedding
                text_to_embed = f"{normalized['title']} {normalized['text'][:500]}".strip()
                model = get_embedding_model()
                embed_list = list(model.embed([text_to_embed]))[0].tolist()
                
                normalized["embedding"] = embed_list
                
                # Insert
                collection.insert_one(normalized)
                new_posts_inserted += 1

            time.sleep(1) # Be nice to Reddit API
            
        except Exception as e:
            logger.error(f"Error fetching from r/{subreddit}: {e}")

    logger.info(f"Ingestion complete. Inserted {new_posts_inserted} new posts.")

def start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    import datetime
    scheduler = BackgroundScheduler()
    # next_run_time dictates that it runs immediately on startup, then every 10 mins
    scheduler.add_job(fetch_new_reddit_posts, "interval", minutes=10, next_run_time=datetime.datetime.now())
    scheduler.start()
    logger.info("Background ingestion scheduler started (every 10 minutes).")
