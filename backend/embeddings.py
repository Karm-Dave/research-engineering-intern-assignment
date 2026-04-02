import json
import os
import logging
from typing import List, Dict, Any

import numpy as np
from fastembed import TextEmbedding

from config import CACHE_DIR, EMBED_MODEL


logger = logging.getLogger("simppl")


class EmbeddingEngine:
    def __init__(self, posts: List[Dict[str, Any]]) -> None:
        self.posts = posts
        self._embeddings = None
        self._model = None
        self._safe_model = EMBED_MODEL.replace("/", "_").replace(":", "_")
        self._embeddings_path = os.path.join(CACHE_DIR, f"embeddings_{self._safe_model}.npy")
        self._ids_path = os.path.join(CACHE_DIR, f"post_ids_{self._safe_model}.json")
        self._meta_path = os.path.join(CACHE_DIR, f"embed_meta_{self._safe_model}.json")

    def _get_model(self) -> TextEmbedding:
        if self._model is None:
            self._model = TextEmbedding(model_name=EMBED_MODEL)
        return self._model

    def _get_text(self, post: Dict[str, Any]) -> str:
        title = post.get("title") or ""
        text = post.get("text") or ""
        return f"{title} {text[:500]}".strip()

    def compute_embeddings(self) -> np.ndarray:
        post_ids = [p.get("id") or "" for p in self.posts]
        if os.path.exists(self._embeddings_path) and os.path.exists(self._ids_path):
            try:
                with open(self._ids_path, "r", encoding="utf-8") as f:
                    cached_ids = json.load(f)
                cached_meta = None
                if os.path.exists(self._meta_path):
                    try:
                        with open(self._meta_path, "r", encoding="utf-8") as mf:
                            cached_meta = json.load(mf)
                    except Exception:
                        cached_meta = None
                if cached_ids == post_ids and (not cached_meta or cached_meta.get("model") == EMBED_MODEL):
                    embeddings = np.load(self._embeddings_path)
                    if embeddings.shape[0] == len(post_ids):
                        self._embeddings = embeddings
                        logger.info("Loaded embeddings from cache: %s", self._embeddings_path)
                        return embeddings
            except Exception:
                pass

        if not self.posts:
            empty = np.zeros((0, 384), dtype=np.float32)
            self._embeddings = empty
            return empty

        logger.info("Computing embeddings for %d posts", len(self.posts))
        model = self._get_model()
        texts = [self._get_text(p) for p in self.posts]
        all_embeddings: List[np.ndarray] = []
        batch_size = 64
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            batch_embeddings = list(model.embed(batch))
            all_embeddings.extend(batch_embeddings)

        embeddings = np.array(all_embeddings)
        try:
            np.save(self._embeddings_path, embeddings)
            with open(self._ids_path, "w", encoding="utf-8") as f:
                json.dump(post_ids, f)
            with open(self._meta_path, "w", encoding="utf-8") as f:
                json.dump({"model": EMBED_MODEL, "count": len(post_ids)}, f)
            logger.info("Saved embeddings to cache: %s", self._embeddings_path)
        except Exception:
            pass

        self._embeddings = embeddings
        return embeddings

    def get_embeddings(self) -> np.ndarray:
        if self._embeddings is None:
            return self.compute_embeddings()
        return self._embeddings

    def get_embedding_for_query(self, query: str) -> np.ndarray:
        logger.info("Computing query embedding")
        model = self._get_model()
        embedding = np.array(list(model.embed([query])))[0]
        return embedding

    def cosine_similarity(self, vec_a: np.ndarray, matrix: np.ndarray) -> np.ndarray:
        if matrix.size == 0:
            return np.array([])
        vec_norm = vec_a / (np.linalg.norm(vec_a) + 1e-10)
        mat_norm = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-10)
        return mat_norm @ vec_norm
