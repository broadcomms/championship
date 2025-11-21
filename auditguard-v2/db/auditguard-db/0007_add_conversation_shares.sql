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
-- TRIGGERS (DISABLED FOR D1 COMPATIBILITY)
-- ============================================
-- Note: Cloudflare D1 does not support triggers.
-- These operations must be handled in application code.

-- TODO: Handle in application code:
-- - Update conversation_shares.view_count and last_viewed_at on INSERT to activity_log with type='viewed'
-- - Update conversation_shares.comment_count on INSERT/DELETE to conversation_comments
-- - Set conversation_shares.revoked_at and log activity on is_revoked change
-- - Set conversation_comments.is_edited and edited_at on content UPDATE
-- - Set conversation_comments.deleted_at on is_deleted change
-- - Update conversation_collaboration_settings.updated_at on UPDATE
-- - Update conversation_exports.download_count and last_downloaded_at on download

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

-- Migration complete marker
SELECT 'Migration 0007 completed successfully' as status;
