"""
Health Check Routes

Provides liveness, readiness, and detailed health check endpoints.

Author: Development Team
Version: 1.0.0
"""

from fastapi import APIRouter, status
from app.models import HealthResponse
from app.services import get_embedding_service
from app.config import get_settings

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Full health check",
    description="Comprehensive health check including model status and metrics"
)
async def health_check():
    """
    Full health check endpoint.
    
    Returns detailed information about service health, model status,
    and performance metrics.
    """
    settings = get_settings()
    service = get_embedding_service()
    
    # Get model info and statistics
    model_info = service.get_model_info()
    statistics = service.get_statistics()
    
    return HealthResponse(
        status="healthy" if service.is_ready() else "initializing",
        model=model_info["model"],
        dimensions=model_info["dimensions"],
        ready=model_info["ready"],
        metrics=statistics
    )


@router.get(
    "/health/live",
    status_code=status.HTTP_200_OK,
    summary="Liveness probe",
    description="Check if service is alive (process running)"
)
async def liveness_check():
    """
    Liveness probe for Kubernetes/Docker.
    
    Returns 200 if process is running.
    This endpoint should always succeed if the process is alive.
    """
    return {"status": "alive"}


@router.get(
    "/health/ready",
    status_code=status.HTTP_200_OK,
    summary="Readiness probe",
    description="Check if service is ready to accept requests"
)
async def readiness_check():
    """
    Readiness probe for Kubernetes/Docker.
    
    Returns 200 only if model is loaded and service is ready.
    Returns 503 if service is not ready yet.
    """
    service = get_embedding_service()
    
    if not service.is_ready():
        return {
            "status": "not_ready",
            "message": "Model not loaded yet"
        }, status.HTTP_503_SERVICE_UNAVAILABLE
    
    return {
        "status": "ready",
        "message": "Service ready to accept requests"
    }


@router.get(
    "/info",
    status_code=status.HTTP_200_OK,
    summary="Service information",
    description="Get service configuration and version information"
)
async def service_info():
    """
    Service information endpoint.
    
    Returns configuration details and version information.
    Public endpoint (no authentication required).
    """
    settings = get_settings()
    service = get_embedding_service()
    model_info = service.get_model_info()
    
    return {
        "service": settings.api_title,
        "version": settings.api_version,
        "model": {
            "name": model_info["model"],
            "dimensions": model_info["dimensions"],
            "device": model_info["device"]
        },
        "limits": {
            "max_batch_size": settings.max_batch_size,
            "max_text_length": settings.max_text_length,
            "rate_limit_per_minute": settings.rate_limit_per_minute
        },
        "features": {
            "caching": settings.cache_enabled,
            "rate_limiting": settings.rate_limit_enabled,
            "metrics": settings.enable_metrics
        }
    }
