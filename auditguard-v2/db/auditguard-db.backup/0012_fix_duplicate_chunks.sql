-- Fix Duplicate Chunks Migration
-- Removes duplicate chunks and adds unique constraint
-- Session: 01k95cfszf8ctva4ekqx1g0mgt

-- Step 1: Delete duplicate chunks, keeping only the oldest (lowest ID) for each (document_id, chunk_index)
DELETE FROM document_chunks
WHERE id NOT IN (
  SELECT MIN(id)
  FROM document_chunks
  GROUP BY document_id, chunk_index
);

-- Step 2: Update document chunk counts to reflect actual chunks after cleanup
UPDATE documents
SET chunk_count = (
  SELECT COUNT(*)
  FROM document_chunks dc
  WHERE dc.document_id = documents.id
);

-- Step 3: Add unique constraint to prevent future duplicates
-- Note: SQLite doesn't support ADD CONSTRAINT, so we create the constraint implicitly
-- by creating a unique index
DROP INDEX IF EXISTS idx_unique_document_chunk;
CREATE UNIQUE INDEX idx_unique_document_chunk ON document_chunks(document_id, chunk_index);
