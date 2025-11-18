-- Insert Free Plan (no Stripe integration, local only)
INSERT OR REPLACE INTO subscription_plans (
    id,
    name,
    display_name,
    description,
    price_monthly,
    price_yearly,
    stripe_price_id_monthly,
    stripe_price_id_yearly,
    features,
    limits,
    is_active,
    created_at,
    max_workspaces
) VALUES (
    'plan_free',
    'free',
    'Free',
    'Perfect for getting started with basic compliance checking',
    0,
    0,
    NULL,
    NULL,
    '["basic_frameworks", "community_support", "pdf_export"]',
    '{"max_documents": 5, "max_checks": 20, "max_ai_messages": 50, "max_storage_gb": 1, "max_team_members": 1, "max_workspaces": 2}',
    1,
    unixepoch() * 1000,
    2
);