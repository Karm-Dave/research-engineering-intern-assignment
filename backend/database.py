import logging
from typing import Any

from pymongo import MongoClient
from pymongo.operations import SearchIndexModel
from pymongo.errors import OperationFailure

from config import MONGODB_URI, MONGO_DB_NAME, MONGO_COLLECTION_NAME

logger = logging.getLogger("simppl")

_client = None

def get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI)
    return _client[MONGO_DB_NAME]

def get_collection():
    return get_db()[MONGO_COLLECTION_NAME]

def init_db():
    if not MONGODB_URI:
        logger.warning("MONGODB_URI is not set. Database integration disabled.")
        return

    collection = get_collection()

    # Create a unique index on 'id' to prevent duplicate posts
    collection.create_index("id", unique=True)

    # Initialize Vector Search Index
    index_name = "vector_index"
    try:
        indexes = list(collection.list_search_indexes())
        index_names = [idx.get("name") for idx in indexes]
        
        if index_name not in index_names:
            logger.info("Creating vector search index...")
            model = SearchIndexModel(
                definition={
                    "fields": [
                        {
                            "numDimensions": 384,
                            "path": "embedding",
                            "similarity": "cosine",
                            "type": "vector"
                        }
                    ]
                },
                name=index_name,
                type="vectorSearch"
            )
            collection.create_search_index(model)
            logger.info("Vector search index creation triggered.")
        else:
            logger.info("Vector search index already exists.")
    except OperationFailure as e:
        logger.error("Could not automatically create Vector Search Index: %s. You may need to create it manually in the Atlas UI.", e)
