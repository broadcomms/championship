-- Migration 0016: Add OAuth and WorkOS integration fields to users table
-- This migration adds support for OAuth social login (Google, Microsoft) via WorkOS

-- Add WorkOS user ID for linking to WorkOS user management (without UNIQUE constraint initially)
ALTER TABLE users ADD COLUMN workos_user_id TEXT;

-- Add OAuth provider (google, microsoft, or null for email/password users)
ALTER TABLE users ADD COLUMN oauth_provider TEXT CHECK(oauth_provider IN ('google', 'microsoft') OR oauth_provider IS NULL);

-- Add OAuth profile data (JSON string containing provider-specific profile information)
ALTER TABLE users ADD COLUMN oauth_profile_data TEXT;

-- Add profile picture URL from OAuth provider
ALTER TABLE users ADD COLUMN profile_picture_url TEXT;

-- Create unique index for faster WorkOS user lookups (acts as UNIQUE constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_workos_user_id ON users(workos_user_id) WHERE workos_user_id IS NOT NULL;

-- Create index for OAuth provider lookups
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON users(oauth_provider);
