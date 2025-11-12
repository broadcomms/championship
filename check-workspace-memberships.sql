-- Check workspace memberships for both users
SELECT 
  wm.id,
  wm.user_id,
  wm.workspace_id,
  wm.role,
  w.name as workspace_name,
  u.email as user_email
FROM workspace_members wm
LEFT JOIN workspaces w ON wm.workspace_id = w.id
LEFT JOIN users u ON wm.user_id = u.id
WHERE wm.user_id IN ('usr_bootstrap_admin', 'usr_1762918170161_6ot43')
ORDER BY wm.created_at DESC;
