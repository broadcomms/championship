-- Add vultr_key column for Vultr S3 original file storage
-- This was missing from 0006_vultr_storage.sql

ALTER TABLE documents ADD COLUMN vultr_key TEXT;
