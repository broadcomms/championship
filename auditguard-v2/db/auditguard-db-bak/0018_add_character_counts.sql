-- Migration: 0018_add_character_counts.sql
-- Description: Add character count tracking to documents and document_chunks tables
--
-- Rationale:
-- - Users need to see both word counts AND character counts for debugging
-- - Character count helps verify extraction quality
-- - Provides better metadata visibility
--
-- Context:
-- - Word count alone is insufficient (users confused by "chars" mislabeling)
-- - Character count was calculated but never stored
-- - This migration adds proper tracking

-- Add character_count column to documents table
ALTER TABLE documents ADD COLUMN character_count INTEGER;

-- Add character_count column to document_chunks table
ALTER TABLE document_chunks ADD COLUMN character_count INTEGER;

-- Backfill existing documents with character count from extracted_text
UPDATE documents
SET character_count = length(extracted_text)
WHERE extracted_text IS NOT NULL;

-- Backfill existing chunks with character count from chunk_text
UPDATE document_chunks
SET character_count = length(chunk_text)
WHERE chunk_text IS NOT NULL;
