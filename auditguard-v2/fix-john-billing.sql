-- Fix John's billing history amount
-- The webhook stored amount_paid=0 instead of total=2900
UPDATE billing_history 
SET amount = 2900 
WHERE stripe_invoice_id = 'in_1STbSGHSX3RgJL1c3PY8blcP' 
  AND workspace_id = 'wks_1763182226437_ud48js';

-- Verify the fix
SELECT 
  stripe_invoice_id,
  amount,
  currency,
  description,
  created_at
FROM billing_history 
WHERE workspace_id = 'wks_1763182226437_ud48js';
