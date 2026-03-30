# SimPPL Research Dashboard

This project is a full-stack investigative dashboard for analyzing narrative spread across multiple political subreddits. It ingests Reddit JSONL data, computes embeddings for semantic search and clustering, and serves an interactive React UI for exploration.

The dataset spans multiple communities (e.g., r/neoliberal, r/politics, r/worldpolitics, r/socialism, r/Liberal, r/Conservative, r/Anarchism, r/democrats, r/Republican, r/PoliticalDiscussion), enabling cross-ideological trend analysis.

## Architecture Diagram

[Reddit JSONL data] -> [DataLoader] -> [EmbeddingEngine (fastembed)]
     |                               |
     v                               v
[TimeSeriesAnalyzer]          [SemanticSearch] <- [Groq LLM]
[NetworkAnalyzer]             [TopicClusterer (KMeans+UMAP)]
     |                               |
     +------------[FastAPI REST API]------------+
                      |
                      v
             [React + Vite Frontend]

## Setup Instructions

1. Ensure Python 3.10+ and Node 18+ are installed.
2. Install backend dependencies:
   - `python -m pip install -r backend/requirements.txt`
3. Install frontend dependencies:
   - `cd frontend && npm install`
4. Build the frontend (output is served by FastAPI):
   - `cd frontend && npm run build`
5. Run backend tests:
   - `cd backend && python -m pytest tests/ -v --tb=short`
6. Start the server:
   - `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`
7. Open `http://localhost:8000`

Notes for Windows: `start.sh` is a bash script. Use Git Bash or WSL if you want to run it directly.

## ML/AI Components

- Embeddings: BAAI/bge-small-en-v1.5 via fastembed, 384 dims, cosine similarity
- Clustering: KMeans (k configurable, clamped 2-50), 5D UMAP preprocessing (n_neighbors=15, min_dist=0.1, random_state=42), scikit-learn
- Dimensionality reduction: UMAP (umap-learn), 2D for visualization, 5D for clustering
- Network: NetworkX, PageRank (alpha=0.85), betweenness centrality (k=200 sample)
- LLM: Groq llama-3.3-70b-versatile, used for summaries and chatbot
- Topic keywords: TF-IDF (scikit-learn, max_features=1000, English stop words)

## Semantic Search Examples (Zero Keyword Overlap)

Example 1:
- Query: "people helping each other without institutions"
- Result returned: Post about mutual aid networks
- Why correct: The query describes the concept of "mutual aid" without using the exact term

Example 2:
- Query: "California attorney general record"
- Result returned: Post about Kamala Harris's prosecutor/AG record
- Why correct: The query describes the role and topic, even though the post title may not use the exact phrasing

Example 3:
- Query: "capital punishment policy"
- Result returned: Post discussing the death penalty
- Why correct: "capital punishment" is a semantic equivalent of "death penalty" without keyword overlap

## Edge Cases Handled

- Empty search query returns a helpful message
- Queries shorter than 3 characters return a helpful message
- Non-English inputs are embedded and searched normally
- Empty datasets do not crash endpoints
- Clustering clamps out-of-range values (2-50)
- Network graphs handle disconnected components
- Chatbot returns a graceful error if Groq is unavailable

## Screenshots

- [Screenshot: Overview Dashboard]
- [Screenshot: Time Series Panel]
- [Screenshot: Network Panel]
- [Screenshot: Topic Clusters]
- [Screenshot: Embedding Space]
- [Screenshot: Search and Chat]

## Live URL

- [hosted URL placeholder]

## Video Walkthrough

- [URL placeholder]
