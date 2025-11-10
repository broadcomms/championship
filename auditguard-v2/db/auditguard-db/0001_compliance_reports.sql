-- Migration: Add compliance_reports table for storing generated executive summary reports
-- Created: 2025-01-15
-- Purpose: Enable saving and retrieving generated compliance reports

CREATE TABLE IF NOT EXISTS compliance_reports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  frameworks TEXT NOT NULL, -- JSON array of framework names
  report_period TEXT NOT NULL, -- JSON object with startDate and endDate
  summary TEXT NOT NULL, -- JSON object with report data (overallScore, keyFindings, recommendations, etc.)
  status TEXT NOT NULL DEFAULT 'completed', -- 'generating', 'completed', 'failed'
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast workspace report lookups
CREATE INDEX IF NOT EXISTS idx_compliance_reports_workspace_id ON compliance_reports(workspace_id);

-- Index for chronological sorting
CREATE INDEX IF NOT EXISTS idx_compliance_reports_created_at ON compliance_reports(created_at DESC);

-- Index for filtering by creator
CREATE INDEX IF NOT EXISTS idx_compliance_reports_created_by ON compliance_reports(created_by);
