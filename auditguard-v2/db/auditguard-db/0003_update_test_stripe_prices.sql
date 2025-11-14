-- Update Stripe price IDs to TEST mode prices
-- This migration updates all subscription plans to use TEST mode Stripe price IDs

-- Update Starter plan with TEST price IDs
UPDATE subscription_plans
SET
  stripe_price_id_monthly = 'price_1STRPIHSX3RgJL1cNxEJB1Zu',
  stripe_price_id_yearly = 'price_1STRV1HSX3RgJL1crkUDoEnr',
  price_monthly = 2900,  -- $29.00 in cents
  price_yearly = 27800   -- $278.00 CAD in cents (20% discount)
WHERE name = 'starter';

-- Update Professional plan with TEST price IDs
UPDATE subscription_plans
SET
  stripe_price_id_monthly = 'price_1STRNnHSX3RgJL1cSjc8tuNG',
  stripe_price_id_yearly = 'price_1STRV ZHSX3RgJL1csyuIcej8',
  price_monthly = 9900,   -- $99.00 in cents
  price_yearly = 95000    -- $950.00 USD in cents (20% discount)
WHERE name = 'professional';

-- Update Business plan with TEST price IDs
UPDATE subscription_plans
SET
  stripe_price_id_monthly = 'price_1STRK2HSX3RgJL1cMXV95vrl',
  stripe_price_id_yearly = 'price_1STRW4HSX3RgJL1cj0yeyuq3',
  price_monthly = 29900,  -- $299.00 in cents
  price_yearly = 287000   -- $2870.00 CAD in cents (20% discount)
WHERE name = 'business';

-- Update Enterprise plan with TEST price IDs
UPDATE subscription_plans
SET
  stripe_price_id_monthly = 'price_1STREQHSX3RgJL1cIfj5gcBq',
  stripe_price_id_yearly = 'price_1STREQHSX3RgJL1cIfj5gcBq',  -- Using monthly for both since no yearly in CSV
  price_monthly = 199900, -- $1999.00 in cents
  price_yearly = 1999000  -- Estimated yearly (no discount in CSV)
WHERE name = 'enterprise';
