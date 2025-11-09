-- Migration: Add processing steps tracking table
-- Purpose: Explicit step-by-step tracking for document processing pipeline
-- This fixes timing mismatches in the processing indicator

-- ============================================================================
-- DOCUMENT PROCESSING STEPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_processing_steps (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    step_name TEXT NOT NULL,  -- 'extraction', 'chunking', 'embedding', 'indexing', 'enrichment'
    step_order INTEGER NOT NULL,  -- 1, 2, 3, 4, 5
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    started_at INTEGER,
    completed_at INTEGER,
    progress_current INTEGER DEFAULT 0,  -- For steps with sub-progress (e.g., embeddings 3/10)
    progress_total INTEGER DEFAULT 0,
    metadata TEXT,  -- JSON for step-specific data like { wordCount, pageCount }
    error_message TEXT,  -- Error details if status is 'failed'
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE(document_id, step_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_processing_steps_document
    ON document_processing_steps(document_id);

CREATE INDEX IF NOT EXISTS idx_processing_steps_status
    ON document_processing_steps(step_order, status);

CREATE INDEX IF NOT EXISTS idx_processing_steps_document_order
    ON document_processing_steps(document_id, step_order);
