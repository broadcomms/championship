-- Update existing documents to have default processing values
UPDATE documents
SET
  processing_status = COALESCE(processing_status, 'pending'),
  text_extracted = COALESCE(text_extracted, 0),
  chunk_count = COALESCE(chunk_count, 0)
WHERE processing_status IS NULL
   OR text_extracted IS NULL
   OR chunk_count IS NULL;
