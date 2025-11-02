-- Migration: 0009_vector_embeddings.sql
-- Description: Add support for custom vector embeddings and compliance frameworks

-- ============================================================================
-- COMPLIANCE FRAMEWORKS TABLE
-- ============================================================================
CREATE TABLE compliance_frameworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    settings TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_compliance_frameworks_active
    ON compliance_frameworks(is_active) WHERE is_active = 1;

-- Seed default frameworks
INSERT INTO compliance_frameworks (name, display_name, description, settings) VALUES
    ('sox', 'SOX', 'Sarbanes-Oxley Act', '{"color":"#FF6B6B"}'),
    ('gdpr', 'GDPR', 'General Data Protection Regulation', '{"color":"#4ECDC4"}'),
    ('hipaa', 'HIPAA', 'Healthcare Data Security', '{"color":"#95E1D3"}'),
    ('pci_dss', 'PCI-DSS', 'Payment Card Security', '{"color":"#F38181"}'),
    ('iso27001', 'ISO 27001', 'Information Security Management', '{"color":"#AA96DA"}'),
    ('nist', 'NIST CSF', 'Cybersecurity Framework', '{"color":"#FCBAD3"}');

-- ============================================================================
-- UPDATE DOCUMENTS TABLE
-- ============================================================================
ALTER TABLE documents ADD COLUMN compliance_framework_id INTEGER
    REFERENCES compliance_frameworks(id) ON DELETE SET NULL;

CREATE INDEX idx_documents_framework
    ON documents(compliance_framework_id) WHERE compliance_framework_id IS NOT NULL;

ALTER TABLE documents ADD COLUMN chunks_created INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN embeddings_generated INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN vector_indexing_status TEXT DEFAULT 'pending';

CREATE INDEX idx_documents_vector_status ON documents(vector_indexing_status);

-- ============================================================================
-- DOCUMENT CHUNKS TABLE ENHANCEMENTS
-- ============================================================================
-- Add vector embedding support to existing document_chunks table
ALTER TABLE document_chunks ADD COLUMN vector_embedding BLOB;
ALTER TABLE document_chunks ADD COLUMN start_char INTEGER DEFAULT 0;
ALTER TABLE document_chunks ADD COLUMN end_char INTEGER DEFAULT 0;
ALTER TABLE document_chunks ADD COLUMN token_count INTEGER DEFAULT 0;
ALTER TABLE document_chunks ADD COLUMN has_header INTEGER DEFAULT 0;
ALTER TABLE document_chunks ADD COLUMN section_title TEXT;
ALTER TABLE document_chunks ADD COLUMN vector_id TEXT;
ALTER TABLE document_chunks ADD COLUMN embedding_status TEXT DEFAULT 'pending';

CREATE INDEX idx_document_chunks_vector_id ON document_chunks(vector_id);
CREATE INDEX idx_document_chunks_status ON document_chunks(embedding_status);

-- ============================================================================
-- DOCUMENT CHUNK FRAMEWORKS
-- ============================================================================
CREATE TABLE document_chunk_frameworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id INTEGER NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    framework_id INTEGER NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    relevance_score REAL,
    auto_tagged INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(chunk_id, framework_id)
);

CREATE INDEX idx_chunk_frameworks_chunk ON document_chunk_frameworks(chunk_id);
CREATE INDEX idx_chunk_frameworks_framework ON document_chunk_frameworks(framework_id);
CREATE INDEX idx_chunk_frameworks_score ON document_chunk_frameworks(relevance_score);
