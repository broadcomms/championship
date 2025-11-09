-- Bootstrap Admin User Migration
-- Creates the first admin user for the AuditGuard v2 platform
-- Temporary password: AdminBootstrap2025!
-- IMPORTANT: Change this password immediately after first login!

-- Insert first admin user
INSERT INTO users (id, email, password_hash, created_at, updated_at)
VALUES (
  'usr_bootstrap_admin',
  'admin@auditguardx.com',
  '$2b$10$KNzWf0ss9SqyTKGDKbjO5u7LFEjwTxW4vwN926aX/LZAyimsX5NlG',
  unixepoch() * 1000,
  unixepoch() * 1000
);

-- Grant super_admin privileges
INSERT INTO admin_users (user_id, role, permissions, created_at, created_by)
VALUES (
  'usr_bootstrap_admin',
  'super_admin',
  '["*"]',
  unixepoch() * 1000,
  'usr_bootstrap_admin'
);

-- Log the bootstrap action
INSERT INTO admin_audit_log (id, admin_user_id, action, resource_type, resource_id, changes, ip_address, created_at)
VALUES (
  'audit_bootstrap_' || hex(randomblob(8)),
  'usr_bootstrap_admin',
  'bootstrap_admin_created',
  'admin_user',
  'usr_bootstrap_admin',
  '{"role":"super_admin","email":"admin@auditguardx.com","note":"Initial admin user created via migration"}',
  '127.0.0.1',
  unixepoch() * 1000
);
