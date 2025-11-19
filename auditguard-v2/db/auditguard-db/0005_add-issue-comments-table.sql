-- Add issue_comments table for tracking comments and activity on compliance issues
-- Migration: add-issue-comments-table
-- Date: 2025-01-18

CREATE TABLE IF NOT EXISTS issue_comments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  comment_type TEXT NOT NULL CHECK(comment_type IN ('comment', 'status_change', 'assignment', 'resolution', 'system')) DEFAULT 'comment',
  metadata TEXT,  -- JSON metadata for system events (e.g., old_status, new_status)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (issue_id) REFERENCES compliance_issues(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_id ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_workspace_id ON issue_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_user_id ON issue_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_created_at ON issue_comments(created_at DESC);

-- Add new fields to compliance_issues table
-- Add due_date field for tracking issue deadlines
ALTER TABLE compliance_issues ADD COLUMN due_date INTEGER;

-- Add assigned_at field to track when issue was assigned
ALTER TABLE compliance_issues ADD COLUMN assigned_at INTEGER;

-- Add priority_level field (P1-P4) separate from priority score
ALTER TABLE compliance_issues ADD COLUMN priority_level TEXT CHECK(priority_level IN ('P1', 'P2', 'P3', 'P4'));

-- Add indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_compliance_issues_due_date ON compliance_issues(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_issues_assigned_at ON compliance_issues(assigned_at) WHERE assigned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_issues_priority_level ON compliance_issues(priority_level) WHERE priority_level IS NOT NULL;
