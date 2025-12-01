-- Migration: Add document correction fields
-- Date: 2025-12-01
-- Description: Adds fields for storing AI-generated document corrections
-- Note: extracted_text and character_count already exist, so we only add correction fields

-- Add corrected document fields
ALTER TABLE documents ADD COLUMN corrected_text TEXT;
ALTER TABLE documents ADD COLUMN corrected_at INTEGER;
ALTER TABLE documents ADD COLUMN corrected_by TEXT;
ALTER TABLE documents ADD COLUMN corrections_count INTEGER DEFAULT 0;

-- Create index for querying corrected documents
CREATE INDEX IF NOT EXISTS idx_documents_corrected_at ON documents(corrected_at) WHERE corrected_at IS NOT NULL;

-- Create index for correction stats
CREATE INDEX IF NOT EXISTS idx_documents_corrections_count ON documents(corrections_count) WHERE corrections_count > 0;
