-- Migration: Assign Free plan to all organizations without subscriptions
-- This ensures all organizations have a subscription (Free plan by default)

-- Insert Free plan subscriptions for organizations that don't have one
-- Only if the free plan exists (from migration 0002)
INSERT INTO subscriptions (
    id,
    organization_id,
    plan_id,
    stripe_customer_id,
    stripe_subscription_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    trial_end,
    stripe_price_id,
    canceled_at,
    trial_start,
    created_at,
    updated_at
)
SELECT
    'sub_' || substr(hex(randomblob(8)), 1, 16),
    org.id,
    'plan_free',
    NULL,
    NULL,
    'active',
    unixepoch() * 1000,
    NULL,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    unixepoch() * 1000,
    unixepoch() * 1000
FROM organizations org
WHERE EXISTS (
    SELECT 1 FROM subscription_plans WHERE id = 'plan_free'
)
AND NOT EXISTS (
    SELECT 1
    FROM subscriptions sub
    WHERE sub.organization_id = org.id
    AND sub.status IN ('active', 'trialing')
);
