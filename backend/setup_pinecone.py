import os
from pinecone import Pinecone, ServerlessSpec
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

def setup():
    pinecone_key = os.getenv("PINECONE_API_KEY")
    pinecone_index = os.getenv("PINECONE_INDEX_NAME", "simppl-index")
    mongo_uri = os.getenv("MONGODB_URI")
    mongo_db = os.getenv("MONGO_DB_NAME", "simppl")
    mongo_coll = os.getenv("MONGO_COLLECTION_NAME", "posts")

    if not pinecone_key:
        print("Missing PINECONE_API_KEY in .env!")
        return

    print("Connecting to Pinecone...")
    pc = Pinecone(api_key=pinecone_key)

    existing = [i.name for i in pc.list_indexes()]
    if pinecone_index not in existing:
        print(f"Creating Pinecone index '{pinecone_index}' with 384 dimensions...")
        pc.create_index(
            name=pinecone_index,
            dimension=384,
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
        print("Index provisioned successfully.")
    else:
        print(f"Pinecone index '{pinecone_index}' already exists.")

    print("Connecting to MongoDB...")
    client = MongoClient(mongo_uri)
    db = client[mongo_db]
    
    print(f"Dropping previous collection '{mongo_coll}' to erase legacy embeddings...")
    db.drop_collection(mongo_coll)
    print("Database purged. Architecture securely reset.")

if __name__ == "__main__":
    setup()
