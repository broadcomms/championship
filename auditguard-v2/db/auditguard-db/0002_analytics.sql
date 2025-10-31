-- Phase 3: Risk Assessment & Analytics Schema

-- Issue tracking enhancements
ALTER TABLE compliance_issues ADD COLUMN status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'dismissed'));
ALTER TABLE compliance_issues ADD COLUMN assigned_to TEXT REFERENCES users(id);
ALTER TABLE compliance_issues ADD COLUMN resolved_at INTEGER;
ALTER TABLE compliance_issues ADD COLUMN resolved_by TEXT REFERENCES users(id);

-- Workspace compliance scores (historical tracking)
CREATE TABLE workspace_scores (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL,
    documents_checked INTEGER NOT NULL,
    total_documents INTEGER NOT NULL,
    critical_issues INTEGER NOT NULL,
    high_issues INTEGER NOT NULL,
    medium_issues INTEGER NOT NULL,
    low_issues INTEGER NOT NULL,
    info_issues INTEGER NOT NULL,
    risk_level TEXT NOT NULL CHECK(risk_level IN ('critical', 'high', 'medium', 'low', 'minimal')),
    frameworks_covered TEXT NOT NULL,
    calculated_at INTEGER NOT NULL,
    calculated_by TEXT REFERENCES users(id)
);

-- Framework-specific scores
CREATE TABLE framework_scores (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    framework TEXT NOT NULL,
    score INTEGER NOT NULL,
    checks_passed INTEGER NOT NULL,
    checks_failed INTEGER NOT NULL,
    total_checks INTEGER NOT NULL,
    last_check_at INTEGER,
    created_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_workspace_scores_workspace_id ON workspace_scores(workspace_id);
CREATE INDEX idx_workspace_scores_calculated_at ON workspace_scores(calculated_at);
CREATE INDEX idx_framework_scores_workspace_framework ON framework_scores(workspace_id, framework);
CREATE INDEX idx_compliance_issues_status ON compliance_issues(status);
CREATE INDEX idx_compliance_issues_assigned_to ON compliance_issues(assigned_to);
