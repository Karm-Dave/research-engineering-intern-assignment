# AI Prompts Documentation

This document records the major AI prompts used during development of the Reddit Social Media Dashboard project. These prompts were used for backend development, embeddings, clustering, RAG chatbot improvements, UI fixes, deployment, and system architecture changes.

---

## 1. Initial Scaffold & Backend Setup
**Prompt:**  
"Generate a FastAPI backend scaffold for a social media dashboard. Include Pydantic models for Reddit JSONL ingestion, a DataLoader class, and a basic semantic search endpoint."

**Fix / Action Taken:**  
- Fixed missing dependency declarations  
- Replaced mocked data payload with proper JSONL parsing  
- Added handling for corrupted lines securely  

---

## 2. Embedding and Semantic Search Implementation
**Prompt:**  
"Write a Python script using `fastembed` to compute embeddings for reddit post titles and text. Set up a local vector cache using cosine similarity for the semantic search endpoint. Handle extreme and non-English edge cases natively."

**Fix / Action Taken:**  
- Adjusted chunk sizes  
- Ensured vector format matched `BAAI/bge-small-en-v1.5` (384 dimensions)  
- Added exception handling for very small query strings  

---

## 3. Topic Clustering & UMAP Preprocessing
**Prompt:**  
"Create a module to cluster reddit posts by topic using scikit-learn's KMeans. Use 5D UMAP preprocessing for the clustering space and calculate 2D UMAP for UI rendering. Expose the number of clusters (k) as a parameter."

**Fix / Action Taken:**  
- Fixed dimensionality crash when dataset size dropped below UMAP min samples  
- Restricted cluster tuning range to 2–50  

---

## 4. Network Graph Analysis
**Prompt:**  
"Build a NetworkX analysis pipeline to model a graph of users in this reddit dataset. Compute PageRank and betweenness centrality. Gracefully manage completely disconnected components."

**Fix / Action Taken:**  
- Changed relationship mapping to keyword interaction logic  
- Created custom iterator to compute metrics on major subgraphs only  

---

## 5. LLM Explanatory Summaries
**Prompt:**  
"Integrate the Groq API (llama-3.3-70b-versatile) to dynamically auto-generate brief, non-technical plain-language summaries of the given time-series graph queries."

**Fix / Action Taken:**  
- Removed conversational filler from model outputs  
- Hardened system prompt to enforce structured responses  
- Added rate-limit fallback logic  

---

## 6. Frontend Dashboard UI (React + Vite)
**Prompt:**  
"Scaffold an aesthetic React + Vite frontend dashboard using modern CSS. Produce a multi-column responsive layout showcasing a Time Series component, Semantic Search panel, and Topic Clustering scatter plot, consuming FastAPI endpoints."

**Fix / Action Taken:**  
- Fixed visual clutter and overlapping chart points  
- Implemented dynamic bounding boxes  
- Fixed backend CORS rules for Vite dev ports  

---

## 7. Deployment Configuration
**Prompt:**  
"Configure a render.yaml file for hosting a FastAPI backend that statically serves a React frontend build. Ensure model downloads gracefully cache to prevent OOM errors."

**Fix / Action Taken:**  
- Removed redundant local caches via `.gitignore`  
- Switched to start-time model fetching to comply with Render memory limits  

---

# Additional Development Prompts & Feature Improvements

## 8. Dynamic Reddit API Ingestion & Database Decision
**Prompt:**  
"I wish to turn this into a dynamic application which instead of ingesting static data, uses Reddit's free JSON API to routinely (every 10 minutes) grab posts from various subreddits. Do you think Atlas MongoDB will be ideal or the current local file access for embeddings is better? Note that the embeddings will have to re-computed routinely and the MiniLM transformer is slow."

---

## 9. UI Improvements
**Prompt:**  
"Few improvements to add:
1. Autoscrolling in the chatbot  
2. Make Search across workspace working and also in dark mode its text color is white which is fading into its textbox, fix that  
3. Align the navbar width with the logo box on the left upper corner"

---

## 10. RAG Chatbot Content Issue
**Prompt:**  
"How does the current RAG chatbot work? Currently, it is showing no text content for a lot of the posts and it seems only titles are being read with the contents being YouTube/website links."

---

## 11. Embedding Text Content Fix
**Prompt:**  
"Fixes to add:
1. text_to_embed = f\"{title} {text[:500]}\" — keep the entire text content not just this. Make it fetch the complete post  
2. For the retrieval make it dynamic RAG where you fetch all sources which are more similar than a threshold not just 4."

---

## 12. Similarity Threshold Retrieval
**Prompt:**  
"Instead of top 20 make it that all sources above 0.5 similarity (add a variable similarity_threshold to config and use it) are used."

---

## 13. Source Display & Ranking Improvements
**Prompt:**  
"Fixes:
1. Despite fetching many sources its only displaying few on the side panel make it display all  
2. Prioritize by first existence of text content and then by score."

---

## 14. Response Quality Improvements
**Prompt:**  
"Fixes:
1. Prioritize posts with text content for framing the response  
2. Increase the depth of the response BUT DO NOT SACRIFICE ACCURACY  
3. If embedding a link without text content, link the reddit URL not the external one."

---

## 15. Markdown Rendering & Token Limits
**Prompt:**  
"In the response it's not rendering markdown properly. Also the response is getting cut out and max tokens 800 leads to API response too large error."

---

## 16. Retrieval Logic Change
**Prompt:**  
"Do not limit posts by highest similarity, limit them only by threshold exclusively."

---

## 17. Text Content Prioritization Issue
**Prompt:**  
"The LLM response still links posts with no text content. Is it not prioritizing just those with text content?"

---

## 18. Performance & Latency Analysis (No Code Changes)
**Prompt:**  
"Do not make any changes to the code. Tell me:
1. Why clustering, embedding, networking is taking too long and if it's normal  
2. Would using Redis help and if so how  
3. How to reduce latency across the entire pipeline"

---

## 19. Migration from MongoDB to Pinecone
**Prompt:**  
"I want to:
1. Transition all embeddings from MongoDB to Pinecone  
2. Remove all entries from MongoDB  
3. Re-ingest data from cleaned_data.jsonl and new Reddit data without embeddings  
4. Store embeddings strictly in Pinecone  
5. Use hierarchical embeddings for better RAG performance"

---

## 20. Clustering & Embedding Pipeline Changes
**Prompt:**  
"For clustering and embedding space:
1. Change min and max clusters to 4 and 10  
2. Precompute and store clusters in MongoDB and recompute on each ingestion  
3. Change ingestion frequency to once an hour  
4. Generate cluster summaries dynamically each time while displaying"

---

# End of Prompts Documentation