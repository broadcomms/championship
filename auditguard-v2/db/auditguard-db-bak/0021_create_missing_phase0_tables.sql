-- Migration: 0021_create_missing_phase0_tables.sql
-- Description: Create missing Phase 0 tables that were not applied from earlier migrations
-- Date: November 8, 2025
-- Reason: Tables defined in 0001 and 0002 migrations were not created in production database

-- ============================================================================
-- COMPLIANCE ISSUES TABLE (from 0001_compliance.sql)
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_issues (
    id TEXT PRIMARY KEY,
    check_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,
    location TEXT,
    created_at INTEGER NOT NULL,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'dismissed')),
    assigned_to TEXT,
    resolved_at INTEGER,
    resolved_by TEXT,
    FOREIGN KEY (check_id) REFERENCES compliance_checks(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- Indexes for compliance_issues
CREATE INDEX IF NOT EXISTS idx_compliance_issues_check_id ON compliance_issues(check_id);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_severity ON compliance_issues(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_status ON compliance_issues(status);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_assigned_to ON compliance_issues(assigned_to);

-- ============================================================================
-- WORKSPACE SCORES TABLE (from 0002_analytics.sql)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_scores (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
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
    calculated_by TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (calculated_by) REFERENCES users(id)
);

-- Indexes for workspace_scores
CREATE INDEX IF NOT EXISTS idx_workspace_scores_workspace_id ON workspace_scores(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_scores_calculated_at ON workspace_scores(calculated_at);

-- ============================================================================
-- FRAMEWORK SCORES TABLE (from 0002_analytics.sql)
-- ============================================================================
CREATE TABLE IF NOT EXISTS framework_scores (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    framework TEXT NOT NULL,
    score INTEGER NOT NULL,
    checks_passed INTEGER NOT NULL,
    checks_failed INTEGER NOT NULL,
    total_checks INTEGER NOT NULL,
    last_check_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Indexes for framework_scores
CREATE INDEX IF NOT EXISTS idx_framework_scores_workspace_framework ON framework_scores(workspace_id, framework);
