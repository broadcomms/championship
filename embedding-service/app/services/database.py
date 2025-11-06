"""
PostgreSQL Database Service

Handles all database operations for document processing,
chunk management, and vector embeddings.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional, List, Dict, Any
import logging
from contextlib import contextmanager

from app.config import get_settings

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for PostgreSQL database operations"""
    
    def __init__(self):
        self.settings = get_settings()
        self.connection_params = {
            'host': self.settings.db_host,
            'port': self.settings.db_port,
            'database': self.settings.db_name,
            'user': self.settings.db_user,
            'password': self.settings.db_password,
        }
    
    @contextmanager
    def get_connection(self):
        """Get a database connection with automatic cleanup"""
        conn = None
        try:
            conn = psycopg2.connect(**self.connection_params)
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}", exc_info=True)
            raise
        finally:
            if conn:
                conn.close()
    
    async def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get document by ID"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, workspace_id, filename, content_type, file_size,
                           vultr_s3_key, smartbucket_key, processing_status,
                           chunk_count, embedding_count, word_count, page_count,
                           uploaded_by, created_at, updated_at, processed_at
                    FROM documents
                    WHERE id = %s
                """, (document_id,))
                
                result = cur.fetchone()
                return dict(result) if result else None
    
    async def get_chunk_statistics(self, document_id: Optional[str] = None) -> Dict[str, int]:
        """
        Get chunk statistics by embedding status.

        If document_id is None, returns statistics for all documents.
        Otherwise, returns statistics for the specific document.

        Note: Most chunks don't have embedding_status tracked individually.
        We aggregate from the documents table instead.
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if document_id:
                    # Get stats for specific document from documents table
                    cur.execute("""
                        SELECT
                            chunk_count as total,
                            embedding_count as completed
                        FROM documents
                        WHERE id = %s
                    """, (document_id,))

                    result = cur.fetchone()
                    if result:
                        total = result['total'] or 0
                        completed = result['completed'] or 0
                        return {
                            'completed': completed,
                            'pending': total - completed,
                            'processing': 0,
                            'failed': 0
                        }
                else:
                    # Get aggregate stats from documents table
                    cur.execute("""
                        SELECT
                            COALESCE(SUM(chunk_count), 0) as total,
                            COALESCE(SUM(embedding_count), 0) as completed
                        FROM documents
                    """)

                    result = cur.fetchone()
                    if result:
                        total = result['total'] or 0
                        completed = result['completed'] or 0
                        return {
                            'completed': completed,
                            'pending': total - completed,
                            'processing': 0,
                            'failed': 0
                        }

                return {
                    'completed': 0,
                    'pending': 0,
                    'processing': 0,
                    'failed': 0
                }
    
    async def get_vector_ids(self, document_id: str) -> List[str]:
        """Get all vector IDs for completed embeddings"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT e.id
                    FROM embeddings e
                    JOIN chunks c ON e.chunk_id = c.id
                    WHERE c.document_id = %s
                    AND c.embedding_status = 'completed'
                    ORDER BY c.chunk_index
                """, (document_id,))
                
                results = cur.fetchall()
                return [row[0] for row in results]
    
    async def get_document_chunks(self, document_id: str) -> List[Dict[str, Any]]:
        """Get all chunks for a document with embedding info"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT 
                        c.id,
                        c.document_id,
                        c.chunk_index,
                        c.chunk_text,
                        c.token_count,
                        c.char_count,
                        c.start_position,
                        c.end_position,
                        c.has_header,
                        c.section_title,
                        c.embedding_status,
                        e.id as embedding_id,
                        c.created_at,
                        c.updated_at
                    FROM chunks c
                    LEFT JOIN embeddings e ON c.id = e.chunk_id
                    WHERE c.document_id = %s
                    ORDER BY c.chunk_index
                """, (document_id,))
                
                results = cur.fetchall()
                return [dict(row) for row in results]
    
    async def search_document_embeddings(
        self, 
        document_id: str, 
        query: str, 
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search using pgvector.
        
        This requires the query to be embedded first using the embedding service,
        then we search using cosine similarity in PostgreSQL.
        """
        # TODO: Integrate with embedding service to generate query embedding
        # For now, return empty results
        logger.warning(f"Semantic search not yet implemented for document {document_id}")
        return []
    
    async def update_document_status(
        self,
        document_id: str,
        status: str,
        chunk_count: Optional[int] = None,
        embedding_count: Optional[int] = None
    ) -> None:
        """Update document processing status"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                if chunk_count is not None and embedding_count is not None:
                    cur.execute("""
                        UPDATE documents
                        SET processing_status = %s,
                            chunk_count = %s,
                            embedding_count = %s,
                            updated_at = EXTRACT(EPOCH FROM NOW())::bigint * 1000
                        WHERE id = %s
                    """, (status, chunk_count, embedding_count, document_id))
                else:
                    cur.execute("""
                        UPDATE documents
                        SET processing_status = %s,
                            updated_at = EXTRACT(EPOCH FROM NOW())::bigint * 1000
                        WHERE id = %s
                    """, (status, document_id))

    async def get_recent_documents_with_stats(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent documents with their embedding statistics"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT
                        d.id as document_id,
                        d.filename,
                        d.created_at as uploaded_at,
                        d.chunk_count,
                        d.embedding_count as embeddings_generated,
                        d.processing_status as status
                    FROM documents d
                    ORDER BY d.created_at DESC
                    LIMIT %s
                """, (limit,))

                results = cur.fetchall()
                return [dict(row) for row in results]

    async def get_document_summary_stats(self) -> Dict[str, int]:
        """Get summary statistics for all documents"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT
                        COUNT(*) as total_documents,
                        COUNT(*) FILTER (WHERE embedding_count > 0) as documents_with_embeddings
                    FROM documents
                """)

                result = cur.fetchone()
                return dict(result) if result else {
                    'total_documents': 0,
                    'documents_with_embeddings': 0
                }

    async def get_failed_chunks(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get chunks that failed embedding generation"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT
                        c.id as chunk_id,
                        c.document_id,
                        c.chunk_index,
                        c.chunk_text,
                        c.embedding_status,
                        c.updated_at
                    FROM chunks c
                    WHERE c.embedding_status = 'failed'
                    ORDER BY c.updated_at DESC
                    LIMIT %s
                """, (limit,))

                results = cur.fetchall()
                return [dict(row) for row in results]

    async def get_database_stats(self) -> Dict[str, Any]:
        """Get PostgreSQL database statistics"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get table sizes and row counts
                cur.execute("""
                    SELECT
                        schemaname,
                        tablename,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
                        n_live_tup as row_count
                    FROM pg_stat_user_tables
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                """)

                tables = cur.fetchall()

                # Get database size
                cur.execute("""
                    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
                """)

                db_size = cur.fetchone()

                return {
                    "database_size": db_size['db_size'] if db_size else "Unknown",
                    "tables": [dict(row) for row in tables],
                }

    async def get_pending_chunks(self, workspace_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get chunks with embedding_status = 'pending' for processing.

        Args:
            workspace_id: Optional workspace filter
            limit: Maximum number of chunks to return

        Returns:
            List of pending chunks with document info
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if workspace_id:
                    cur.execute("""
                        SELECT
                            c.id,
                            c.document_id,
                            c.chunk_index,
                            c.chunk_text,
                            c.token_count,
                            c.char_count,
                            c.start_position,
                            c.end_position,
                            c.has_header,
                            c.section_title,
                            c.embedding_status,
                            c.created_at,
                            d.workspace_id,
                            d.filename
                        FROM chunks c
                        JOIN documents d ON c.document_id = d.id
                        WHERE c.embedding_status = 'pending'
                        AND d.workspace_id = %s
                        ORDER BY c.created_at ASC
                        LIMIT %s
                    """, (workspace_id, limit))
                else:
                    cur.execute("""
                        SELECT
                            c.id,
                            c.document_id,
                            c.chunk_index,
                            c.chunk_text,
                            c.token_count,
                            c.char_count,
                            c.start_position,
                            c.end_position,
                            c.has_header,
                            c.section_title,
                            c.embedding_status,
                            c.created_at,
                            d.workspace_id,
                            d.filename
                        FROM chunks c
                        JOIN documents d ON c.document_id = d.id
                        WHERE c.embedding_status = 'pending'
                        ORDER BY c.created_at ASC
                        LIMIT %s
                    """, (limit,))

                results = cur.fetchall()
                return [dict(row) for row in results]

    async def get_chunk_by_id(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a single chunk by ID with embedding info.

        Args:
            chunk_id: The chunk ID

        Returns:
            Chunk data or None if not found
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT
                        c.id,
                        c.document_id,
                        c.chunk_index,
                        c.chunk_text,
                        c.token_count,
                        c.char_count,
                        c.start_position,
                        c.end_position,
                        c.has_header,
                        c.section_title,
                        c.embedding_status,
                        e.id as embedding_id,
                        c.created_at,
                        c.updated_at,
                        d.workspace_id,
                        d.filename
                    FROM chunks c
                    LEFT JOIN embeddings e ON c.id = e.chunk_id
                    JOIN documents d ON c.document_id = d.id
                    WHERE c.id = %s
                """, (chunk_id,))

                result = cur.fetchone()
                return dict(result) if result else None

    async def update_chunk_status(self, chunk_id: str, status: str) -> bool:
        """
        Update the embedding_status of a chunk.

        Args:
            chunk_id: The chunk ID
            status: New status (pending, processing, completed, failed)

        Returns:
            True if updated, False if chunk not found
        """
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE chunks
                    SET embedding_status = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (status, chunk_id))

                return cur.rowcount > 0

    async def get_workspace_chunk_stats(self, workspace_id: str) -> Dict[str, Any]:
        """
        Get chunk statistics for a specific workspace.

        Args:
            workspace_id: The workspace ID

        Returns:
            Dictionary with chunk counts by status
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get aggregate stats from documents table
                cur.execute("""
                    SELECT
                        COUNT(*) as document_count,
                        COALESCE(SUM(chunk_count), 0) as total_chunks,
                        COALESCE(SUM(embedding_count), 0) as completed_chunks
                    FROM documents
                    WHERE workspace_id = %s
                """, (workspace_id,))

                result = cur.fetchone()

                if result:
                    total = result['total_chunks'] or 0
                    completed = result['completed_chunks'] or 0
                    pending = total - completed

                    return {
                        'workspace_id': workspace_id,
                        'document_count': result['document_count'] or 0,
                        'total_chunks': total,
                        'completed': completed,
                        'pending': pending,
                        'processing': 0,
                        'failed': 0,
                        'completion_percentage': round((completed / total * 100)) if total > 0 else 0
                    }

                return {
                    'workspace_id': workspace_id,
                    'document_count': 0,
                    'total_chunks': 0,
                    'completed': 0,
                    'pending': 0,
                    'processing': 0,
                    'failed': 0,
                    'completion_percentage': 0
                }
