"""
Document Query API Routes

Provides endpoints for querying document processing status,
chunk information, and embedding statistics from PostgreSQL.
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional, List, Dict, Any
import logging

from app.services.database import DatabaseService
from app.auth import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/v1/documents/{document_id}/status")
async def get_document_status(
    document_id: str,
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Get document processing status from PostgreSQL.
    
    Returns:
        - document_id: Document identifier
        - processing_status: pending | processing | completed | failed
        - chunk_count: Total chunks created
        - embedding_count: Total embeddings generated
        - chunks_completed: Chunks with completed embeddings
        - chunks_pending: Chunks with pending embeddings
        - chunks_failed: Chunks with failed embeddings
    """
    try:
        db = DatabaseService()
        
        # Get document info
        document = await db.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        
        # Get chunk statistics
        chunk_stats = await db.get_chunk_statistics(document_id)
        
        return {
            "document_id": document_id,
            "workspace_id": document.get("workspace_id"),
            "processing_status": document.get("processing_status", "unknown"),
            "chunk_count": document.get("chunk_count", 0),
            "embedding_count": document.get("embedding_count", 0),
            "chunks_completed": chunk_stats.get("completed", 0),
            "chunks_pending": chunk_stats.get("pending", 0),
            "chunks_processing": chunk_stats.get("processing", 0),
            "chunks_failed": chunk_stats.get("failed", 0),
            "created_at": document.get("created_at"),
            "updated_at": document.get("updated_at"),
            "processed_at": document.get("processed_at"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get document status: {str(e)}")


@router.get("/api/v1/documents/{document_id}/vector-status")
async def get_vector_status(
    document_id: str,
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Get vector indexing status for a document.
    
    Returns status compatible with the existing Cloudflare Worker API.
    """
    try:
        db = DatabaseService()
        
        # Get chunk and embedding counts
        chunk_stats = await db.get_chunk_statistics(document_id)
        total_chunks = sum(chunk_stats.values())
        indexed_chunks = chunk_stats.get("completed", 0)
        
        # Get vector IDs for indexed chunks
        vector_ids = await db.get_vector_ids(document_id)
        
        # Determine status
        if indexed_chunks == 0:
            status = "failed"
        elif indexed_chunks < total_chunks:
            status = "partial"
        else:
            status = "completed"
        
        return {
            "documentId": document_id,
            "totalChunks": total_chunks,
            "indexedChunks": indexed_chunks,
            "vectorIds": vector_ids,
            "status": status,
            "smartBucketStatus": {
                "isIndexed": True,  # Assume SmartBucket is indexed if chunks exist
                "chunkCount": total_chunks
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting vector status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get vector status: {str(e)}")


@router.get("/api/v1/documents/{document_id}/chunks")
async def get_document_chunks(
    document_id: str,
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Get all chunks for a document with their embedding status.
    """
    try:
        db = DatabaseService()

        chunks = await db.get_document_chunks(document_id)

        # Map PostgreSQL field names to expected API format
        formatted_chunks = []
        for chunk in chunks:
            # Handle created_at - it's a datetime object from psycopg2
            created_at = chunk.get("created_at")
            created_at_str = created_at.isoformat() if created_at and hasattr(created_at, 'isoformat') else str(created_at) if created_at else None

            formatted_chunks.append({
                "chunkId": chunk["id"],
                "chunkIndex": chunk["chunk_index"],
                "content": chunk["chunk_text"],  # Map chunk_text -> content
                "chunkSize": chunk["char_count"],  # Map char_count -> chunkSize
                "startChar": chunk["start_position"],  # Map start_position -> startChar
                "endChar": chunk["end_position"],  # Map end_position -> endChar
                "tokenCount": chunk["token_count"],
                "embeddingStatus": chunk["embedding_status"],
                "hasHeader": chunk.get("has_header", False),
                "sectionTitle": chunk.get("section_title"),
                "embeddingId": chunk.get("embedding_id"),
                "createdAt": created_at_str,
            })

        return {
            "documentId": document_id,
            "totalChunks": len(formatted_chunks),
            "chunks": formatted_chunks
        }

    except Exception as e:
        logger.error(f"Error getting document chunks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get document chunks: {str(e)}")


@router.get("/api/v1/documents/{document_id}/embedding-stats")
async def get_embedding_stats(
    document_id: str,
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Get embedding statistics for a document.
    
    Returns data compatible with the existing Cloudflare Worker API.
    """
    try:
        db = DatabaseService()
        
        # Get chunk statistics
        chunk_stats = await db.get_chunk_statistics(document_id)
        total = sum(chunk_stats.values())
        completed = chunk_stats.get("completed", 0)
        pending = chunk_stats.get("pending", 0)
        processing = chunk_stats.get("processing", 0)
        failed = chunk_stats.get("failed", 0)
        
        percentage = round((completed / total * 100)) if total > 0 else 0
        
        # Get detailed chunk info
        chunks = await db.get_document_chunks(document_id)
        
        # Format chunks for response
        chunk_details = []
        for chunk in chunks:
            chunk_details.append({
                "chunkId": chunk["id"],
                "chunkIndex": chunk["chunk_index"],
                "embeddingStatus": chunk["embedding_status"],
                "vectorId": chunk.get("embedding_id"),
                "hasEmbedding": chunk["embedding_status"] == "completed"
            })
        
        return {
            "documentId": document_id,
            "totalChunks": total,
            "completed": completed,
            "pending": pending,
            "failed": failed,
            "percentage": percentage,
            "chunks": chunk_details
        }
        
    except Exception as e:
        logger.error(f"Error getting embedding stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get embedding stats: {str(e)}")


@router.post("/api/v1/documents/{document_id}/search")
async def search_document(
    document_id: str,
    query: str,
    top_k: int = 10,
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Perform semantic search within a specific document using pgvector.
    """
    try:
        db = DatabaseService()
        
        # This will use the existing embedding service to generate query embedding
        # Then search using pgvector cosine similarity
        results = await db.search_document_embeddings(document_id, query, top_k)
        
        return {
            "documentId": document_id,
            "query": query,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        logger.error(f"Error searching document: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to search document: {str(e)}")


@router.delete("/api/v1/documents/{document_id}")
async def delete_document(
    document_id: str,
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Delete a document and all its associated data from PostgreSQL.

    This endpoint is called when a document is deleted from D1 to maintain
    database synchronization and prevent orphaned data.

    Deletes in order:
    1. Embeddings (foreign key to chunks)
    2. Chunks (foreign key to documents)
    3. Document record

    Returns:
        - documentId: The deleted document ID
        - deletedEmbeddings: Number of embeddings deleted
        - deletedChunks: Number of chunks deleted
        - deletedDocument: Boolean indicating if document was deleted
        - success: Boolean indicating overall success
    """
    try:
        db = DatabaseService()

        logger.info(f"Deleting document and all associated data: {document_id}")

        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Get counts before deletion for response
                cur.execute("SELECT COUNT(*) FROM embeddings WHERE document_id = %s", (document_id,))
                embedding_count = cur.fetchone()[0]

                cur.execute("SELECT COUNT(*) FROM chunks WHERE document_id = %s", (document_id,))
                chunk_count = cur.fetchone()[0]

                cur.execute("SELECT COUNT(*) FROM documents WHERE id = %s", (document_id,))
                document_exists = cur.fetchone()[0] > 0

                if not document_exists:
                    logger.warning(f"Document {document_id} not found in PostgreSQL")
                    return {
                        "documentId": document_id,
                        "deletedEmbeddings": 0,
                        "deletedChunks": 0,
                        "deletedDocument": False,
                        "success": True,
                        "message": "Document not found (may have been already deleted)"
                    }

                # Delete embeddings first (has foreign key to chunks)
                cur.execute("DELETE FROM embeddings WHERE document_id = %s", (document_id,))
                deleted_embeddings = cur.rowcount
                logger.info(f"Deleted {deleted_embeddings} embeddings for document {document_id}")

                # Delete chunks (has foreign key to documents)
                cur.execute("DELETE FROM chunks WHERE document_id = %s", (document_id,))
                deleted_chunks = cur.rowcount
                logger.info(f"Deleted {deleted_chunks} chunks for document {document_id}")

                # Delete document
                cur.execute("DELETE FROM documents WHERE id = %s", (document_id,))
                deleted_document = cur.rowcount > 0
                logger.info(f"Deleted document {document_id}")

                # Commit the transaction
                conn.commit()

                logger.info(f"Successfully deleted document {document_id} with {deleted_chunks} chunks and {deleted_embeddings} embeddings")

                return {
                    "documentId": document_id,
                    "deletedEmbeddings": deleted_embeddings,
                    "deletedChunks": deleted_chunks,
                    "deletedDocument": deleted_document,
                    "success": True,
                    "message": f"Successfully deleted document with {deleted_chunks} chunks and {deleted_embeddings} embeddings"
                }

    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")
