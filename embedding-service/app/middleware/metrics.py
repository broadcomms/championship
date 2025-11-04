"""
Prometheus Metrics Middleware

Tracks request metrics for monitoring and observability.

Author: Development Team
Version: 1.0.0
"""

import time
from typing import Callable
from fastapi import Request, Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

from app.config import get_settings


# Metrics definitions
request_count = Counter(
    'embedding_requests_total',
    'Total number of embedding requests',
    ['method', 'endpoint', 'status']
)

request_duration = Histogram(
    'embedding_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

embedding_batch_size = Histogram(
    'embedding_batch_size',
    'Size of embedding batches',
    buckets=[1, 2, 4, 8, 16, 32, 64, 128]
)

embedding_errors = Counter(
    'embedding_errors_total',
    'Total number of embedding errors',
    ['error_type']
)

model_inference_duration = Histogram(
    'model_inference_duration_seconds',
    'Model inference duration in seconds',
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]
)

active_requests = Gauge(
    'active_requests',
    'Number of requests currently being processed'
)


async def metrics_middleware(request: Request, call_next: Callable) -> Response:
    """
    Middleware to track request metrics.
    
    Tracks:
    - Request count by endpoint and status
    - Request duration
    - Active requests
    
    Args:
        request: FastAPI request object
        call_next: Next middleware/handler in chain
        
    Returns:
        Response: FastAPI response object
    """
    settings = get_settings()
    
    # Skip metrics collection if disabled
    if not settings.enable_metrics:
        return await call_next(request)
    
    # Extract endpoint info
    method = request.method
    path = request.url.path
    
    # Increment active requests
    active_requests.inc()
    
    # Start timer
    start_time = time.time()
    
    try:
        # Process request
        response = await call_next(request)
        
        # Record metrics
        duration = time.time() - start_time
        status = response.status_code
        
        request_count.labels(
            method=method,
            endpoint=path,
            status=status
        ).inc()
        
        request_duration.labels(
            method=method,
            endpoint=path
        ).observe(duration)
        
        return response
        
    except Exception as e:
        # Record error
        duration = time.time() - start_time
        
        request_count.labels(
            method=method,
            endpoint=path,
            status=500
        ).inc()
        
        request_duration.labels(
            method=method,
            endpoint=path
        ).observe(duration)
        
        embedding_errors.labels(
            error_type=type(e).__name__
        ).inc()
        
        raise
        
    finally:
        # Decrement active requests
        active_requests.dec()


def get_metrics() -> tuple:
    """
    Get Prometheus metrics in exposition format.
    
    Returns:
        tuple: (metrics_data, content_type)
    """
    metrics_data = generate_latest()
    return metrics_data, CONTENT_TYPE_LATEST


def record_batch_size(size: int) -> None:
    """
    Record batch size for histogram.
    
    Args:
        size: Batch size
    """
    embedding_batch_size.observe(size)


def record_inference_duration(duration: float) -> None:
    """
    Record model inference duration.
    
    Args:
        duration: Duration in seconds
    """
    model_inference_duration.observe(duration)


def record_error(error_type: str) -> None:
    """
    Record an error occurrence.
    
    Args:
        error_type: Type of error
    """
    embedding_errors.labels(error_type=error_type).inc()
