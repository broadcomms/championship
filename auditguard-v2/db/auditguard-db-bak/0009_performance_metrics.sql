-- Migration: 0009_performance_metrics.sql
-- Description: Add performance monitoring tables for Phase 6 optimization tracking

-- ============================================================================
-- PERFORMANCE METRICS TABLE
-- ============================================================================
CREATE TABLE performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    metadata TEXT,
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_performance_metrics_operation ON performance_metrics(operation);
CREATE INDEX idx_performance_metrics_created_at ON performance_metrics(created_at);
CREATE INDEX idx_performance_metrics_success ON performance_metrics(success);
