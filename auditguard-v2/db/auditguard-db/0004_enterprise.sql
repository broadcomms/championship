-- Phase 5: Enterprise Features Schema

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

-- Usage tracking
CREATE TABLE usage_tracking (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL, -- 'api_call', 'document', 'compliance_check', 'assistant_message'
    resource_id TEXT,
    user_id TEXT REFERENCES users(id),
    metadata TEXT, -- JSON for additional context
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

-- Admin users (platform admins)
CREATE TABLE admin_users (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('super_admin', 'support', 'billing_admin')),
    permissions TEXT NOT NULL, -- JSON array
    created_at INTEGER NOT NULL,
    created_by TEXT REFERENCES users(id)
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

-- Indexes for performance
CREATE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_usage_tracking_workspace ON usage_tracking(workspace_id);
CREATE INDEX idx_usage_tracking_tracked_at ON usage_tracking(tracked_at);
CREATE INDEX idx_usage_tracking_resource_type ON usage_tracking(resource_type);
CREATE INDEX idx_usage_summaries_workspace_date ON usage_summaries(workspace_id, date);
CREATE INDEX idx_admin_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at);

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
    strftime('%s', 'now') * 1000
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
    strftime('%s', 'now') * 1000
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
    strftime('%s', 'now') * 1000
);

-- Insert default system settings
INSERT INTO system_settings (key, value, value_type, description, updated_at) VALUES
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode to prevent access', strftime('%s', 'now') * 1000),
('default_plan', 'plan_free', 'string', 'Default plan for new workspaces', strftime('%s', 'now') * 1000),
('trial_period_days', '14', 'number', 'Trial period duration in days', strftime('%s', 'now') * 1000),
('max_workspaces_per_user', '5', 'number', 'Maximum workspaces a user can own', strftime('%s', 'now') * 1000);
