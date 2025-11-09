-- AuditGuard Core Schema: 11 Tables + JSON Extensions
-- This schema works within Cloudflare D1's 11-table limit
-- Additional data stored as JSON columns (see JSON_IMPLEMENTATION_PLAN.md)

-- ============================================================================
-- TABLE 1: users - Core authentication
-- ============================================================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  email_verified INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- TABLE 2: sessions - User sessions
-- ============================================================================
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- TABLE 3: workspaces - Multi-tenancy foundation
-- JSON EXTENSION: analytics_json (replaces workspace_scores table)
-- ============================================================================
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE,
  owner_id TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  settings TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- JSON EXTENSIONS
  analytics_json TEXT, -- WorkspaceAnalytics: current_score, history
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_created_at ON workspaces(created_at);

-- ============================================================================
-- TABLE 4: workspace_members - Access control
-- ============================================================================
CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  UNIQUE(workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

-- ============================================================================
-- TABLE 5: compliance_frameworks - Framework reference data
-- ============================================================================
CREATE TABLE compliance_frameworks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  version TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  requirements_count INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_compliance_frameworks_category ON compliance_frameworks(category);
CREATE INDEX idx_compliance_frameworks_active ON compliance_frameworks(active);

-- Seed compliance frameworks (13 frameworks)
INSERT INTO compliance_frameworks (id, name, description, version, category, icon, color, requirements_count, active, created_at) VALUES
  ('gdpr', 'GDPR', 'General Data Protection Regulation - EU data privacy law', '2018', 'privacy', '🇪🇺', '#0052CC', 99, 1, strftime('%s', 'now') * 1000),
  ('hipaa', 'HIPAA', 'Health Insurance Portability and Accountability Act', '2013', 'healthcare', '🏥', '#00875A', 164, 1, strftime('%s', 'now') * 1000),
  ('soc2', 'SOC 2', 'System and Organization Controls 2 - Trust service criteria', 'Type II', 'security', '🔒', '#6554C0', 64, 1, strftime('%s', 'now') * 1000),
  ('iso27001', 'ISO 27001', 'Information Security Management System standard', '2013', 'security', '🛡️', '#FF5630', 114, 1, strftime('%s', 'now') * 1000),
  ('pci-dss', 'PCI DSS', 'Payment Card Industry Data Security Standard', 'v4.0', 'financial', '💳', '#00B8D9', 12, 1, strftime('%s', 'now') * 1000),
  ('ccpa', 'CCPA', 'California Consumer Privacy Act', '2020', 'privacy', '🌴', '#36B37E', 7, 1, strftime('%s', 'now') * 1000),
  ('fisma', 'FISMA', 'Federal Information Security Management Act', '2014', 'government', '🏛️', '#6554C0', 17, 1, strftime('%s', 'now') * 1000),
  ('nist', 'NIST CSF', 'National Institute of Standards and Technology Cybersecurity Framework', 'v1.1', 'security', '🔐', '#00875A', 108, 1, strftime('%s', 'now') * 1000),
  ('ferpa', 'FERPA', 'Family Educational Rights and Privacy Act', '2021', 'education', '🎓', '#FF8B00', 4, 1, strftime('%s', 'now') * 1000),
  ('fedramp', 'FedRAMP', 'Federal Risk and Authorization Management Program', 'High', 'government', '🏛️', '#0052CC', 421, 1, strftime('%s', 'now') * 1000),
  ('glba', 'GLBA', 'Gramm-Leach-Bliley Act - Financial privacy', '1999', 'financial', '🏦', '#00B8D9', 3, 1, strftime('%s', 'now') * 1000),
  ('sox', 'SOX', 'Sarbanes-Oxley Act - Financial reporting', '2002', 'financial', '📊', '#6554C0', 11, 1, strftime('%s', 'now') * 1000),
  ('coppa', 'COPPA', 'Children''s Online Privacy Protection Act', '2013', 'privacy', '👶', '#36B37E', 13, 1, strftime('%s', 'now') * 1000);

-- ============================================================================
-- TABLE 6: documents - Document management
-- JSON EXTENSIONS: processing_steps_json, metadata_json
-- ============================================================================
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  upload_status TEXT DEFAULT 'pending',
  processing_status TEXT DEFAULT 'pending',
  s3_key TEXT,
  page_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  character_count INTEGER DEFAULT 0,
  extracted_text TEXT,
  smartbucket_indexed INTEGER DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- JSON EXTENSIONS
  processing_steps_json TEXT, -- ProcessingStep[]: pipeline status tracking
  metadata_json TEXT,          -- Flexible document metadata
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE INDEX idx_documents_workspace_id ON documents(workspace_id);
CREATE INDEX idx_documents_upload_status ON documents(upload_status);
CREATE INDEX idx_documents_processing_status ON documents(processing_status);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- ============================================================================
-- TABLE 7: document_chunks - RAG/Vector search
-- JSON EXTENSION: frameworks_json (replaces document_chunk_frameworks table)
-- ============================================================================
CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  page_number INTEGER,
  created_at INTEGER NOT NULL,
  -- JSON EXTENSION
  frameworks_json TEXT, -- string[]: Array of framework IDs this chunk relates to
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_chunk_index ON document_chunks(document_id, chunk_index);

-- ============================================================================
-- TABLE 8: compliance_checks - Compliance analysis engine
-- JSON EXTENSIONS: issues_json, framework_scores_json
-- ============================================================================
CREATE TABLE compliance_checks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  framework TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  overall_score INTEGER,
  issues_found INTEGER DEFAULT 0,
  recommendations_count INTEGER DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  -- JSON EXTENSIONS
  issues_json TEXT,           -- ComplianceIssue[]: All issues found during this check
  framework_scores_json TEXT, -- FrameworkScores: Per-framework scoring details
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_compliance_checks_document_id ON compliance_checks(document_id);
CREATE INDEX idx_compliance_checks_workspace_id ON compliance_checks(workspace_id);
CREATE INDEX idx_compliance_checks_framework ON compliance_checks(framework);
CREATE INDEX idx_compliance_checks_status ON compliance_checks(status);
CREATE INDEX idx_compliance_checks_created_at ON compliance_checks(created_at);

-- ============================================================================
-- TABLE 9: subscriptions - Billing and usage tracking
-- JSON EXTENSIONS: plan_details_json, usage_json
-- ============================================================================
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'paused')),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start INTEGER NOT NULL,
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- JSON EXTENSIONS
  plan_details_json TEXT, -- PlanDetails: Plan info (name, price, limits, features)
  usage_json TEXT,        -- UsageData: Current usage + history (replaces usage_tracking/usage_summaries)
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_workspace_id ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);

-- ============================================================================
-- TABLE 10: admin_users - Admin access control
-- JSON EXTENSION: permissions_json
-- ============================================================================
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'support')),
  permissions_json TEXT, -- string[]: Array of permission strings for flexible RBAC
  created_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_role ON admin_users(role);

-- Bootstrap super admin (uses default password hash for 'admin123' - CHANGE IN PRODUCTION)
INSERT INTO admin_users (id, user_id, role, permissions_json, created_at, created_by) 
SELECT 
  'adm_' || substr(hex(randomblob(16)), 1, 16),
  id,
  'super_admin',
  '["*"]',
  strftime('%s', 'now') * 1000,
  NULL
FROM users 
WHERE email = 'admin@auditguardx.com'
LIMIT 1;

-- ============================================================================
-- TABLE 11: system_settings - Application configuration
-- JSON EXTENSION: metadata_json
-- ============================================================================
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  value_type TEXT DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  -- JSON EXTENSION
  metadata_json TEXT -- Additional setting metadata (validation rules, etc.)
);

CREATE INDEX idx_system_settings_updated_at ON system_settings(updated_at);

-- Seed default system settings
INSERT INTO system_settings (key, value, description, value_type, updated_at) VALUES
  ('max_upload_size_mb', '100', 'Maximum file upload size in megabytes', 'number', strftime('%s', 'now') * 1000),
  ('chunk_size', '1000', 'Default chunk size for document processing (words)', 'number', strftime('%s', 'now') * 1000),
  ('chunk_overlap', '200', 'Default chunk overlap (words)', 'number', strftime('%s', 'now') * 1000),
  ('maintenance_mode', 'false', 'Enable maintenance mode', 'boolean', strftime('%s', 'now') * 1000);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Total tables: 11 (within D1 limit)
-- Total JSON columns: 12 (storing data from 12+ additional tables)
-- 
-- Tables with JSON extensions:
-- 1. workspaces.analytics_json (replaces workspace_scores)
-- 2. documents.processing_steps_json (replaces document_processing_steps)
-- 3. documents.metadata_json (flexible metadata)
-- 4. document_chunks.frameworks_json (replaces document_chunk_frameworks)
-- 5. compliance_checks.issues_json (replaces compliance_issues)
-- 6. compliance_checks.framework_scores_json (replaces framework_scores)
-- 7. subscriptions.plan_details_json (replaces subscription_plans)
-- 8. subscriptions.usage_json (replaces usage_tracking + usage_summaries)
-- 9. admin_users.permissions_json (flexible RBAC)
-- 10. system_settings.metadata_json (setting metadata)
-- 
-- Tables NOT included (use alternatives):
-- - performance_metrics → Use analytics-smartsql or external service
-- - conversation_sessions/messages → Use assistant-memory (SmartMemory)
-- - admin_audit_log → Store in SmartBucket or external logging service
-- ============================================================================
