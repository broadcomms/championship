-- Migration: Add workspace limits enforcement
-- Date: November 15, 2025
-- Purpose: Prevent revenue leakage by limiting workspaces per plan

-- 1. Add workspace_count tracking to users (denormalized for performance)
ALTER TABLE users ADD COLUMN workspace_count INTEGER DEFAULT 0;

-- 2. Update existing workspace counts
UPDATE users
SET workspace_count = (
    SELECT COUNT(DISTINCT w.id)
    FROM workspaces w
    INNER JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = users.id AND wm.role = 'owner'
);

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_role ON workspace_members(user_id, role);

-- 4. Add max_workspaces to subscription_plans (defines limits per plan)
ALTER TABLE subscription_plans ADD COLUMN max_workspaces INTEGER DEFAULT 3;

-- 5. Update existing plans with workspace limits
UPDATE subscription_plans SET max_workspaces = 3 WHERE id = 'plan_free';
UPDATE subscription_plans SET max_workspaces = 5 WHERE id = 'plan_starter';
UPDATE subscription_plans SET max_workspaces = 20 WHERE id = 'plan_professional';
UPDATE subscription_plans SET max_workspaces = 50 WHERE id = 'plan_business';
UPDATE subscription_plans SET max_workspaces = -1 WHERE id = 'plan_enterprise';  -- -1 = unlimited

-- 6. Create function to get user's max allowed workspaces
-- (This will be used in application logic)

-- 7. Add audit log entry
INSERT INTO admin_audit_log (
    id,
    admin_user_id,
    action,
    resource_type,
    changes,
    ip_address,
    created_at
) VALUES (
    'audit_' || lower(hex(randomblob(16))),
    'usr_bootstrap_admin',
    'workspace_limits_migration',
    'system',
    json_object(
        'migration', '0020_workspace_limits',
        'added_columns', json_array('users.workspace_count', 'subscription_plans.max_workspaces'),
        'purpose', 'Prevent revenue leakage by enforcing workspace limits per plan'
    ),
    '127.0.0.1',
    unixepoch() * 1000
);
