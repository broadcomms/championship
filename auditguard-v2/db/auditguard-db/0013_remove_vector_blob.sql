-- Migration: 0013_remove_vector_blob.sql
-- Description: Remove wasteful vector_embedding BLOB column from document_chunks
-- This saves significant storage as embeddings are stored in PostgreSQL pgvector

-- Remove the BLOB column that stores vector embeddings
-- We keep vector_id to reference the embedding in PostgreSQL
ALTER TABLE document_chunks DROP COLUMN vector_embedding;

-- Note: This migration removes redundant data
-- Embeddings are now stored exclusively in PostgreSQL (embedding-service)
-- D1 document_chunks keeps only metadata and references
