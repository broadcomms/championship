-- Clean up old D1 chunks that are now in PostgreSQL
-- This removes duplicate chunks that were created before the PostgreSQL migration

-- Delete chunks for the test document
DELETE FROM document_chunks WHERE document_id = 'doc_1762315311420_7tcrnd';
DELETE FROM document_chunks WHERE document_id = 'doc_1762311360992_frlp7n';

-- Clean up orphaned chunk framework tags
DELETE FROM document_chunk_frameworks WHERE chunk_id NOT IN (SELECT id FROM document_chunks);
