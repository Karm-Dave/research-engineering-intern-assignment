# AI Prompts Documentation

This document records the major AI prompts used during development of the Reddit Social Media Dashboard / Investigative Research Dashboard project. These prompts were used for backend development, embeddings, clustering, RAG chatbot improvements, UI fixes, deployment, database migration, and system architecture changes.

---

## Tools Used

The following AI tools were used during development (free tiers):

- OpenAI Codex / ChatGPT  
- Claude  
- Cursor / Copilot-style autocomplete tools  
- Anti-gravity / agent-based coding tools  

These tools were used for scaffolding, debugging, refactoring, and system design assistance.

---

## Development Flow Overview

The development followed this sequence:

1. Initial scaffold with embeddings, chatbot, clustering using `data.jsonl`  
2. Bootstrap database and MongoDB Atlas integration  
3. Migration to Pinecone for vector search optimization  
4. Live Reddit ingestion via `.json` endpoints  
5. UI improvements with Roman-style design  
6. Ranking system with environment-based modes  

---

## 1. Initial Scaffold & Backend Setup
**Prompt:**  
"Generate a FastAPI backend scaffold for a social media dashboard. Include Pydantic models for Reddit JSONL ingestion, a DataLoader class, semantic search endpoint, clustering pipeline using MiniLM embeddings, UMAP dimensionality reduction, and a simple RAG chatbot system. The project should work with an existing data.jsonl file."

**Fix / Action Taken:**  
- Fixed missing dependency declarations  
- Replaced mocked data payload with proper JSONL parsing  
- Added handling for corrupted lines securely  
- Added embedding caching  

---

## 2. Embedding and Semantic Search Implementation
**Prompt:**  
"Write a Python script using fastembed or sentence-transformers MiniLM model to compute embeddings for reddit post titles and text. Store embeddings locally and implement cosine similarity semantic search. Handle empty text, non-English text, and very small queries."

**Fix / Action Taken:**  
- Adjusted chunk sizes  
- Ensured correct embedding dimensions  
- Added exception handling for small queries  
- Combined full text instead of truncation  

---

## 3. Topic Clustering & UMAP Preprocessing
**Prompt:**  
"Create a clustering module for reddit posts using UMAP for dimensionality reduction and KMeans clustering. Use higher dimensional UMAP for clustering space and 2D UMAP for visualization. Allow cluster count to be configurable."

**Fix / Action Taken:**  
- Fixed UMAP crash for small datasets  
- Restricted cluster range  
- Stored cluster labels for reuse  

---

## 4. Network Graph Analysis
**Prompt:**  
"Build a NetworkX graph analysis pipeline to model relationships between posts/users/keywords. Compute PageRank and betweenness centrality and handle disconnected components."

**Fix / Action Taken:**  
- Improved relationship mapping logic  
- Focused on major connected components  
- Added influence scoring  

---

## 5. MongoDB Bootstrap Database Script
**Prompt:**  
"Create a bootstrap database script that reads reddit JSONL data, cleans it, and uploads it to MongoDB Atlas. The application should fetch data from MongoDB instead of local files."

**Fix / Action Taken:**  
- Created ingestion pipeline  
- Added indexing  
- Stored metadata and clustering info  

---

## 6. Migration to Pinecone (Vector Optimization)
**Prompt:**  
"Vector similarity search in MongoDB is slow. Migrate embeddings to Pinecone. Keep metadata in MongoDB but store embeddings in Pinecone and perform retrieval there."

**Fix / Action Taken:**  
- Removed embeddings from MongoDB  
- Stored vector references  
- Reduced latency significantly  

---

## 7. Live Reddit Post Fetching
**Prompt:**  
"Implement live reddit ingestion using subreddit.json endpoints. Fetch new posts periodically and update database and vector index."

**Fix / Action Taken:**  
- Implemented scheduler  
- Prevented duplicates  
- Periodic clustering updates  

---

## 8. Ranking Mode (Environment Variable)
**Prompt:**  
"Add an environment variable ranking_mode:
- old: cosine similarity only  
- new: hybrid ranking using similarity, recency, and engagement  
Make it configurable without code changes."

**Fix / Action Taken:**  
- Added recency scoring  
- Added engagement weighting  
- Implemented hybrid ranking  

---

## 9. LLM Explanatory Summaries
**Prompt:**  
"Integrate Groq API with Llama model to generate analytical summaries of results. Avoid conversational tone."

**Fix / Action Taken:**  
- Removed filler text  
- Structured outputs  
- Added rate-limit handling  

---

## 10. Frontend Dashboard UI (Roman Theme)
**Prompt:**  
"Improve the frontend UI with a Roman/classical theme using serif fonts, parchment colors, and structured layout."

**Fix / Action Taken:**  
- Improved layout  
- Fixed overlapping charts  
- Adjusted theme styling  

---

## 11. Deployment Configuration
**Prompt:**  
"Configure deployment for FastAPI + React. Ensure models load efficiently and avoid memory issues."

**Fix / Action Taken:**  
- Removed unnecessary caches  
- Optimized startup loading  

---

## 12. Retrieval Logic Improvements
**Prompt:**  
"Modify RAG retrieval to use similarity threshold instead of top-k. Prioritize posts with text content."

---

## 13. Response Quality Improvements
**Prompt:**  
"Improve response depth while maintaining accuracy. Prefer text-based posts and ensure correct linking."

---

## 14. Markdown Rendering & Token Limits
**Prompt:**  
"Fix markdown rendering issues and adjust token limits to prevent truncation."

---

## 15. Performance & Latency Analysis
**Prompt:**  
"Analyze pipeline latency and suggest optimizations such as caching, batching, and Redis usage without changing core logic."

---

# End of Prompts Documentation