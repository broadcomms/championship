-- Migration: Add user profile and password reset fields
-- Created: 2025-12-03
-- Description: Adds name field for user profiles and password reset token fields

-- Add name column to users table
ALTER TABLE users ADD COLUMN name TEXT;

-- Add password reset fields
ALTER TABLE users ADD COLUMN password_reset_token TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires INTEGER;

-- Create index on password_reset_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
