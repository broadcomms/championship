-- Migration: 0008_add_assistant_analytics.sql
-- Description: Add comprehensive analytics for AI Assistant usage
-- Date: 2025-01-19
-- AI Compliance Assistant Phase 5: Analytics Dashboard

-- ============================================
-- ASSISTANT ANALYTICS DAILY TABLE
-- ============================================
-- Daily aggregated analytics for AI Assistant usage

CREATE TABLE assistant_analytics_daily (
    id TEXT PRIMARY KEY DEFAULT ('analytics_daily_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    date TEXT NOT NULL,                          -- YYYY-MM-DD format
    
    -- Conversation metrics
    conversations_count INTEGER DEFAULT 0,       -- New conversations started
    messages_count INTEGER DEFAULT 0,            -- Total messages sent
    user_messages_count INTEGER DEFAULT 0,       -- Messages from users
    assistant_messages_count INTEGER DEFAULT 0,  -- Messages from assistant
    
    -- Voice metrics
    voice_interactions_count INTEGER DEFAULT 0,
    voice_input_duration INTEGER DEFAULT 0,      -- Total input duration (ms)
    voice_output_duration INTEGER DEFAULT 0,     -- Total output duration (ms)
    
    -- Performance metrics
    avg_response_time INTEGER DEFAULT 0,         -- Average response time (ms)
    median_response_time INTEGER DEFAULT 0,
    p95_response_time INTEGER DEFAULT 0,         -- 95th percentile
    p99_response_time INTEGER DEFAULT 0,         -- 99th percentile
    
    -- Tool usage
    tool_calls_count INTEGER DEFAULT 0,
    tool_calls_by_type TEXT DEFAULT '{}',        -- JSON: {"toolGetComplianceStatus": 10, ...}
    
    -- User engagement
    active_users_count INTEGER DEFAULT 0,        -- Unique users
    avg_messages_per_conversation REAL DEFAULT 0,
    avg_conversation_duration INTEGER DEFAULT 0, -- In milliseconds
    
    -- Satisfaction metrics
    satisfaction_avg REAL DEFAULT 0,             -- Average rating (1-5)
    satisfaction_count INTEGER DEFAULT 0,        -- Number of ratings
    satisfaction_distribution TEXT DEFAULT '{}', -- JSON: {"1": 2, "2": 5, "3": 10, ...}
    
    -- Token usage
    total_tokens_used INTEGER DEFAULT 0,
    input_tokens_used INTEGER DEFAULT 0,
    output_tokens_used INTEGER DEFAULT 0,
    
    -- Error tracking
    error_count INTEGER DEFAULT 0,
    timeout_count INTEGER DEFAULT 0,
    
    -- Cost estimation (in cents)
    estimated_cost INTEGER DEFAULT 0,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(workspace_id, date),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================
-- ASSISTANT ANALYTICS HOURLY TABLE
-- ============================================
-- Hourly granular analytics for real-time insights

CREATE TABLE assistant_analytics_hourly (
    id TEXT PRIMARY KEY DEFAULT ('analytics_hourly_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,                     -- YYYY-MM-DD HH:00:00 format
    
    -- Basic counts
    conversations_count INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0,
    active_users_count INTEGER DEFAULT 0,
    
    -- Performance
    avg_response_time INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(workspace_id, timestamp),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================
-- USER ANALYTICS TABLE
-- ============================================
-- Per-user analytics for personalization

CREATE TABLE user_analytics (
    id TEXT PRIMARY KEY DEFAULT ('user_analytics_' || lower(hex(randomblob(8)))),
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    
    -- Usage stats
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_voice_interactions INTEGER DEFAULT 0,
    
    -- Engagement
    first_interaction_at INTEGER,
    last_interaction_at INTEGER,
    active_days_count INTEGER DEFAULT 0,
    
    -- Preferences (learned from behavior)
    preferred_frameworks TEXT DEFAULT '[]',      -- JSON array
    common_topics TEXT DEFAULT '[]',             -- JSON array
    avg_session_duration INTEGER DEFAULT 0,
    
    -- Satisfaction
    avg_satisfaction_rating REAL,
    total_ratings_given INTEGER DEFAULT 0,
    
    -- Feature usage
    uses_voice INTEGER DEFAULT 0,
    uses_actions INTEGER DEFAULT 0,
    uses_suggestions INTEGER DEFAULT 0,
    exports_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(user_id, workspace_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================
-- TOOL USAGE ANALYTICS TABLE
-- ============================================
-- Track AI tool function calls

CREATE TABLE tool_usage_analytics (
    id TEXT PRIMARY KEY DEFAULT ('tool_analytics_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    
    -- Tool details
    tool_name TEXT NOT NULL,
    session_id TEXT NOT NULL,
    message_id TEXT,
    
    -- Execution details
    executed_at INTEGER NOT NULL,
    execution_time INTEGER,                      -- Duration in milliseconds
    success INTEGER DEFAULT 1,
    error_message TEXT,
    
    -- Parameters (for analysis)
    parameters TEXT,                             -- JSON object
    result_size INTEGER,                         -- Size of result in bytes
    
    -- User context
    user_id TEXT NOT NULL,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- COMPLIANCE INTELLIGENCE METRICS TABLE
-- ============================================
-- Track how AI Assistant impacts compliance

CREATE TABLE compliance_intelligence_metrics (
    id TEXT PRIMARY KEY DEFAULT ('compliance_intel_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    date TEXT NOT NULL,                          -- YYYY-MM-DD format
    
    -- Issue detection
    issues_discovered INTEGER DEFAULT 0,         -- New issues found via assistant
    issues_resolved INTEGER DEFAULT 0,           -- Issues resolved with assistant help
    
    -- Proactive impact
    proactive_alerts_generated INTEGER DEFAULT 0,
    proactive_alerts_acted_on INTEGER DEFAULT 0,
    
    -- Document insights
    documents_analyzed INTEGER DEFAULT 0,
    compliance_recommendations_generated INTEGER DEFAULT 0,
    recommendations_implemented INTEGER DEFAULT 0,
    
    -- Knowledge base usage
    kb_articles_referenced INTEGER DEFAULT 0,
    kb_articles_helpful INTEGER DEFAULT 0,       -- User indicated helpful
    
    -- Compliance score impact
    avg_score_improvement REAL DEFAULT 0,        -- Average improvement after assistant usage
    workspaces_improved INTEGER DEFAULT 0,       -- Number of workspaces with score increase
    
    -- Time savings (estimated minutes)
    estimated_time_saved INTEGER DEFAULT 0,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(workspace_id, date),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================
-- MESSAGE FEEDBACK TABLE
-- ============================================
-- User feedback on individual messages

CREATE TABLE message_feedback (
    id TEXT PRIMARY KEY DEFAULT ('feedback_' || lower(hex(randomblob(8)))),
    message_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Feedback type
    feedback_type TEXT NOT NULL CHECK(feedback_type IN ('thumbs_up', 'thumbs_down', 'flag', 'helpful', 'not_helpful')),
    
    -- Details
    comment TEXT,
    reason TEXT,                                 -- Predefined reason code
    
    -- Context
    expected_response TEXT,                      -- What user expected to see
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES conversation_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- POPULAR QUERIES TABLE
-- ============================================
-- Track most common questions for insights

CREATE TABLE popular_queries (
    id TEXT PRIMARY KEY DEFAULT ('popular_query_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    
    -- Query details
    query_text TEXT NOT NULL,
    query_normalized TEXT NOT NULL,              -- Normalized version for grouping
    category TEXT,                               -- Auto-categorized
    framework TEXT,                              -- Related framework
    
    -- Frequency
    count INTEGER DEFAULT 1,
    first_asked_at INTEGER NOT NULL,
    last_asked_at INTEGER NOT NULL,
    
    -- Quality
    avg_satisfaction REAL,                       -- Average user satisfaction with answers
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================
-- PERFORMANCE BENCHMARKS TABLE
-- ============================================
-- Track performance over time for optimization

CREATE TABLE performance_benchmarks (
    id TEXT PRIMARY KEY DEFAULT ('benchmark_' || lower(hex(randomblob(8)))),
    
    -- Benchmark details
    operation_type TEXT NOT NULL CHECK(operation_type IN (
        'chat_response',
        'voice_transcription',
        'voice_synthesis',
        'tool_execution',
        'knowledge_search',
        'summary_generation',
        'export_generation'
    )),
    
    -- Timing
    duration INTEGER NOT NULL,                   -- Milliseconds
    timestamp INTEGER NOT NULL,
    
    -- Context
    workspace_id TEXT,
    user_id TEXT,
    session_id TEXT,
    
    -- Metadata
    metadata TEXT,                               -- JSON object with operation-specific details
    
    -- Environment
    model_used TEXT,
    api_version TEXT,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Daily analytics indexes
CREATE INDEX idx_analytics_daily_workspace_date ON assistant_analytics_daily(workspace_id, date DESC);
CREATE INDEX idx_analytics_daily_date ON assistant_analytics_daily(date DESC);

-- Hourly analytics indexes
CREATE INDEX idx_analytics_hourly_workspace_timestamp ON assistant_analytics_hourly(workspace_id, timestamp DESC);
CREATE INDEX idx_analytics_hourly_timestamp ON assistant_analytics_hourly(timestamp DESC);

-- User analytics indexes
CREATE INDEX idx_user_analytics_user ON user_analytics(user_id);
CREATE INDEX idx_user_analytics_workspace ON user_analytics(workspace_id);
CREATE INDEX idx_user_analytics_last_interaction ON user_analytics(last_interaction_at DESC);

-- Tool usage analytics indexes
CREATE INDEX idx_tool_analytics_workspace ON tool_usage_analytics(workspace_id);
CREATE INDEX idx_tool_analytics_tool_name ON tool_usage_analytics(tool_name);
CREATE INDEX idx_tool_analytics_session ON tool_usage_analytics(session_id);
CREATE INDEX idx_tool_analytics_executed ON tool_usage_analytics(executed_at DESC);
CREATE INDEX idx_tool_analytics_success ON tool_usage_analytics(success);

-- Compliance intelligence indexes
CREATE INDEX idx_compliance_intel_workspace_date ON compliance_intelligence_metrics(workspace_id, date DESC);
CREATE INDEX idx_compliance_intel_date ON compliance_intelligence_metrics(date DESC);

-- Message feedback indexes
CREATE INDEX idx_message_feedback_message ON message_feedback(message_id);
CREATE INDEX idx_message_feedback_session ON message_feedback(session_id);
CREATE INDEX idx_message_feedback_user ON message_feedback(user_id);
CREATE INDEX idx_message_feedback_type ON message_feedback(feedback_type);

-- Popular queries indexes
CREATE INDEX idx_popular_queries_workspace ON popular_queries(workspace_id);
CREATE INDEX idx_popular_queries_count ON popular_queries(count DESC);
CREATE INDEX idx_popular_queries_category ON popular_queries(category);
CREATE INDEX idx_popular_queries_framework ON popular_queries(framework);
CREATE INDEX idx_popular_queries_normalized ON popular_queries(query_normalized);

-- Performance benchmarks indexes
CREATE INDEX idx_benchmarks_operation ON performance_benchmarks(operation_type);
CREATE INDEX idx_benchmarks_timestamp ON performance_benchmarks(timestamp DESC);
CREATE INDEX idx_benchmarks_workspace ON performance_benchmarks(workspace_id);
CREATE INDEX idx_benchmarks_duration ON performance_benchmarks(duration);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update analytics timestamp
CREATE TRIGGER update_analytics_daily_timestamp
AFTER UPDATE ON assistant_analytics_daily
BEGIN
    UPDATE assistant_analytics_daily
    SET updated_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- Update user analytics timestamp
CREATE TRIGGER update_user_analytics_timestamp
AFTER UPDATE ON user_analytics
BEGIN
    UPDATE user_analytics
    SET updated_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- Update popular queries timestamp
CREATE TRIGGER update_popular_queries_timestamp
AFTER UPDATE ON popular_queries
BEGIN
    UPDATE popular_queries
    SET updated_at = (unixepoch() * 1000)
    WHERE id = NEW.id;
END;

-- Update user analytics on new conversation
CREATE TRIGGER update_user_analytics_on_conversation
AFTER INSERT ON conversation_sessions
BEGIN
    INSERT INTO user_analytics (user_id, workspace_id, total_conversations, first_interaction_at, last_interaction_at)
    VALUES (
        NEW.user_id,
        NEW.workspace_id,
        1,
        NEW.started_at,
        NEW.started_at
    )
    ON CONFLICT(user_id, workspace_id) DO UPDATE SET
        total_conversations = total_conversations + 1,
        last_interaction_at = NEW.started_at;
END;

-- Update user analytics on new message
CREATE TRIGGER update_user_analytics_on_message
AFTER INSERT ON conversation_messages
WHEN NEW.role = 'user'
BEGIN
    UPDATE user_analytics
    SET total_messages = total_messages + 1,
        last_interaction_at = NEW.created_at
    WHERE user_id = (SELECT user_id FROM conversation_sessions WHERE id = NEW.session_id)
    AND workspace_id = (SELECT workspace_id FROM conversation_sessions WHERE id = NEW.session_id);
END;

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

-- Real-time dashboard metrics view
CREATE VIEW vw_realtime_metrics AS
SELECT 
    workspace_id,
    COUNT(DISTINCT id) as active_conversations,
    COUNT(DISTINCT user_id) as active_users,
    SUM(message_count) as total_messages
FROM conversation_sessions
WHERE last_activity_at > (unixepoch() * 1000) - 3600000  -- Last hour
GROUP BY workspace_id;

-- Weekly performance summary view
CREATE VIEW vw_weekly_performance AS
SELECT 
    workspace_id,
    DATE(date) as week_start,
    SUM(conversations_count) as weekly_conversations,
    SUM(messages_count) as weekly_messages,
    AVG(avg_response_time) as avg_weekly_response_time,
    AVG(satisfaction_avg) as avg_weekly_satisfaction
FROM assistant_analytics_daily
WHERE date >= DATE('now', '-7 days')
GROUP BY workspace_id, week_start;

-- Top tools usage view
CREATE VIEW vw_top_tools AS
SELECT 
    workspace_id,
    tool_name,
    COUNT(*) as usage_count,
    AVG(execution_time) as avg_execution_time,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count
FROM tool_usage_analytics
WHERE executed_at > (unixepoch() * 1000) - 2592000000  -- Last 30 days
GROUP BY workspace_id, tool_name
ORDER BY usage_count DESC;

-- ============================================
-- SEED DATA: INITIALIZE ANALYTICS
-- ============================================

-- Create initial user analytics for all existing users
INSERT INTO user_analytics (user_id, workspace_id)
SELECT DISTINCT cs.user_id, cs.workspace_id
FROM conversation_sessions cs
WHERE NOT EXISTS (
    SELECT 1 FROM user_analytics ua
    WHERE ua.user_id = cs.user_id AND ua.workspace_id = cs.workspace_id
);

-- Create initial daily analytics for today
INSERT INTO assistant_analytics_daily (workspace_id, date)
SELECT DISTINCT workspace_id, DATE('now')
FROM workspaces
WHERE NOT EXISTS (
    SELECT 1 FROM assistant_analytics_daily aad
    WHERE aad.workspace_id = workspaces.id AND aad.date = DATE('now')
);
