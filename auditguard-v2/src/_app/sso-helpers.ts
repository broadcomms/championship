/**
 * SSO Helper Functions
 *
 * This file contains all SSO-related logic that was previously in the sso-service.
 * Moved inline due to deployment issues with the standalone service.
 */

import { Kysely } from 'kysely';
import { DB } from '../db/auditguard-db/types';

interface SSODetectionResult {
  hasSso: boolean;
  organizationId?: string;
  organizationName?: string;
  provider?: string;
}

interface WorkOSUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
  organizationId?: string;
}

/**
 * Initiate SSO login flow for an organization
 */
export async function initiateSSOLogin(
  db: Kysely<DB>,
  organizationId: string,
  env: any
): Promise<{ authorizationUrl: string; state: string }> {
  // Fetch SSO configuration for organization
  const ssoConnection = await db
    .selectFrom('sso_connections')
    .selectAll()
    .where('organization_id', '=', organizationId)
    .where('enabled', '=', 1)
    .executeTakeFirst();

  if (!ssoConnection) {
    throw new Error('SSO not configured or not enabled for this organization');
  }

  // Generate state token for CSRF protection
  const state = `sso_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Build WorkOS authorization URL for SSO
  const params = new URLSearchParams({
    client_id: env.WORKOS_CLIENT_ID,
    redirect_uri: `${env.BACKEND_URL}/api/auth/sso/callback`,
    response_type: 'code',
    state,
    organization: ssoConnection.workos_organization_id,
  });

  if (ssoConnection.workos_connection_id) {
    params.set('connection', ssoConnection.workos_connection_id);
  }

  const authorizationUrl = `https://api.workos.com/user_management/authorize?${params.toString()}`;

  return { authorizationUrl, state };
}

/**
 * Handle SSO callback and provision user
 */
export async function handleSSOCallback(
  db: Kysely<DB>,
  code: string,
  env: any
): Promise<{
  userId: string;
  email: string;
  sessionId: string;
  isNewUser: boolean;
  organizationId: string;
}> {
  // Exchange authorization code for user profile
  const tokenResponse = await fetch('https://api.workos.com/user_management/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.WORKOS_CLIENT_ID,
      client_secret: env.WORKOS_API_KEY,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`WorkOS SSO authentication failed: ${error}`);
  }

  const authData = (await tokenResponse.json()) as {
    user: WorkOSUser;
    organizationId?: string;
  };

  const workosUser = authData.user;
  const workosOrgId = authData.organizationId || workosUser.organizationId;

  if (!workosOrgId) {
    throw new Error('No organization ID in SSO response');
  }

  // Find the organization
  const ssoConnection = await db
    .selectFrom('sso_connections')
    .select(['organization_id', 'provider'])
    .where('workos_organization_id', '=', workosOrgId)
    .where('enabled', '=', 1)
    .executeTakeFirst();

  if (!ssoConnection) {
    throw new Error('SSO connection not found or not enabled');
  }

  const organizationId = ssoConnection.organization_id;

  // Check if user exists
  let user = await db
    .selectFrom('users')
    .select(['id', 'email', 'workos_user_id', 'profile_picture_url'])
    .where((eb) =>
      eb.or([eb('workos_user_id', '=', workosUser.id), eb('email', '=', workosUser.email)])
    )
    .executeTakeFirst();

  const now = Math.floor(Date.now() / 1000);
  let userId: string;
  let isNewUser = false;

  if (!user) {
    // Create new user
    userId = `usr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fullName = [workosUser.firstName, workosUser.lastName].filter(Boolean).join(' ');

    await db
      .insertInto('users')
      .values({
        id: userId,
        email: workosUser.email,
        password_hash: '',
        name: fullName || workosUser.email.split('@')[0],
        workos_user_id: workosUser.id,
        oauth_provider: 'sso',
        oauth_profile_data: JSON.stringify(workosUser),
        profile_picture_url: workosUser.profilePictureUrl || null,
        created_at: now,
        updated_at: now,
        last_login: now,
      })
      .execute();

    isNewUser = true;
  } else {
    // Update existing user
    userId = user.id;

    await db
      .updateTable('users')
      .set({
        workos_user_id: workosUser.id,
        oauth_provider: 'sso',
        oauth_profile_data: JSON.stringify(workosUser),
        profile_picture_url: workosUser.profilePictureUrl || user.profile_picture_url,
        last_login: now,
        updated_at: now,
      })
      .where('id', '=', userId)
      .execute();
  }

  // Check organization membership
  const membership = await db
    .selectFrom('organization_members')
    .select('id')
    .where('organization_id', '=', organizationId)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!membership) {
    // Auto-add user to organization
    const membershipId = `om_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await db
      .insertInto('organization_members')
      .values({
        id: membershipId,
        organization_id: organizationId,
        user_id: userId,
        role: 'member',
        joined_at: now,
        invited_by: null,
      })
      .execute();
  }

  // Create session
  const sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const expiresAt = now + 7 * 24 * 60 * 60; // 7 days

  await db
    .insertInto('sessions')
    .values({
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt,
      created_at: now,
    })
    .execute();

  return {
    userId,
    email: workosUser.email,
    sessionId,
    isNewUser,
    organizationId,
  };
}

/**
 * Detect SSO from email domain
 */
export async function detectSSOFromEmail(
  db: Kysely<DB>,
  email: string
): Promise<SSODetectionResult> {
  const domain = email.split('@')[1];
  if (!domain) {
    return { hasSso: false };
  }

  const connections = await db
    .selectFrom('sso_connections')
    .innerJoin('organizations', 'organizations.id', 'sso_connections.organization_id')
    .select([
      'sso_connections.organization_id',
      'sso_connections.provider',
      'sso_connections.allowed_domains',
      'organizations.name as organization_name',
    ])
    .where('sso_connections.enabled', '=', 1)
    .execute();

  for (const connection of connections) {
    if (connection.allowed_domains) {
      try {
        const allowedDomains = JSON.parse(connection.allowed_domains) as string[];
        if (allowedDomains.includes(domain.toLowerCase())) {
          return {
            hasSso: true,
            organizationId: connection.organization_id,
            organizationName: connection.organization_name,
            provider: connection.provider,
          };
        }
      } catch (error) {
        // Skip invalid JSON
      }
    }
  }

  return { hasSso: false };
}

/**
 * Validate SSO connection
 */
export async function validateSSOConnection(
  db: Kysely<DB>,
  organizationId: string
): Promise<{
  enabled: boolean;
  provider?: string;
  workosOrganizationId?: string;
  workosConnectionId?: string;
  allowedDomains?: string[];
}> {
  const ssoConnection = await db
    .selectFrom('sso_connections')
    .selectAll()
    .where('organization_id', '=', organizationId)
    .executeTakeFirst();

  if (!ssoConnection) {
    return { enabled: false };
  }

  const allowedDomains = ssoConnection.allowed_domains
    ? JSON.parse(ssoConnection.allowed_domains)
    : [];

  return {
    enabled: ssoConnection.enabled === 1,
    provider: ssoConnection.provider,
    workosOrganizationId: ssoConnection.workos_organization_id,
    workosConnectionId: ssoConnection.workos_connection_id || undefined,
    allowedDomains,
  };
}

/**
 * Configure SSO connection
 */
export async function configureSSOConnection(
  db: Kysely<DB>,
  organizationId: string,
  config: {
    provider: string;
    workosOrganizationId: string;
    workosConnectionId?: string;
    allowedDomains?: string[];
  }
): Promise<any> {
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .selectFrom('sso_connections')
    .select('id')
    .where('organization_id', '=', organizationId)
    .executeTakeFirst();

  const allowedDomainsJson = config.allowedDomains ? JSON.stringify(config.allowedDomains) : null;

  if (existing) {
    await db
      .updateTable('sso_connections')
      .set({
        provider: config.provider,
        workos_organization_id: config.workosOrganizationId,
        workos_connection_id: config.workosConnectionId || null,
        allowed_domains: allowedDomainsJson,
        updated_at: now,
      })
      .where('id', '=', existing.id)
      .execute();

    return await db
      .selectFrom('sso_connections')
      .selectAll()
      .where('id', '=', existing.id)
      .executeTakeFirstOrThrow();
  } else {
    const ssoId = `sso_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await db
      .insertInto('sso_connections')
      .values({
        id: ssoId,
        organization_id: organizationId,
        provider: config.provider,
        workos_organization_id: config.workosOrganizationId,
        workos_connection_id: config.workosConnectionId || null,
        enabled: 0,
        allowed_domains: allowedDomainsJson,
        created_at: now,
        updated_at: now,
      })
      .execute();

    return await db
      .selectFrom('sso_connections')
      .selectAll()
      .where('id', '=', ssoId)
      .executeTakeFirstOrThrow();
  }
}

/**
 * Toggle SSO enabled status
 */
export async function toggleSSO(
  db: Kysely<DB>,
  organizationId: string,
  enabled: boolean
): Promise<{ success: boolean }> {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .updateTable('sso_connections')
    .set({
      enabled: enabled ? 1 : 0,
      updated_at: now,
    })
    .where('organization_id', '=', organizationId)
    .executeTakeFirst();

  if (!result.numUpdatedRows || result.numUpdatedRows === 0n) {
    throw new Error('SSO connection not found');
  }

  return { success: true };
}

/**
 * Delete SSO configuration
 */
export async function deleteSSOConnection(
  db: Kysely<DB>,
  organizationId: string
): Promise<{ success: boolean }> {
  const result = await db
    .deleteFrom('sso_connections')
    .where('organization_id', '=', organizationId)
    .executeTakeFirst();

  if (!result.numDeletedRows || result.numDeletedRows === 0n) {
    throw new Error('SSO connection not found');
  }

  return { success: true };
}
