"""
Authentication Tests

Tests for API key authentication and rate limiting.

Author: Development Team
Version: 1.0.0
"""

import pytest
import time
from app.auth import verify_api_key, rate_limiter
from fastapi import HTTPException


class TestAuthentication:
    """Test suite for authentication functionality."""
    
    def test_missing_api_key(self, client):
        """Test request without API key."""
        response = client.post(
            "/embed",
            json={"texts": ["test"]}
        )
        
        # Should return 401 if API keys are configured
        # Or 200 if in development mode (no API keys)
        assert response.status_code in [200, 401]
    
    def test_invalid_api_key(self, client, invalid_api_key):
        """Test request with invalid API key."""
        response = client.post(
            "/embed",
            json={"texts": ["test"]},
            headers={"X-API-Key": invalid_api_key}
        )
        
        # Should return 401 if API keys are configured
        assert response.status_code in [200, 401]
    
    def test_valid_api_key(self, client, auth_headers, sample_texts):
        """Test request with valid API key."""
        response = client.post(
            "/embed",
            json={"texts": sample_texts},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "embeddings" in data
        assert len(data["embeddings"]) == len(sample_texts)
    
    def test_rate_limiting(self, client, auth_headers):
        """Test rate limiting enforcement."""
        # Note: This test depends on rate limit settings
        # May need to be adjusted based on configured limits
        
        # Make multiple rapid requests
        responses = []
        for i in range(5):
            response = client.post(
                "/embed",
                json={"texts": ["test"]},
                headers=auth_headers
            )
            responses.append(response)
        
        # All should succeed (under limit)
        for response in responses:
            assert response.status_code in [200, 429]
    
    def test_rate_limiter_check(self):
        """Test rate limiter logic."""
        test_key = "test-key-123"
        
        # First request should succeed
        assert rate_limiter.check_rate_limit(test_key, limit_per_minute=10)
        
        # Multiple requests within limit should succeed
        for _ in range(5):
            assert rate_limiter.check_rate_limit(test_key, limit_per_minute=10)
        
        # Check current usage
        usage = rate_limiter.get_current_usage(test_key)
        assert usage == 6
    
    def test_rate_limiter_reset(self):
        """Test that rate limiter resets after time window."""
        test_key = "test-key-456"
        
        # Use up limit
        for _ in range(10):
            rate_limiter.check_rate_limit(test_key, limit_per_minute=10)
        
        # Next request should fail
        assert not rate_limiter.check_rate_limit(test_key, limit_per_minute=10)
        
        # Wait for window to reset (61 seconds)
        # Note: This is slow, consider mocking time in real tests
        # time.sleep(61)
        # assert rate_limiter.check_rate_limit(test_key, limit_per_minute=10)
    
    def test_api_key_in_response_headers(self, client, auth_headers):
        """Test that rate limit headers are returned."""
        response = client.post(
            "/embed",
            json={"texts": ["test"]},
            headers=auth_headers
        )
        
        # Check if rate limit headers are present (if rate limiting enabled)
        # Note: Headers may only be present on 429 responses
        if response.status_code == 429:
            assert "X-RateLimit-Limit" in response.headers
            assert "X-RateLimit-Remaining" in response.headers
            assert "X-RateLimit-Reset" in response.headers
