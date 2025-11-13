-- Migration: Stripe Integration for Subscription System
-- Created: 2025-11-13
-- Description: Add tables and columns for full Stripe payment integration

-- ============================================
-- STRIPE CUSTOMER MAPPING
-- ============================================
-- Maps workspace to Stripe customer ID for billing operations
CREATE TABLE stripe_customers (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    payment_method_id TEXT, -- Default payment method
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_stripe_customers_workspace_id ON stripe_customers(workspace_id);
CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

-- ============================================
-- PAYMENT METHODS
-- ============================================
-- Stores customer payment methods (cards, bank accounts, etc)
CREATE TABLE stripe_payment_methods (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'card', 'us_bank_account', etc
    last4 TEXT, -- Last 4 digits of card/account
    brand TEXT, -- 'visa', 'mastercard', etc
    exp_month INTEGER, -- Card expiration month
    exp_year INTEGER, -- Card expiration year
    is_default INTEGER DEFAULT 0, -- 1 if default payment method
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_payment_methods_workspace_id ON stripe_payment_methods(workspace_id);
CREATE INDEX idx_payment_methods_stripe_id ON stripe_payment_methods(stripe_payment_method_id);
CREATE INDEX idx_payment_methods_default ON stripe_payment_methods(workspace_id, is_default);

-- ============================================
-- BILLING HISTORY
-- ============================================
-- Records all invoices and charges for audit trail
CREATE TABLE billing_history (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT UNIQUE, -- Stripe invoice ID
    stripe_charge_id TEXT, -- Stripe charge ID
    amount INTEGER NOT NULL, -- Amount in cents
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL, -- 'paid', 'open', 'void', 'uncollectible', 'payment_failed'
    description TEXT,
    invoice_pdf TEXT, -- URL to invoice PDF
    period_start INTEGER, -- Billing period start timestamp
    period_end INTEGER, -- Billing period end timestamp
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_billing_history_workspace_id ON billing_history(workspace_id);
CREATE INDEX idx_billing_history_stripe_invoice ON billing_history(stripe_invoice_id);
CREATE INDEX idx_billing_history_status ON billing_history(workspace_id, status);
CREATE INDEX idx_billing_history_created ON billing_history(workspace_id, created_at);

-- ============================================
-- WEBHOOK AUDIT LOG
-- ============================================
-- Stores all Stripe webhook events for debugging and idempotency
CREATE TABLE stripe_webhooks (
    id TEXT PRIMARY KEY,
    stripe_event_id TEXT UNIQUE NOT NULL, -- Stripe event ID (for idempotency)
    type TEXT NOT NULL, -- Event type (e.g., 'invoice.payment_succeeded')
    processed INTEGER DEFAULT 0, -- 0 = pending, 1 = processed successfully
    payload TEXT NOT NULL, -- Full JSON payload from Stripe
    error TEXT, -- Error message if processing failed
    created_at INTEGER NOT NULL, -- When webhook was received
    processed_at INTEGER -- When webhook was processed
);

CREATE INDEX idx_webhooks_event_id ON stripe_webhooks(stripe_event_id);
CREATE INDEX idx_webhooks_type ON stripe_webhooks(type);
CREATE INDEX idx_webhooks_processed ON stripe_webhooks(processed, created_at);

-- ============================================
-- EXTEND EXISTING TABLES
-- ============================================

-- Add trial and Stripe price tracking to subscriptions
ALTER TABLE subscriptions ADD COLUMN trial_end INTEGER;
ALTER TABLE subscriptions ADD COLUMN stripe_price_id TEXT;
ALTER TABLE subscriptions ADD COLUMN canceled_at INTEGER;

-- Add Stripe price IDs to subscription plans for monthly and yearly billing
ALTER TABLE subscription_plans ADD COLUMN stripe_price_id_monthly TEXT;
ALTER TABLE subscription_plans ADD COLUMN stripe_price_id_yearly TEXT;

