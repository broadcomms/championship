-- Compliance checks table
CREATE TABLE IF NOT EXISTS compliance_checks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    framework TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    overall_score INTEGER,
    issues_found INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    created_by TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Compliance issues table
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
    FOREIGN KEY (check_id) REFERENCES compliance_checks(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Document chunks table for semantic search
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    chunk_size INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Add processing status to documents table
ALTER TABLE documents ADD COLUMN processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE documents ADD COLUMN text_extracted INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN chunk_count INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_compliance_checks_document_id ON compliance_checks(document_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_workspace_id ON compliance_checks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_framework ON compliance_checks(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_check_id ON compliance_issues(check_id);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_severity ON compliance_issues(severity);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_workspace_id ON document_chunks(workspace_id);
