-- Migration: 0006_add_proactive_notifications.sql
-- Description: Add proactive compliance monitoring and notifications
-- Date: 2025-01-19
-- AI Compliance Assistant Phase 4: Proactive Monitoring

-- ============================================
-- PROACTIVE NOTIFICATIONS TABLE
-- ============================================
-- AI-generated proactive compliance alerts and recommendations

CREATE TABLE proactive_notifications (
    id TEXT PRIMARY KEY DEFAULT ('proactive_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    
    -- Notification classification
    type TEXT NOT NULL CHECK(type IN (
        'compliance_drift',          -- Compliance score trending downward
        'new_regulation',            -- New regulation detected
        'upcoming_deadline',         -- Deadline approaching
        'risk_detected',             -- New risk identified
        'recommendation',            -- Best practice recommendation
        'anomaly',                   -- Unusual activity detected
        'missing_documentation',     -- Required documentation missing
        'framework_update'           -- Framework requirements updated
    )),
    
    severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    detailed_analysis TEXT,
    
    -- Context
    framework TEXT,                              -- Related compliance framework
    affected_documents TEXT DEFAULT '[]',        -- JSON array of document IDs
    affected_issues TEXT DEFAULT '[]',           -- JSON array of issue IDs
    
    -- Action items
    action_items TEXT DEFAULT '[]',              -- JSON array of recommended actions
    primary_action TEXT,                         -- Primary CTA action type
    primary_action_url TEXT,                     -- URL for primary action
    
    -- Trend data
    trend_data TEXT,                             -- JSON object with trend information
    score_change INTEGER,                        -- Change in compliance score (if applicable)
    
    -- AI metadata
    confidence REAL CHECK(confidence >= 0 AND confidence <= 1),
    model_used TEXT,
    generation_time INTEGER,                     -- Time to generate (ms)
    
    -- Status
    is_read INTEGER DEFAULT 0,
    is_dismissed INTEGER DEFAULT 0,
    dismissed_at INTEGER,
    dismissed_by TEXT,
    dismissal_reason TEXT,
    
    -- Actions taken
    action_taken TEXT,                           -- Description of action user took
    action_taken_at INTEGER,
    action_taken_by TEXT,
    
    -- Expiration
    expires_at INTEGER,                          -- When notification becomes irrelevant
    
    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (dismissed_by) REFERENCES users(id),
    FOREIGN KEY (action_taken_by) REFERENCES users(id)
);

-- ============================================
-- PROACTIVE MONITORING SETTINGS TABLE
-- ============================================
-- User preferences for proactive monitoring

CREATE TABLE proactive_monitoring_settings (
    id TEXT PRIMARY KEY DEFAULT ('proactive_settings_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Feature toggles
    enabled INTEGER DEFAULT 1,
    
    -- Notification preferences by type
    notify_compliance_drift INTEGER DEFAULT 1,
    notify_new_regulation INTEGER DEFAULT 1,
    notify_upcoming_deadline INTEGER DEFAULT 1,
    notify_risk_detected INTEGER DEFAULT 1,
    notify_recommendation INTEGER DEFAULT 1,
    notify_anomaly INTEGER DEFAULT 1,
    notify_missing_documentation INTEGER DEFAULT 1,
    notify_framework_update INTEGER DEFAULT 1,
    
    -- Severity thresholds (minimum severity to notify)
    min_severity TEXT DEFAULT 'medium' CHECK(min_severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Delivery preferences
    email_notifications INTEGER DEFAULT 1,
    in_app_notifications INTEGER DEFAULT 1,
    notification_frequency TEXT DEFAULT 'immediate' CHECK(notification_frequency IN (
        'immediate',                             -- As they occur
        'hourly',                                -- Hourly digest
        'daily',                                 -- Daily digest
        'weekly'                                 -- Weekly digest
    )),
    
    -- Quiet hours
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start TEXT DEFAULT '22:00',      -- HH:MM format
    quiet_hours_end TEXT DEFAULT '08:00',        -- HH:MM format
    quiet_hours_timezone TEXT DEFAULT 'UTC',
    
    -- Framework-specific settings
    monitored_frameworks TEXT DEFAULT '[]',      -- JSON array, empty = all frameworks
    
    -- Schedule settings
    check_frequency TEXT DEFAULT 'daily' CHECK(check_frequency IN ('hourly', 'daily', 'weekly')),
    last_check_at INTEGER,
    next_check_at INTEGER,
    
    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(workspace_id, user_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- PROACTIVE MONITORING JOBS TABLE
-- ============================================
-- Track scheduled monitoring jobs and their results

CREATE TABLE proactive_monitoring_jobs (
    id TEXT PRIMARY KEY DEFAULT ('proactive_job_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    
    -- Job details
    job_type TEXT NOT NULL CHECK(job_type IN (
        'compliance_analysis',
        'risk_assessment',
        'trend_analysis',
        'deadline_check',
        'documentation_audit',
        'framework_sync'
    )),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    
    -- Timing
    started_at INTEGER,
    completed_at INTEGER,
    duration INTEGER,                            -- Duration in milliseconds
    
    -- Results
    notifications_generated INTEGER DEFAULT 0,
    issues_detected INTEGER DEFAULT 0,
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    triggered_by TEXT CHECK(triggered_by IN ('schedule', 'manual', 'event', 'api')),
    triggered_by_user TEXT,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (triggered_by_user) REFERENCES users(id)
);

-- ============================================
-- PROACTIVE NOTIFICATION DELIVERY LOG
-- ============================================
-- Track notification delivery attempts

CREATE TABLE proactive_notification_delivery_log (
    id TEXT PRIMARY KEY DEFAULT ('delivery_log_' || lower(hex(randomblob(8)))),
    notification_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Delivery details
    delivery_method TEXT NOT NULL CHECK(delivery_method IN ('in_app', 'email', 'webhook')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    
    -- Timing
    attempted_at INTEGER NOT NULL,
    delivered_at INTEGER,
    
    -- Engagement
    opened_at INTEGER,
    clicked_at INTEGER,
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Email-specific
    email_address TEXT,
    message_id TEXT,                             -- Email service message ID
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (notification_id) REFERENCES proactive_notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- COMPLIANCE TRENDS TABLE
-- ============================================
-- Historical compliance scores for trend analysis

CREATE TABLE compliance_trends (
    id TEXT PRIMARY KEY DEFAULT ('trend_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    
    -- Score data
    date TEXT NOT NULL,                          -- YYYY-MM-DD
    overall_score INTEGER NOT NULL,
    
    -- Framework-specific scores
    framework_scores TEXT NOT NULL DEFAULT '{}', -- JSON object: {"gdpr": 85, "soc2": 90, ...}
    
    -- Issue counts
    critical_issues INTEGER DEFAULT 0,
    high_issues INTEGER DEFAULT 0,
    medium_issues INTEGER DEFAULT 0,
    low_issues INTEGER DEFAULT 0,
    
    -- Document stats
    total_documents INTEGER DEFAULT 0,
    documents_checked INTEGER DEFAULT 0,
    
    -- Metadata
    data_source TEXT CHECK(data_source IN ('snapshot', 'calculated', 'imported')),
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(workspace_id, date),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Proactive notifications indexes
CREATE INDEX idx_proactive_notifications_workspace ON proactive_notifications(workspace_id);
CREATE INDEX idx_proactive_notifications_type ON proactive_notifications(type);
CREATE INDEX idx_proactive_notifications_severity ON proactive_notifications(severity);
CREATE INDEX idx_proactive_notifications_framework ON proactive_notifications(framework);
CREATE INDEX idx_proactive_notifications_read ON proactive_notifications(is_read, workspace_id);
CREATE INDEX idx_proactive_notifications_dismissed ON proactive_notifications(is_dismissed);
CREATE INDEX idx_proactive_notifications_created ON proactive_notifications(created_at DESC);
CREATE INDEX idx_proactive_notifications_expires ON proactive_notifications(expires_at);
CREATE INDEX idx_proactive_notifications_unread ON proactive_notifications(workspace_id, is_read) WHERE is_read = 0;

-- Monitoring settings indexes
CREATE INDEX idx_proactive_settings_workspace ON proactive_monitoring_settings(workspace_id);
CREATE INDEX idx_proactive_settings_user ON proactive_monitoring_settings(user_id);
CREATE INDEX idx_proactive_settings_next_check ON proactive_monitoring_settings(next_check_at);

-- Monitoring jobs indexes
CREATE INDEX idx_proactive_jobs_workspace ON proactive_monitoring_jobs(workspace_id);
CREATE INDEX idx_proactive_jobs_status ON proactive_monitoring_jobs(status);
CREATE INDEX idx_proactive_jobs_created ON proactive_monitoring_jobs(created_at DESC);

-- Delivery log indexes
CREATE INDEX idx_delivery_log_notification ON proactive_notification_delivery_log(notification_id);
CREATE INDEX idx_delivery_log_user ON proactive_notification_delivery_log(user_id);
CREATE INDEX idx_delivery_log_status ON proactive_notification_delivery_log(status);
CREATE INDEX idx_delivery_log_engagement ON proactive_notification_delivery_log(opened_at, clicked_at);

-- Compliance trends indexes
CREATE INDEX idx_compliance_trends_workspace_date ON compliance_trends(workspace_id, date DESC);
CREATE INDEX idx_compliance_trends_date ON compliance_trends(date DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update monitoring settings timestamp
CREATE TRIGGER update_proactive_settings_timestamp
AFTER UPDATE ON proactive_monitoring_settings
BEGIN
    UPDATE proactive_monitoring_settings
    SET updated_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- Set dismissal timestamp
CREATE TRIGGER set_notification_dismissal_timestamp
AFTER UPDATE OF is_dismissed ON proactive_notifications
WHEN NEW.is_dismissed = 1 AND OLD.is_dismissed = 0
BEGIN
    UPDATE proactive_notifications
    SET dismissed_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- Set action taken timestamp
CREATE TRIGGER set_notification_action_timestamp
AFTER UPDATE OF action_taken ON proactive_notifications
WHEN NEW.action_taken IS NOT NULL AND OLD.action_taken IS NULL
BEGIN
    UPDATE proactive_notifications
    SET action_taken_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- ============================================
-- SEED DATA: DEFAULT SETTINGS
-- ============================================

-- Create default monitoring settings for all workspace owners
INSERT INTO proactive_monitoring_settings (workspace_id, user_id)
SELECT w.id as workspace_id, w.owner_id as user_id
FROM workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM proactive_monitoring_settings pms
    WHERE pms.workspace_id = w.id AND pms.user_id = w.owner_id
);

-- ============================================
-- INITIAL COMPLIANCE TREND SNAPSHOT
-- ============================================

-- Create initial trend snapshot for workspaces with existing data
INSERT INTO compliance_trends (workspace_id, date, overall_score, framework_scores, critical_issues, high_issues, medium_issues, low_issues, total_documents, documents_checked, data_source)
SELECT 
    ws.workspace_id,
    DATE('now') as date,
    ws.overall_score,
    '{}' as framework_scores,
    ws.critical_issues,
    ws.high_issues,
    ws.medium_issues,
    ws.low_issues,
    ws.total_documents,
    ws.documents_checked,
    'snapshot' as data_source
FROM workspace_scores ws
WHERE ws.id IN (
    SELECT id FROM workspace_scores
    WHERE calculated_at = (
        SELECT MAX(calculated_at)
        FROM workspace_scores ws2
        WHERE ws2.workspace_id = ws.workspace_id
    )
)
ON CONFLICT(workspace_id, date) DO NOTHING;
