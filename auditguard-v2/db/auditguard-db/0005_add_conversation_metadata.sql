-- Migration: 0005_add_conversation_metadata.sql
-- Description: Add advanced conversation management features
-- Date: 2025-01-19
-- AI Compliance Assistant Phase 2: Advanced Thread Management

-- ============================================
-- EXTEND CONVERSATION_SESSIONS TABLE
-- ============================================
-- Add metadata fields for conversation organization

ALTER TABLE conversation_sessions ADD COLUMN title TEXT;
ALTER TABLE conversation_sessions ADD COLUMN summary TEXT;
ALTER TABLE conversation_sessions ADD COLUMN tags TEXT DEFAULT '[]';           -- JSON array of tags
ALTER TABLE conversation_sessions ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE conversation_sessions ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE conversation_sessions ADD COLUMN archived_at INTEGER;
ALTER TABLE conversation_sessions ADD COLUMN last_summary_generated_at INTEGER;
ALTER TABLE conversation_sessions ADD COLUMN token_count INTEGER DEFAULT 0;    -- Total tokens used
ALTER TABLE conversation_sessions ADD COLUMN avg_response_time INTEGER DEFAULT 0; -- Average response time (ms)
ALTER TABLE conversation_sessions ADD COLUMN satisfaction_rating INTEGER CHECK(satisfaction_rating >= 1 AND satisfaction_rating <= 5);
ALTER TABLE conversation_sessions ADD COLUMN satisfaction_comment TEXT;

-- ============================================
-- CONVERSATION TAGS TABLE
-- ============================================
-- Predefined and user-created tags for conversation organization

CREATE TABLE conversation_tags (
    id TEXT PRIMARY KEY DEFAULT ('tag_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',               -- Hex color for UI
    description TEXT,
    is_system INTEGER DEFAULT 0,                 -- System-defined vs user-created
    usage_count INTEGER DEFAULT 0,               -- Number of conversations using this tag
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    created_by TEXT,
    
    UNIQUE(workspace_id, name),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- CONVERSATION SUMMARIES TABLE
-- ============================================
-- AI-generated summaries of conversations

CREATE TABLE conversation_summaries (
    id TEXT PRIMARY KEY DEFAULT ('summary_' || lower(hex(randomblob(8)))),
    session_id TEXT NOT NULL,
    
    -- Summary content
    short_summary TEXT NOT NULL,                 -- 1-2 sentence summary
    detailed_summary TEXT,                       -- Longer summary with key points
    key_topics TEXT NOT NULL DEFAULT '[]',       -- JSON array of key topics discussed
    action_items TEXT DEFAULT '[]',              -- JSON array of action items
    
    -- Metadata
    message_count INTEGER NOT NULL,              -- Number of messages summarized
    token_count INTEGER NOT NULL,                -- Tokens used for summary
    model_used TEXT,                             -- AI model used for summary
    generation_time INTEGER NOT NULL,            -- Time to generate (ms)
    
    -- Quality
    confidence_score REAL,                       -- Confidence in summary quality (0-1)
    
    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE
);

-- ============================================
-- CONVERSATION FOLDERS TABLE
-- ============================================
-- Organize conversations into folders

CREATE TABLE conversation_folders (
    id TEXT PRIMARY KEY DEFAULT ('folder_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    icon TEXT DEFAULT '📁',
    parent_folder_id TEXT,                       -- For nested folders
    
    -- Display order
    sort_order INTEGER DEFAULT 0,
    
    -- Counts
    conversation_count INTEGER DEFAULT 0,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    created_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_folder_id) REFERENCES conversation_folders(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- CONVERSATION FOLDER ASSIGNMENTS TABLE
-- ============================================
-- Many-to-many relationship between conversations and folders

CREATE TABLE conversation_folder_assignments (
    id TEXT PRIMARY KEY DEFAULT ('folder_assign_' || lower(hex(randomblob(8)))),
    session_id TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    
    assigned_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    assigned_by TEXT NOT NULL,
    
    UNIQUE(session_id, folder_id),
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES conversation_folders(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- ============================================
-- CONVERSATION BOOKMARKS TABLE
-- ============================================
-- Bookmark specific messages within conversations

CREATE TABLE conversation_bookmarks (
    id TEXT PRIMARY KEY DEFAULT ('bookmark_' || lower(hex(randomblob(8)))),
    session_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Bookmark details
    note TEXT,                                   -- Optional note about why bookmarked
    color TEXT DEFAULT '#FBBF24',                -- Highlight color
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(user_id, message_id),
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES conversation_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- CONVERSATION SEARCH INDEX (DISABLED FOR D1)
-- ============================================
-- Note: Cloudflare D1 does not support FTS5 virtual tables.
-- Full-text search must be implemented using:
-- - LIKE queries for simple search
-- - External search service (Elasticsearch, Algolia, etc.)
-- - Cloudflare Vectorize for semantic search

-- CREATE VIRTUAL TABLE conversation_search_index USING fts5(
--     session_id UNINDEXED,
--     title,
--     summary,
--     message_content,
--     tags,
--     tokenize = 'porter unicode61'
-- );

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Conversation sessions indexes
CREATE INDEX idx_conversation_sessions_title ON conversation_sessions(title);
CREATE INDEX idx_conversation_sessions_pinned ON conversation_sessions(is_pinned) WHERE is_pinned = 1;
CREATE INDEX idx_conversation_sessions_archived ON conversation_sessions(is_archived);
CREATE INDEX idx_conversation_sessions_workspace_archived ON conversation_sessions(workspace_id, is_archived);
CREATE INDEX idx_conversation_sessions_last_activity ON conversation_sessions(last_activity_at DESC);
CREATE INDEX idx_conversation_sessions_rating ON conversation_sessions(satisfaction_rating) WHERE satisfaction_rating IS NOT NULL;

-- Tags indexes
CREATE INDEX idx_conversation_tags_workspace ON conversation_tags(workspace_id);
CREATE INDEX idx_conversation_tags_name ON conversation_tags(workspace_id, name);
CREATE INDEX idx_conversation_tags_usage ON conversation_tags(usage_count DESC);

-- Summaries indexes
CREATE INDEX idx_conversation_summaries_session ON conversation_summaries(session_id);
CREATE INDEX idx_conversation_summaries_created ON conversation_summaries(created_at DESC);

-- Folders indexes
CREATE INDEX idx_conversation_folders_workspace ON conversation_folders(workspace_id);
CREATE INDEX idx_conversation_folders_parent ON conversation_folders(parent_folder_id);
CREATE INDEX idx_conversation_folders_sort ON conversation_folders(workspace_id, sort_order);

-- Folder assignments indexes
CREATE INDEX idx_folder_assignments_session ON conversation_folder_assignments(session_id);
CREATE INDEX idx_folder_assignments_folder ON conversation_folder_assignments(folder_id);

-- Bookmarks indexes
CREATE INDEX idx_conversation_bookmarks_session ON conversation_bookmarks(session_id);
CREATE INDEX idx_conversation_bookmarks_user ON conversation_bookmarks(user_id);
CREATE INDEX idx_conversation_bookmarks_message ON conversation_bookmarks(message_id);

-- ============================================
-- TRIGGERS (DISABLED FOR D1 COMPATIBILITY)
-- ============================================
-- Note: Cloudflare D1 does not support triggers.
-- These operations must be handled in application code.

-- TODO: Handle in application code:
-- - Update conversation_sessions.last_summary_generated_at and summary on INSERT to conversation_summaries
-- - Update conversation_folders.conversation_count on INSERT/DELETE to conversation_folder_assignments
-- - Update conversation_folders.updated_at on UPDATE
-- - Update conversation_tags.usage_count when session tags change
-- - Populate search index when conversations/messages change (use external search service)
-- - Set conversation_sessions.archived_at when is_archived changes to 1

-- ============================================
-- SEED DATA: SYSTEM TAGS
-- ============================================

-- Insert system tags for all existing workspaces
INSERT INTO conversation_tags (workspace_id, name, color, description, is_system)
SELECT 
    id as workspace_id,
    'GDPR' as name,
    '#3B82F6' as color,
    'GDPR compliance discussions' as description,
    1 as is_system
FROM workspaces;

INSERT INTO conversation_tags (workspace_id, name, color, description, is_system)
SELECT 
    id as workspace_id,
    'SOC2' as name,
    '#8B5CF6' as color,
    'SOC 2 compliance discussions' as description,
    1 as is_system
FROM workspaces;

INSERT INTO conversation_tags (workspace_id, name, color, description, is_system)
SELECT 
    id as workspace_id,
    'HIPAA' as name,
    '#10B981' as color,
    'HIPAA compliance discussions' as description,
    1 as is_system
FROM workspaces;

INSERT INTO conversation_tags (workspace_id, name, color, description, is_system)
SELECT 
    id as workspace_id,
    'ISO 27001' as name,
    '#F59E0B' as color,
    'ISO 27001 discussions' as description,
    1 as is_system
FROM workspaces;

INSERT INTO conversation_tags (workspace_id, name, color, description, is_system)
SELECT 
    id as workspace_id,
    'NIST CSF' as name,
    '#EF4444' as color,
    'NIST CSF discussions' as description,
    1 as is_system
FROM workspaces;

INSERT INTO conversation_tags (workspace_id, name, color, description, is_system)
SELECT 
    id as workspace_id,
    'General' as name,
    '#6B7280' as color,
    'General compliance questions' as description,
    1 as is_system
FROM workspaces;

INSERT INTO conversation_tags (workspace_id, name, color, description, is_system)
SELECT 
    id as workspace_id,
    'Urgent' as name,
    '#DC2626' as color,
    'Urgent compliance issues' as description,
    1 as is_system
FROM workspaces;

-- ============================================
-- DATA MIGRATION
-- ============================================

-- Generate titles for existing conversations based on first message
UPDATE conversation_sessions
SET title = (
    SELECT SUBSTR(content, 1, 100)
    FROM conversation_messages
    WHERE session_id = conversation_sessions.id
    AND role = 'user'
    ORDER BY created_at ASC
    LIMIT 1
)
WHERE title IS NULL;

-- Set default title for conversations without messages
UPDATE conversation_sessions
SET title = 'Untitled Conversation'
WHERE title IS NULL OR title = '';
