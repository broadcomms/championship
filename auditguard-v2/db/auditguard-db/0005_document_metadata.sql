-- Add title and description fields to documents table for AI-extracted metadata
ALTER TABLE documents ADD COLUMN title TEXT;
ALTER TABLE documents ADD COLUMN description TEXT;

-- Note: processing_status, text_extracted, and chunk_count are already added in 0001_compliance.sql
