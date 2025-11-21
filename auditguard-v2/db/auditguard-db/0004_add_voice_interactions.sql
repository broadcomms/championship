-- Migration: 0004_add_voice_interactions.sql
-- Description: Add voice chat capabilities with ElevenLabs integration
-- Date: 2025-01-19
-- AI Compliance Assistant Phase 1: Voice Chat Integration

-- ============================================
-- VOICE INTERACTIONS TABLE
-- ============================================
-- Stores voice interaction metadata and links to audio files
-- Audio files stored in Vultr Object Storage (S3-compatible)

CREATE TABLE voice_interactions (
    id TEXT PRIMARY KEY DEFAULT ('voice_' || lower(hex(randomblob(8)))),
    session_id TEXT NOT NULL,
    
    -- Audio storage (Vultr Object Storage keys)
    audio_input_key TEXT NOT NULL,              -- S3/R2 key for user's audio input
    audio_output_key TEXT NOT NULL,             -- S3/R2 key for AI's audio response
    
    -- Transcription and synthesis metadata
    transcription TEXT NOT NULL,                -- User's speech-to-text result
    synthesis_text TEXT NOT NULL,               -- Text sent to TTS
    voice_id TEXT NOT NULL,                     -- ElevenLabs voice ID used
    
    -- Duration tracking
    input_duration INTEGER NOT NULL,            -- Input audio duration (milliseconds)
    output_duration INTEGER NOT NULL,           -- Output audio duration (milliseconds)
    
    -- Processing timestamps
    transcription_started_at INTEGER NOT NULL,
    transcription_completed_at INTEGER NOT NULL,
    synthesis_started_at INTEGER NOT NULL,
    synthesis_completed_at INTEGER NOT NULL,
    
    -- Quality metrics
    transcription_confidence REAL,              -- Confidence score (0-1)
    synthesis_quality TEXT CHECK(synthesis_quality IN ('low', 'medium', 'high')),
    
    -- Error tracking
    transcription_error TEXT,
    synthesis_error TEXT,
    
    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE
);

-- ============================================
-- VOICE PREFERENCES TABLE
-- ============================================
-- User-specific voice settings and preferences

CREATE TABLE voice_preferences (
    id TEXT PRIMARY KEY DEFAULT ('voiceprefs_' || lower(hex(randomblob(8)))),
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    
    -- Voice selection
    preferred_voice_id TEXT DEFAULT '21m00Tcm4TlvDq8ikWAM',  -- ElevenLabs Rachel (default)
    voice_stability REAL DEFAULT 0.5 CHECK(voice_stability >= 0 AND voice_stability <= 1),
    voice_similarity_boost REAL DEFAULT 0.75 CHECK(voice_similarity_boost >= 0 AND voice_similarity_boost <= 1),
    
    -- Interaction mode
    interaction_mode TEXT DEFAULT 'push_to_talk' CHECK(interaction_mode IN ('push_to_talk', 'continuous', 'auto_detect')),
    
    -- Audio settings
    playback_speed REAL DEFAULT 1.0 CHECK(playback_speed >= 0.5 AND playback_speed <= 2.0),
    volume REAL DEFAULT 1.0 CHECK(volume >= 0 AND volume <= 1.0),
    
    -- Language preferences
    transcription_language TEXT DEFAULT 'en',    -- ISO 639-1 language code
    
    -- Features
    auto_play_response INTEGER DEFAULT 1,        -- Auto-play AI voice responses
    show_waveform INTEGER DEFAULT 1,             -- Show audio waveforms
    enable_noise_cancellation INTEGER DEFAULT 1,  -- Enable noise cancellation
    
    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(user_id, workspace_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================
-- AVAILABLE VOICES TABLE
-- ============================================
-- Cache of available ElevenLabs voices

CREATE TABLE available_voices (
    id TEXT PRIMARY KEY,                         -- ElevenLabs voice ID
    name TEXT NOT NULL,
    category TEXT CHECK(category IN ('premade', 'cloned', 'professional', 'generated')),
    description TEXT,
    preview_url TEXT,
    
    -- Voice characteristics
    gender TEXT CHECK(gender IN ('male', 'female', 'neutral')),
    age TEXT CHECK(age IN ('young', 'middle_aged', 'old')),
    accent TEXT,                                 -- e.g., 'american', 'british', 'australian'
    use_case TEXT,                               -- e.g., 'narration', 'conversational', 'customer_service'
    
    -- Quality and availability
    is_active INTEGER DEFAULT 1,
    is_premium INTEGER DEFAULT 0,
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    last_used_at INTEGER,
    
    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ============================================
-- VOICE USAGE TRACKING
-- ============================================
-- Track voice API usage for billing and analytics

CREATE TABLE voice_usage_daily (
    id TEXT PRIMARY KEY DEFAULT ('voice_usage_' || lower(hex(randomblob(8)))),
    workspace_id TEXT NOT NULL,
    date TEXT NOT NULL,                          -- YYYY-MM-DD format
    
    -- Usage counts
    transcription_count INTEGER DEFAULT 0,
    synthesis_count INTEGER DEFAULT 0,
    
    -- Duration totals (milliseconds)
    total_input_duration INTEGER DEFAULT 0,
    total_output_duration INTEGER DEFAULT 0,
    
    -- Character counts (for billing)
    total_characters_synthesized INTEGER DEFAULT 0,
    
    -- Cost tracking (in cents)
    estimated_cost INTEGER DEFAULT 0,
    
    -- Quality metrics
    avg_transcription_confidence REAL,
    avg_processing_time INTEGER,                 -- Average time from input to output (ms)
    
    -- Error tracking
    transcription_errors INTEGER DEFAULT 0,
    synthesis_errors INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    UNIQUE(workspace_id, date),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Voice interactions indexes
CREATE INDEX idx_voice_interactions_session ON voice_interactions(session_id);
CREATE INDEX idx_voice_interactions_created ON voice_interactions(created_at DESC);
CREATE INDEX idx_voice_interactions_voice_id ON voice_interactions(voice_id);

-- Voice preferences indexes
CREATE INDEX idx_voice_preferences_user ON voice_preferences(user_id);
CREATE INDEX idx_voice_preferences_workspace ON voice_preferences(workspace_id);

-- Available voices indexes
CREATE INDEX idx_available_voices_active ON available_voices(is_active) WHERE is_active = 1;
CREATE INDEX idx_available_voices_category ON available_voices(category);
CREATE INDEX idx_available_voices_usage ON available_voices(times_used DESC);

-- Voice usage tracking indexes
CREATE INDEX idx_voice_usage_workspace_date ON voice_usage_daily(workspace_id, date);
CREATE INDEX idx_voice_usage_date ON voice_usage_daily(date DESC);

-- ============================================
-- SEED DATA: DEFAULT VOICES
-- ============================================

-- Insert popular ElevenLabs voices
INSERT INTO available_voices (id, name, category, description, gender, age, accent, use_case, is_active, is_premium) VALUES
('21m00Tcm4TlvDq8ikWAM', 'Rachel', 'premade', 'Clear and professional American female voice', 'female', 'middle_aged', 'american', 'conversational', 1, 0),
('AZnzlk1XvdvUeBnXmlld', 'Domi', 'premade', 'Strong and confident American female voice', 'female', 'middle_aged', 'american', 'narration', 1, 0),
('EXAVITQu4vr4xnSDxMaL', 'Bella', 'premade', 'Soft and warm American female voice', 'female', 'young', 'american', 'customer_service', 1, 0),
('ErXwobaYiN019PkySvjV', 'Antoni', 'premade', 'Well-rounded American male voice', 'male', 'middle_aged', 'american', 'narration', 1, 0),
('VR6AewLTigWG4xSOukaG', 'Arnold', 'premade', 'Crisp and authoritative American male voice', 'male', 'middle_aged', 'american', 'conversational', 1, 0),
('pNInz6obpgDQGcFmaJgB', 'Adam', 'premade', 'Deep and resonant American male voice', 'male', 'middle_aged', 'american', 'narration', 1, 0),
('yoZ06aMxZJJ28mfd3POQ', 'Sam', 'premade', 'Dynamic and engaging American male voice', 'male', 'young', 'american', 'conversational', 1, 0);

-- ============================================
-- TRIGGERS (DISABLED FOR D1 COMPATIBILITY)
-- ============================================
-- Note: Cloudflare D1 does not support triggers.
-- These operations must be handled in application code.

-- TODO: Handle in application code:
-- - Update voice_preferences.updated_at on UPDATE
-- - Update available_voices.updated_at on UPDATE
-- - Update voice_usage_daily.updated_at on UPDATE
-- - Increment available_voices.times_used and last_used_at on INSERT to voice_interactions

-- Migration complete marker
SELECT 'Migration 0004 completed successfully' as status;
