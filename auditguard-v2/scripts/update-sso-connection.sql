-- Update SSO connection with WorkOS Connection ID
-- This adds the connection ID to enable proper SSO authentication

UPDATE sso_connections
SET
  workos_connection_id = 'conn_01KBV62SKYETGMT89GDW6MR4S2',
  updated_at = unixepoch()
WHERE organization_id = 'org_1764735393095_disjk'
  AND workos_organization_id = 'org_01KBTRZYBJ5FW3MRQQ3Z9SCDTV';

-- Verify the update
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
