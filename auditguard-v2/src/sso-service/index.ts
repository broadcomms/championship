import { Service } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface SSOConnection {
  id: string;
  organization_id: string;
  provider: string;
  workos_organization_id: string;
  workos_connection_id: string | null;
  enabled: number;
  allowed_domains: string | null;
  created_at: number;
  updated_at: number;
}

interface SSODetectionResult {
  hasSso: boolean;
  organizationId?: string;
  organizationName?: string;
  provider?: string;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  /**
   * Initiate SSO login flow for an organization
   * Generates WorkOS authorization URL for SAML/OIDC
   */
  async initiateSSOLogin(organizationId: string): Promise<{
    authorizationUrl: string;
    state: string;
  }> {
    const db = this.getDb();

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
    // Unlike OAuth (which uses provider parameter), SSO uses organization parameter
    const params = new URLSearchParams({
      client_id: this.env.WORKOS_CLIENT_ID,
      redirect_uri: `${this.env.BACKEND_URL}/api/auth/sso/callback`,
      response_type: 'code',
      state,
      // For SSO, we use the organization parameter instead of provider
      organization: ssoConnection.workos_organization_id,
    });

    // If connection ID is specified, include it for direct connection routing
    if (ssoConnection.workos_connection_id) {
      params.set('connection', ssoConnection.workos_connection_id);
    }

    const authorizationUrl = `https://api.workos.com/user_management/authorize?${params.toString()}`;

    this.env.logger.info('SSO login initiated', {
      organizationId,
      provider: ssoConnection.provider,
      workosOrgId: ssoConnection.workos_organization_id,
    });

    return {
      authorizationUrl,
      state,
    };
  }

  /**
   * Handle SSO callback and provision user
   * Exchanges SAML assertion for user profile and creates/links user to organization
   */
  async handleSSOCallback(code: string): Promise<{
    userId: string;
    email: string;
    sessionId: string;
    isNewUser: boolean;
    organizationId: string;
  }> {
    const db = this.getDb();

    // Exchange authorization code for user profile using WorkOS HTTP API
    const tokenResponse = await fetch('https://api.workos.com/user_management/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.env.WORKOS_CLIENT_ID,
        client_secret: this.env.WORKOS_API_KEY,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`WorkOS SSO authentication failed: ${error}`);
    }

    const authData = (await tokenResponse.json()) as {
      user: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
        profilePictureUrl?: string;
        organizationId?: string; // WorkOS organization ID
      };
      organizationId?: string;
      access_token: string;
    };

    const workosUser = authData.user;
    const workosOrgId = authData.organizationId || workosUser.organizationId;

    if (!workosOrgId) {
      throw new Error('No organization ID in SSO response');
    }

    // Find the organization by WorkOS organization ID
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

    // Check if user exists by WorkOS user ID or email
    let user = await db
      .selectFrom('users')
      .select(['id', 'email', 'workos_user_id'])
      .where((eb) =>
        eb.or([eb('workos_user_id', '=', workosUser.id), eb('email', '=', workosUser.email)])
      )
      .executeTakeFirst();

    const now = Math.floor(Date.now() / 1000);
    let userId: string;
    let isNewUser = false;

    if (!user) {
      // Create new user account
      userId = `usr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const fullName = [workosUser.firstName, workosUser.lastName].filter(Boolean).join(' ');

      await db
        .insertInto('users')
        .values({
          id: userId,
          email: workosUser.email,
          password_hash: '', // SSO users don't have password
          name: fullName || workosUser.email.split('@')[0],
          workos_user_id: workosUser.id,
          oauth_provider: 'sso', // Mark as SSO user
          oauth_profile_data: JSON.stringify(workosUser),
          profile_picture_url: workosUser.profilePictureUrl || null,
          created_at: now,
          updated_at: now,
          last_login: now,
        })
        .execute();

      isNewUser = true;

      this.env.logger.info('New SSO user created', {
        userId,
        email: workosUser.email,
        organizationId,
      });
    } else {
      // Update existing user with SSO info
      userId = user.id;

      await db
        .updateTable('users')
        .set({
          workos_user_id: workosUser.id,
          oauth_provider: 'sso',
          oauth_profile_data: JSON.stringify(workosUser),
          profile_picture_url: workosUser.profilePictureUrl || user.id, // Keep existing if not provided
          last_login: now,
          updated_at: now,
        })
        .where('id', '=', userId)
        .execute();

      this.env.logger.info('Existing user logged in via SSO', {
        userId,
        email: workosUser.email,
        organizationId,
      });
    }

    // Check if user is already a member of the organization
    const membership = await db
      .selectFrom('organization_members')
      .select('id')
      .where('organization_id', '=', organizationId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      // Auto-add user to organization via SSO
      const membershipId = `om_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await db
        .insertInto('organization_members')
        .values({
          id: membershipId,
          organization_id: organizationId,
          user_id: userId,
          role: 'member', // SSO users join as members by default
          joined_at: now,
          invited_by: null, // SSO auto-join
        })
        .execute();

      this.env.logger.info('User added to organization via SSO', {
        userId,
        organizationId,
        membershipId,
      });
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
   * Validate if organization has SSO enabled
   */
  async validateSSOConnection(organizationId: string): Promise<{
    enabled: boolean;
    provider?: string;
    workosOrganizationId?: string;
    workosConnectionId?: string;
    allowedDomains?: string[];
  }> {
    const db = this.getDb();

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
   * Detect SSO from email domain
   * Auto-detects organization from user's email domain
   */
  async detectSSOFromEmail(email: string): Promise<SSODetectionResult> {
    const db = this.getDb();

    // Extract domain from email
    const domain = email.split('@')[1];
    if (!domain) {
      return { hasSso: false };
    }

    // Find SSO connection with matching domain
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

    // Check if domain matches any allowed_domains
    for (const connection of connections) {
      if (connection.allowed_domains) {
        try {
          const allowedDomains = JSON.parse(connection.allowed_domains) as string[];
          if (allowedDomains.includes(domain.toLowerCase())) {
            this.env.logger.info('SSO detected from email domain', {
              email,
              domain,
              organizationId: connection.organization_id,
            });

            return {
              hasSso: true,
              organizationId: connection.organization_id,
              organizationName: connection.organization_name,
              provider: connection.provider,
            };
          }
        } catch (error) {
          this.env.logger.error('Failed to parse allowed_domains', {
            organizationId: connection.organization_id,
            error: String(error),
          });
        }
      }
    }

    return { hasSso: false };
  }

  /**
   * Create or update SSO configuration for an organization
   */
  async configureSSOConnection(
    organizationId: string,
    config: {
      provider: string;
      workosOrganizationId: string;
      workosConnectionId?: string;
      allowedDomains?: string[];
    }
  ): Promise<SSOConnection> {
    const db = this.getDb();
    const now = Math.floor(Date.now() / 1000);

    // Check if SSO connection already exists
    const existing = await db
      .selectFrom('sso_connections')
      .select('id')
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();

    const allowedDomainsJson = config.allowedDomains
      ? JSON.stringify(config.allowedDomains)
      : null;

    if (existing) {
      // Update existing SSO connection
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

      this.env.logger.info('SSO configuration updated', {
        organizationId,
        provider: config.provider,
      });

      const updated = await db
        .selectFrom('sso_connections')
        .selectAll()
        .where('id', '=', existing.id)
        .executeTakeFirstOrThrow();

      return updated;
    } else {
      // Create new SSO connection
      const ssoId = `sso_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await db
        .insertInto('sso_connections')
        .values({
          id: ssoId,
          organization_id: organizationId,
          provider: config.provider,
          workos_organization_id: config.workosOrganizationId,
          workos_connection_id: config.workosConnectionId || null,
          enabled: 0, // Disabled by default, admin must explicitly enable
          allowed_domains: allowedDomainsJson,
          created_at: now,
          updated_at: now,
        })
        .execute();

      this.env.logger.info('SSO configuration created', {
        organizationId,
        ssoId,
        provider: config.provider,
      });

      const created = await db
        .selectFrom('sso_connections')
        .selectAll()
        .where('id', '=', ssoId)
        .executeTakeFirstOrThrow();

      return created;
    }
  }

  /**
   * Toggle SSO enabled status
   */
  async toggleSSO(organizationId: string, enabled: boolean): Promise<{ success: boolean }> {
    const db = this.getDb();
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

    this.env.logger.info('SSO toggled', {
      organizationId,
      enabled,
    });

    return { success: true };
  }

  /**
   * Delete SSO configuration
   */
  async deleteSSOConnection(organizationId: string): Promise<{ success: boolean }> {
    const db = this.getDb();

    const result = await db
      .deleteFrom('sso_connections')
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();

    if (!result.numDeletedRows || result.numDeletedRows === 0n) {
      throw new Error('SSO connection not found');
    }

    this.env.logger.info('SSO configuration deleted', {
      organizationId,
    });

    return { success: true };
  }
}
