-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Sessions table
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workspaces table
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workspace members table
CREATE TABLE workspace_members (
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    added_by TEXT NOT NULL,
    PRIMARY KEY (workspace_id, user_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Documents table
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    category TEXT,
    storage_key TEXT,
    processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed', 'deleting')),
    
    text_extracted INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    title TEXT,
    description TEXT, 
    vultr_key TEXT,
    extracted_text_key TEXT,
    original_file_url TEXT,
    extraction_status TEXT DEFAULT 'pending',
    page_count INTEGER,
    word_count INTEGER,

    extracted_text TEXT,

    compliance_framework_id INTEGER REFERENCES compliance_frameworks(id) ON DELETE SET NULL,
    chunks_created INTEGER DEFAULT 0,
    embeddings_generated INTEGER DEFAULT 0,
    vector_indexing_status TEXT DEFAULT 'pending',
    smartbucket_indexing_status TEXT DEFAULT 'pending',
    fully_completed INTEGER DEFAULT 0,
    character_count INTEGER,

    uploaded_by TEXT NOT NULL,
    uploaded_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Document chunks table for semantic search
CREATE TABLE document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    word_count INTEGER,
    vector_id TEXT,
    embedding_status TEXT DEFAULT 'pending',

    -- Legacy fields (kept for backward compatibility, but nullable)
    content TEXT,
    chunk_size INTEGER,

    start_char INTEGER DEFAULT 0,
    end_char INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    character_count INTEGER DEFAULT 0,
    has_header INTEGER DEFAULT 0,
    section_title TEXT,

    created_at INTEGER NOT NULL,
    updated_at INTEGER,

    UNIQUE(document_id, chunk_index),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Compliance checks table
CREATE TABLE compliance_checks (
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

CREATE TABLE compliance_frameworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    settings TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);


-- User subscriptions
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'past_due', 'trialing', 'paused')),
    current_period_start INTEGER NOT NULL,
    current_period_end INTEGER NOT NULL,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);


-- System settings
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL CHECK(value_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at INTEGER NOT NULL,
    updated_by TEXT REFERENCES users(id)
);

-- Admin users (platform admins)
CREATE TABLE admin_users (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('super_admin', 'support', 'billing_admin')),
    permissions TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT REFERENCES users(id)
);



-- Audit log for admin actions
CREATE TABLE admin_audit_log (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    changes TEXT, -- JSON
    ip_address TEXT,
    created_at INTEGER NOT NULL
);


CREATE TABLE document_chunk_frameworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id INTEGER NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    framework_id INTEGER NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    relevance_score REAL,
    auto_tagged INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(chunk_id, framework_id)
);



CREATE TABLE document_processing_steps (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    step_name TEXT NOT NULL, 
    step_order INTEGER NOT NULL,  
    status TEXT NOT NULL DEFAULT 'pending', 
    started_at INTEGER,
    completed_at INTEGER,
    progress_current INTEGER DEFAULT 0,
    progress_total INTEGER DEFAULT 0,
    meta_info TEXT, 
    error_message TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE(document_id, step_name)
);

-- Compliance issues table
CREATE TABLE compliance_issues (
    id TEXT PRIMARY KEY,
    check_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    workspace_id TEXT,
    framework TEXT,
    regulation_citation TEXT,
    excerpt TEXT,
    risk_score INTEGER,
    section_ref TEXT,
    chunk_ids TEXT,
    remediation_steps TEXT,
    full_excerpt TEXT,
    resolution_notes TEXT,
    updated_at INTEGER,
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,
    confidence INTEGER DEFAULT 70 CHECK(confidence >= 0 AND confidence <= 100),
    priority INTEGER DEFAULT 50 CHECK(priority >= 0 AND priority <= 100),
    location TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'dismissed')),
    assigned_to TEXT REFERENCES users(id),
    resolved_at INTEGER,
    resolved_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (check_id) REFERENCES compliance_checks(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id)
);


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


-- Conversation sessions
CREATE TABLE conversation_sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    memory_session_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    last_activity_at INTEGER NOT NULL,
    message_count INTEGER DEFAULT 0
);

-- Conversation messages (for audit trail)
CREATE TABLE conversation_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- Subscription plans
CREATE TABLE subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly INTEGER NOT NULL, -- in cents
    price_yearly INTEGER NOT NULL, -- in cents
    features TEXT NOT NULL, -- JSON array
    limits TEXT NOT NULL, -- JSON object with limits
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
);



-- Usage tracking
CREATE TABLE usage_tracking (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    user_id TEXT REFERENCES users(id),
    meta_info TEXT,
    tracked_at INTEGER NOT NULL
);

-- Usage summaries (aggregated daily)
CREATE TABLE usage_summaries (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- YYYY-MM-DD
    api_calls INTEGER DEFAULT 0,
    documents_uploaded INTEGER DEFAULT 0,
    compliance_checks INTEGER DEFAULT 0,
    assistant_messages INTEGER DEFAULT 0,
    storage_bytes INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(workspace_id, date)
);



CREATE TABLE performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    meta_info TEXT,
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);


-- -------------------- New Table: document_compliance_cache --------------------
-- Cache computed compliance scores and summaries for performance
CREATE TABLE IF NOT EXISTS document_compliance_cache (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  framework TEXT NOT NULL,
  overall_score REAL,
  risk_level TEXT,
  total_issues INTEGER DEFAULT 0,
  critical_issues INTEGER DEFAULT 0,
  high_issues INTEGER DEFAULT 0,
  medium_issues INTEGER DEFAULT 0,
  low_issues INTEGER DEFAULT 0,
  open_issues INTEGER DEFAULT 0,
  resolved_issues INTEGER DEFAULT 0,
  last_check_id TEXT,
  last_analyzed_at INTEGER NOT NULL,
  expires_at INTEGER,
  UNIQUE(document_id, framework),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- -------------------- New Table: issue_status_history --------------------
-- Track all status changes for complete audit trail
CREATE TABLE IF NOT EXISTS issue_status_history (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (issue_id) REFERENCES compliance_issues(id) ON DELETE CASCADE
);


-- Track assignment history for audit trail and notifications
CREATE TABLE IF NOT EXISTS issue_assignments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  unassigned_at INTEGER,
  notes TEXT,
  notification_sent INTEGER DEFAULT 0,
  FOREIGN KEY (issue_id) REFERENCES compliance_issues(id) ON DELETE CASCADE
);


-- Enable saving and retrieving generated compliance reports
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

-- Indexes for performance 00
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
CREATE INDEX workspaces_owner_id_idx ON workspaces(owner_id);
CREATE INDEX workspace_members_user_id_idx ON workspace_members(user_id);
CREATE INDEX documents_workspace_id_idx ON documents(workspace_id);
CREATE INDEX documents_uploaded_by_idx ON documents(uploaded_by);


CREATE INDEX idx_compliance_frameworks_active ON compliance_frameworks(is_active) WHERE is_active = 1;


-- Indexes for performance 02
CREATE INDEX idx_workspace_scores_workspace_id ON workspace_scores(workspace_id);
CREATE INDEX idx_workspace_scores_calculated_at ON workspace_scores(calculated_at);

-- Indexes for performance 03
CREATE INDEX idx_conversation_sessions_workspace ON conversation_sessions(workspace_id);
CREATE INDEX idx_conversation_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_conversation_messages_session ON conversation_messages(session_id);
CREATE INDEX idx_conversation_messages_created ON conversation_messages(created_at);

-- Indexes for performance
CREATE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_usage_tracking_workspace ON usage_tracking(workspace_id);
CREATE INDEX idx_usage_tracking_tracked_at ON usage_tracking(tracked_at);
CREATE INDEX idx_usage_tracking_resource_type ON usage_tracking(resource_type);
CREATE INDEX idx_usage_summaries_workspace_date ON usage_summaries(workspace_id, date);
CREATE INDEX idx_admin_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at);

-- Index for faster lookups by extraction status 06
CREATE INDEX idx_documents_extraction_status ON documents(extraction_status);

CREATE INDEX idx_documents_framework
    ON documents(compliance_framework_id) WHERE compliance_framework_id IS NOT NULL;

CREATE INDEX idx_documents_vector_status ON documents(vector_indexing_status);
CREATE INDEX idx_documents_smartbucket_status ON documents(smartbucket_indexing_status);



CREATE INDEX idx_chunk_frameworks_chunk ON document_chunk_frameworks(chunk_id);
CREATE INDEX idx_chunk_frameworks_framework ON document_chunk_frameworks(framework_id);
CREATE INDEX idx_chunk_frameworks_score ON document_chunk_frameworks(relevance_score);

DROP INDEX IF EXISTS idx_unique_document_chunk;
CREATE UNIQUE INDEX idx_unique_document_chunk ON document_chunks(document_id, chunk_index);


CREATE INDEX idx_performance_metrics_operation ON performance_metrics(operation);
CREATE INDEX idx_performance_metrics_created_at ON performance_metrics(created_at);
CREATE INDEX idx_performance_metrics_success ON performance_metrics(success);


CREATE INDEX IF NOT EXISTS idx_documents_fully_completed ON documents(fully_completed);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_workspace_id ON document_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_vector_id ON document_chunks(vector_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_status ON document_chunks(embedding_status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_workspace_document ON document_chunks(workspace_id, document_id);

-- Indexes for performance 01
CREATE INDEX IF NOT EXISTS idx_compliance_checks_document_id ON compliance_checks(document_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_workspace_id ON compliance_checks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_framework ON compliance_checks(framework);

CREATE INDEX IF NOT EXISTS idx_processing_steps_document
    ON document_processing_steps(document_id);

CREATE INDEX IF NOT EXISTS idx_processing_steps_status
    ON document_processing_steps(step_order, status);

CREATE INDEX IF NOT EXISTS idx_processing_steps_document_order
    ON document_processing_steps(document_id, step_order);
CREATE INDEX idx_compliance_issues_priority ON compliance_issues(priority DESC);
CREATE INDEX idx_compliance_issues_workspace_priority
ON compliance_issues(check_id, priority DESC, status);

-- Indexes for compliance_issues
CREATE INDEX IF NOT EXISTS idx_compliance_issues_check_id ON compliance_issues(check_id);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_severity ON compliance_issues(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_status ON compliance_issues(status);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_assigned_to ON compliance_issues(assigned_to);

CREATE INDEX IF NOT EXISTS idx_framework_scores_workspace_framework ON framework_scores(workspace_id, framework);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_issues_workspace ON compliance_issues(workspace_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON compliance_issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assigned ON compliance_issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON compliance_issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_document ON compliance_issues(document_id);
CREATE INDEX IF NOT EXISTS idx_issues_framework ON compliance_issues(framework);



CREATE INDEX idx_assignments_issue ON issue_assignments(issue_id);
CREATE INDEX idx_assignments_assignee ON issue_assignments(assigned_to);
CREATE INDEX idx_assignments_workspace ON issue_assignments(workspace_id);



CREATE INDEX idx_status_history_issue ON issue_status_history(issue_id);
CREATE INDEX idx_status_history_workspace ON issue_status_history(workspace_id);



CREATE INDEX idx_compliance_cache_document ON document_compliance_cache(document_id);
CREATE INDEX idx_compliance_cache_workspace ON document_compliance_cache(workspace_id);

-- Index for fast workspace report lookups
CREATE INDEX IF NOT EXISTS idx_compliance_reports_workspace_id ON compliance_reports(workspace_id);

-- Index for chronological sorting
CREATE INDEX IF NOT EXISTS idx_compliance_reports_created_at ON compliance_reports(created_at DESC);

-- Index for filtering by creator
CREATE INDEX IF NOT EXISTS idx_compliance_reports_created_by ON compliance_reports(created_by);


-- Seed default frameworks
INSERT INTO compliance_frameworks (name, display_name, description, settings) VALUES
    ('sox', 'SOX', 'Sarbanes-Oxley Act', '{"color":"#FF6B6B"}'),
    ('gdpr', 'GDPR', 'General Data Protection Regulation', '{"color":"#4ECDC4"}'),
    ('hipaa', 'HIPAA', 'Healthcare Data Security', '{"color":"#95E1D3"}'),
    ('pci_dss', 'PCI-DSS', 'Payment Card Security', '{"color":"#F38181"}'),
    ('iso27001', 'ISO 27001', 'Information Security Management', '{"color":"#AA96DA"}'),
    ('nist', 'NIST CSF', 'Cybersecurity Framework', '{"color":"#FCBAD3"}'),
    ('cobit', 'COBIT', 'Control Objectives for Information and Related Technologies', '{"color":"#C1FBA4"}'),
    ('itil', 'ITIL', 'Information Technology Infrastructure Library', '{"color":"#FFD97D"}'),
    ('federal_risk', 'Federal Risk', 'Federal Risk and Authorization Management Program', '{"color":"#A0CED9"}'),
    ('cis_controls', 'CIS Controls', 'Center for Internet Security Controls', '{"color":"#FFABAB"}'),
    ('gdpr_uk', 'UK GDPR', 'United Kingdom General Data Protection Regulation', '{"color":"#B5EAEA"}'),
    ('pdpa_sg', 'PDPA SG', 'Personal Data Protection Act (Singapore)', '{"color":"#FFDAC1"}'),
    ('soc2', 'SOC 2', 'Service Organization Control 2', '{"color":"#6C5CE7"}'),
    ('ccpa', 'CCPA', 'California Consumer Privacy Act', '{"color":"#FD79A8"}'),
    ('ferpa', 'FERPA', 'Family Educational Rights and Privacy Act', '{"color":"#00B894"}'),
    ('glba', 'GLBA', 'Gramm-Leach-Bliley Act', '{"color":"#FDCB6E"}'),
    ('fisma', 'FISMA', 'Federal Information Security Management Act', '{"color":"#E17055"}'),
    ('pipeda', 'PIPEDA', 'Personal Information Protection and Electronic Documents Act (Canada)', '{"color":"#74B9FF"}'),
    ('coppa', 'COPPA', 'Children Online Privacy Protection Act', '{"color":"#A29BFE"}'),
    ('cmmc', 'CMMC', 'Cybersecurity Maturity Model Certification', '{"color":"#D5AAFF"}');


-- Insert default subscription plans
INSERT INTO subscription_plans (id, name, display_name, description, price_monthly, price_yearly, features, limits, created_at) VALUES
(
    'plan_free',
    'free',
    'Free',
    'Perfect for getting started with compliance management',
    0,
    0,
    '["Basic compliance checks","Up to 10 documents","Community support","GDPR & SOC2 frameworks"]',
    '{"documents":10,"compliance_checks":20,"api_calls":1000,"assistant_messages":50,"storage_mb":100}',
    (SELECT unixepoch() * 1000)
),
(
    'plan_pro',
    'pro',
    'Professional',
    'For growing teams that need more power',
    4900,
    49000,
    '["All compliance frameworks","Up to 1000 documents","Email support","AI assistant","Advanced analytics","Team collaboration"]',
    '{"documents":1000,"compliance_checks":500,"api_calls":50000,"assistant_messages":1000,"storage_mb":10000}',
    (SELECT unixepoch() * 1000)
),
(
    'plan_enterprise',
    'enterprise',
    'Enterprise',
    'For large organizations with advanced needs',
    19900,
    199000,
    '["All Pro features","Unlimited documents","Priority support","Custom frameworks","SSO integration","Dedicated account manager","SLA guarantee"]',
    '{"documents":-1,"compliance_checks":-1,"api_calls":-1,"assistant_messages":-1,"storage_mb":-1}',
    (SELECT unixepoch() * 1000)
);

-- Insert default system settings
INSERT INTO system_settings (key, value, value_type, description, updated_at) VALUES
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode to prevent access', (SELECT unixepoch() * 1000)),
('default_plan', 'plan_free', 'string', 'Default plan for new workspaces', (SELECT unixepoch() * 1000)),
('trial_period_days', '14', 'number', 'Trial period duration in days', (SELECT unixepoch() * 1000)),
('max_workspaces_per_user', '5', 'number', 'Maximum workspaces a user can own', (SELECT unixepoch() * 1000));

-- Insert first admin user
INSERT INTO users (id, email, password_hash, created_at, updated_at)
VALUES (
  'usr_bootstrap_admin',
  'admin@auditguardx.com',
  '$2b$10$KNzWf0ss9SqyTKGDKbjO5u7LFEjwTxW4vwN926aX/LZAyimsX5NlG',
  unixepoch() * 1000,
  unixepoch() * 1000
);

-- Grant super_admin privileges
INSERT INTO admin_users (user_id, role, permissions, created_at, created_by)
VALUES (
  'usr_bootstrap_admin',
  'super_admin',
  '["*"]',
  unixepoch() * 1000,
  'usr_bootstrap_admin'
);

-- Log the bootstrap action
INSERT INTO admin_audit_log (id, admin_user_id, action, resource_type, resource_id, changes, ip_address, created_at)
VALUES (
  'audit_bootstrap_' || hex(randomblob(8)),
  'usr_bootstrap_admin',
  'bootstrap_admin_created',
  'admin_user',
  'usr_bootstrap_admin',
  '{"role":"super_admin","email":"admin@auditguardx.com","note":"Initial admin user created via migration"}',
  '127.0.0.1',
  unixepoch() * 1000
);