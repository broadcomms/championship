"""
Main FastAPI Application

Production embedding service with authentication, monitoring, and optimization.

Author: Development Team
Version: 1.0.0
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings, validate_settings
from app.services import get_embedding_service
from app.routes import health_router, embeddings_router
from app.middleware import metrics_middleware, get_metrics
from app.models import ErrorResponse


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("🚀 Starting Embedding Service...")
    
    # Validate settings
    try:
        validate_settings()
    except Exception as e:
        logger.error(f"❌ Settings validation failed: {e}")
        raise
    
    # Pre-load model (optional: can also lazy load on first request)
    settings = get_settings()
    if hasattr(settings, 'preload_model') and settings.preload_model:
        logger.info("Loading model on startup...")
        service = get_embedding_service()
        try:
            service.load_model()
        except Exception as e:
            logger.error(f"❌ Model loading failed: {e}")
            # Don't fail startup - allow lazy loading
    
    logger.info("✅ Embedding Service ready")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Embedding Service...")
    logger.info("✅ Shutdown complete")


# Initialize FastAPI app
settings = get_settings()

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
    lifespan=lifespan,
    docs_url="/docs" if settings.log_level == "DEBUG" else None,
    redoc_url="/redoc" if settings.log_level == "DEBUG" else None,
)


# Add CORS middleware
if settings.cors_enabled:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Add metrics middleware
if settings.enable_metrics:
    app.middleware("http")(metrics_middleware)


# Include routers
app.include_router(health_router, prefix="", tags=["Health"])
app.include_router(embeddings_router, prefix="", tags=["Embeddings"])


# Prometheus metrics endpoint
if settings.enable_metrics:
    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        """Prometheus metrics endpoint."""
        metrics_data, content_type = get_metrics()
        return Response(content=metrics_data, media_type=content_type)


# Custom exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle Pydantic validation errors.
    
    Returns a clean error response with validation details.
    """
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    logger.warning(f"Validation error: {errors}")
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "Validation Error",
            "detail": "Request validation failed",
            "errors": errors
        }
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handle HTTP exceptions.
    
    Returns consistent error format.
    """
    logger.warning(f"HTTP {exc.status_code}: {exc.detail}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": f"HTTP {exc.status_code}",
            "detail": exc.detail
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle unexpected exceptions.
    
    Logs error and returns generic error response.
    """
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": "An unexpected error occurred"
        }
    )


# Root endpoint
@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint with service information."""
    return {
        "service": settings.api_title,
        "version": settings.api_version,
        "status": "running",
        "docs": "/docs" if settings.log_level == "DEBUG" else "disabled",
        "health": "/health",
        "endpoints": {
            "embed": "POST /embed",
            "health": "GET /health",
            "info": "GET /info",
            "metrics": "GET /metrics" if settings.enable_metrics else "disabled"
        }
    }


# Request logging middleware (if enabled)
if settings.enable_detailed_logging:
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        """Log all requests with timing information."""
        import time
        
        start_time = time.time()
        
        # Log request
        logger.info(f"➡️  {request.method} {request.url.path}")
        
        # Process request
        response = await call_next(request)
        
        # Log response
        duration = time.time() - start_time
        logger.info(
            f"⬅️  {request.method} {request.url.path} "
            f"[{response.status_code}] {duration*1000:.2f}ms"
        )
        
        return response


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level=settings.log_level.lower()
    )
