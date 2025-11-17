-- Notifications table (in-app notifications for users)
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN (
        'issue_assigned',
        'comment',
        'mention',
        'status_change',
        'workspace_invite',
        'due_date_reminder',
        'overdue_alert'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    action_url TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    read_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);

-- Notification preferences table (user-specific notification settings)
CREATE TABLE notification_preferences (
    user_id TEXT PRIMARY KEY,
    email_issue_assigned TEXT NOT NULL DEFAULT 'instant' CHECK(email_issue_assigned IN ('instant', 'daily', 'weekly', 'never')),
    email_comments TEXT NOT NULL DEFAULT 'instant' CHECK(email_comments IN ('instant', 'daily', 'weekly', 'never')),
    email_mentions TEXT NOT NULL DEFAULT 'instant' CHECK(email_mentions IN ('instant', 'daily', 'weekly', 'never')),
    email_due_date TEXT NOT NULL DEFAULT 'instant' CHECK(email_due_date IN ('instant', 'daily', 'weekly', 'never')),
    email_status_change TEXT NOT NULL DEFAULT 'daily' CHECK(email_status_change IN ('instant', 'daily', 'weekly', 'never')),
    in_app_enabled INTEGER NOT NULL DEFAULT 1,
    in_app_sound INTEGER NOT NULL DEFAULT 1,
    browser_push_enabled INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);
