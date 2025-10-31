-- Phase 4: Smart Assistant & Advanced Features Schema

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

-- Indexes for performance
CREATE INDEX idx_conversation_sessions_workspace ON conversation_sessions(workspace_id);
CREATE INDEX idx_conversation_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_conversation_messages_session ON conversation_messages(session_id);
CREATE INDEX idx_conversation_messages_created ON conversation_messages(created_at);
