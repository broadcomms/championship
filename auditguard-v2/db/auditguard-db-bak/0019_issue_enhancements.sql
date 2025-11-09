-- PHASE 1.1.2 & 1.1.3: Add enhanced fields to compliance_issues table
-- NOTE: status column already added in 0002_analytics.sql

-- Add confidence score from AI analysis (0-100)
ALTER TABLE compliance_issues ADD COLUMN confidence INTEGER DEFAULT 70 CHECK(confidence >= 0 AND confidence <= 100);

-- Add priority score (0-100, higher = more urgent)
ALTER TABLE compliance_issues ADD COLUMN priority INTEGER DEFAULT 50 CHECK(priority >= 0 AND priority <= 100);

-- Create index_ on priority for fast sorting
CREATE INDEX idx_compliance_issues_priority ON compliance_issues(priority DESC);

-- NOTE: idx_compliance_issues_status already created in 0002_analytics.sql
-- Create composite index on check_id, priority, and status for optimized queries
CREATE INDEX idx_compliance_issues_workspace_priority
ON compliance_issues(check_id, priority DESC, status);
 