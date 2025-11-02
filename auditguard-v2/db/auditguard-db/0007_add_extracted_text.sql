-- Add extracted_text column to store cleaned text directly in database
-- This allows immediate access to document content while SmartBucket indexes
-- and helps verify text extraction quality

ALTER TABLE documents ADD COLUMN extracted_text TEXT;
