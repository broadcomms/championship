-- Migration: Add Vultr Storage Support
-- Date: 2025-01-29
-- Description: Add columns to support dual-storage architecture (Vultr S3 for originals + SmartBucket for clean text)

-- Add new columns for Vultr storage and text extraction metadata
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS extracted_text_key TEXT,
  ADD COLUMN IF NOT EXISTS original_file_url TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS word_count INTEGER;

-- Create index for efficient filtering by extraction status
CREATE INDEX IF NOT EXISTS idx_documents_extraction_status 
  ON documents(extraction_status);

-- Update existing documents to have 'completed' extraction_status
-- (backward compatibility - old documents don't need re-extraction)
UPDATE documents 
  SET extraction_status = 'completed'
  WHERE extraction_status IS NULL OR extraction_status = 'pending';

-- Add comments to document the new columns
COMMENT ON COLUMN documents.extracted_text_key IS 'SmartBucket key for extracted clean text (used for AI indexing)';
COMMENT ON COLUMN documents.original_file_url IS 'Vultr S3 pre-signed URL for downloading original file';
COMMENT ON COLUMN documents.extraction_status IS 'Status of text extraction: pending, processing, completed, failed';
COMMENT ON COLUMN documents.page_count IS 'Number of pages in document (for PDFs)';
COMMENT ON COLUMN documents.word_count IS 'Number of words in extracted text';
