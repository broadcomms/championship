-- ============================================
-- Migration 0010: Update Subscription Plans
-- ============================================
--
-- This migration updates subscription plans to match the finalized pricing strategy:
-- - Starter: $49/month, $470/year (up from $29/$278)
-- - Professional: $149/month, $1,430/year (up from $99/$950) [MOST POPULAR]
-- - Business: $399/month, $3,830/year (up from $299/$2,870)
-- - Enterprise: $1,999/month (custom pricing)
--
-- Key changes:
-- 1. Update pricing to reflect current Stripe price IDs and amounts
-- 2. Update limits to match Stripe product metadata
-- 3. Implement organization-based billing (1 org = 1 subscription)
-- 4. Add 14-day Professional trial configuration
-- 5. Add premium ElevenLabs voice for Patrick
--
-- References:
-- - SUBSCRIPTION_PRICING_PLAN.md (business strategy)
-- - prices.csv (Stripe price IDs and amounts)
-- - products.csv (Stripe product metadata with limits)
--
-- ============================================

-- --------------------------------------------
-- PART 1: Premium Voice Addition
-- --------------------------------------------

-- Insert premium ElevenLabs voice: Patrick
INSERT OR IGNORE INTO available_voices (
  id,
  name,
  category,
  description,
  gender,
  age,
  accent,
  use_case,
  is_active,
  is_premium
) VALUES (
  'C4eyCB721V3UgxQfSJYJ',
  'Patrick',
  'premade',
  'Dynamic Canadian African male voice',
  'male',
  'middle_aged',
  'canadian',
  'conversational',
  1,
  1
);

-- --------------------------------------------
-- PART 2: Free Plan (Trial Fallback)
-- --------------------------------------------
-- Free plan after 14-day Professional trial expires
-- Users without active subscription get these limits

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
  max_workspaces,
  is_active,
  created_at
) VALUES (
  'plan_free',
  'free',
  'Free',
  'Perfect for getting started with basic compliance checking',
  0,                                          -- $0/month
  0,                                          -- $0/year
  NULL,                                       -- No Stripe price (local only)
  NULL,
  json_array(
    'basic_frameworks',
    'community_support',
    'pdf_export'
  ),
  json_object(
    'documents', 3,                           -- Lock to last 3 docs after trial
    'compliance_checks', 5,                   -- 5 compliance checks/month
    'assistant_messages', 20,                 -- 20 AI messages/month
    'storage_gb', 0.5,                        -- 500 MB storage
    'team_members', 1,                        -- Solo user only
    'api_calls', 0                            -- No API access
  ),
  1,                                          -- Max 1 workspace
  1,                                          -- Active
  unixepoch() * 1000
);

-- --------------------------------------------
-- PART 3: Starter Plan ($49/month)
-- --------------------------------------------
-- Target: Solo consultants and small businesses (1-3 people)
-- Pricing: $49 CAD/month or $470 CAD/year (20% savings)

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
  max_workspaces,
  is_active,
  created_at
) VALUES (
  'plan_starter',
  'starter',
  'Starter',
  'Perfect for solo consultants and small businesses',
  4900,                                       -- $49.00 CAD/month (in cents)
  47000,                                      -- $470.00 CAD/year (in cents) - 20% discount
  'price_1SW7smHSX3RgJL1cA7gl8KoL',         -- Stripe monthly price ID (CAD)
  'price_1SW7tDHSX3RgJL1cgrkfZfLs',         -- Stripe yearly price ID (CAD)
  json_array(
    'all_frameworks',
    'email_support',
    'pdf_export',
    'version_control_7days',
    'basic_analytics'
  ),
  json_object(
    'documents', 50,                          -- 50 documents total (across all workspaces)
    'compliance_checks', 100,                 -- 100 compliance checks/month
    'assistant_messages', 200,                -- 200 AI messages/month
    'storage_gb', 1,                          -- 1 GB storage
    'team_members', 3,                        -- 3 team members
    'api_calls', 0                            -- No API access
  ),
  5,                                          -- Max 5 workspaces
  1,                                          -- Active
  unixepoch() * 1000
);

-- --------------------------------------------
-- PART 4: Professional Plan ($149/month) ⭐ MOST POPULAR
-- --------------------------------------------
-- Target: Growing teams (5-20 people)
-- Pricing: $149 CAD/month or $1,430 CAD/year (20% savings)
-- This is the default trial plan (14-day free trial)

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
  max_workspaces,
  is_active,
  created_at
) VALUES (
  'plan_professional',
  'professional',
  'Professional',
  'For growing compliance teams - Most Popular!',
  14900,                                      -- $149.00 CAD/month (in cents)
  143000,                                     -- $1,430.00 CAD/year (in cents) - 20% discount
  'price_1SW7xkHSX3RgJL1cMtmSkpZO',         -- Stripe monthly price ID (CAD)
  'price_1SW7yKHSX3RgJL1ckDhuicM2',         -- Stripe yearly price ID (CAD)
  json_array(
    'all_frameworks',
    'priority_support',
    'pdf_export',
    'version_control_30days',
    'advanced_analytics',
    'team_collaboration',
    'api_access',
    'slack_integration',
    'custom_branding',
    'automation',
    'document_templates'
  ),
  json_object(
    'documents', 1000,                        -- 1,000 documents total
    'compliance_checks', 1000,                -- 1,000 compliance checks/month
    'assistant_messages', 2000,               -- 2,000 AI messages/month
    'storage_gb', 10,                         -- 10 GB storage
    'team_members', 10,                       -- 10 team members (updated from 20 per spec)
    'api_calls', 10000                        -- 10,000 API calls/month
  ),
  20,                                         -- Max 20 workspaces
  1,                                          -- Active
  unixepoch() * 1000
);

-- --------------------------------------------
-- PART 5: Business Plan ($399/month)
-- --------------------------------------------
-- Target: Established companies (20-100 people)
-- Pricing: $399 USD/month or $3,830 CAD/year (20% savings)

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
  max_workspaces,
  is_active,
  created_at
) VALUES (
  'plan_business',
  'business',
  'Business',
  'For established companies with advanced compliance needs',
  39900,                                      -- $399.00 USD/month (in cents)
  383000,                                     -- $3,830.00 CAD/year (in cents) - 20% discount
  'price_1SW82PHSX3RgJL1cns5wmNXd',         -- Stripe monthly price ID (USD)
  'price_1SW82mHSX3RgJL1c0EMB7byV',         -- Stripe yearly price ID (CAD)
  json_array(
    'all_frameworks',
    'priority_support',
    'phone_support',
    'pdf_export',
    'unlimited_version_control',
    'advanced_analytics',
    'team_collaboration',
    'api_access',
    'slack_integration',
    'custom_branding',
    'sso',
    'audit_trails',
    'custom_frameworks',
    'advanced_permissions',
    'automation',
    'document_templates',
    'dedicated_account_manager',
    'quarterly_reviews',
    'sla_99_9'
  ),
  json_object(
    'documents', 5000,                        -- 5,000 documents total
    'compliance_checks', 10000,               -- 10,000 compliance checks/month
    'assistant_messages', 10000,              -- 10,000 AI messages/month
    'storage_gb', 100,                        -- 100 GB storage
    'team_members', 50,                       -- 50 team members
    'api_calls', 100000                       -- 100,000 API calls/month
  ),
  50,                                         -- Max 50 workspaces
  1,                                          -- Active
  unixepoch() * 1000
);

-- --------------------------------------------
-- PART 6: Enterprise Plan (Custom Pricing)
-- --------------------------------------------
-- Target: Large enterprises (100+ people)
-- Pricing: Custom (starting at $1,999/month)
-- All limits are unlimited (-1)

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
  max_workspaces,
  is_active,
  created_at
) VALUES (
  'plan_enterprise',
  'enterprise',
  'Enterprise',
  'Custom solution for large enterprises with unlimited resources',
  199900,                                     -- $1,999.00 USD/month (starting price)
  199900,                                     -- Same as monthly (custom contracts negotiated separately)
  'price_1STREQHSX3RgJL1cIfj5gcBq',         -- Stripe monthly price ID (USD)
  'price_1STREQHSX3RgJL1cIfj5gcBq',         -- Use monthly price (no separate yearly product in Stripe)
  json_array(
    'all_frameworks',
    'dedicated_support',
    '24_7_support',
    'pdf_export',
    'unlimited_version_control',
    'advanced_analytics',
    'team_collaboration',
    'api_access',
    'slack_integration',
    'custom_branding',
    'sso',
    'audit_trails',
    'custom_frameworks',
    'advanced_permissions',
    'white_label',
    'on_premise',
    'dedicated_infrastructure',
    'custom_sla',
    'dedicated_account_manager',
    'training_onboarding',
    'custom_development',
    'volume_discounts',
    'automation',
    'document_templates',
    'sla_99_99'
  ),
  json_object(
    'documents', -1,                          -- Unlimited documents
    'compliance_checks', -1,                  -- Unlimited compliance checks
    'assistant_messages', -1,                 -- Unlimited AI messages
    'storage_gb', -1,                         -- Unlimited storage
    'team_members', -1,                       -- Unlimited team members
    'api_calls', -1                           -- Unlimited API calls
  ),
  -1,                                         -- Unlimited workspaces
  1,                                          -- Active
  unixepoch() * 1000
);

-- --------------------------------------------
-- PART 7: System Settings for Trial Configuration
-- --------------------------------------------
-- Configure 14-day Professional trial for new signups

INSERT OR REPLACE INTO system_settings (key, value, value_type, description, updated_at)
VALUES ('trial_period_days', '14', 'number', 'Trial period duration in days (Professional plan features)', unixepoch() * 1000);

INSERT OR REPLACE INTO system_settings (key, value, value_type, description, updated_at)
VALUES ('trial_plan_id', 'plan_professional', 'string', 'Plan ID for trial period (Professional features)', unixepoch() * 1000);

INSERT OR REPLACE INTO system_settings (key, value, value_type, description, updated_at)
VALUES ('default_plan_after_trial', 'plan_free', 'string', 'Default plan after trial expires without payment', unixepoch() * 1000);

INSERT OR REPLACE INTO system_settings (key, value, value_type, description, updated_at)
VALUES ('upgrade_prompt_threshold', '0.7', 'number', 'Usage percentage to show upgrade prompts (70%)', unixepoch() * 1000);

-- --------------------------------------------
-- PART 8: Cleanup and Indexing
-- --------------------------------------------

-- Deactivate any old/deprecated plans that might exist
UPDATE subscription_plans
SET is_active = 0
WHERE id NOT IN ('plan_free', 'plan_starter', 'plan_professional', 'plan_business', 'plan_enterprise');

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_status
  ON subscriptions(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan
  ON subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end
  ON subscriptions(trial_end)
  WHERE trial_end IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active
  ON subscription_plans(is_active)
  WHERE is_active = 1;

-- --------------------------------------------
-- VERIFICATION QUERIES (for manual testing)
-- --------------------------------------------

-- Verify all active plans are correctly configured
-- SELECT
--   id,
--   name,
--   display_name,
--   price_monthly / 100.0 as monthly_price_dollars,
--   price_yearly / 100.0 as yearly_price_dollars,
--   stripe_price_id_monthly,
--   stripe_price_id_yearly,
--   max_workspaces,
--   json_extract(limits, '$.documents') as documents,
--   json_extract(limits, '$.assistant_messages') as assistant_messages,
--   json_extract(limits, '$.team_members') as team_members,
--   is_active
-- FROM subscription_plans
-- WHERE is_active = 1
-- ORDER BY price_monthly;

-- Verify system settings
-- SELECT key, value, description
-- FROM system_settings
-- WHERE key LIKE 'trial%' OR key LIKE '%upgrade%';

-- --------------------------------------------
-- MIGRATION COMPLETE ✅
-- --------------------------------------------
--
-- Summary of changes:
-- ✅ Added premium Patrick voice
-- ✅ Updated Free plan with post-trial limits (3 docs, 20 AI messages, 5 checks)
-- ✅ Updated Starter plan to $49/month with correct limits (50 docs, 200 AI messages, 100 checks, 5 workspaces, 3 members)
-- ✅ Updated Professional plan to $149/month with correct limits (1000 docs, 2000 AI messages, 1000 checks, 20 workspaces, 10 members)
-- ✅ Updated Business plan to $399/month with correct limits (5000 docs, 10000 AI messages, 10000 checks, 50 workspaces, 50 members)
-- ✅ Updated Enterprise plan with unlimited resources (-1 for all limits)
-- ✅ All Stripe price IDs updated to match prices.csv (latest 2025-11-22 prices)
-- ✅ All limits updated to match products.csv metadata
-- ✅ 14-day Professional trial configured in system_settings
-- ✅ Upgrade prompt threshold set to 70%
-- ✅ Organization-based billing structure maintained
-- ✅ Performance indexes added
--
-- Next steps for deployment:
-- 1. Test migration in staging environment
-- 2. Verify Stripe webhook integration with new price IDs
-- 3. Test trial flow (signup → 14-day Professional → Free downgrade)
-- 4. Test upgrade flows (Free → Starter → Professional → Business)
-- 5. Verify limit enforcement across all plans
-- 6. Test organization-wide usage aggregation
-- 7. Deploy to production during low-traffic window
--
-- ============================================
-- Migration complete marker
SELECT 'Migration 0010 completed successfully' as status;