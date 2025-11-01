-- Add title and description fields to documents table for AI-extracted metadata
ALTER TABLE documents ADD COLUMN title TEXT;
ALTER TABLE documents ADD COLUMN description TEXT;
