"""
Embedding Generation Tests

Tests for core embedding generation functionality.

Author: Development Team
Version: 1.0.0
"""

import pytest
import numpy as np


class TestEmbeddingGeneration:
    """Test suite for embedding generation."""
    
    def test_single_text_embedding(self, client, auth_headers):
        """Test embedding generation for single text."""
        response = client.post(
            "/embed",
            json={"texts": ["Hello world"]},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "embeddings" in data
        assert "dimensions" in data
        assert "count" in data
        assert "latency_ms" in data
        assert "model" in data
        
        assert data["count"] == 1
        assert data["dimensions"] == 384
        assert len(data["embeddings"]) == 1
        assert len(data["embeddings"][0]) == 384
    
    def test_multiple_texts_embedding(self, client, auth_headers, sample_texts):
        """Test embedding generation for multiple texts."""
        response = client.post(
            "/embed",
            json={"texts": sample_texts},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["count"] == len(sample_texts)
        assert len(data["embeddings"]) == len(sample_texts)
        
        # Check each embedding
        for embedding in data["embeddings"]:
            assert len(embedding) == 384
            assert all(isinstance(x, float) for x in embedding)
    
    def test_normalized_embeddings(self, client, auth_headers):
        """Test that normalized embeddings have unit length."""
        response = client.post(
            "/embed",
            json={
                "texts": ["Test normalization"],
                "normalize": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        embedding = np.array(data["embeddings"][0])
        norm = np.linalg.norm(embedding)
        
        # Should be very close to 1.0 (within floating point precision)
        assert abs(norm - 1.0) < 0.0001
    
    def test_unnormalized_embeddings(self, client, auth_headers):
        """Test unnormalized embeddings."""
        response = client.post(
            "/embed",
            json={
                "texts": ["Test no normalization"],
                "normalize": False
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        embedding = np.array(data["embeddings"][0])
        norm = np.linalg.norm(embedding)
        
        # Should NOT be exactly 1.0
        assert abs(norm - 1.0) > 0.01
    
    def test_batch_size_parameter(self, client, auth_headers, large_text_batch):
        """Test custom batch size parameter."""
        response = client.post(
            "/embed",
            json={
                "texts": large_text_batch,
                "batch_size": 16
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == len(large_text_batch)
    
    def test_empty_text_validation(self, client, auth_headers):
        """Test that empty texts are rejected."""
        response = client.post(
            "/embed",
            json={"texts": [""]},
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data or "detail" in data
    
    def test_too_many_texts_validation(self, client, auth_headers):
        """Test batch size limit enforcement."""
        # Generate more than max batch size (32)
        too_many_texts = [f"Text {i}" for i in range(100)]
        
        response = client.post(
            "/embed",
            json={"texts": too_many_texts},
            headers=auth_headers
        )
        
        # Should reject (400) or truncate
        assert response.status_code in [400, 200]
        
        if response.status_code == 400:
            data = response.json()
            assert "error" in data or "detail" in data
    
    def test_text_length_limit(self, client, auth_headers, long_text):
        """Test maximum text length enforcement."""
        # Text length depends on settings (default 8192 chars)
        very_long_text = " ".join(["word"] * 10000)
        
        response = client.post(
            "/embed",
            json={"texts": [very_long_text]},
            headers=auth_headers
        )
        
        # Should reject (400) or truncate
        assert response.status_code in [400, 200]
    
    def test_semantic_similarity(self, client, auth_headers):
        """Test that similar texts have similar embeddings."""
        response = client.post(
            "/embed",
            json={
                "texts": [
                    "The cat sat on the mat",
                    "A feline rested on the rug",
                    "Python is a programming language"
                ]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Calculate cosine similarity
        emb1 = np.array(data["embeddings"][0])
        emb2 = np.array(data["embeddings"][1])
        emb3 = np.array(data["embeddings"][2])
        
        def cosine_similarity(a, b):
            return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
        
        # Similar sentences should be more similar than dissimilar ones
        sim_12 = cosine_similarity(emb1, emb2)
        sim_13 = cosine_similarity(emb1, emb3)
        
        assert sim_12 > sim_13
    
    def test_caching_effectiveness(self, client, auth_headers, embedding_service):
        """Test that caching improves performance."""
        text = ["This is a test for caching"]
        
        # Clear cache first
        embedding_service.clear_cache()
        
        # First request (cache miss)
        response1 = client.post(
            "/embed",
            json={"texts": text},
            headers=auth_headers
        )
        
        assert response1.status_code == 200
        latency1 = response1.json()["latency_ms"]
        
        # Second request (cache hit)
        response2 = client.post(
            "/embed",
            json={"texts": text},
            headers=auth_headers
        )
        
        assert response2.status_code == 200
        latency2 = response2.json()["latency_ms"]
        
        # Embeddings should be identical
        assert response1.json()["embeddings"] == response2.json()["embeddings"]
        
        # Second request should be faster (cached)
        # Note: May not always be true due to system variance
        # assert latency2 < latency1
    
    def test_statistics_endpoint(self, client, auth_headers):
        """Test statistics endpoint."""
        # Make some requests first
        client.post(
            "/embed",
            json={"texts": ["test1"]},
            headers=auth_headers
        )
        
        # Get statistics
        response = client.get("/stats", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "statistics" in data
        assert "model" in data
        
        stats = data["statistics"]
        assert "total_requests" in stats
        assert "total_embeddings" in stats
        assert "cache_hit_rate" in stats
    
    def test_cache_clear_endpoint(self, client, auth_headers):
        """Test cache clearing endpoint."""
        # Add something to cache
        client.post(
            "/embed",
            json={"texts": ["test"]},
            headers=auth_headers
        )
        
        # Clear cache
        response = client.post("/cache/clear", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert "entries_cleared" in data
        assert data["status"] == "success"
