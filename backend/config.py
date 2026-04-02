from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

MONGODB_URI = os.getenv("MONGODB_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "simppl")
MONGO_COLLECTION_NAME = os.getenv("MONGO_COLLECTION_NAME", "posts")

SUBREDDITS = [
    "neoliberal", "politics", "worldpolitics", "socialism",
    "Liberal", "Conservative", "Anarchism", "democrats",
    "Republican", "PoliticalDiscussion"
]

os.makedirs(CACHE_DIR, exist_ok=True)
