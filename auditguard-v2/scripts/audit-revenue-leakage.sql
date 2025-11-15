-- Revenue Leakage Audit Report
-- Date: November 15, 2025
-- Purpose: Identify users with multiple workspaces to understand revenue impact

-- 1. Find users with multiple workspaces
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT w.id) as workspace_count,
    GROUP_CONCAT(w.id) as workspace_ids,
    GROUP_CONCAT(w.name) as workspace_names
FROM users u
INNER JOIN workspace_members wm ON u.id = wm.user_id
INNER JOIN workspaces w ON wm.workspace_id = w.id
GROUP BY u.id, u.email
HAVING workspace_count > 1
ORDER BY workspace_count DESC;

-- 2. Check subscriptions per workspace (current model)
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    s.plan_id,
    sp.name as plan_name,
    sp.price_monthly,
    s.status,
    s.stripe_subscription_id,
    wm.user_id
FROM workspaces w
LEFT JOIN subscriptions s ON w.id = s.workspace_id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.role = 'owner'
ORDER BY wm.user_id, w.created_at;

-- 3. Calculate revenue leakage - users paying for one workspace but getting multiple
SELECT 
    u.email,
    COUNT(DISTINCT w.id) as total_workspaces,
    COUNT(DISTINCT s.id) as paid_workspaces,
    (COUNT(DISTINCT w.id) - COUNT(DISTINCT s.id)) as free_workspaces_exploited,
    MAX(sp.price_monthly) as highest_paid_plan,
    (COUNT(DISTINCT w.id) - COUNT(DISTINCT s.id)) * MAX(sp.price_monthly) as estimated_lost_revenue_monthly
FROM users u
INNER JOIN workspace_members wm ON u.id = wm.user_id
INNER JOIN workspaces w ON wm.workspace_id = w.id
LEFT JOIN subscriptions s ON w.id = s.workspace_id AND s.status = 'active'
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
GROUP BY u.id, u.email
HAVING total_workspaces > 1 AND paid_workspaces >= 1
ORDER BY estimated_lost_revenue_monthly DESC;

-- 4. Summary statistics
SELECT 
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT w.id) as total_workspaces,
    AVG(workspace_per_user.workspace_count) as avg_workspaces_per_user,
    MAX(workspace_per_user.workspace_count) as max_workspaces_per_user
FROM users u
INNER JOIN workspace_members wm ON u.id = wm.user_id
INNER JOIN workspaces w ON wm.workspace_id = w.id
LEFT JOIN (
    SELECT user_id, COUNT(DISTINCT workspace_id) as workspace_count
    FROM workspace_members
    GROUP BY user_id
) workspace_per_user ON u.id = workspace_per_user.user_id;

-- 5. Document usage across multiple workspaces (showing the limit gaming issue)
SELECT 
    u.email,
    COUNT(DISTINCT w.id) as workspace_count,
    SUM(doc_counts.doc_count) as total_documents_across_workspaces,
    MAX(sp.limits) as plan_document_limit
FROM users u
INNER JOIN workspace_members wm ON u.id = wm.user_id
INNER JOIN workspaces w ON wm.workspace_id = w.id
LEFT JOIN subscriptions s ON w.id = s.workspace_id AND s.status = 'active'
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
LEFT JOIN (
    SELECT workspace_id, COUNT(*) as doc_count
    FROM documents
    WHERE deleted_at IS NULL
    GROUP BY workspace_id
) doc_counts ON w.id = doc_counts.workspace_id
GROUP BY u.id, u.email
HAVING workspace_count > 1 AND total_documents_across_workspaces > 10
ORDER BY total_documents_across_workspaces DESC;
