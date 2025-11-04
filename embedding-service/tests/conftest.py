"""
Pytest Configuration and Fixtures

Provides shared test fixtures for all test modules.

Author: Development Team
Version: 1.0.0
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services import get_embedding_service
from app.config import get_settings


@pytest.fixture
def client():
    """
    Test client fixture.
    
    Provides a TestClient instance for making requests.
    """
    return TestClient(app)


@pytest.fixture
def valid_api_key():
    """
    Valid API key fixture.
    
    Returns a valid API key from settings or test key.
    """
    settings = get_settings()
    if settings.api_keys:
        return settings.api_keys[0]
    return "test-api-key-1234567890"


@pytest.fixture
def invalid_api_key():
    """Invalid API key fixture."""
    return "invalid-key"


@pytest.fixture
def embedding_service():
    """
    Embedding service fixture.
    
    Returns the global embedding service instance.
    """
    return get_embedding_service()


@pytest.fixture
def sample_texts():
    """Sample texts for embedding generation."""
    return [
        "This is a test document for embedding generation.",
        "Another example text to process.",
        "The quick brown fox jumps over the lazy dog."
    ]


@pytest.fixture
def auth_headers(valid_api_key):
    """
    Authentication headers fixture.
    
    Returns headers with valid API key.
    """
    return {"X-API-Key": valid_api_key}


@pytest.fixture(autouse=True)
def reset_service_stats(embedding_service):
    """
    Reset service statistics before each test.
    
    Ensures clean state for each test.
    """
    # Clear cache
    embedding_service.clear_cache()
    
    # Reset counters (if needed)
    yield
    
    # Cleanup after test
    embedding_service.clear_cache()


@pytest.fixture
def large_text_batch():
    """
    Large batch of texts for load testing.
    
    Returns 32 texts (max batch size).
    """
    return [f"Test document number {i} for batch processing." for i in range(32)]


@pytest.fixture
def long_text():
    """
    Long text for testing length limits.
    
    Returns a text with ~1000 words.
    """
    return " ".join(["word"] * 1000)
