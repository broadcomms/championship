-- Migration: Add subscription plans based on Stripe products
-- This migration adds all subscription tiers including Free, Starter, Professional, Business, and Enterprise

-- ✅ Use INSERT OR REPLACE instead of DELETE to preserve foreign key integrity
-- This will update existing plans or insert new ones without breaking references

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
    '{"max_documents": 10, "max_checks": 20, "max_ai_messages": 50, "max_storage_gb": 1, "max_team_members": 1, "max_workspaces": 3}',
    1,
    unixepoch() * 1000,
    3
);

-- Insert Starter Plan
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
    'plan_starter',
    'starter',
    'Starter',
    'Perfect for small businesses and consultants, included 50 docs, 100 compliance checks, 500 AI message, 2 team members, 5GB storage.',
    29.00,
    278.00,
    'price_1STRPIHSX3RgJL1cNxEJB1Zu',
    'price_1STRV1HSX3RgJL1crkUDoEnr',
    '["all_frameworks", "email_support", "pdf_export", "version_control_7days"]',
    '{"max_documents": 10, "max_checks": 50, "max_ai_messages": 100, "max_storage_gb": 5, "max_team_members": 2, "max_workspaces": 5}',
    1,
    unixepoch() * 1000,
    5
);

-- Insert Professional Plan
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
    'plan_professional',
    'professional',
    'Professional',
    'For growing compliance teams, include up to 250 docs, 500 checks, 2000 AI messages, 10 team members, 25GB storage, API access',
    99.00,
    950.00,
    'price_1STRNnHSX3RgJL1cSjc8tuNG',
    'price_1STRVZHSX3RgJL1csyuIcej8',
    '["all_frameworks", "email_support", "pdf_export", "advanced_analytics", "team_collaboration", "api_access", "slack_integration", "version_control_30days", "custom_branding"]',
    '{"max_documents": 50, "max_checks": 200, "max_ai_messages": 1000, "max_storage_gb": 25, "max_team_members": 10, "max_workspaces": 20, "api_calls_monthly": 10000}',
    1,
    unixepoch() * 1000,
    20
);

-- Insert Business Plan
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
    'plan_business',
    'business',
    'Business',
    'For mid-size organizations, includes 1000 docs, 2000 checks, 10,000 AI messages, 100GB storage with all advanced features.',
    299.00,
    2870.00,
    'price_1STRK2HSX3RgJL1cMXV95vrl',
    'price_1STRW4HSX3RgJL1cj0yeyuq3',
    '["all_frameworks", "priority_support", "pdf_export", "advanced_analytics", "team_collaboration", "api_access", "slack_integration", "version_control_30days", "custom_branding", "sso", "audit_trails", "custom_frameworks"]',
    '{"max_documents": 1000, "max_checks": 2000, "max_ai_messages": 10000, "max_storage_gb": 100, "max_team_members": 25, "max_workspaces": 50, "api_calls_monthly": 100000}',
    1,
    unixepoch() * 1000,
    50
);

-- Insert Enterprise Plan
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
    'plan_enterprise',
    'enterprise',
    'Enterprise',
    'Custom solution for medium to large enterprises, including unlimited cloud resources, dedicated support, SLA and SSO.',
    1999.00,
    19990.00,
    'price_1STREQHSX3RgJL1cIfj5gcBq',
    NULL,
    '["all_frameworks", "dedicated_support", "24/7_support", "pdf_export", "advanced_analytics", "team_collaboration", "api_access", "slack_integration", "unlimited_version_control", "custom_branding", "sso", "audit_trails", "custom_frameworks", "white_label", "sla_guarantee", "on_premise_option"]',
    '{"max_documents": -1, "max_checks": -1, "max_ai_messages": -1, "max_storage_gb": -1, "max_team_members": -1, "max_workspaces": -1, "api_calls_monthly": -1}',
    1,
    unixepoch() * 1000,
    NULL
);

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