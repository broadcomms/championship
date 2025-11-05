"""
Admin API Routes for PostgreSQL Database

Provides admin-only endpoints for monitoring and managing
the PostgreSQL database, embeddings, and vector operations.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from pydantic import BaseModel
import logging

from app.services.database import DatabaseService
from app.services.embedding_service import EmbeddingService
from app.routes.documents import verify_api_key
from pgvector.asyncpg import register_vector
import asyncpg

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize embedding service
embedding_service = EmbeddingService()


class AdminSearchRequest(BaseModel):
    query: str
    limit: int = 10


class CleanupRequest(BaseModel):
    validDocumentIds: List[str] = []


@router.get("/api/v1/admin/vector-stats")
async def get_vector_stats(
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Get comprehensive vector index statistics.

    Returns:
        - totalChunks: Total number of chunks in database
        - chunksCompleted: Chunks with completed embeddings
        - chunksPending: Chunks waiting for embeddings
        - chunksProcessing: Chunks currently being processed
        - chunksFailed: Chunks that failed embedding generation
        - completionPercentage: Overall completion rate
        - recentDocuments: Last 20 documents with their status
    """
    try:
        db = DatabaseService()

        # Get chunk statistics by status
        chunk_stats = await db.get_chunk_statistics(None)  # None = all documents
        total = sum(chunk_stats.values())
        completed = chunk_stats.get("completed", 0)
        pending = chunk_stats.get("pending", 0)
        processing = chunk_stats.get("processing", 0)
        failed = chunk_stats.get("failed", 0)

        percentage = round((completed / total * 100)) if total > 0 else 0

        # Get recent documents with their embedding status
        recent_docs = await db.get_recent_documents_with_stats(limit=20)

        return {
            "totalChunks": total,
            "chunksCompleted": completed,
            "chunksPending": pending,
            "chunksProcessing": processing,
            "chunksFailed": failed,
            "completionPercentage": percentage,
            "recentDocuments": recent_docs,
            "indexName": "pgvector",
            "dimensions": 384,
            "metric": "cosine",
        }

    except Exception as e:
        logger.error(f"Error getting vector stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get vector stats: {str(e)}")


@router.get("/api/v1/admin/embedding-summary")
async def get_embedding_summary(
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Get detailed embedding generation summary.

    Returns document-level and chunk-level statistics for admin dashboard.
    """
    try:
        db = DatabaseService()

        # Document-level stats
        doc_stats = await db.get_document_summary_stats()

        # Chunk-level stats
        chunk_stats = await db.get_chunk_statistics(None)
        total_chunks = sum(chunk_stats.values())
        completed_chunks = chunk_stats.get("completed", 0)

        # Recent documents
        recent_docs = await db.get_recent_documents_with_stats(limit=20)

        return {
            "summary": {
                "totalDocuments": doc_stats.get("total_documents", 0),
                "documentsWithEmbeddings": doc_stats.get("documents_with_embeddings", 0),
                "totalChunks": total_chunks,
                "chunksCompleted": completed_chunks,
                "chunksPending": chunk_stats.get("pending", 0),
                "chunksProcessing": chunk_stats.get("processing", 0),
                "chunksFailed": chunk_stats.get("failed", 0),
                "completionPercentage": round((completed_chunks / total_chunks * 100)) if total_chunks > 0 else 0,
            },
            "recentDocuments": recent_docs,
        }

    except Exception as e:
        logger.error(f"Error getting embedding summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get embedding summary: {str(e)}")


@router.get("/api/v1/admin/failed-chunks")
async def get_failed_chunks(
    api_key: str = Depends(verify_api_key),
    limit: int = 50
) -> Dict[str, Any]:
    """
    Get list of chunks that failed embedding generation.

    Returns detailed information about failed chunks for debugging.
    """
    try:
        db = DatabaseService()

        failed_chunks = await db.get_failed_chunks(limit=limit)

        return {
            "failedChunks": failed_chunks,
            "totalFailed": len(failed_chunks),
        }

    except Exception as e:
        logger.error(f"Error getting failed chunks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get failed chunks: {str(e)}")


@router.get("/api/v1/admin/database-stats")
async def get_database_stats(
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Get PostgreSQL database statistics.

    Returns table sizes, row counts, and database health metrics.
    """
    try:
        db = DatabaseService()

        stats = await db.get_database_stats()

        return stats

    except Exception as e:
        logger.error(f"Error getting database stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get database stats: {str(e)}")


@router.post("/api/v1/admin/test-search")
async def test_vector_search(
    request: AdminSearchRequest,
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Test vector search across all documents (admin-only).

    This endpoint searches across all workspaces without filtering,
    useful for testing and debugging the vector search functionality.

    Args:
        query: The search query text
        limit: Maximum number of results to return (default: 10)

    Returns:
        - query: The original query text
        - results: List of matching chunks with similarity scores
        - count: Number of results returned
        - searchTimeMs: Time taken for the search in milliseconds
    """
    try:
        import time
        start_time = time.time()

        # Generate embedding for query
        logger.info(f"Generating embedding for query: {request.query[:100]}")
        query_embeddings = await embedding_service.generate_embeddings_async([request.query])
        query_embedding = query_embeddings[0]

        # Search using pgvector (across all workspaces)
        db = DatabaseService()

        # Get database connection
        with db.get_connection() as conn:
            # Use psycopg2 cursor (sync, not async)
            with conn.cursor() as cur:
                # Search across all workspaces
                search_query = """
                    SELECT
                        e.id,
                        e.chunk_id,
                        e.document_id,
                        c.chunk_text,
                        c.chunk_index,
                        d.filename,
                        d.workspace_id,
                        e.compliance_framework_id,
                        e.compliance_tags,
                        e.keywords,
                        e.embedding <=> %s::vector AS distance
                    FROM embeddings e
                    JOIN chunks c ON e.chunk_id = c.id
                    JOIN documents d ON e.document_id = d.id
                    ORDER BY distance
                    LIMIT %s
                """

                # Convert embedding to string format for pgvector
                embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'

                cur.execute(search_query, (embedding_str, request.limit))
                rows = cur.fetchall()

                # Get column names
                columns = [desc[0] for desc in cur.description]

                # Convert rows to dicts
                results = []
                for row in rows:
                    row_dict = dict(zip(columns, row))
                    results.append({
                        'vectorId': row_dict['id'],
                        'chunkId': row_dict['chunk_id'],
                        'documentId': row_dict['document_id'],
                        'chunkIndex': row_dict['chunk_index'],
                        'text': row_dict['chunk_text'],
                        'filename': row_dict['filename'],
                        'workspaceId': row_dict['workspace_id'],
                        'complianceFrameworkId': row_dict['compliance_framework_id'],
                        'complianceTags': row_dict['compliance_tags'],
                        'keywords': row_dict['keywords'],
                        'distance': float(row_dict['distance']),
                        'similarity': round(1 - float(row_dict['distance']), 4),
                        'score': round((1 - float(row_dict['distance'])) * 100, 2)
                    })

        search_time = round((time.time() - start_time) * 1000, 2)

        logger.info(f"Search completed: {len(results)} results in {search_time}ms")

        return {
            "query": request.query,
            "results": results,
            "count": len(results),
            "searchTimeMs": search_time
        }

    except Exception as e:
        logger.error(f"Error in test vector search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/api/v1/admin/cleanup/orphaned-embeddings")
async def cleanup_orphaned_embeddings(
    request: CleanupRequest,
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Clean up orphaned embeddings in PostgreSQL using D1 as source of truth.

    Accepts a list of valid document IDs from D1 and deletes all documents,
    chunks, and embeddings in PostgreSQL that don't exist in D1.

    Args:
        request: Contains validDocumentIds from D1 (source of truth)

    Returns:
        - totalEmbeddings: Total embeddings before cleanup
        - validDocuments: Number of valid documents in D1
        - orphanedDocuments: Number of orphaned documents in PostgreSQL
        - orphanedEmbeddings: Number of orphaned embeddings found
        - deletedDocuments: Number of documents deleted from PostgreSQL
        - deletedChunks: Number of orphaned chunks deleted
        - deletedEmbeddings: Number of embeddings successfully deleted
        - errors: Number of errors encountered
    """
    try:
        db = DatabaseService()

        valid_document_ids = set(request.validDocumentIds)
        logger.info(f"Starting orphaned embeddings cleanup with {len(valid_document_ids)} valid D1 document IDs")

        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Get total embeddings count before cleanup
                cur.execute("SELECT COUNT(*) FROM embeddings")
                total_embeddings = cur.fetchone()[0]

                # Get all document IDs currently in PostgreSQL
                cur.execute("SELECT id FROM documents")
                postgres_doc_ids = set(row[0] for row in cur.fetchall())
                postgres_doc_count = len(postgres_doc_ids)

                # Find orphaned documents (in PostgreSQL but not in D1)
                orphaned_document_ids = postgres_doc_ids - valid_document_ids
                orphaned_doc_count = len(orphaned_document_ids)

                logger.info(f"PostgreSQL state: {total_embeddings} embeddings, {postgres_doc_count} documents")
                logger.info(f"D1 state: {len(valid_document_ids)} valid documents")
                logger.info(f"Found {orphaned_doc_count} orphaned documents in PostgreSQL")

                deleted_documents = 0
                deleted_chunks = 0
                deleted_embeddings = 0
                errors = 0

                if orphaned_doc_count > 0:
                    try:
                        # Log sample of orphaned documents
                        sample_orphaned = list(orphaned_document_ids)[:5]
                        logger.info(f"Sample orphaned document IDs: {sample_orphaned}")

                        # Convert set to list for SQL query
                        orphaned_ids_list = list(orphaned_document_ids)

                        # Delete orphaned embeddings first (foreign key constraint)
                        cur.execute("""
                            DELETE FROM embeddings
                            WHERE document_id = ANY(%s::text[])
                        """, (orphaned_ids_list,))
                        deleted_embeddings = cur.rowcount
                        logger.info(f"Deleted {deleted_embeddings} orphaned embeddings")

                        # Delete orphaned chunks
                        cur.execute("""
                            DELETE FROM chunks
                            WHERE document_id = ANY(%s::text[])
                        """, (orphaned_ids_list,))
                        deleted_chunks = cur.rowcount
                        logger.info(f"Deleted {deleted_chunks} orphaned chunks")

                        # Delete orphaned documents
                        cur.execute("""
                            DELETE FROM documents
                            WHERE id = ANY(%s::text[])
                        """, (orphaned_ids_list,))
                        deleted_documents = cur.rowcount
                        logger.info(f"Deleted {deleted_documents} orphaned documents")

                        conn.commit()

                        logger.info(f"Cleanup complete: deleted {deleted_documents} documents, {deleted_chunks} chunks, {deleted_embeddings} embeddings")

                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error during cleanup: {e}", exc_info=True)
                        errors = 1
                        raise
                else:
                    logger.info("No orphaned documents found - PostgreSQL is in sync with D1")

                return {
                    "totalEmbeddings": total_embeddings,
                    "validDocuments": len(valid_document_ids),
                    "orphanedDocuments": orphaned_doc_count,
                    "orphanedEmbeddings": deleted_embeddings,  # Same as deleted since we delete by document
                    "deletedDocuments": deleted_documents,
                    "deletedChunks": deleted_chunks,
                    "deletedEmbeddings": deleted_embeddings,
                    "errors": errors,
                    "success": errors == 0
                }

    except Exception as e:
        logger.error(f"Error cleaning up orphaned embeddings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")
