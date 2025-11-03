"""
Local Embedding Service
Fast batch processing with sentence-transformers all-MiniLM-L6-v2
Generates 384-dimensional embeddings for AuditGuard documents
"""

from sentence_transformers import SentenceTransformer
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List
import uvicorn
import logging
import time
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="AuditGuard Local Embedding Service",
    description="Fast sentence-transformers embeddings for document processing",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your needs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance (loaded once on startup)
model: SentenceTransformer = None

# Metrics
metrics = {
    "total_requests": 0,
    "total_embeddings": 0,
    "total_errors": 0,
    "avg_latency_ms": 0,
}


class EmbeddingRequest(BaseModel):
    """Request model for embedding generation"""
    texts: List[str] = Field(..., description="List of texts to embed", min_items=1)
    batch_size: int = Field(32, description="Batch size for processing", ge=1, le=100)
    normalize: bool = Field(True, description="Normalize embeddings to unit length")


class EmbeddingResponse(BaseModel):
    """Response model with embeddings"""
    embeddings: List[List[float]] = Field(..., description="List of embedding vectors")
    dimensions: int = Field(384, description="Embedding dimensionality")
    count: int = Field(..., description="Number of embeddings generated")
    latency_ms: float = Field(..., description="Processing time in milliseconds")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model: str
    dimensions: int
    ready: bool
    metrics: dict


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    detail: str


@app.on_event("startup")
async def load_model():
    """Load sentence-transformers model on startup"""
    global model
    
    try:
        logger.info("Loading sentence-transformers model: all-MiniLM-L6-v2")
        start_time = time.time()
        
        # Load model (will download if not cached)
        model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        
        load_time = (time.time() - start_time) * 1000
        logger.info(f"Model loaded successfully in {load_time:.2f}ms")
        
        # Test model
        test_embedding = model.encode(["test"], show_progress_bar=False)
        logger.info(f"Model test successful: dimensions={len(test_embedding[0])}")
        
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        raise


@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint with basic info"""
    return await health()


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if model is not None else "not_ready",
        model="sentence-transformers/all-MiniLM-L6-v2",
        dimensions=384,
        ready=model is not None,
        metrics=metrics
    )


@app.post("/embed", response_model=EmbeddingResponse)
async def generate_embeddings(request: EmbeddingRequest):
    """
    Generate embeddings for a list of texts
    
    This endpoint uses the sentence-transformers library with the all-MiniLM-L6-v2 model
    to generate 384-dimensional embeddings optimized for semantic similarity.
    
    Performance:
    - Batch size 32: ~30-50 chunks/second on CPU
    - Latency: 2-3 seconds for 100 chunks
    - Memory: ~500MB for model
    
    Returns:
        EmbeddingResponse with 384-dimensional vectors
    """
    global metrics
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    
    try:
        start_time = time.time()
        
        logger.info(f"Generating embeddings for {len(request.texts)} texts (batch_size={request.batch_size})")
        
        # Generate embeddings
        embeddings = model.encode(
            request.texts,
            batch_size=request.batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=request.normalize
        )
        
        # Convert to list of lists
        embeddings_list = embeddings.tolist()
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # Update metrics
        metrics["total_requests"] += 1
        metrics["total_embeddings"] += len(embeddings_list)
        metrics["avg_latency_ms"] = (
            (metrics["avg_latency_ms"] * (metrics["total_requests"] - 1) + latency_ms) 
            / metrics["total_requests"]
        )
        
        logger.info(
            f"Successfully generated {len(embeddings_list)} embeddings in {latency_ms:.2f}ms "
            f"({len(embeddings_list)/latency_ms*1000:.1f} chunks/sec)"
        )
        
        return EmbeddingResponse(
            embeddings=embeddings_list,
            dimensions=384,
            count=len(embeddings_list),
            latency_ms=round(latency_ms, 2)
        )
        
    except Exception as e:
        metrics["total_errors"] += 1
        logger.error(f"Error generating embeddings: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate embeddings: {str(e)}"
        )


@app.post("/embed/single")
async def generate_single_embedding(text: str):
    """
    Generate embedding for a single text (convenience endpoint)
    
    Args:
        text: Text to embed
        
    Returns:
        Single embedding vector (384 dimensions)
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    
    try:
        embedding = model.encode([text], show_progress_bar=False, convert_to_numpy=True)
        return {
            "embedding": embedding[0].tolist(),
            "dimensions": 384,
            "text_length": len(text)
        }
    except Exception as e:
        logger.error(f"Error generating single embedding: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    return {
        **metrics,
        "model_loaded": model is not None,
        "model_name": "all-MiniLM-L6-v2",
        "dimensions": 384,
    }


@app.post("/reset-metrics")
async def reset_metrics():
    """Reset metrics (for testing)"""
    global metrics
    metrics = {
        "total_requests": 0,
        "total_embeddings": 0,
        "total_errors": 0,
        "avg_latency_ms": 0,
    }
    return {"status": "metrics reset"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting AuditGuard Local Embedding Service on {host}:{port}")
    
    uvicorn.run(
        app, 
        host=host, 
        port=port,
        log_level="info",
        access_log=True
    )
