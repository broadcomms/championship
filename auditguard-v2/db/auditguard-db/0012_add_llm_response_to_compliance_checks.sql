-- Migration: Add llm_response column to compliance_checks table
-- This stores the complete JSON response from the LLM for audit trail and debugging

ALTER TABLE compliance_checks ADD COLUMN llm_response TEXT;
