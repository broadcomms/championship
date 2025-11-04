"""
Embedding Generation Routes

Main API endpoints for embedding generation with authentication.

Author: Development Team
Version: 1.0.0
"""

import time
from fastapi import APIRouter, Depends, HTTPException, status
from app.models import EmbeddingRequest, EmbeddingResponse, ErrorResponse
from app.services import get_embedding_service
from app.auth import verify_api_key

router = APIRouter(tags=["Embeddings"])


@router.post(
    "/embed",
    response_model=EmbeddingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate embeddings",
    description="Generate embeddings for a list of texts (requires authentication)",
    responses={
        200: {"description": "Embeddings generated successfully"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Authentication failed"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def generate_embeddings(
    request: EmbeddingRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Generate embeddings for input texts.
    
    **Authentication**: Requires valid API key in X-API-Key header
    
    **Request Body**:
    - texts: List of texts to embed (1-32 items)
    - normalize: Whether to normalize embeddings to unit length (default: true)
    - batch_size: Optional batch size for processing (1-128)
    
    **Response**:
    - embeddings: List of embedding vectors
    - dimensions: Embedding dimensions (384)
    - count: Number of embeddings generated
    - latency_ms: Processing latency in milliseconds
    - model: Model used for generation
    
    **Rate Limits**:
    - 100 requests per minute per API key
    
    **Example**:
    ```json
    {
      "texts": [
        "This is a sample document.",
        "Another example text."
      ],
      "normalize": true,
      "batch_size": 32
    }
    ```
    """
    service = get_embedding_service()
    
    try:
        # Ensure model is loaded (lazy loading)
        if not service.is_ready():
            service.load_model()
        
        # Generate embeddings
        embeddings, latency_ms = service.generate_embeddings(
            texts=request.texts,
            normalize=request.normalize,
            batch_size=request.batch_size
        )
        
        # Get model info
        model_info = service.get_model_info()
        
        return EmbeddingResponse(
            embeddings=embeddings,
            dimensions=model_info["dimensions"],
            count=len(embeddings),
            latency_ms=round(latency_ms, 2),
            model=model_info["model"]
        )
        
    except ValueError as e:
        # Input validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except RuntimeError as e:
        # Model loading or generation errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Embedding generation failed: {str(e)}"
        )
    except Exception as e:
        # Unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/stats",
    status_code=status.HTTP_200_OK,
    summary="Get service statistics",
    description="Get embedding service statistics (requires authentication)"
)
async def get_statistics(api_key: str = Depends(verify_api_key)):
    """
    Get service statistics.
    
    **Authentication**: Requires valid API key
    
    **Returns**:
    - total_requests: Total embedding requests processed
    - total_embeddings: Total embeddings generated
    - cache_enabled: Whether caching is enabled
    - cache_size: Current cache size
    - cache_hits: Number of cache hits
    - cache_misses: Number of cache misses
    - cache_hit_rate: Cache hit rate (0-1)
    """
    service = get_embedding_service()
    
    return {
        "statistics": service.get_statistics(),
        "model": service.get_model_info()
    }


@router.post(
    "/cache/clear",
    status_code=status.HTTP_200_OK,
    summary="Clear embedding cache",
    description="Clear the embedding cache (requires authentication)"
)
async def clear_cache(api_key: str = Depends(verify_api_key)):
    """
    Clear the embedding cache.
    
    **Authentication**: Requires valid API key
    
    **Returns**:
    - entries_cleared: Number of cache entries cleared
    """
    service = get_embedding_service()
    cleared = service.clear_cache()
    
    return {
        "status": "success",
        "entries_cleared": cleared,
        "message": f"Cleared {cleared} cache entries"
    }
