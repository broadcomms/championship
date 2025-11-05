"""
Vector Service for PostgreSQL + pgvector
Handles all database operations for documents, chunks, and embeddings
"""
import time
import logging
from typing import List, Dict, Optional
from pgvector.asyncpg import register_vector

logger = logging.getLogger(__name__)


class VectorService:
    def __init__(self, db_pool):
        self.db_pool = db_pool
        
    async def store_document(self, document_id: str, workspace_id: str, raw_text: str,
                            filename: str, content_type: str, file_size: int,
                            vultr_s3_key: str, smartbucket_key: Optional[str],
                            uploaded_by: str) -> None:
        """Store document in PostgreSQL"""
        now = int(time.time() * 1000)
        
        query = """
            INSERT INTO documents (
                id, workspace_id, raw_text, filename, content_type, file_size,
                vultr_s3_key, smartbucket_key, uploaded_by, created_at, updated_at,
                processing_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                raw_text = EXCLUDED.raw_text,
                updated_at = EXCLUDED.updated_at,
                processing_status = EXCLUDED.processing_status
        """
        
        async with self.db_pool.pool.acquire() as conn:
            await conn.execute(
                query, document_id, workspace_id, raw_text, filename, content_type,
                file_size, vultr_s3_key, smartbucket_key, uploaded_by, now, now, 'processing'
            )
            
        logger.info(f"Stored document {document_id}")
        
    async def store_chunks(self, document_id: str, workspace_id: str, chunks: List[Dict]) -> List[int]:
        """Store chunks in PostgreSQL and return chunk IDs"""
        now = int(time.time() * 1000)
        chunk_ids = []
        
        query = """
            INSERT INTO chunks (
                document_id, workspace_id, chunk_text, chunk_index, token_count,
                char_count, start_position, end_position, has_header, section_title,
                created_at, embedding_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
        """
        
        async with self.db_pool.pool.acquire() as conn:
            for chunk in chunks:
                row = await conn.fetchrow(
                    query,
                    document_id, workspace_id, chunk['chunk_text'], chunk['chunk_index'],
                    chunk['token_count'], chunk['char_count'], chunk['start_position'],
                    chunk['end_position'], chunk.get('has_header', False),
                    chunk.get('section_title'), now, 'pending'
                )
                chunk_ids.append(row['id'])
                
        logger.info(f"Stored {len(chunk_ids)} chunks for document {document_id}")
        return chunk_ids
        
    async def store_embeddings(self, document_id: str, workspace_id: str,
                              chunk_ids: List[int], embeddings: List[List[float]],
                              tags_list: List[Dict]) -> int:
        """Store embeddings in PostgreSQL with pgvector"""
        now = int(time.time() * 1000)
        stored_count = 0
        
        query = """
            INSERT INTO embeddings (
                id, chunk_id, document_id, workspace_id, embedding,
                compliance_framework_id, compliance_tags, keywords,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (chunk_id) DO UPDATE SET
                embedding = EXCLUDED.embedding,
                compliance_framework_id = EXCLUDED.compliance_framework_id,
                compliance_tags = EXCLUDED.compliance_tags,
                keywords = EXCLUDED.keywords,
                updated_at = EXCLUDED.updated_at
        """
        
        async with self.db_pool.pool.acquire() as conn:
            # Register vector type
            await register_vector(conn)
            
            for i, (chunk_id, embedding, tags) in enumerate(zip(chunk_ids, embeddings, tags_list)):
                embedding_id = f"{document_id}_emb_{i}"
                
                await conn.execute(
                    query,
                    embedding_id, chunk_id, document_id, workspace_id, embedding,
                    tags.get('compliance_framework_id'), tags.get('compliance_tags'),
                    tags.get('keywords'), now, now
                )
                stored_count += 1
                
            # Update chunk status
            await conn.execute(
                "UPDATE chunks SET embedding_status = 'completed', updated_at = $1 WHERE document_id = $2",
                now, document_id
            )
            
            # Update document status
            await conn.execute(
                """UPDATE documents SET 
                    processing_status = 'completed',
                    chunk_count = $1,
                    embedding_count = $2,
                    processed_at = $3,
                    updated_at = $3
                   WHERE id = $4""",
                len(chunk_ids), stored_count, now, document_id
            )
            
        logger.info(f"Stored {stored_count} embeddings for document {document_id}")
        return stored_count
        
    async def search_similar(self, query_embedding: List[float], workspace_id: str,
                           limit: int = 10, compliance_framework_id: Optional[int] = None) -> List[Dict]:
        """Search for similar chunks using cosine similarity"""
        query = """
            SELECT 
                e.id,
                e.chunk_id,
                e.document_id,
                c.chunk_text,
                d.filename,
                e.compliance_framework_id,
                e.compliance_tags,
                e.keywords,
                e.embedding <=> $1::vector AS distance
            FROM embeddings e
            JOIN chunks c ON e.chunk_id = c.id
            JOIN documents d ON e.document_id = d.id
            WHERE e.workspace_id = $2
        """
        
        params = [query_embedding, workspace_id]
        
        if compliance_framework_id:
            query += " AND e.compliance_framework_id = $3"
            params.append(compliance_framework_id)
            query += f" ORDER BY distance LIMIT ${len(params) + 1}"
            params.append(limit)
        else:
            query += f" ORDER BY distance LIMIT $3"
            params.append(limit)
            
        async with self.db_pool.pool.acquire() as conn:
            await register_vector(conn)
            rows = await conn.fetch(query, *params)
            
        results = []
        for row in rows:
            results.append({
                'id': row['id'],
                'chunk_id': row['chunk_id'],
                'document_id': row['document_id'],
                'chunk_text': row['chunk_text'],
                'filename': row['filename'],
                'compliance_framework_id': row['compliance_framework_id'],
                'compliance_tags': row['compliance_tags'],
                'keywords': row['keywords'],
                'distance': float(row['distance']),
                'similarity': 1 - float(row['distance'])
            })
            
        return results
