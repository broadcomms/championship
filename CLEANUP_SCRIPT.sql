-- ================================================================
-- AuditGuard v2 - Complete Cleanup Script
-- ================================================================
-- This script removes all document-related data from the database
-- WARNING: This is irreversible! All documents, compliance checks,
-- chunks, analytics, and conversations will be deleted.
-- ================================================================

-- STEP 1: Delete all compliance-related data
-- ================================================================
DELETE FROM compliance_issues;
DELETE FROM compliance_checks;

-- STEP 2: Delete all analytics data
-- ================================================================
DELETE FROM risk_assessments WHERE id IN (
  SELECT id FROM risk_assessments WHERE document_id IN (SELECT id FROM documents)
);

-- STEP 3: Delete all assistant conversations
-- ================================================================
DELETE FROM conversations;

-- STEP 4: Delete all document chunks
-- ================================================================
DELETE FROM document_chunks;

-- STEP 5: Delete all documents
-- ================================================================
DELETE FROM documents;

-- ================================================================
-- Verification Queries (Run after cleanup)
-- ================================================================
-- SELECT COUNT(*) as documents_count FROM documents;
-- SELECT COUNT(*) as chunks_count FROM document_chunks;
-- SELECT COUNT(*) as compliance_checks_count FROM compliance_checks;
-- SELECT COUNT(*) as compliance_issues_count FROM compliance_issues;
-- SELECT COUNT(*) as conversations_count FROM conversations;

-- Expected results: All counts should be 0
