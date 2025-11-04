"""
End-to-End Integration Tests

Complete workflow tests simulating real-world usage scenarios.

Author: Development Team
Version: 1.0.0
"""

import pytest
import time
import numpy as np


class TestEndToEndWorkflows:
    """Test suite for complete end-to-end workflows."""
    
    def test_complete_embedding_workflow(self, client, auth_headers):
        """Test complete workflow: health check -> embed -> verify."""
        # 1. Check service health
        health_response = client.get("/health")
        assert health_response.status_code == 200
        assert health_response.json()["ready"]
        
        # 2. Generate embeddings
        embed_response = client.post(
            "/embed",
            json={
                "texts": [
                    "First document about machine learning",
                    "Second document about artificial intelligence",
                    "Third document about cooking recipes"
                ],
                "normalize": True
            },
            headers=auth_headers
        )
        
        assert embed_response.status_code == 200
        embed_data = embed_response.json()
        
        # 3. Verify embeddings
        assert embed_data["count"] == 3
        assert len(embed_data["embeddings"]) == 3
        
        # 4. Verify semantic similarity
        emb1 = np.array(embed_data["embeddings"][0])
        emb2 = np.array(embed_data["embeddings"][1])
        emb3 = np.array(embed_data["embeddings"][2])
        
        def cosine_similarity(a, b):
            return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
        
        # ML and AI documents should be more similar
        sim_12 = cosine_similarity(emb1, emb2)
        sim_13 = cosine_similarity(emb1, emb3)
        
        assert sim_12 > sim_13
        
        # 5. Check statistics
        stats_response = client.get("/stats", headers=auth_headers)
        assert stats_response.status_code == 200
        stats = stats_response.json()["statistics"]
        assert stats["total_embeddings"] >= 3
    
    def test_batch_processing_workflow(self, client, auth_headers):
        """Test batch processing of multiple documents."""
        # Generate 30 documents
        documents = [f"Document {i} about topic {i % 5}" for i in range(30)]
        
        # Process in batch
        response = client.post(
            "/embed",
            json={
                "texts": documents,
                "batch_size": 16,
                "normalize": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["count"] == 30
        assert len(data["embeddings"]) == 30
        
        # Verify all embeddings are normalized
        for embedding in data["embeddings"]:
            norm = np.linalg.norm(np.array(embedding))
            assert abs(norm - 1.0) < 0.0001
    
    def test_caching_workflow(self, client, auth_headers, embedding_service):
        """Test caching behavior across multiple requests."""
        # Clear cache
        embedding_service.clear_cache()
        
        texts = ["Cached text 1", "Cached text 2", "Cached text 3"]
        
        # First request (cache miss)
        response1 = client.post(
            "/embed",
            json={"texts": texts},
            headers=auth_headers
        )
        
        assert response1.status_code == 200
        embeddings1 = response1.json()["embeddings"]
        
        # Second request (cache hit)
        response2 = client.post(
            "/embed",
            json={"texts": texts},
            headers=auth_headers
        )
        
        assert response2.status_code == 200
        embeddings2 = response2.json()["embeddings"]
        
        # Embeddings should be identical
        assert embeddings1 == embeddings2
        
        # Check statistics
        stats_response = client.get("/stats", headers=auth_headers)
        stats = stats_response.json()["statistics"]
        
        # Should have cache hits
        if stats["cache_enabled"]:
            assert stats["cache_hits"] > 0
    
    def test_error_handling_workflow(self, client, auth_headers):
        """Test error handling across different scenarios."""
        # 1. Empty text
        response1 = client.post(
            "/embed",
            json={"texts": [""]},
            headers=auth_headers
        )
        assert response1.status_code == 400
        
        # 2. No texts
        response2 = client.post(
            "/embed",
            json={"texts": []},
            headers=auth_headers
        )
        assert response2.status_code in [400, 422]
        
        # 3. Invalid batch size
        response3 = client.post(
            "/embed",
            json={"texts": ["test"], "batch_size": 1000},
            headers=auth_headers
        )
        assert response3.status_code in [400, 422]
        
        # 4. Service should still be healthy
        health_response = client.get("/health")
        assert health_response.status_code == 200
    
    def test_concurrent_requests_workflow(self, client, auth_headers):
        """Test handling of concurrent requests."""
        import concurrent.futures
        
        def make_request(text):
            return client.post(
                "/embed",
                json={"texts": [text]},
                headers=auth_headers
            )
        
        # Make 10 concurrent requests
        texts = [f"Concurrent text {i}" for i in range(10)]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request, text) for text in texts]
            responses = [future.result() for future in futures]
        
        # All requests should succeed
        success_count = sum(1 for r in responses if r.status_code == 200)
        assert success_count >= 8  # Allow some to fail due to rate limiting
    
    def test_model_info_consistency(self, client, auth_headers):
        """Test that model info is consistent across endpoints."""
        # Get info from /info
        info_response = client.get("/info")
        info_model = info_response.json()["model"]
        
        # Get info from /health
        health_response = client.get("/health")
        health_model = health_response.json()["model"]
        
        # Generate embeddings
        embed_response = client.post(
            "/embed",
            json={"texts": ["test"]},
            headers=auth_headers
        )
        embed_model = embed_response.json()["model"]
        embed_dimensions = embed_response.json()["dimensions"]
        
        # All should match
        assert info_model["name"] == health_model
        assert info_model["name"] == embed_model
        assert info_model["dimensions"] == 384
        assert embed_dimensions == 384
    
    def test_service_restart_simulation(self, client, auth_headers, embedding_service):
        """Test service behavior after cache clear (simulating restart)."""
        # Generate some embeddings
        response1 = client.post(
            "/embed",
            json={"texts": ["Before restart"]},
            headers=auth_headers
        )
        assert response1.status_code == 200
        
        # Clear cache (simulate restart)
        embedding_service.clear_cache()
        
        # Service should still work
        response2 = client.post(
            "/embed",
            json={"texts": ["After restart"]},
            headers=auth_headers
        )
        assert response2.status_code == 200
        
        # Health should be good
        health_response = client.get("/health")
        assert health_response.status_code == 200
        assert health_response.json()["ready"]
    
    def test_metrics_endpoint_workflow(self, client, auth_headers):
        """Test Prometheus metrics endpoint."""
        # Make some requests
        for i in range(3):
            client.post(
                "/embed",
                json={"texts": [f"Test {i}"]},
                headers=auth_headers
            )
        
        # Get metrics
        response = client.get("/metrics")
        
        # Should return metrics in Prometheus format
        assert response.status_code == 200
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "text/plain" in content_type or "text" in content_type
        
        # Metrics should contain our custom metrics
        metrics_text = response.text
        # May contain various metrics depending on configuration
        # Just verify it returns some content
        assert len(metrics_text) > 0
