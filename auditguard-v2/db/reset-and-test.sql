-- Complete Database Reset and Test Setup
-- This script will clean all test data and prepare for fresh testing

-- 1. Clear all billing and subscription data
DELETE FROM billing_history;
DELETE FROM stripe_webhooks;
DELETE FROM stripe_payment_methods;
DELETE FROM subscriptions;
DELETE FROM stripe_customers;

-- 2. Clear workspace and user data (keeping admin)
DELETE FROM workspace_members WHERE user_id != 'usr_bootstrap_admin';
DELETE FROM workspaces WHERE id != 'wks_bootstrap';
DELETE FROM sessions WHERE user_id != 'usr_bootstrap_admin';
DELETE FROM users WHERE id != 'usr_bootstrap_admin';

-- 3. Clear all document and compliance data
DELETE FROM document_chunks;
DELETE FROM documents;
DELETE FROM compliance_checks;
DELETE FROM compliance_reports;

-- 4. Clear analytics and usage data
DELETE FROM usage_logs;
DELETE FROM api_usage_logs;

-- 5. Clear assistant data
DELETE FROM assistant_conversations;

-- 6. Clear issue management data
DELETE FROM issue_assignments;
DELETE FROM issues;

-- Reset sequences/counters (if needed)
-- SQLite uses AUTOINCREMENT differently, but we're using UUIDs mostly

-- Verify cleanup
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'workspaces', COUNT(*) FROM workspaces
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'stripe_customers', COUNT(*) FROM stripe_customers
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'billing_history', COUNT(*) FROM billing_history
UNION ALL
SELECT 'stripe_webhooks', COUNT(*) FROM stripe_webhooks
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'compliance_checks', COUNT(*) FROM compliance_checks;
