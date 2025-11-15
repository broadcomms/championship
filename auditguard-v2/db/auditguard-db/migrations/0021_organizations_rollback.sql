-- =====================================================
-- Rollback Script for Migration 0021
-- =====================================================
-- Date: November 15, 2025
-- Purpose: Safely revert organization-based billing migration
-- Risk Level: HIGH - Only use if migration fails
-- =====================================================

-- =====================================================
-- PRE-ROLLBACK CHECKLIST
-- =====================================================
-- [ ] Confirm migration failure or critical issues
-- [ ] Enable maintenance mode
-- [ ] Notify users of rollback in progress
-- [ ] Stop all background jobs
-- [ ] Verify database backup exists and is recent
-- =====================================================

-- =====================================================
-- STEP 1: VERIFY BACKUP EXISTS
-- =====================================================
-- This should be done BEFORE running rollback
-- Verify your backup file: /path/to/backup_YYYYMMDD_HHMMSS.sqlite

-- =====================================================
-- STEP 2: DROP NEW TABLES (IF MIGRATION COMPLETED)
-- =====================================================

-- Drop organization usage tracking
DROP INDEX IF EXISTS idx_org_usage_date;
DROP INDEX IF EXISTS idx_org_usage_org_date;
DROP TABLE IF EXISTS organization_usage_daily;

-- Drop new subscriptions table
DROP INDEX IF EXISTS idx_subscriptions_new_stripe;
DROP INDEX IF EXISTS idx_subscriptions_new_status;
DROP INDEX IF EXISTS idx_subscriptions_new_org;
DROP TABLE IF EXISTS subscriptions_new;

-- Drop organization members
DROP INDEX IF EXISTS idx_org_members_role;
DROP INDEX IF EXISTS idx_org_members_user;
DROP INDEX IF EXISTS idx_org_members_org;
DROP TABLE IF EXISTS organization_members;

-- Drop workspaces organization link
DROP INDEX IF EXISTS idx_workspaces_organization;
ALTER TABLE workspaces DROP COLUMN IF EXISTS organization_id;

-- Drop organizations
DROP INDEX IF EXISTS idx_organizations_stripe;
DROP INDEX IF EXISTS idx_organizations_slug;
DROP INDEX IF EXISTS idx_organizations_owner;
DROP TABLE IF EXISTS organizations;

-- =====================================================
-- STEP 3: VERIFY OLD SCHEMA INTACT
-- =====================================================

-- Verify subscriptions table exists and has data
-- SELECT COUNT(*) as subscription_count FROM subscriptions;

-- Verify workspace_members table intact
-- SELECT COUNT(*) as member_count FROM workspace_members;

-- Verify workspaces table intact (without organization_id)
-- SELECT COUNT(*) as workspace_count FROM workspaces;

-- =====================================================
-- STEP 4: VERIFY STRIPE CUSTOMER REFERENCES
-- =====================================================

-- Ensure Stripe customer IDs still valid in old schema
-- SELECT DISTINCT stripe_customer_id 
-- FROM subscriptions 
-- WHERE stripe_customer_id IS NOT NULL;

-- =====================================================
-- STEP 5: RESTART SERVICES
-- =====================================================
-- After SQL rollback, revert application code:
--
-- Backend rollback:
-- $ cd /home/patrick/championship/auditguard-v2
-- $ git log --oneline  # Find commit before migration
-- $ git revert <commit-hash>
-- $ raindrop build deploy
--
-- Frontend rollback:
-- $ cd /home/patrick/championship/auditguard-ui
-- $ git log --oneline
-- $ git revert <commit-hash>
-- $ npm run build
-- $ netlify deploy --prod
--
-- Verify services:
-- $ raindrop build find  # Check all routes respond
-- $ curl https://your-app.com/health  # Health check

-- =====================================================
-- STEP 6: DATA INTEGRITY VERIFICATION
-- =====================================================

-- Verify user access preserved
-- SELECT 
--     u.email,
--     COUNT(DISTINCT wm.workspace_id) as accessible_workspaces
-- FROM users u
-- LEFT JOIN workspace_members wm ON u.id = wm.user_id
-- GROUP BY u.id
-- ORDER BY u.email;

-- Verify active subscriptions
-- SELECT 
--     w.name as workspace_name,
--     s.status,
--     s.stripe_subscription_id,
--     sp.name as plan_name
-- FROM subscriptions s
-- INNER JOIN workspaces w ON s.workspace_id = w.id
-- INNER JOIN subscription_plans sp ON s.plan_id = sp.id
-- WHERE s.status = 'active';

-- Verify no orphaned data
-- SELECT 
--     (SELECT COUNT(*) FROM subscriptions WHERE workspace_id NOT IN (SELECT id FROM workspaces)) as orphaned_subscriptions,
--     (SELECT COUNT(*) FROM workspace_members WHERE workspace_id NOT IN (SELECT id FROM workspaces)) as orphaned_members,
--     (SELECT COUNT(*) FROM workspace_members WHERE user_id NOT IN (SELECT id FROM users)) as orphaned_users;

-- =====================================================
-- STEP 7: STRIPE METADATA CLEANUP
-- =====================================================
-- If Stripe subscriptions were updated with org metadata, revert:
--
-- Run external script to update Stripe:
-- $ node scripts/revert-stripe-metadata.js
--
-- Script should:
-- 1. For each subscription in Stripe
-- 2. Remove metadata.organization_id
-- 3. Keep metadata.workspace_id
-- 4. Log all changes

-- =====================================================
-- STEP 8: POST-ROLLBACK VERIFICATION
-- =====================================================

-- Test critical user flows:
-- [ ] User can log in
-- [ ] User can access their workspaces
-- [ ] User can create documents
-- [ ] User can run compliance checks
-- [ ] Subscription status displays correctly
-- [ ] Billing webhooks process correctly
-- [ ] No console errors in frontend
-- [ ] No 500 errors in backend logs

-- Check error rates:
-- $ raindrop logs tail --follow | grep -i "error"

-- Monitor for 30 minutes after rollback
-- Watch for spike in errors or user reports

-- =====================================================
-- STEP 9: COMMUNICATION
-- =====================================================
-- After successful rollback:
-- [ ] Update status page (migration rolled back)
-- [ ] Email users explaining rollback
-- [ ] Disable maintenance mode
-- [ ] Post-mortem document creation
-- [ ] Plan next migration attempt

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================
-- Migration 0021 has been rolled back successfully.
-- 
-- Post-rollback checklist:
-- [ ] Old schema verified working
-- [ ] All users can access their data
-- [ ] Subscriptions functioning correctly
-- [ ] Stripe webhooks processing
-- [ ] Error rates normal
-- [ ] Users notified
-- [ ] Post-mortem scheduled
-- 
-- Investigation needed:
-- 1. What caused migration failure?
-- 2. Were there data integrity issues?
-- 3. Was it a code bug or schema problem?
-- 4. How can we prevent this next time?
-- 5. What additional testing is needed?
-- =====================================================

-- =====================================================
-- ALTERNATIVE: RESTORE FROM BACKUP (SAFEST)
-- =====================================================
-- If tables are corrupted or data is inconsistent:
--
-- 1. Stop all services
-- 2. Restore database from pre-migration backup:
--    $ cp /path/to/backup_YYYYMMDD.sqlite /path/to/production.db
-- 3. Verify backup integrity
-- 4. Restart services with old code
-- 5. Run verification queries above
-- 6. Monitor closely
--
-- This is the SAFEST option if any doubt exists about data integrity.
-- =====================================================
