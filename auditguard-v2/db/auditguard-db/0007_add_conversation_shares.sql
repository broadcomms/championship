-- Migration: 0007_add_conversation_shares.sql
-- Description: Add conversation sharing and collaboration features
-- Date: 2025-01-19
-- AI Compliance Assistant Phase 3: Export & Sharing

-- ============================================
-- CONVERSATION SHARES TABLE
-- ============================================
-- Share conversations with team members and external users

CREATE TABLE conversation_shares (
    id TEXT PRIMARY KEY DEFAULT ('share_' || lower(hex(randomblob(8)))),
    session_id TEXT NOT NULL,
    
    -- Sharing details
    shared_by TEXT NOT NULL,                     -- User who shared
    shared_with TEXT,                            -- User ID (internal) or NULL (public link)
    shared_with_email TEXT,                      -- Email for external shares
    
    -- Access control
    permission TEXT NOT NULL CHECK(permission IN ('view', 'comment', 'edit')),
    access_type TEXT NOT NULL DEFAULT 'private' CHECK(access_type IN ('private', 'workspace', 'public')),
    
    -- Public link settings
    share_token TEXT UNIQUE,                     -- Token for public share links
    require_password INTEGER DEFAULT 0,
    password_hash TEXT,
    
    -- Expiration
    expires_at INTEGER,
    is_revoked INTEGER DEFAULT 0,
    revoked_at INTEGER,
    revoked_by TEXT,
    
    -- Usage tracking
    view_count INTEGER DEFAULT 0,
    last_viewed_at INTEGER,
    comment_count INTEGER DEFAULT 0,
    
    -- Notification settings
    notify_on_view INTEGER DEFAULT 0,
    notify_on_comment INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users(id),
    FOREIGN KEY (shared_with) REFERENCES users(id),
    FOREIGN KEY (revoked_by) REFERENCES users(id)
);

-- ============================================
-- CONVERSATION COMMENTS TABLE
-- ============================================
-- Comments on shared conversations

CREATE TABLE conversation_comments (
    id TEXT PRIMARY KEY DEFAULT ('comment_' || lower(hex(randomblob(8)))),
    session_id TEXT NOT NULL,
    message_id TEXT,                             -- Specific message being commented on (NULL = general comment)
    
    -- Comment details
    author_id TEXT,                              -- NULL if external commenter
    author_email TEXT,                           -- For external commenters
    author_name TEXT,                            -- For external commenters
    content TEXT NOT NULL,
    
    -- Thread structure
    parent_comment_id TEXT,                      -- For nested comments/replies
    thread_depth INTEGER DEFAULT 0,
    
    -- Status
    is_edited INTEGER DEFAULT 0,
    edited_at INTEGER,
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    
    -- Reactions
    reactions TEXT DEFAULT '{}',                 -- JSON object: {"👍": 5, "❤️": 3, ...}
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES conversation_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (parent_comment_id) REFERENCES conversation_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (deleted_by) REFERENCES users(id)
);

-- ============================================
-- CONVERSATION EXPORTS TABLE
-- ============================================
-- Track conversation exports

CREATE TABLE conversation_exports (
    id TEXT PRIMARY KEY DEFAULT ('export_' || lower(hex(randomblob(8)))),
    session_id TEXT NOT NULL,
    
    -- Export details
    format TEXT NOT NULL CHECK(format IN ('pdf', 'markdown', 'json', 'html', 'docx')),
    requested_by TEXT NOT NULL,
    
    -- Options
    include_metadata INTEGER DEFAULT 1,
    include_timestamps INTEGER DEFAULT 1,
    include_actions INTEGER DEFAULT 1,
    include_system_messages INTEGER DEFAULT 0,
    
    -- Processing
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    processing_started_at INTEGER,
    processing_completed_at INTEGER,
    processing_time INTEGER,                     -- Duration in milliseconds
    
    -- Output
    file_size INTEGER,                           -- In bytes
    storage_key TEXT,                            -- Vultr Object Storage key
    download_url TEXT,                           -- Signed URL for download
    url_expires_at INTEGER,                      -- When download URL expires
    
    -- Error tracking
    error_message TEXT,
    
    -- Analytics
    downloaded INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at INTEGER,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id)
);

-- ============================================
-- CONVERSATION SHARE ACTIVITY LOG
-- ============================================
-- Audit log for share-related activities

CREATE TABLE conversation_share_activity_log (
    id TEXT PRIMARY KEY DEFAULT ('share_activity_' || lower(hex(randomblob(8)))),
    share_id TEXT NOT NULL,
    
    -- Activity details
    activity_type TEXT NOT NULL CHECK(activity_type IN (
        'shared',
        'viewed',
        'commented',
        'edited',
        'permission_changed',
        'revoked',
        'expired',
        'password_changed'
    )),
    
    -- Actor
    actor_id TEXT,                               -- User who performed action (NULL if anonymous)
    actor_email TEXT,                            -- For anonymous viewers
    actor_ip TEXT,                               -- IP address
    
    -- Metadata
    metadata TEXT,                               -- JSON object with activity-specific data
    user_agent TEXT,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (share_id) REFERENCES conversation_shares(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id)
);

-- ============================================
-- CONVERSATION COLLABORATION SETTINGS
-- ============================================
-- Workspace-level settings for collaboration

CREATE TABLE conversation_collaboration_settings (
    id TEXT PRIMARY KEY DEFAULT ('collab_settings_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL UNIQUE,
    
    -- Feature toggles
    allow_sharing INTEGER DEFAULT 1,
    allow_public_shares INTEGER DEFAULT 1,
    allow_external_comments INTEGER DEFAULT 1,
    
    -- Default settings
    default_share_expiration INTEGER DEFAULT 2592000000,  -- 30 days in milliseconds
    default_share_permission TEXT DEFAULT 'view' CHECK(default_share_permission IN ('view', 'comment', 'edit')),
    require_password_for_public INTEGER DEFAULT 0,
    
    -- Security
    allowed_domains TEXT DEFAULT '[]',           -- JSON array of allowed email domains for sharing
    block_domains TEXT DEFAULT '[]',             -- JSON array of blocked domains
    
    -- Notifications
    notify_on_share INTEGER DEFAULT 1,
    notify_on_comment INTEGER DEFAULT 1,
    
    -- Audit settings
    log_all_access INTEGER DEFAULT 1,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Conversation shares indexes
CREATE INDEX idx_conversation_shares_session ON conversation_shares(session_id);
CREATE INDEX idx_conversation_shares_shared_by ON conversation_shares(shared_by);
CREATE INDEX idx_conversation_shares_shared_with ON conversation_shares(shared_with);
CREATE INDEX idx_conversation_shares_token ON conversation_shares(share_token);
CREATE INDEX idx_conversation_shares_expires ON conversation_shares(expires_at);
CREATE INDEX idx_conversation_shares_revoked ON conversation_shares(is_revoked);
CREATE INDEX idx_conversation_shares_access_type ON conversation_shares(access_type);

-- Comments indexes
CREATE INDEX idx_conversation_comments_session ON conversation_comments(session_id);
CREATE INDEX idx_conversation_comments_message ON conversation_comments(message_id);
CREATE INDEX idx_conversation_comments_author ON conversation_comments(author_id);
CREATE INDEX idx_conversation_comments_parent ON conversation_comments(parent_comment_id);
CREATE INDEX idx_conversation_comments_created ON conversation_comments(created_at DESC);
CREATE INDEX idx_conversation_comments_deleted ON conversation_comments(is_deleted);

-- Exports indexes
CREATE INDEX idx_conversation_exports_session ON conversation_exports(session_id);
CREATE INDEX idx_conversation_exports_requested_by ON conversation_exports(requested_by);
CREATE INDEX idx_conversation_exports_status ON conversation_exports(status);
CREATE INDEX idx_conversation_exports_created ON conversation_exports(created_at DESC);

-- Activity log indexes
CREATE INDEX idx_share_activity_share ON conversation_share_activity_log(share_id);
CREATE INDEX idx_share_activity_actor ON conversation_share_activity_log(actor_id);
CREATE INDEX idx_share_activity_type ON conversation_share_activity_log(activity_type);
CREATE INDEX idx_share_activity_created ON conversation_share_activity_log(created_at DESC);

-- Collaboration settings indexes
CREATE INDEX idx_collab_settings_workspace ON conversation_collaboration_settings(workspace_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update share view count
CREATE TRIGGER increment_share_view_count
AFTER INSERT ON conversation_share_activity_log
WHEN NEW.activity_type = 'viewed'
BEGIN
    UPDATE conversation_shares
    SET view_count = view_count + 1,
        last_viewed_at = (unixepoch() * 1000)
    WHERE id = NEW.share_id;
END;

-- Update share comment count
CREATE TRIGGER increment_share_comment_count
AFTER INSERT ON conversation_comments
BEGIN
    UPDATE conversation_shares
    SET comment_count = comment_count + 1
    WHERE session_id = NEW.session_id;
END;

CREATE TRIGGER decrement_share_comment_count
AFTER DELETE ON conversation_comments
BEGIN
    UPDATE conversation_shares
    SET comment_count = comment_count - 1
    WHERE session_id = OLD.session_id;
END;

-- Set revoked timestamp
CREATE TRIGGER set_share_revoked_timestamp
AFTER UPDATE OF is_revoked ON conversation_shares
WHEN NEW.is_revoked = 1 AND OLD.is_revoked = 0
BEGIN
    UPDATE conversation_shares
    SET revoked_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
    
    -- Log revocation
    INSERT INTO conversation_share_activity_log (share_id, activity_type, actor_id)
    VALUES (NEW.id, 'revoked', NEW.revoked_by);
END;

-- Set comment edited timestamp
CREATE TRIGGER set_comment_edited_timestamp
AFTER UPDATE OF content ON conversation_comments
WHEN NEW.is_edited = 0
BEGIN
    UPDATE conversation_comments
    SET is_edited = 1,
        edited_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- Set comment deleted timestamp
CREATE TRIGGER set_comment_deleted_timestamp
AFTER UPDATE OF is_deleted ON conversation_comments
WHEN NEW.is_deleted = 1 AND OLD.is_deleted = 0
BEGIN
    UPDATE conversation_comments
    SET deleted_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- Update collaboration settings timestamp
CREATE TRIGGER update_collab_settings_timestamp
AFTER UPDATE ON conversation_collaboration_settings
BEGIN
    UPDATE conversation_collaboration_settings
    SET updated_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- Increment export download count
CREATE TRIGGER increment_export_download_count
AFTER UPDATE OF downloaded ON conversation_exports
WHEN NEW.downloaded = 1 AND OLD.downloaded = 0
BEGIN
    UPDATE conversation_exports
    SET download_count = download_count + 1,
        last_downloaded_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- ============================================
-- SEED DATA: DEFAULT COLLABORATION SETTINGS
-- ============================================

-- Create default collaboration settings for all workspaces
INSERT INTO conversation_collaboration_settings (workspace_id)
SELECT id FROM workspaces
WHERE NOT EXISTS (
    SELECT 1 FROM conversation_collaboration_settings ccs
    WHERE ccs.workspace_id = workspaces.id
);

-- ============================================
-- FUNCTIONS (SQLite doesn't support functions, but documenting logic)
-- ============================================

-- Generate share token: 'share_' || lower(hex(randomblob(16)))
-- Example usage in application:
-- INSERT INTO conversation_shares (..., share_token) 
-- VALUES (..., 'share_' || lower(hex(randomblob(16))));

-- Password verification: Use bcrypt in application layer
-- Check expiration: WHERE expires_at IS NULL OR expires_at > (unixepoch() * 1000)
-- Check revoked: WHERE is_revoked = 0
