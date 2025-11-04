"""
Pydantic Models for Request/Response Validation

Author: Development Team
Version: 1.0.0
"""

from typing import List, Optional
from pydantic import BaseModel, Field, validator


class EmbeddingRequest(BaseModel):
    """Request model for embedding generation."""
    
    texts: List[str] = Field(
        ...,
        min_items=1,
        description="List of texts to embed"
    )
    normalize: bool = Field(
        default=True,
        description="Normalize embeddings to unit length"
    )
    batch_size: Optional[int] = Field(
        default=None,
        ge=1,
        le=128,
        description="Batch size for processing (optional)"
    )
    
    @validator("texts")
    def validate_texts(cls, v):
        """Validate text inputs."""
        from app.config import get_settings
        settings = get_settings()
        
        # Check batch size
        if len(v) > settings.max_batch_size:
            raise ValueError(
                f"Too many texts. Maximum batch size: {settings.max_batch_size}"
            )
        
        # Check individual text lengths
        for i, text in enumerate(v):
            if not text or not text.strip():
                raise ValueError(f"Text at index {i} is empty")
            if len(text) > settings.max_text_length:
                raise ValueError(
                    f"Text at index {i} too long. Maximum: {settings.max_text_length} characters"
                )
        
        return v

    class Config:
        schema_extra = {
            "example": {
                "texts": [
                    "This is a sample document for embedding generation.",
                    "Another example text to process."
                ],
                "normalize": True,
                "batch_size": 32
            }
        }


class EmbeddingResponse(BaseModel):
    """Response model for embedding generation."""
    
    embeddings: List[List[float]] = Field(
        ...,
        description="Generated embeddings"
    )
    dimensions: int = Field(
        ...,
        description="Embedding dimensions"
    )
    count: int = Field(
        ...,
        description="Number of embeddings generated"
    )
    latency_ms: float = Field(
        ...,
        description="Processing latency in milliseconds"
    )
    model: str = Field(
        ...,
        description="Model used for generation"
    )


class HealthResponse(BaseModel):
    """Health check response."""
    
    status: str = Field(..., description="Service status")
    model: str = Field(..., description="Loaded model")
    dimensions: int = Field(..., description="Embedding dimensions")
    ready: bool = Field(..., description="Service ready status")
    metrics: Optional[dict] = Field(None, description="Service metrics")


class ErrorResponse(BaseModel):
    """Error response model."""
    
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")
