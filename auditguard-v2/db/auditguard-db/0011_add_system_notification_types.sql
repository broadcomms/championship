-- Migration: Add System Notification Types
-- Description: Update notifications table to support system notification types (welcome, trial, subscription, payment)
-- Date: 2025-11-23

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the table with the updated constraint

-- Step 1: Create new notifications table with updated type constraint
CREATE TABLE notifications_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN (
        -- Workspace notifications
        'issue_assigned',
        'comment',
        'mention',
        'status_change',
        'workspace_invite',
        'due_date_reminder',
        'overdue_alert',
        -- AI notifications
        'ai_compliance_alert',
        'ai_recommendation',
        'ai_issue_detected',
        'ai_report_ready',
        'ai_insight',
        -- System notifications
        'welcome',
        'trial_started',
        'trial_warning',
        'trial_expired',
        'subscription_created',
        'subscription_updated',
        'subscription_canceled',
        'payment_succeeded',
        'payment_failed',
        'invoice_ready'
    )),
    category TEXT DEFAULT 'workspace' CHECK(category IN ('ai', 'workspace', 'system')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    source TEXT DEFAULT 'system' CHECK(source IN ('ai_assistant', 'workspace', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    action_url TEXT NOT NULL,
    workspace_id TEXT,
    ai_session_id TEXT,
    ai_context TEXT,
    actions TEXT,
    metadata TEXT,
    snoozed_until INTEGER,
    created_at INTEGER NOT NULL,
    read_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Step 2: Copy all existing data
INSERT INTO notifications_new 
SELECT 
    id,
    user_id,
    type,
    category,
    priority,
    source,
    title,
    message,
    read,
    archived,
    action_url,
    workspace_id,
    ai_session_id,
    ai_context,
    actions,
    metadata,
    snoozed_until,
    created_at,
    read_at
FROM notifications;

-- Step 3: Drop old table
DROP TABLE notifications;

-- Step 4: Rename new table
ALTER TABLE notifications_new RENAME TO notifications;

-- Step 5: Recreate all indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_archived ON notifications(archived);
CREATE INDEX idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX idx_notifications_ai_session ON notifications(ai_session_id);
CREATE INDEX idx_notifications_snoozed ON notifications(snoozed_until);
CREATE INDEX idx_notifications_user_category_read ON notifications(user_id, category, read);
CREATE INDEX idx_notifications_workspace_category ON notifications(workspace_id, category);

-- Migration complete marker
SELECT 'Migration 0011 completed successfully' as status;
