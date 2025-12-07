#!/bin/bash

# Update SSO connection with WorkOS Connection ID
# This script adds the connection ID directly to the database

echo "Updating SSO connection with WorkOS Connection ID..."
echo "Connection ID: conn_01KBV62SKYETGMT89GDW6MR4S2"
echo ""

# Run the SQL update using raindrop CLI
raindrop db execute auditguard-db "
UPDATE sso_connections
SET
  workos_connection_id = 'conn_01KBV62SKYETGMT89GDW6MR4S2',
  updated_at = unixepoch()
WHERE organization_id = 'org_1764735393095_disjk'
  AND workos_organization_id = 'org_01KBTRZYBJ5FW3MRQQ3Z9SCDTV';
"

echo ""
echo "Verifying the update..."
echo ""

# Verify the update
raindrop db execute auditguard-db "
SELECT
  id,
  organization_id,
  provider,
  workos_organization_id,
  workos_connection_id,
  enabled,
  allowed_domains,
  datetime(created_at, 'unixepoch') as created_at,
  datetime(updated_at, 'unixepoch') as updated_at
FROM sso_connections
WHERE organization_id = 'org_1764735393095_disjk';
"

echo ""
echo "✓ Done! Connection ID has been added."
echo ""
echo "You can now test SSO login with: demo@auditguardx.com"
