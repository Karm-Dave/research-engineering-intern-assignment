import json
import logging
import os
from typing import Dict, Any

from config import DATA_DIR
from database import get_collection, init_db
from ingestion import normalize_post, get_embedding_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bootstrap")

def bootstrap():
    init_db()
    
    filepath = os.path.join(DATA_DIR, "cleaned_data.jsonl")
    if not os.path.exists(filepath):
        logger.error(f"Cannot find {filepath}")
        return
        
    collection = get_collection()
    model = get_embedding_model()
    
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    logger.info(f"Found {len(lines)} lines in cleaned_data.jsonl. Processing constraints...")
    
    inserted = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
            
        if obj.get("kind") != "t3":
            continue
        
        data = obj.get("data", {})
        post_id = data.get("id")
        if not post_id or collection.find_one({"id": post_id}):
            continue
            
        try:
            normalized = normalize_post(data)
            text_to_embed = f"{normalized['title']} {normalized['text'][:500]}".strip()
            embed_list = list(model.embed([text_to_embed]))[0].tolist()
            normalized["embedding"] = embed_list
            collection.insert_one(normalized)
            inserted += 1
            if inserted % 50 == 0:
                logger.info(f"Inserted {inserted} posts...")
        except Exception as e:
            logger.error(f"Failed to process post {post_id}: {e}")
            
    logger.info(f"Bootstrap complete. Total successfully embedded and inserted: {inserted}")

if __name__ == "__main__":
    bootstrap()
