-- Add issue_comments table for tracking comments and activity on compliance issues
-- Migration: add-issue-comments-table
-- Date: 2025-01-18

CREATE TABLE issue_comments (
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

