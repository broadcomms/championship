-- Migration: Add allowed_domains field to sso_connections for domain-based SSO detection
-- This enables auto-detection of organization from user email domain

ALTER TABLE sso_connections ADD COLUMN allowed_domains TEXT;

-- Create index for faster domain lookups
CREATE INDEX IF NOT EXISTS idx_sso_connections_enabled ON sso_connections(enabled) WHERE enabled = 1;
