-- Add workspace memberships for existing users
-- This migration fixes the 403 error by ensuring users are members of their workspaces

-- First, ensure all workspace owners are members of their own workspaces
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, added_at, added_by)
SELECT 
    w.id,
    w.owner_id,
    'owner',
    w.created_at,
    w.owner_id
FROM workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM workspace_members wm 
    WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
);

-- Add admin user to ALL workspaces as admin (for testing/support purposes)
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, added_at, added_by)
SELECT 
    w.id,
    'usr_bootstrap_admin',
    'admin',
    unixepoch() * 1000,
    'usr_bootstrap_admin'
FROM workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM workspace_members wm 
    WHERE wm.workspace_id = w.id AND wm.user_id = 'usr_bootstrap_admin'
);

-- Add john@doe.com user to ALL their workspaces (for testing)
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, added_at, added_by)
SELECT 
    w.id,
    'usr_1762918170161_6ot43',
    'admin',
    unixepoch() * 1000,
    'usr_bootstrap_admin'
FROM workspaces w
WHERE w.owner_id = 'usr_1762918170161_6ot43'
AND NOT EXISTS (
    SELECT 1 FROM workspace_members wm 
    WHERE wm.workspace_id = w.id AND wm.user_id = 'usr_1762918170161_6ot43'
);

-- Log the fix
INSERT INTO admin_audit_log (id, admin_user_id, action, resource_type, resource_id, changes, ip_address, created_at)
VALUES (
  'audit_fix_memberships_' || hex(randomblob(8)),
  'usr_bootstrap_admin',
  'fix_workspace_memberships',
  'workspace_members',
  'bulk',
  '{"note":"Auto-added workspace owners and admin as members to fix 403 errors"}',
  '127.0.0.1',
  unixepoch() * 1000
);
