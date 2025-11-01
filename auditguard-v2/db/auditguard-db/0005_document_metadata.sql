-- Add title and description fields to documents table for AI-extracted metadata
ALTER TABLE documents ADD COLUMN title TEXT;
ALTER TABLE documents ADD COLUMN description TEXT;

-- Add document processing tracking fields
ALTER TABLE documents ADD COLUMN processing_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN text_extracted INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN chunk_count INTEGER DEFAULT 0;
