import pandas as pd
from typing import List, Dict, Any

from database import get_collection

class DataLoader:
    def __init__(self) -> None:
        self.collection = get_collection()

    def get_posts(self) -> List[Dict[str, Any]]:
        # Without _id so it's JSON serializable easily
        return list(self.collection.find({}, {"_id": 0, "embedding": 0}))

    def get_dataframe(self) -> pd.DataFrame:
        posts = self.get_posts()
        return pd.DataFrame(posts)

    def search_text(self, query: str) -> List[Dict[str, Any]]:
        if not query:
            return []
        q = query.lower().strip()
        if not q:
            return []
            
        # MongoDB regex search (basic lexical fallback)
        results = self.collection.find({
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"text": {"$regex": q, "$options": "i"}}
            ]
        }, {"_id": 0, "embedding": 0})
        
        return list(results)

    def get_stats(self) -> Dict[str, Any]:
        total_posts = self.collection.count_documents({})
        if total_posts == 0:
            return {
                "total_posts": 0,
                "date_range": {"start": "", "end": ""},
                "top_authors": [],
                "top_domains": [],
                "avg_score": 0,
                "total_comments": 0,
            }

        # Date range
        min_date_doc = self.collection.find_one({}, sort=[("created_date", 1)])
        max_date_doc = self.collection.find_one({}, sort=[("created_date", -1)])
        start_date = min_date_doc.get("created_date", "") if min_date_doc else ""
        end_date = max_date_doc.get("created_date", "") if max_date_doc else ""

        # Top Authors
        authors_pipeline = [
            {"$group": {"_id": "$author", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_authors = [
            {"author": doc["_id"], "count": doc["count"]} 
            for doc in self.collection.aggregate(authors_pipeline)
        ]

        # Top Domains
        domains_pipeline = [
            {"$group": {"_id": "$domain", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_domains = [
            {"domain": doc["_id"], "count": doc["count"]} 
            for doc in self.collection.aggregate(domains_pipeline)
        ]

        # Averages
        avg_pipeline = [
            {"$group": {
                "_id": None,
                "avg_score": {"$avg": "$score"},
                "total_comments": {"$sum": "$num_comments"}
            }}
        ]
        avg_res = list(self.collection.aggregate(avg_pipeline))
        if avg_res:
            avg_score = avg_res[0]["avg_score"] or 0
            total_comments = avg_res[0]["total_comments"] or 0
        else:
            avg_score = 0
            total_comments = 0

        return {
            "total_posts": total_posts,
            "date_range": {"start": start_date, "end": end_date},
            "top_authors": top_authors,
            "top_domains": top_domains,
            "avg_score": round(avg_score, 2),
            "total_comments": int(total_comments),
        }
