-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    workspace_count INTEGER DEFAULT 0,
    last_login INTEGER,
    is_active INTEGER DEFAULT 1,
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

-- Organizations table (for multi-workspace and team billing)
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    stripe_customer_id TEXT UNIQUE,
    billing_email TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_organizations_owner ON organizations(owner_user_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_stripe ON organizations(stripe_customer_id);

-- Organization members table
CREATE TABLE organization_members (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member', 'billing')),
    joined_at INTEGER NOT NULL,
    invited_by TEXT REFERENCES users(id),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);

-- SSO connections table (WorkOS integration)
CREATE TABLE sso_connections (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL CHECK(provider IN ('google', 'okta', 'azure', 'saml', 'generic-saml')),
    workos_organization_id TEXT NOT NULL,
    workos_connection_id TEXT,
    enabled INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_sso_connections_org ON sso_connections(organization_id);
CREATE INDEX idx_sso_connections_workos_org ON sso_connections(workos_organization_id);

-- Organization usage tracking (daily aggregation)
CREATE TABLE organization_usage_daily (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    documents_created INTEGER DEFAULT 0,
    documents_total INTEGER DEFAULT 0,
    compliance_checks_count INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0,
    assistant_messages_count INTEGER DEFAULT 0,
    storage_bytes INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(organization_id, date)
);

CREATE INDEX idx_org_usage_org_date ON organization_usage_daily(organization_id, date);

-- Workspaces table
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL,
    organization_id TEXT REFERENCES organizations(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_workspaces_organization ON workspaces(organization_id);


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

-- Workspace invitations table
CREATE TABLE workspace_invitations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'member', 'viewer')),
    invited_by TEXT NOT NULL,
    invitation_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at INTEGER NOT NULL,
    accepted_at INTEGER,
    accepted_by TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id),
    FOREIGN KEY (accepted_by) REFERENCES users(id)
);

CREATE INDEX idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX idx_workspace_invitations_token ON workspace_invitations(invitation_token);
CREATE INDEX idx_workspace_invitations_status ON workspace_invitations(status);

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
    -- content TEXT, -- empty content is stored in chunk_text now
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


-- User subscriptions (organization-level billing)
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'paused')),
    current_period_start INTEGER,
    current_period_end INTEGER,
    cancel_at_period_end INTEGER DEFAULT 0,
    trial_end INTEGER,
    trial_start INTEGER,
    trial_period_days INTEGER,
    billing_cycle TEXT CHECK(billing_cycle IN ('monthly', 'yearly')),
    billing_email TEXT,
    canceled_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(organization_id, status);




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

-- Add fingerprinting columns to compliance_issues table
ALTER TABLE compliance_issues ADD COLUMN issue_fingerprint TEXT;
ALTER TABLE compliance_issues ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE compliance_issues ADD COLUMN superseded_by TEXT;
ALTER TABLE compliance_issues ADD COLUMN first_detected_check_id TEXT;
ALTER TABLE compliance_issues ADD COLUMN last_confirmed_check_id TEXT;

-- Create index for fingerprint-based lookups
CREATE INDEX idx_compliance_issues_fingerprint 
ON compliance_issues(document_id, framework, issue_fingerprint, is_active);

-- Create index for active issues
CREATE INDEX idx_compliance_issues_active 
ON compliance_issues(is_active, workspace_id);


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
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    features TEXT NOT NULL, -- JSON array
    max_workspaces INTEGER DEFAULT 3,
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
CREATE TABLE document_compliance_cache (
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
CREATE TABLE issue_status_history (
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
CREATE TABLE issue_assignments (
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
CREATE TABLE compliance_reports (
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


CREATE TABLE stripe_webhooks (
    id TEXT PRIMARY KEY,
    stripe_event_id TEXT UNIQUE NOT NULL, -- Stripe event ID (for idempotency)
    type TEXT NOT NULL, -- Event type (e.g., 'invoice.payment_succeeded')
    processed INTEGER DEFAULT 0, -- 0 = pending, 1 = processed successfully
    payload TEXT NOT NULL, -- Full JSON payload from Stripe
    error TEXT, -- Error message if processing failed
    created_at INTEGER NOT NULL, -- When webhook was received
    processed_at INTEGER -- When webhook was processed
);

CREATE TABLE billing_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT UNIQUE,
    stripe_charge_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL,
    description TEXT,
    invoice_pdf TEXT,
    period_start INTEGER,
    period_end INTEGER,
    created_at INTEGER NOT NULL
);

CREATE TABLE stripe_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    payment_method_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE stripe_payment_methods (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT NOT NULL,
    type TEXT NOT NULL,
    last4 TEXT,
    brand TEXT,
    exp_month INTEGER,
    exp_year INTEGER,
    is_default INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE knowledge_base (
  id TEXT PRIMARY KEY DEFAULT ('kb_' || lower(hex(randomblob(6)))),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('framework_guide', 'compliance_article', 'best_practice')),
  framework TEXT CHECK (framework IN ('gdpr', 'soc2', 'hipaa', 'iso27001', 'nist_csf', 'pci_dss')),
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
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

-- 3. Create index for performance
CREATE INDEX idx_workspace_members_user_role ON workspace_members(user_id, role);


-- Indexes for performance 03
CREATE INDEX idx_conversation_sessions_workspace ON conversation_sessions(workspace_id);
CREATE INDEX idx_conversation_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_conversation_messages_session ON conversation_messages(session_id);
CREATE INDEX idx_conversation_messages_created ON conversation_messages(created_at);

-- Indexes for performance
CREATE INDEX idx_subscriptions_workspace ON subscriptions(organization_id);
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




CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_kb_framework ON knowledge_base(framework) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_kb_active ON knowledge_base(is_active);

CREATE TRIGGER IF NOT EXISTS update_kb_timestamp 
AFTER UPDATE ON knowledge_base
BEGIN
  UPDATE knowledge_base SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Seed data: Framework Guides (5)
INSERT INTO knowledge_base (id, title, content, category, framework, tags, sort_order) VALUES
('kb_guide_gdpr', 'GDPR Quick Reference', 
'GDPR (General Data Protection Regulation) Quick Reference

KEY PRINCIPLES:
1. Lawfulness, fairness, transparency
2. Purpose limitation
3. Data minimization
4. Accuracy
5. Storage limitation
6. Integrity and confidentiality
7. Accountability

COMMON REQUIREMENTS:
- Lawful basis for processing
- Data subject rights (access, erasure, portability)
- Data breach notification (72 hours)
- Privacy by design and default
- Data Protection Impact Assessments (DPIAs)

PENALTIES: Up to €20M or 4% of global annual turnover', 
'framework_guide', 'gdpr', '["GDPR","data_protection","privacy","regulation","EU"]', 1),

('kb_guide_soc2', 'SOC 2 Quick Reference',
'SOC 2 (System and Organization Controls 2) Quick Reference

TRUST SERVICE CRITERIA:
1. Security - Protection against unauthorized access
2. Availability - System available for operation/use
3. Processing Integrity - Complete, valid, accurate, timely
4. Confidentiality - Protected as committed/agreed
5. Privacy - Personal information collection, use, retention, disclosure, disposal

AUDIT TYPES:
- Type I: Point-in-time assessment
- Type II: 6-12 month period assessment (most common)

EVIDENCE REQUIRED:
- Policies and procedures
- System descriptions
- Risk assessments
- Access controls
- Change management logs', 
'framework_guide', 'soc2', '["SOC2","audit","compliance","trust_services","security"]', 2),

('kb_guide_hipaa', 'HIPAA Quick Reference',
'HIPAA (Health Insurance Portability and Accountability Act) Quick Reference

KEY RULES:
1. Privacy Rule - PHI protections
2. Security Rule - ePHI safeguards
3. Breach Notification Rule

SAFEGUARDS REQUIRED:
Administrative:
- Risk assessments
- Workforce training
- Incident response procedures

Physical:
- Facility access controls
- Workstation security
- Device/media controls

Technical:
- Access control
- Audit controls
- Integrity controls
- Transmission security

BUSINESS ASSOCIATE AGREEMENTS (BAA):
Required for third parties handling PHI', 
'framework_guide', 'hipaa', '["HIPAA","healthcare","PHI","ePHI","privacy","security"]', 3),

('kb_guide_iso27001', 'ISO 27001 Quick Reference',
'ISO 27001 (Information Security Management System) Quick Reference

ISMS COMPONENTS:
1. Leadership and commitment
2. Information security policy
3. Risk assessment methodology
4. Risk treatment plan
5. Statement of Applicability (SoA)

ANNEX A CONTROLS: 93 controls across:
- Organizational controls (37)
- People controls (8)
- Physical controls (14)
- Technological controls (34)

CERTIFICATION PROCESS:
- Stage 1: Documentation review
- Stage 2: Implementation audit
- Surveillance audits (annual)
- Recertification (every 3 years)

KEY REQUIREMENTS:
- Context of organization
- Interested parties needs
- Scope of ISMS
- Risk assessment and treatment', 
'framework_guide', 'iso27001', '["ISO27001","ISMS","information_security","certification"]', 4),

('kb_guide_nist', 'NIST CSF Quick Reference',
'NIST Cybersecurity Framework (CSF) Quick Reference

FIVE CORE FUNCTIONS:

1. IDENTIFY
- Asset management
- Business environment
- Governance
- Risk assessment
- Risk management strategy

2. PROTECT
- Access control
- Awareness and training
- Data security
- Protective technology

3. DETECT
- Anomalies and events
- Security continuous monitoring
- Detection processes

4. RESPOND
- Response planning
- Communications
- Analysis
- Mitigation
- Improvements

5. RECOVER
- Recovery planning
- Improvements
- Communications

IMPLEMENTATION TIERS:
- Tier 1: Partial
- Tier 2: Risk Informed
- Tier 3: Repeatable
- Tier 4: Adaptive', 
'framework_guide', 'nist_csf', '["NIST","CSF","cybersecurity","framework"]', 5);

-- Seed data: Compliance Articles (8)
INSERT INTO knowledge_base (id, title, content, category, framework, tags, sort_order) VALUES
('kb_gdpr_data_min', 'GDPR Article 5 - Data Minimization',
'GDPR Data Minimization Principle (Article 5(1)(c))

REQUIREMENT:
Personal data must be adequate, relevant, and limited to what is necessary for the purposes for which they are processed.

KEY ASPECTS:
1. Collect only necessary data
2. Avoid excessive data collection
3. Review data needs regularly
4. Delete unnecessary data
5. Document data necessity

PRACTICAL APPLICATION:
- Default forms to minimum fields
- Optional vs required field designation
- Regular data audits
- Purpose-based data collection
- Privacy by design

PENALTIES FOR NON-COMPLIANCE:
Up to €20M or 4% of global annual turnover

DOCUMENTATION:
- Data mapping
- Purpose statements
- Necessity assessments
- Retention schedules', 
'compliance_article', 'gdpr', '["GDPR","data_minimization","data_protection","privacy"]', 10),

('kb_gdpr_breach', 'GDPR Data Breach Notification Requirements',
'GDPR Data Breach Notification (Article 33 & 34)

72-HOUR NOTIFICATION REQUIREMENT:
Organizations must notify the supervisory authority within 72 hours of becoming aware of a personal data breach.

NOTIFICATION MUST INCLUDE:
1. Nature of breach (categories, approximate number of data subjects)
2. Name and contact details of DPO or other contact point
3. Likely consequences of the breach
4. Measures taken or proposed to address the breach and mitigate effects

INDIVIDUAL NOTIFICATION:
Required when breach likely to result in high risk to rights and freedoms of data subjects. Must include:
- Clear and plain language description
- Name and contact of DPO
- Likely consequences
- Mitigation measures taken

DOCUMENTATION REQUIREMENTS:
- Document all breaches (regardless of notification requirement)
- Facts relating to breach
- Effects and remedial action taken
- Available for supervisory authority review

PENALTIES:
Up to €10M or 2% of global annual turnover for notification failures

EXEMPTIONS:
- Encrypted data (key not compromised)
- Subsequent measures render data unintelligible
- Disproportionate effort (public communication accepted)', 
'compliance_article', 'gdpr', '["GDPR","data_breach","notification","72_hours","incident_response","DPO"]', 11),

('kb_soc2_evidence', 'SOC 2 Type II Evidence Requirements',
'SOC 2 Type II Audit Evidence

EVIDENCE CATEGORIES:

1. ACCESS CONTROL EVIDENCE
- User access reviews (quarterly)
- Termination logs
- Access request approvals
- Role assignments
- Privileged access reviews

2. CHANGE MANAGEMENT
- Change tickets with approvals
- Code review documentation
- Deployment logs
- Rollback procedures
- Emergency change justifications

3. INCIDENT MANAGEMENT
- Incident tickets
- Response timelines
- Root cause analyses
- Communication records
- Lessons learned

4. SECURITY AWARENESS
- Training completion records
- Training content/materials
- Phishing simulation results
- Policy acknowledgments

5. VULNERABILITY MANAGEMENT
- Scan results (monthly/quarterly)
- Patching records
- Risk acceptance documentation
- Remediation timelines

6. MONITORING & LOGGING
- Log retention evidence
- SIEM alerts
- Log review documentation
- Anomaly investigations

7. GOVERNANCE
- Policy review/approval
- Board/management meeting minutes
- Risk assessment updates
- Vendor assessments

AUDIT PERIOD:
Typically 6-12 months of continuous evidence

COMMON GAPS:
- Incomplete quarterly access reviews
- Missing change approvals
- Insufficient training records
- Gaps in vulnerability scanning
- Incomplete incident documentation', 
'compliance_article', 'soc2', '["SOC2","Type_II","audit","evidence","controls"]', 12),

('kb_hipaa_baa', 'HIPAA Business Associate Agreement Requirements',
'HIPAA Business Associate Agreement (BAA) Requirements

WHEN REQUIRED:
Any third party that creates, receives, maintains, or transmits PHI on behalf of a covered entity must sign a BAA.

MANDATORY PROVISIONS:

1. Permitted Uses and Disclosures
- Specify authorized uses of PHI
- Limit to purposes stated in agreement

2. Safeguards
- BA must implement appropriate safeguards
- Prevent unauthorized use/disclosure

3. Subcontractors
- BA must ensure subcontractors agree to same restrictions
- BA responsible for subcontractor compliance

4. Access Rights
- BA must provide access to PHI to covered entity
- Within timeframe specified by Privacy Rule

5. Amendment Rights
- BA must incorporate amendments to PHI

6. Accounting
- BA must track disclosures
- Provide accounting when required

7. Breach Notification
- BA must report breaches to covered entity
- No unreasonable delay (typically 60 days)

TERMINATION PROVISIONS:
- Termination upon breach
- Return or destruction of PHI
- Survival of certain provisions

PENALTIES FOR OPERATING WITHOUT BAA:
Both covered entity and business associate liable
Up to $1.5M per violation category per year

COMMON SERVICES REQUIRING BAA:
- Cloud storage providers
- Email services with PHI
- Billing companies
- IT support with PHI access
- Legal services reviewing PHI
- Transcription services', 
'compliance_article', 'hipaa', '["HIPAA","BAA","business_associate","PHI","contracts"]', 13),

('kb_iso_risk', 'ISO 27001 Risk Assessment Methodology',
'ISO 27001 Risk Assessment and Treatment

RISK ASSESSMENT PROCESS:

1. IDENTIFY ASSETS
- Information assets
- IT assets (hardware, software)
- Services
- People
- Physical assets

2. IDENTIFY THREATS
- Malicious (hackers, malware, insiders)
- Accidental (human error, system failures)
- Environmental (natural disasters)

3. IDENTIFY VULNERABILITIES
- Technical vulnerabilities
- Organizational weaknesses
- Process gaps
- Physical security weaknesses

4. ASSESS EXISTING CONTROLS
- Technical controls
- Administrative controls
- Physical controls

5. DETERMINE LIKELIHOOD
- Consider threat frequency
- Ease of exploitation
- Existing control effectiveness

6. DETERMINE IMPACT
- Confidentiality impact
- Integrity impact
- Availability impact
- Financial impact
- Reputational impact

RISK CALCULATION:
Risk = Likelihood × Impact

RISK TREATMENT OPTIONS:

1. MODIFY (Mitigate)
- Implement new controls
- Improve existing controls
- Most common approach

2. RETAIN (Accept)
- Document acceptance
- Require senior management approval
- Review periodically

3. AVOID (Eliminate)
- Stop the activity
- Remove the asset
- Change the process

4. SHARE (Transfer)
- Insurance
- Outsourcing with contractual protection
- Cloud services with appropriate agreements

DOCUMENTATION REQUIREMENTS:
- Risk register
- Risk treatment plan
- Statement of Applicability (SoA)
- Risk acceptance records
- Residual risk assessment

REVIEW FREQUENCY:
- Annual reviews mandatory
- After significant changes
- After incidents
- When new threats emerge', 
'compliance_article', 'iso27001', '["ISO27001","risk_assessment","ISMS","risk_management"]', 14),

('kb_access_control', 'Cross-Framework Access Control Best Practices',
'Access Control Best Practices (GDPR, SOC2, HIPAA, ISO27001, NIST CSF)

PRINCIPLE OF LEAST PRIVILEGE:
- Grant minimum necessary access
- Time-limited elevated privileges
- Regular access reviews

ROLE-BASED ACCESS CONTROL (RBAC):
- Define roles based on job functions
- Assign permissions to roles, not individuals
- Document role definitions
- Review role assignments quarterly

MULTI-FACTOR AUTHENTICATION (MFA):
- Required for:
  * Administrative access
  * Remote access
  * Sensitive data access
  * Cloud services

ACCESS REVIEW PROCESS:
Quarterly reviews should include:
- Active user list
- Current permissions
- Last login dates
- Terminated user verification
- Contractor access validation

TERMINATION PROCEDURES:
- Immediate access revocation
- HR notification triggers
- Asset return
- Account disablement checklist
- Quarterly terminated user audits

PRIVILEGED ACCESS MANAGEMENT (PAM):
- Separate admin accounts
- Just-in-time access
- Session recording
- Approval workflows
- Emergency access procedures

AUDIT LOGGING:
Log all:
- Authentication attempts
- Permission changes
- Admin actions
- Access to sensitive data
- Failed access attempts

FRAMEWORK-SPECIFIC REQUIREMENTS:

GDPR:
- Data subject access restrictions
- Processing purpose alignment
- Technical and organizational measures

SOC2:
- Quarterly user access reviews
- Segregation of duties
- Change management controls

HIPAA:
- Minimum necessary standard
- Role-based access to ePHI
- Emergency access procedures
- Workforce clearance procedures

ISO27001:
- Access control policy (A.9)
- User access management (A.9.2)
- User responsibilities (A.9.3)
- System and application access control (A.9.4)

NIST CSF:
- PR.AC-1: Identities and credentials managed
- PR.AC-3: Remote access managed
- PR.AC-4: Access permissions managed
- PR.AC-6: Identities proofed and bound', 
'best_practice', NULL, '["access_control","RBAC","MFA","least_privilege","cross_framework"]', 20),

('kb_data_retention', 'Data Retention Policy Guidelines',
'Data Retention Policy Guidelines (Multi-Framework)

RETENTION PRINCIPLES:

1. LEGAL REQUIREMENTS
- Comply with applicable laws
- Industry-specific regulations
- Contractual obligations

2. BUSINESS NEEDS
- Operational requirements
- Historical analysis
- Customer support

3. DATA MINIMIZATION
- Retain only as long as necessary
- Regular review and deletion
- Documented justification

FRAMEWORK-SPECIFIC REQUIREMENTS:

GDPR:
- Storage limitation principle
- Retain only for specified purposes
- Regular review obligations
- Right to erasure considerations

HIPAA:
- Minimum 6 years for most records
- Business associate agreements
- Accounting of disclosures (6 years)
- HIPAA authorization (6 years)

SOC2:
- Audit logs (7 years typical)
- Security events (1 year minimum)
- Access reviews (3 years)
- Incident records (3 years)

SAMPLE RETENTION SCHEDULE:

CUSTOMER DATA:
- Active customer: Duration of relationship + 7 years
- Inactive customer: 2-7 years based on requirements
- Marketing data: Until opt-out + 30 days

EMPLOYEE DATA:
- Personnel files: Termination + 7 years
- Payroll records: 7 years
- I-9 forms: Termination + 3 years
- Training records: Employment + 3 years

SYSTEM LOGS:
- Security logs: 1-2 years
- Audit logs: 7 years
- Application logs: 90 days - 1 year
- Network logs: 90 days - 1 year

FINANCIAL RECORDS:
- Invoices: 7 years
- Tax records: 7 years
- Contracts: Termination + 7 years

IMPLEMENTATION STEPS:

1. Data Inventory
- Identify all data types
- Document current retention
- Map to legal requirements

2. Policy Development
- Define retention periods
- Approval process
- Exceptions process

3. Technical Implementation
- Automated deletion
- Archive procedures
- Backup considerations

4. Training and Communication
- Staff awareness
- Data owner responsibilities
- Customer notifications

5. Monitoring and Review
- Annual policy review
- Compliance monitoring
- Update as regulations change

DELETION BEST PRACTICES:
- Secure deletion methods
- Verification of deletion
- Document deletion activities
- Consider backup retention', 
'best_practice', NULL, '["data_retention","privacy","records_management","GDPR","HIPAA"]', 21),

('kb_incident_response', 'Incident Response Plan Components',
'Incident Response Plan (SOC2, ISO27001, GDPR, NIST CSF)

SIX PHASES OF INCIDENT RESPONSE:

1. PREPARATION
- Incident response team roles
- Contact lists (internal/external)
- Communication templates
- Tool setup and access
- Training and drills

2. DETECTION AND ANALYSIS
- Monitoring and alerting
- Log analysis
- Threat intelligence
- Severity classification
- Initial assessment

3. CONTAINMENT
Short-term:
- Isolate affected systems
- Preserve evidence
- Implement temporary fixes

Long-term:
- Apply security patches
- Change credentials
- Remove malware

4. ERADICATION
- Remove threat actors
- Delete malware
- Close vulnerabilities
- Verify threat removal

5. RECOVERY
- Restore systems from clean backups
- Rebuild compromised systems
- Verify system integrity
- Monitor for reinfection
- Gradual service restoration

6. POST-INCIDENT
- Lessons learned meeting
- Incident report documentation
- Process improvements
- Training updates
- Metrics analysis

COMMUNICATION PLAN:

INTERNAL:
- Executive leadership
- IT and security teams
- Legal and compliance
- Public relations
- Human resources

EXTERNAL:
- Law enforcement (if applicable)
- Customers (if data breach)
- Regulators (GDPR 72 hours)
- Insurance provider
- Third-party vendors

SEVERITY CLASSIFICATION:

CRITICAL (P1):
- Active data breach
- Ransomware
- Complete service outage
- Response: Immediate (24/7)

HIGH (P2):
- Potential data breach
- Significant service degradation
- Response: 2 hours during business hours

MEDIUM (P3):
- Security policy violations
- Minor service issues
- Response: 8 hours

LOW (P4):
- Security warnings
- No immediate impact
- Response: 48 hours

DOCUMENTATION REQUIREMENTS:
- Incident timeline
- Actions taken
- Evidence collected
- Communications sent
- Impact assessment
- Root cause analysis
- Corrective actions

METRICS TO TRACK:
- Mean Time to Detect (MTTD)
- Mean Time to Respond (MTTR)
- Number of incidents by severity
- Incident categories/trends
- False positive rate

COMPLIANCE MAPPING:

SOC2:
- CC7.3: Incident response
- CC7.4: Incident detection
- CC7.5: Incident analysis

ISO27001:
- A.16.1: Incident management
- A.16.2: Evidence collection

GDPR:
- Article 33: Breach notification
- Article 34: Communication to data subjects

NIST CSF:
- DE.AE: Anomalies and events
- RS: Respond function
- RC: Recovery function', 
'best_practice', NULL, '["incident_response","security","breach","SOC2","ISO27001","GDPR","NIST"]', 22);




CREATE INDEX idx_stripe_customers_organization_id ON stripe_customers(organization_id);
CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

CREATE INDEX idx_payment_methods_organization_id ON stripe_payment_methods(organization_id);
CREATE INDEX idx_payment_methods_stripe_id ON stripe_payment_methods(stripe_payment_method_id);
CREATE INDEX idx_payment_methods_default ON stripe_payment_methods(organization_id, is_default);

CREATE INDEX idx_billing_history_organization_id ON billing_history(organization_id);
CREATE INDEX idx_billing_history_stripe_invoice ON billing_history(stripe_invoice_id);
CREATE INDEX idx_billing_history_status ON billing_history(organization_id, status);
CREATE INDEX idx_billing_history_created ON billing_history(organization_id, created_at);



CREATE INDEX idx_webhooks_event_id ON stripe_webhooks(stripe_event_id);
CREATE INDEX idx_webhooks_type ON stripe_webhooks(type);
CREATE INDEX idx_webhooks_processed ON stripe_webhooks(processed, created_at);


-- ============================================
-- SUBSCRIPTION PLANS
-- ============================================

-- Insert defaults subscription plan
INSERT INTO subscription_plans (id, name, display_name, description, price_monthly, price_yearly, features, limits, stripe_price_id_monthly, stripe_price_id_yearly, is_active, created_at) VALUES
(
    'plan_free',
    'free',
    'Free',
    'Perfect for getting started with compliance management',
    0,
    0,
    '["Basic compliance checks","Up to 10 documents","Community support","GDPR & SOC2 frameworks"]',
    '{"documents":10,"compliance_checks":20,"api_calls":1000,"assistant_messages":50,"storage_mb":100}',
    NULL,
    NULL,
    1,
    (SELECT unixepoch() * 1000)
);


INSERT INTO subscription_plans (id, name, display_name, description, price_monthly, price_yearly, features, limits, stripe_price_id_monthly, stripe_price_id_yearly, is_active, created_at) VALUES
(
    'plan_starter',
    'starter',
    'Starter',
    'Perfect for small teams getting started',
    2900,  -- $29.00
    27840, -- $278.40 (20% annual discount)
    '["All compliance frameworks","Up to 10 documents","AI assistant (50 messages)","Email support","Basic analytics"]',
    '{"documents":10,"compliance_checks":20,"api_calls":1000,"assistant_messages":50,"storage_mb":100}',
    'price_1ST8AAHSX3RgJL1cuCnSfkbF',
    'price_1ST8gaHSX3RgJL1cxzsQdeiL',
    1,
    (SELECT unixepoch() * 1000)
);

INSERT INTO subscription_plans (id, name, display_name, description, price_monthly, price_yearly, features, limits, stripe_price_id_monthly, stripe_price_id_yearly, is_active, created_at) VALUES
(
    'plan_professional',
    'professional',
    'Professional',
    'For growing teams that need more power',
    9900,  -- $99.00
    95040, -- $950.40 (20% annual discount)
    '["All compliance frameworks","Up to 1,000 documents","AI assistant (1,000 messages)","Priority support","Advanced analytics","Team collaboration"]',
    '{"documents":1000,"compliance_checks":500,"api_calls":50000,"assistant_messages":1000,"storage_mb":10000}',
    'price_1ST8FPHSX3RgJL1cf3mqP3bG',
    'price_1ST8hcHSX3RgJL1cUdsm1u98',
    1,
    (SELECT unixepoch() * 1000)
);


INSERT INTO subscription_plans (id, name, display_name, description, price_monthly, price_yearly, features, limits, stripe_price_id_monthly, stripe_price_id_yearly, is_active, created_at) VALUES
(
    'plan_business',
    'business',
    'Business',
    'For established teams with advanced compliance needs',
    29900,  -- $299.00
    287040, -- $2,870.40 (20% annual discount)
    '["All Professional features","Up to 10,000 documents","AI assistant (10,000 messages)","Priority support","Custom compliance frameworks","Advanced API access","Team management","Audit trails","Custom integrations"]',
    '{"documents":10000,"compliance_checks":5000,"api_calls":500000,"assistant_messages":10000,"storage_mb":100000}',
    'price_1ST8R1HSX3RgJL1cdZ6mpZoV',
    'price_1ST8ioHSX3RgJL1ckWq83mYc',
    1,
    (SELECT unixepoch() * 1000)
);


INSERT INTO subscription_plans (id, name, display_name, description, price_monthly, price_yearly, features, limits, stripe_price_id_monthly, stripe_price_id_yearly, is_active, created_at) VALUES
(
    'plan_enterprise',
    'enterprise',
    'Enterprise',
    'For large organizations with mission-critical compliance requirements',
    199900,  -- $1,999.00 per month
    199900,  -- Same as monthly (no yearly plan available yet)
    '["All Business features","Unlimited documents","Unlimited AI assistant","24/7 dedicated support","SSO integration","Custom SLA","Dedicated account manager","On-premise deployment option","Custom compliance frameworks","White-label options","Advanced security features"]',
    '{"documents":-1,"compliance_checks":-1,"api_calls":-1,"assistant_messages":-1,"storage_mb":-1}',
    'price_1ST8ZzHSX3RgJL1caXZ7rMKH',
    NULL,  -- No yearly Stripe price ID available yet
    1,
    (SELECT unixepoch() * 1000)
);

-- Update Stripe price IDs to TEST mode prices
-- This migration updates all subscription plans to use TEST mode Stripe price IDs

-- Update Starter plan with TEST price IDs
UPDATE subscription_plans
SET
  stripe_price_id_monthly = 'price_1STRPIHSX3RgJL1cNxEJB1Zu',
  stripe_price_id_yearly = 'price_1STRV1HSX3RgJL1crkUDoEnr',
  price_monthly = 2900,  -- $29.00 in cents
  price_yearly = 27800   -- $278.00 CAD in cents (20% discount)
WHERE name = 'starter';

-- Update Professional plan with TEST price IDs
UPDATE subscription_plans
SET
  stripe_price_id_monthly = 'price_1STRNnHSX3RgJL1cSjc8tuNG',
  stripe_price_id_yearly = 'price_1STRVZHSX3RgJL1csyuIcej8',
  price_monthly = 9900,   -- $99.00 in cents
  price_yearly = 95000    -- $950.00 USD in cents (20% discount)
WHERE name = 'professional';

-- Update Business plan with TEST price IDs
UPDATE subscription_plans
SET
  stripe_price_id_monthly = 'price_1STRK2HSX3RgJL1cMXV95vrl',
  stripe_price_id_yearly = 'price_1STRW4HSX3RgJL1cj0yeyuq3',
  price_monthly = 29900,  -- $299.00 in cents
  price_yearly = 287000   -- $2870.00 CAD in cents (20% discount)
WHERE name = 'business';

-- Update Enterprise plan with TEST price IDs
UPDATE subscription_plans
SET
  stripe_price_id_monthly = 'price_1STREQHSX3RgJL1cIfj5gcBq',
  stripe_price_id_yearly = 'price_1STREQHSX3RgJL1cIfj5gcBq',  -- Using monthly for both since no yearly in CSV
  price_monthly = 199900, -- $1999.00 in cents
  price_yearly = 1999000  -- Estimated yearly (no discount in CSV)
WHERE name = 'enterprise';

-- 5. Update existing plans with workspace limits
UPDATE subscription_plans SET max_workspaces = 3 WHERE id = 'plan_free';
UPDATE subscription_plans SET max_workspaces = 5 WHERE id = 'plan_starter';
UPDATE subscription_plans SET max_workspaces = 20 WHERE id = 'plan_professional';
UPDATE subscription_plans SET max_workspaces = 50 WHERE id = 'plan_business';
UPDATE subscription_plans SET max_workspaces = -1 WHERE id = 'plan_enterprise';