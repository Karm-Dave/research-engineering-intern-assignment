import logging
from typing import List, Dict, Any

import numpy as np
from fastembed import TextEmbedding

from config import EMBED_MODEL

logger = logging.getLogger("simppl")

class EmbeddingEngine:
    def __init__(self, posts: List[Dict[str, Any]] = None) -> None:
        self._model = None

    def _get_model(self) -> TextEmbedding:
        if self._model is None:
            self._model = TextEmbedding(model_name=EMBED_MODEL)
        return self._model

    def get_embedding_for_query(self, query: str) -> np.ndarray:
        logger.info("Computing query embedding remotely or locally")
        model = self._get_model()
        embedding = np.array(list(model.embed([query])))[0]
        return embedding
