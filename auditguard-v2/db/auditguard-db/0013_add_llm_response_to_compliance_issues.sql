-- Migration 0013: Add llm_response column to compliance_issues table
-- This stores the complete LLM JSON response for each individual issue

ALTER TABLE compliance_issues ADD COLUMN llm_response TEXT;
