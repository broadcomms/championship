-- Migration: 0014_drop_document_chunks.sql
-- Description: Remove unused document_chunks and related tables

-- ============================================================================
-- DROP DOCUMENT CHUNK FRAMEWORKS TABLE
-- ============================================================================
-- Drop the document_chunk_frameworks table first (has foreign key to document_chunks)
DROP TABLE IF EXISTS document_chunk_frameworks;

-- ============================================================================
-- DROP DOCUMENT CHUNKS TABLE
-- ============================================================================
-- Drop the document_chunks table and all associated indexes
DROP INDEX IF EXISTS idx_document_chunks_vector_id;
DROP INDEX IF EXISTS idx_document_chunks_status;
DROP INDEX IF EXISTS idx_document_chunks_document_id;
DROP INDEX IF EXISTS idx_document_chunks_workspace_id;
DROP TABLE IF EXISTS document_chunks;
