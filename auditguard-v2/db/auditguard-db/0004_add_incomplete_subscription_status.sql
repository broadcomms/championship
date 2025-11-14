-- Add 'incomplete' and 'incomplete_expired' statuses to subscriptions table
-- These statuses are used by Stripe when a subscription requires payment confirmation

-- Step 1: Create new table with updated constraint
CREATE TABLE subscriptions_new (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'paused')),
    current_period_start INTEGER NOT NULL,
    current_period_end INTEGER NOT NULL,
    cancel_at_period_end INTEGER DEFAULT 0,
    trial_end INTEGER,
    stripe_price_id TEXT,
    canceled_at INTEGER,
    trial_start INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Step 2: Copy all existing data
INSERT INTO subscriptions_new
SELECT id, workspace_id, plan_id, stripe_customer_id, stripe_subscription_id,
       status, current_period_start, current_period_end, cancel_at_period_end,
       trial_end, stripe_price_id, canceled_at, NULL as trial_start,
       created_at, updated_at
FROM subscriptions;

-- Step 3: Drop old table
DROP TABLE subscriptions;

-- Step 4: Rename new table to original name
ALTER TABLE subscriptions_new RENAME TO subscriptions;
