-- Migration: Add issue fingerprinting and deduplication support
-- Date: 2025-01-19
-- Purpose: Enable smart issue deduplication across multiple compliance checks

-- Add fingerprinting columns to compliance_issues table
ALTER TABLE compliance_issues ADD COLUMN issue_fingerprint TEXT;
ALTER TABLE compliance_issues ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE compliance_issues ADD COLUMN superseded_by TEXT;
ALTER TABLE compliance_issues ADD COLUMN first_detected_check_id TEXT;
ALTER TABLE compliance_issues ADD COLUMN last_confirmed_check_id TEXT;

-- Create index for fingerprint-based lookups
CREATE INDEX IF NOT EXISTS idx_compliance_issues_fingerprint 
ON compliance_issues(document_id, framework, issue_fingerprint, is_active);

-- Create index for active issues
CREATE INDEX IF NOT EXISTS idx_compliance_issues_active 
ON compliance_issues(is_active, workspace_id);

-- Update existing issues with fingerprints (will be computed on next check)
-- Set is_active=1 for all existing issues
UPDATE compliance_issues SET is_active = 1 WHERE is_active IS NULL;

-- Set first_detected_check_id for existing issues
UPDATE compliance_issues 
SET first_detected_check_id = check_id 
WHERE first_detected_check_id IS NULL;

-- Set last_confirmed_check_id for existing issues
UPDATE compliance_issues 
SET last_confirmed_check_id = check_id 
WHERE last_confirmed_check_id IS NULL;
