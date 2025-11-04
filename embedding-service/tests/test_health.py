"""
Health Check Tests

Tests for health, liveness, and readiness endpoints.

Author: Development Team
Version: 1.0.0
"""

import pytest


class TestHealthEndpoints:
    """Test suite for health check endpoints."""
    
    def test_root_endpoint(self, client):
        """Test root endpoint returns service info."""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "service" in data
        assert "version" in data
        assert "status" in data
        assert data["status"] == "running"
    
    def test_health_endpoint(self, client):
        """Test comprehensive health check."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert "model" in data
        assert "dimensions" in data
        assert "ready" in data
        
        assert data["dimensions"] == 384
        assert data["status"] in ["healthy", "initializing"]
    
    def test_health_includes_metrics(self, client):
        """Test that health endpoint includes metrics."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        if "metrics" in data and data["metrics"]:
            metrics = data["metrics"]
            assert "total_requests" in metrics
            assert "cache_hit_rate" in metrics
    
    def test_liveness_probe(self, client):
        """Test liveness probe always succeeds."""
        response = client.get("/health/live")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert data["status"] == "alive"
    
    def test_readiness_probe(self, client):
        """Test readiness probe."""
        response = client.get("/health/ready")
        
        # Should return 200 if ready, 503 if not
        assert response.status_code in [200, 503]
        
        data = response.json()
        assert "status" in data
        
        if response.status_code == 200:
            assert data["status"] == "ready"
        else:
            assert data["status"] == "not_ready"
    
    def test_info_endpoint(self, client):
        """Test service info endpoint."""
        response = client.get("/info")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "service" in data
        assert "version" in data
        assert "model" in data
        assert "limits" in data
        assert "features" in data
        
        # Check model info
        model = data["model"]
        assert "name" in model
        assert "dimensions" in model
        assert model["dimensions"] == 384
        
        # Check limits
        limits = data["limits"]
        assert "max_batch_size" in limits
        assert "max_text_length" in limits
        assert "rate_limit_per_minute" in limits
        
        # Check features
        features = data["features"]
        assert "caching" in features
        assert "rate_limiting" in features
    
    def test_info_no_auth_required(self, client):
        """Test that info endpoint doesn't require auth."""
        response = client.get("/info")
        
        # Should succeed without API key
        assert response.status_code == 200
    
    def test_health_endpoints_no_auth(self, client):
        """Test that health endpoints don't require auth."""
        endpoints = ["/health", "/health/live", "/health/ready"]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code in [200, 503]
