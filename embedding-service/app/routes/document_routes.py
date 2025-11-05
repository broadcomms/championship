"""
Document Processing API Routes
/process - Process document with full pipeline (chunk, embed, tag, store)
/search - Search similar chunks using vector similarity
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
import logging

from app.database import db_pool
from app.services.chunking_service import chunking_service
from app.services.tagging_service import tagging_service
from app.services.vector_service import VectorService
from app.services.embedding_service import embedding_service
from app.auth import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

# Initialize vector service
vector_service = VectorService(db_pool)


class ProcessDocumentRequest(BaseModel):
    document_id: str
    workspace_id: str
    raw_text: str
    filename: str
    content_type: str = "text/plain"
    file_size: int
    vultr_s3_key: str
    smartbucket_key: Optional[str] = None
    uploaded_by: str


class SearchRequest(BaseModel):
    query_text: str
    workspace_id: str
    limit: int = 10
    compliance_framework_id: Optional[int] = None


@router.post("/process")
async def process_document(request: ProcessDocumentRequest, api_key: str = Depends(verify_api_key)):
    """
    Process a document through the complete pipeline:
    1. Store document metadata
    2. Chunk the text
    3. Generate embeddings for each chunk
    4. Tag chunks with compliance frameworks
    5. Store everything in PostgreSQL
    """
    try:
        logger.info(f"Processing document {request.document_id}")
        
        # Step 1: Store document
        await vector_service.store_document(
            document_id=request.document_id,
            workspace_id=request.workspace_id,
            raw_text=request.raw_text,
            filename=request.filename,
            content_type=request.content_type,
            file_size=request.file_size,
            vultr_s3_key=request.vultr_s3_key,
            smartbucket_key=request.smartbucket_key,
            uploaded_by=request.uploaded_by
        )
        
        # Step 2: Chunk the text
        chunks = chunking_service.chunk_text(request.raw_text, request.document_id)
        
        if not chunks:
            raise HTTPException(status_code=400, detail="No chunks created from text")
            
        # Step 3: Store chunks and get IDs
        chunk_ids = await vector_service.store_chunks(
            document_id=request.document_id,
            workspace_id=request.workspace_id,
            chunks=chunks
        )
        
        # Step 4: Generate embeddings for all chunks
        chunk_texts = [chunk['chunk_text'] for chunk in chunks]
        embeddings = await embedding_service.generate_embeddings_async(chunk_texts)
        
        # Step 5: Tag each chunk
        tags_list = [tagging_service.tag_chunk(chunk['chunk_text']) for chunk in chunks]
        
        # Step 6: Store embeddings with tags
        embedding_count = await vector_service.store_embeddings(
            document_id=request.document_id,
            workspace_id=request.workspace_id,
            chunk_ids=chunk_ids,
            embeddings=embeddings,
            tags_list=tags_list
        )
        
        return {
            "success": True,
            "document_id": request.document_id,
            "chunks_created": len(chunks),
            "embeddings_stored": embedding_count,
            "message": "Document processed successfully"
        }
        
    except Exception as e:
        logger.error(f"Error processing document {request.document_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@router.post("/search")
async def search_similar(request: SearchRequest, api_key: str = Depends(verify_api_key)):
    """
    Search for similar chunks using vector similarity
    """
    try:
        logger.info(f"Searching for: {request.query_text[:100]}...")
        
        # Generate embedding for query text
        query_embeddings = await embedding_service.generate_embeddings_async([request.query_text])
        query_embedding = query_embeddings[0]
        
        # Search for similar chunks
        results = await vector_service.search_similar(
            query_embedding=query_embedding,
            workspace_id=request.workspace_id,
            limit=request.limit,
            compliance_framework_id=request.compliance_framework_id
        )
        
        return {
            "success": True,
            "query": request.query_text,
            "results_count": len(results),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error searching: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        if db_pool.pool is not None:
            async with db_pool.pool.acquire() as conn:
                await conn.fetchval('SELECT 1')
            db_status = "connected"
        else:
            db_status = "not initialized"
            
        return {
            "status": "healthy",
            "database": db_status,
            "services": "operational"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
