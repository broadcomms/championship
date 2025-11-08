-- Migration: Add fully_completed flag to documents table
-- Purpose: Track when ALL processing (including AI enrichment) is complete
-- This fixes the bug where polling stops before enrichment data is available

-- Add fully_completed column (0 = false, 1 = true)
ALTER TABLE documents ADD COLUMN fully_completed INTEGER DEFAULT 0;

-- Create index for faster queries on fully_completed status
CREATE INDEX IF NOT EXISTS idx_documents_fully_completed ON documents(fully_completed);

-- Backfill existing completed documents
-- Mark documents as fully_completed if they have:
-- 1. processing_status = 'completed'
-- 2. text_extracted = 1 (true)
-- 3. chunk_count > 0
-- 4. vector_indexing_status = 'completed'
UPDATE documents
SET fully_completed = 1
WHERE processing_status = 'completed'
  AND text_extracted = 1
  AND chunk_count > 0
  AND vector_indexing_status = 'completed';
