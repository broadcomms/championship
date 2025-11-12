-- Check user sessions
SELECT 'Sessions' as type, id, user_id, expires_at, datetime(expires_at/1000, 'unixepoch') as expires_readable
FROM sessions 
WHERE user_id IN (
  SELECT id FROM users WHERE email IN ('joe@doe.com', 'admin@auditguardx.com')
)
ORDER BY expires_at DESC
LIMIT 10;

-- Check users
SELECT 'Users' as type, id, email, created_at, datetime(created_at/1000, 'unixepoch') as created_readable
FROM users 
WHERE email IN ('joe@doe.com', 'admin@auditguardx.com');

-- Check workspace memberships
SELECT 'Workspace Members' as type, wm.*, w.name as workspace_name
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id IN (
  SELECT id FROM users WHERE email IN ('joe@doe.com', 'admin@auditguardx.com')
);

-- Check all workspaces
SELECT 'All Workspaces' as type, id, name, created_at, datetime(created_at/1000, 'unixepoch') as created_readable
FROM workspaces
ORDER BY created_at DESC
LIMIT 10;
