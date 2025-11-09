-- Add columns for Vultr S3 dual-storage architecture
-- Phase 1 of VULTR_STORAGE_ARCHITECTURE_PLAN.md

-- Vultr S3 key for original file (NEW ARCHITECTURE)
ALTER TABLE documents ADD COLUMN vultr_key TEXT;

-- SmartBucket key for extracted clean text (not the original file)
ALTER TABLE documents ADD COLUMN extracted_text_key TEXT;

-- Pre-signed Vultr S3 download URL (refreshed on request)
ALTER TABLE documents ADD COLUMN original_file_url TEXT;

-- Text extraction status: pending, extracting, completed, failed
ALTER TABLE documents ADD COLUMN extraction_status TEXT DEFAULT 'pending';

-- Metadata from text extraction
ALTER TABLE documents ADD COLUMN page_count INTEGER;
ALTER TABLE documents ADD COLUMN word_count INTEGER;

-- Index for faster lookups by extraction status
CREATE INDEX idx_documents_extraction_status ON documents(extraction_status);
