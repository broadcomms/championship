"""
Embedding Service - Core Business Logic

Handles model loading, embedding generation, caching, and batch processing.

Author: Development Team
Version: 1.0.0
"""

import time
import hashlib
from typing import List, Tuple, Optional, Dict
from functools import lru_cache
import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import get_settings


class EmbeddingService:
    """
    Production-grade embedding service with caching and optimization.
    
    Features:
    - Lazy model loading (on first request)
    - LRU caching for identical inputs
    - Batch processing support
    - GPU support with CPU fallback
    - Normalization support
    """
    
    _instance: Optional['EmbeddingService'] = None
    _model: Optional[SentenceTransformer] = None
    _cache: Dict[str, List[float]] = {}
    _cache_hits: int = 0
    _cache_misses: int = 0
    _total_requests: int = 0
    _total_embeddings: int = 0
    
    def __new__(cls):
        """Singleton pattern to ensure single model instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize service (model loaded lazily on first use)."""
        self.settings = get_settings()
        self._initialized = False
    
    def load_model(self) -> None:
        """
        Load the sentence transformer model.
        
        Called automatically on first request (lazy loading).
        """
        if self._model is not None:
            return
        
        start_time = time.time()
        
        try:
            self._model = SentenceTransformer(
                self.settings.model_name,
                device=self.settings.device,
                cache_folder=self.settings.model_cache_dir
            )
            
            load_time = time.time() - start_time
            
            # Verify model dimensions
            test_embedding = self._model.encode(["test"], normalize_embeddings=False)
            actual_dimensions = test_embedding.shape[1]
            
            if actual_dimensions != self.settings.model_dimensions:
                raise ValueError(
                    f"Model dimension mismatch. "
                    f"Expected: {self.settings.model_dimensions}, "
                    f"Got: {actual_dimensions}"
                )
            
            self._initialized = True
            
            print(f"✅ Model loaded successfully")
            print(f"   - Model: {self.settings.model_name}")
            print(f"   - Dimensions: {actual_dimensions}")
            print(f"   - Device: {self.settings.device}")
            print(f"   - Load time: {load_time:.2f}s")
            
        except Exception as e:
            self._model = None
            self._initialized = False
            raise RuntimeError(f"Failed to load model: {str(e)}") from e
    
    def _compute_cache_key(self, text: str, normalize: bool) -> str:
        """
        Compute cache key for text.
        
        Args:
            text: Input text
            normalize: Whether normalization is enabled
            
        Returns:
            str: Cache key (SHA256 hash)
        """
        # Include normalize flag in cache key
        key_input = f"{text}::{normalize}"
        return hashlib.sha256(key_input.encode()).hexdigest()
    
    def _get_from_cache(self, text: str, normalize: bool) -> Optional[List[float]]:
        """
        Get embedding from cache.
        
        Args:
            text: Input text
            normalize: Normalization flag
            
        Returns:
            Optional[List[float]]: Cached embedding or None
        """
        if not self.settings.cache_enabled:
            return None
        
        cache_key = self._compute_cache_key(text, normalize)
        
        if cache_key in self._cache:
            self._cache_hits += 1
            return self._cache[cache_key]
        
        self._cache_misses += 1
        return None
    
    def _add_to_cache(self, text: str, normalize: bool, embedding: List[float]) -> None:
        """
        Add embedding to cache with LRU eviction.
        
        Args:
            text: Input text
            normalize: Normalization flag
            embedding: Generated embedding
        """
        if not self.settings.cache_enabled:
            return
        
        cache_key = self._compute_cache_key(text, normalize)
        
        # Simple LRU: if cache full, remove oldest entry
        if len(self._cache) >= self.settings.cache_size:
            # Remove first item (oldest in insertion order for Python 3.7+)
            first_key = next(iter(self._cache))
            del self._cache[first_key]
        
        self._cache[cache_key] = embedding
    
    def generate_embeddings(
        self,
        texts: List[str],
        normalize: bool = True,
        batch_size: Optional[int] = None
    ) -> Tuple[List[List[float]], float]:
        """
        Generate embeddings for a list of texts.
        
        Args:
            texts: List of input texts
            normalize: Whether to normalize embeddings to unit length
            batch_size: Batch size for processing (optional)
            
        Returns:
            Tuple[List[List[float]], float]: (embeddings, latency_ms)
            
        Raises:
            RuntimeError: If model not loaded or generation fails
        """
        # Ensure model is loaded
        if self._model is None:
            self.load_model()
        
        if not self._initialized or self._model is None:
            raise RuntimeError("Model not initialized")
        
        start_time = time.time()
        
        # Update request statistics
        self._total_requests += 1
        self._total_embeddings += len(texts)
        
        # Check cache for all texts
        embeddings: List[Optional[List[float]]] = []
        texts_to_generate: List[Tuple[int, str]] = []
        
        for idx, text in enumerate(texts):
            cached = self._get_from_cache(text, normalize)
            if cached is not None:
                embeddings.append(cached)
            else:
                embeddings.append(None)
                texts_to_generate.append((idx, text))
        
        # Generate embeddings for cache misses
        if texts_to_generate:
            indices, texts_batch = zip(*texts_to_generate)
            
            # Use model's encode method with batch processing
            generated = self._model.encode(
                list(texts_batch),
                normalize_embeddings=normalize,
                batch_size=batch_size or self.settings.max_batch_size,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            
            # Store in results and cache
            for idx, embedding_array in zip(indices, generated):
                embedding_list = embedding_array.tolist()
                embeddings[idx] = embedding_list
                self._add_to_cache(texts[idx], normalize, embedding_list)
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # Ensure all embeddings are present (type safety)
        final_embeddings = [e for e in embeddings if e is not None]
        
        return final_embeddings, latency_ms
    
    def get_model_info(self) -> Dict[str, any]:
        """
        Get model information and status.
        
        Returns:
            Dict: Model information
        """
        return {
            "model": self.settings.model_name,
            "dimensions": self.settings.model_dimensions,
            "device": self.settings.device,
            "loaded": self._initialized,
            "ready": self._model is not None
        }
    
    def get_statistics(self) -> Dict[str, any]:
        """
        Get service statistics.
        
        Returns:
            Dict: Service statistics
        """
        cache_hit_rate = 0.0
        if self._cache_hits + self._cache_misses > 0:
            cache_hit_rate = self._cache_hits / (self._cache_hits + self._cache_misses)
        
        return {
            "total_requests": self._total_requests,
            "total_embeddings": self._total_embeddings,
            "cache_enabled": self.settings.cache_enabled,
            "cache_size": len(self._cache),
            "cache_capacity": self.settings.cache_size,
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "cache_hit_rate": round(cache_hit_rate, 4)
        }
    
    def clear_cache(self) -> int:
        """
        Clear the embedding cache.
        
        Returns:
            int: Number of entries cleared
        """
        count = len(self._cache)
        self._cache.clear()
        return count
    
    def is_ready(self) -> bool:
        """
        Check if service is ready to handle requests.
        
        Returns:
            bool: True if model loaded and ready
        """
        return self._initialized and self._model is not None



    async def generate_embeddings_async(
        self,
        texts: List[str],
        normalize: bool = True,
        batch_size: Optional[int] = None
    ) -> List[List[float]]:
        """
        Async wrapper for generate_embeddings for use with FastAPI async routes.
        
        Args:
            texts: List of input texts
            normalize: Whether to normalize embeddings
            batch_size: Batch size for processing
            
        Returns:
            List[List[float]]: Generated embeddings
        """
        import asyncio
        from functools import partial
        
        # Run synchronous method in thread pool
        loop = asyncio.get_event_loop()
        func = partial(self.generate_embeddings, texts, normalize, batch_size)
        embeddings, _ = await loop.run_in_executor(None, func)
        
        return embeddings

# Global service instance
embedding_service = EmbeddingService()


def get_embedding_service() -> EmbeddingService:
    """
    Get the global embedding service instance.
    
    Returns:
        EmbeddingService: Service instance
    """
    return embedding_service

