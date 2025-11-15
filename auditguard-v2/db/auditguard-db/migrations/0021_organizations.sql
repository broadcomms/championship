-- =====================================================
-- Migration 0021: Organization-Based Billing Model
-- =====================================================
-- Date: November 15, 2025
-- Purpose: Transform from per-workspace to per-organization billing
-- Risk Level: HIGH - Affects core business model
-- Rollback: See 0021_organizations_rollback.sql
-- =====================================================

-- STEP 1: CREATE ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) >= 1 AND length(name) <= 100),
    slug TEXT UNIQUE NOT NULL CHECK(length(slug) >= 2 AND length(slug) <= 50),
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    stripe_customer_id TEXT UNIQUE,
    billing_email TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe ON organizations(stripe_customer_id);

-- =====================================================
-- STEP 2: CREATE ORGANIZATION MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member', 'billing')),
    joined_at INTEGER NOT NULL,
    invited_by TEXT REFERENCES users(id),
    UNIQUE(organization_id, user_id)
);

-- Indexes for membership queries
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(organization_id, role);

-- =====================================================
-- STEP 3: ADD ORGANIZATION_ID TO WORKSPACES
-- =====================================================
-- Add nullable column first (will populate then make NOT NULL)
ALTER TABLE workspaces ADD COLUMN organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

-- Index for workspace-organization queries
CREATE INDEX IF NOT EXISTS idx_workspaces_organization ON workspaces(organization_id);

-- =====================================================
-- STEP 4: CREATE NEW SUBSCRIPTIONS TABLE (ORG-LEVEL)
-- =====================================================
CREATE TABLE IF NOT EXISTS subscriptions_new (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'paused')),
    current_period_start INTEGER,
    current_period_end INTEGER,
    cancel_at_period_end INTEGER DEFAULT 0,
    trial_end INTEGER,
    trial_start INTEGER,
    canceled_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Indexes for subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_new_org ON subscriptions_new(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_new_status ON subscriptions_new(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_new_stripe ON subscriptions_new(stripe_subscription_id);

-- =====================================================
-- STEP 5: CREATE ORGANIZATION USAGE TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_usage_daily (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date TEXT NOT NULL CHECK(date LIKE '____-__-__'),  -- YYYY-MM-DD format
    documents_created INTEGER DEFAULT 0,
    documents_total INTEGER DEFAULT 0,
    compliance_checks_count INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0,
    assistant_messages_count INTEGER DEFAULT 0,
    storage_bytes INTEGER DEFAULT 0,
    workspaces_count INTEGER DEFAULT 0,
    members_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(organization_id, date)
);

-- Indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_org_usage_org_date ON organization_usage_daily(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_org_usage_date ON organization_usage_daily(date);

-- =====================================================
-- STEP 6: MIGRATE EXISTING DATA
-- =====================================================

-- 6.1: Create organizations from users with workspaces
INSERT INTO organizations (id, name, slug, owner_user_id, stripe_customer_id, created_at, updated_at)
SELECT DISTINCT
    'org_' || (CAST(strftime('%s', 'now') AS INTEGER) * 1000) || '_' || substr(hex(randomblob(4)), 1, 8) || '_' || substr(u.id, 5, 6) as id,
    COALESCE(u.name, substr(u.email, 1, instr(u.email, '@') - 1)) || '''s Organization' as name,
    LOWER(
        replace(
            replace(
                replace(
                    substr(COALESCE(u.name, u.email), 1, 30),
                    ' ', '-'
                ),
                '.', '-'
            ),
            '@', '-'
        )
    ) || '-' || substr(hex(randomblob(2)), 1, 4) as slug,
    u.id as owner_user_id,
    (
        SELECT s.stripe_customer_id 
        FROM subscriptions s 
        INNER JOIN workspaces w ON s.workspace_id = w.id
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = u.id AND wm.role = 'owner'
        ORDER BY s.created_at DESC
        LIMIT 1
    ) as stripe_customer_id,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 as created_at,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 as updated_at
FROM users u
WHERE u.id IN (
    SELECT DISTINCT user_id 
    FROM workspace_members 
    WHERE role = 'owner'
)
AND NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.owner_user_id = u.id
);

-- 6.2: Add organization owners as members
INSERT INTO organization_members (id, organization_id, user_id, role, joined_at, invited_by)
SELECT 
    'om_' || (CAST(strftime('%s', 'now') AS INTEGER) * 1000) || '_' || substr(hex(randomblob(4)), 1, 8) as id,
    o.id as organization_id,
    o.owner_user_id as user_id,
    'owner' as role,
    o.created_at as joined_at,
    NULL as invited_by
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = o.id AND om.user_id = o.owner_user_id
);

-- 6.3: Add all workspace members as organization members
INSERT INTO organization_members (id, organization_id, user_id, role, joined_at, invited_by)
SELECT DISTINCT
    'om_' || (CAST(strftime('%s', 'now') AS INTEGER) * 1000) || '_' || substr(hex(randomblob(4)), 1, 8) || '_' || substr(wm.id, 5, 6) as id,
    o.id as organization_id,
    wm.user_id,
    CASE 
        WHEN wm.role = 'owner' THEN 'owner'
        WHEN wm.role = 'admin' THEN 'admin'
        ELSE 'member'
    END as role,
    wm.joined_at,
    NULL as invited_by
FROM workspace_members wm
INNER JOIN workspaces w ON wm.workspace_id = w.id
INNER JOIN workspace_members wm_owner ON w.id = wm_owner.workspace_id AND wm_owner.role = 'owner'
INNER JOIN organizations o ON o.owner_user_id = wm_owner.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = o.id AND om.user_id = wm.user_id
);

-- 6.4: Link workspaces to their owner's organization
UPDATE workspaces
SET 
    organization_id = (
        SELECT o.id
        FROM organizations o
        WHERE o.owner_user_id = (
            SELECT wm.user_id
            FROM workspace_members wm
            WHERE wm.workspace_id = workspaces.id 
              AND wm.role = 'owner'
            LIMIT 1
        )
    ),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE organization_id IS NULL;

-- 6.5: Migrate subscriptions to organization level
INSERT INTO subscriptions_new (
    id, organization_id, plan_id, stripe_customer_id, 
    stripe_subscription_id, stripe_price_id, status,
    current_period_start, current_period_end, 
    cancel_at_period_end, trial_end, trial_start, 
    canceled_at, created_at, updated_at
)
SELECT 
    s.id,
    w.organization_id,
    s.plan_id,
    s.stripe_customer_id,
    s.stripe_subscription_id,
    s.stripe_price_id,
    s.status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.trial_end,
    0 as trial_start,
    s.canceled_at,
    s.created_at,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 as updated_at
FROM subscriptions s
INNER JOIN workspaces w ON s.workspace_id = w.id
WHERE w.organization_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM subscriptions_new sn
    WHERE sn.id = s.id
);

-- 6.6: Initialize organization usage tracking for today
INSERT INTO organization_usage_daily (
    id,
    organization_id,
    date,
    documents_total,
    workspaces_count,
    members_count,
    created_at,
    updated_at
)
SELECT 
    'usage_' || (CAST(strftime('%s', 'now') AS INTEGER) * 1000) || '_' || substr(o.id, 5, 10) as id,
    o.id as organization_id,
    date('now') as date,
    COALESCE((
        SELECT COUNT(DISTINCT d.id)
        FROM documents d
        INNER JOIN workspaces w ON d.workspace_id = w.id
        WHERE w.organization_id = o.id
    ), 0) as documents_total,
    COALESCE((
        SELECT COUNT(DISTINCT w.id)
        FROM workspaces w
        WHERE w.organization_id = o.id
    ), 0) as workspaces_count,
    COALESCE((
        SELECT COUNT(DISTINCT om.user_id)
        FROM organization_members om
        WHERE om.organization_id = o.id
    ), 0) as members_count,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 as created_at,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 as updated_at
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_usage_daily oud
    WHERE oud.organization_id = o.id AND oud.date = date('now')
);

-- =====================================================
-- STEP 7: DATA VALIDATION
-- =====================================================

-- These are validation checks - should all return 0
-- Uncomment to run manually after migration

-- Check 1: No workspaces without organization
-- SELECT COUNT(*) as unlinked_workspaces FROM workspaces WHERE organization_id IS NULL;

-- Check 2: All organizations have exactly one owner
-- SELECT o.id, o.name, COUNT(*) as owner_count
-- FROM organizations o
-- LEFT JOIN organization_members om ON o.id = om.organization_id AND om.role = 'owner'
-- GROUP BY o.id
-- HAVING owner_count != 1;

-- Check 3: All active subscriptions migrated
-- SELECT 
--     (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as old_active,
--     (SELECT COUNT(*) FROM subscriptions_new WHERE status = 'active') as new_active;

-- Check 4: No orphaned organization members
-- SELECT COUNT(*) FROM organization_members om
-- WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = om.organization_id);

-- Check 5: User workspace access preserved
-- SELECT 
--     u.id,
--     u.email,
--     COUNT(DISTINCT wm.workspace_id) as old_access,
--     COUNT(DISTINCT w.id) as new_access
-- FROM users u
-- LEFT JOIN workspace_members wm ON u.id = wm.user_id
-- LEFT JOIN organization_members om ON u.id = om.user_id
-- LEFT JOIN workspaces w ON w.organization_id = om.organization_id
-- GROUP BY u.id
-- HAVING old_access != new_access;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next Steps:
-- 1. Run validation queries (commented above)
-- 2. Update Stripe subscription metadata (external script)
-- 3. Deploy backend code using subscriptions_new
-- 4. Monitor for 48 hours
-- 5. Rename tables:
--    - subscriptions → subscriptions_old
--    - subscriptions_new → subscriptions
-- 6. After 2 weeks, drop subscriptions_old
-- =====================================================
