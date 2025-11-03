-- Migration: 0010_fix_chunk_id_type.sql
-- Description: Fix document_chunks.id to use INTEGER PRIMARY KEY AUTOINCREMENT
--              This is critical for the RETURNING id clause to work properly

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
-- Step 1: Create new table with correct schema
CREATE TABLE document_chunks_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    chunk_size INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    -- Columns added by migration 0008_vector_embeddings.sql
    vector_embedding BLOB,
    start_char INTEGER DEFAULT 0,
    end_char INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    has_header INTEGER DEFAULT 0,
    section_title TEXT,
    vector_id TEXT,
    embedding_status TEXT DEFAULT 'pending',
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Step 2: Copy existing data (if any)
INSERT INTO document_chunks_new (
    document_id, workspace_id, chunk_index, content, chunk_size, created_at,
    vector_embedding, start_char, end_char, token_count, has_header,
    section_title, vector_id, embedding_status
)
SELECT 
    document_id, workspace_id, chunk_index, content, chunk_size, created_at,
    vector_embedding, start_char, end_char, token_count, has_header,
    section_title, vector_id, embedding_status
FROM document_chunks;

-- Step 3: Drop old table
DROP TABLE document_chunks;

-- Step 4: Rename new table
ALTER TABLE document_chunks_new RENAME TO document_chunks;

-- Step 5: Recreate indexes
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_workspace_id ON document_chunks(workspace_id);
CREATE INDEX idx_document_chunks_vector_id ON document_chunks(vector_id);
CREATE INDEX idx_document_chunks_status ON document_chunks(embedding_status);

-- Step 6: Update document_chunk_frameworks to handle the ID change
-- Note: This assumes the table exists from migration 0008
-- We need to clear this table since the chunk IDs have changed
DELETE FROM document_chunk_frameworks;
