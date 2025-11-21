-- Migration: Unified Notification System
-- Description: Add category, priority, source, AI-specific fields, and actions to notifications
-- Date: 2025-01-20

-- Add new columns to notifications table
ALTER TABLE notifications ADD COLUMN category TEXT DEFAULT 'workspace' CHECK(category IN ('ai', 'workspace', 'system'));
ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE notifications ADD COLUMN source TEXT DEFAULT 'system' CHECK(source IN ('ai_assistant', 'workspace', 'system'));
ALTER TABLE notifications ADD COLUMN workspace_id TEXT;
ALTER TABLE notifications ADD COLUMN ai_session_id TEXT;
ALTER TABLE notifications ADD COLUMN ai_context TEXT; -- JSON: {compliance_framework, issue_count, severity}
ALTER TABLE notifications ADD COLUMN actions TEXT; -- JSON array: [{id, label, action, style}]
ALTER TABLE notifications ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN snoozed_until INTEGER;

-- Update the type constraint to include AI notification types
-- Note: SQLite doesn't support ALTER for CHECK constraints, so we need to track this in application code
-- New types: 'ai_compliance_alert', 'ai_recommendation', 'ai_issue_detected', 'ai_report_ready', 'ai_insight'

-- Add foreign key for workspace_id
-- Note: SQLite doesn't support adding foreign keys via ALTER, so this is enforced at application level

-- Create new indexes for the unified system
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_archived ON notifications(archived);
CREATE INDEX idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX idx_notifications_ai_session ON notifications(ai_session_id);
CREATE INDEX idx_notifications_snoozed ON notifications(snoozed_until);

-- Create composite indexes for common queries
CREATE INDEX idx_notifications_user_category_read ON notifications(user_id, category, read);
CREATE INDEX idx_notifications_workspace_category ON notifications(workspace_id, category);

-- Update notification_preferences for AI Assistant categories
ALTER TABLE notification_preferences ADD COLUMN email_ai_compliance_alert TEXT DEFAULT 'instant' CHECK(email_ai_compliance_alert IN ('instant', 'daily', 'weekly', 'never'));
ALTER TABLE notification_preferences ADD COLUMN email_ai_recommendation TEXT DEFAULT 'daily' CHECK(email_ai_recommendation IN ('instant', 'daily', 'weekly', 'never'));
ALTER TABLE notification_preferences ADD COLUMN email_ai_issue_detected TEXT DEFAULT 'instant' CHECK(email_ai_issue_detected IN ('instant', 'daily', 'weekly', 'never'));
ALTER TABLE notification_preferences ADD COLUMN email_ai_report_ready TEXT DEFAULT 'instant' CHECK(email_ai_report_ready IN ('instant', 'daily', 'weekly', 'never'));
ALTER TABLE notification_preferences ADD COLUMN email_ai_insight TEXT DEFAULT 'weekly' CHECK(email_ai_insight IN ('instant', 'daily', 'weekly', 'never'));

-- Migration note: Existing notification data will have default values:
-- - category: 'workspace' (existing notifications are workspace-related)
-- - priority: 'medium' (safe default)
-- - source: 'system' (existing notifications came from system)
-- - archived: 0 (not archived)
-- All other new fields will be NULL

-- Migration complete marker
SELECT 'Migration 0009 completed successfully' as status;
