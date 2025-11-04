ALTER TABLE documents ADD COLUMN smartbucket_indexing_status TEXT DEFAULT 'pending';
CREATE INDEX idx_documents_smartbucket_status ON documents(smartbucket_indexing_status);
UPDATE documents SET smartbucket_indexing_status = 'completed' WHERE processing_status = 'completed';
