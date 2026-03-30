from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")
EMBED_MODEL = "BAAI/bge-small-en-v1.5"

os.makedirs(CACHE_DIR, exist_ok=True)
