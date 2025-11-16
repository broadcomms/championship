import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { WorkOS } from '@workos-inc/node';

interface GetAuthorizationUrlInput {
  organizationId: string;
  provider?: 'google' | 'okta' | 'azure' | 'saml' | 'generic-saml';
  state?: string;
}

interface HandleSSOCallbackInput {
  code: string;
}

interface CreateSSOConnectionInput {
  organizationId: string;
  provider: 'google' | 'okta' | 'azure' | 'saml' | 'generic-saml';
  workosOrganizationId: string;
  workosConnectionId?: string;
}

interface UpdateSSOConnectionInput {
  organizationId: string;
  enabled: boolean;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  private getWorkOS(): WorkOS {
    return new WorkOS(this.env.WORKOS_API_KEY, {
      clientId: this.env.WORKOS_CLIENT_ID,
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('SSO Service - Private', { status: 501 });
  }

  /**
   * Generate WorkOS authorization URL for SSO login
   */
  async getAuthorizationUrl(input: GetAuthorizationUrlInput): Promise<{
    authorizationUrl: string;
    state: string;
  }> {
    const db = this.getDb();
    const workos = this.getWorkOS();

    // Verify organization exists
    const organization = await db
      .selectFrom('organizations')
      .select(['id', 'name'])
      .where('id', '=', input.organizationId)
      .executeTakeFirst();

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Check if SSO is configured for this organization
    const ssoConnection = await db
      .selectFrom('sso_connections')
      .select(['workos_organization_id', 'workos_connection_id', 'provider', 'enabled'])
      .where('organization_id', '=', input.organizationId)
      .executeTakeFirst();

    if (!ssoConnection) {
      throw new Error('SSO not configured for this organization');
    }

    if (!ssoConnection.enabled) {
      throw new Error('SSO is disabled for this organization');
    }

    // Generate state parameter for CSRF protection
    const state = input.state || crypto.randomUUID();

    // Build authorization URL parameters
    const authorizationParams: {
      clientId: string;
      organizationId: string;
      redirectUri: string;
      state: string;
      provider?: string;
    } = {
      clientId: this.env.WORKOS_CLIENT_ID,
      organizationId: ssoConnection.workos_organization_id,
      redirectUri: this.env.WORKOS_REDIRECT_URI,
      state,
    };

    // If provider is specified, include it
    if (input.provider) {
      authorizationParams.provider = input.provider;
    }

    // Generate authorization URL using WorkOS SDK
    const authorizationUrl = workos.userManagement.getAuthorizationUrl(authorizationParams);

    return {
      authorizationUrl,
      state,
    };
  }

  /**
   * Handle SSO callback from WorkOS and authenticate user
   */
  async handleSSOCallback(input: HandleSSOCallbackInput): Promise<{
    userId: string;
    email: string;
    organizationId: string;
    firstName?: string;
    lastName?: string;
    isNewUser: boolean;
  }> {
    const db = this.getDb();
    const workos = this.getWorkOS();

    try {
      // Exchange authorization code for user profile
      const authResponse = await workos.userManagement.authenticateWithCode({
        code: input.code,
        clientId: this.env.WORKOS_CLIENT_ID,
      });

      if (!authResponse.user || !authResponse.user.email) {
        throw new Error('Failed to get user profile from SSO provider');
      }

      const user = authResponse.user;
      const email = user.email;
      const firstName = user.firstName || undefined;
      const lastName = user.lastName || undefined;

      // Find the organization associated with this SSO login
      // WorkOS organizationId is returned at the top level of the response
      const workosOrgId = authResponse.organizationId;

      if (!workosOrgId) {
        throw new Error('No organization associated with SSO login');
      }

      const ssoConnection = await db
        .selectFrom('sso_connections')
        .select(['organization_id'])
        .where('workos_organization_id', '=', workosOrgId)
        .executeTakeFirst();

      if (!ssoConnection) {
        throw new Error('SSO connection not found for this organization');
      }

      const organizationId = ssoConnection.organization_id;

      // Check if user already exists
      let existingUser = await db
        .selectFrom('users')
        .select(['id', 'email'])
        .where('email', '=', email)
        .executeTakeFirst();

      let userId: string;
      let isNewUser = false;

      if (existingUser) {
        userId = existingUser.id;

        // Check if user is already a member of the organization
        const membership = await db
          .selectFrom('organization_members')
          .select('id')
          .where('organization_id', '=', organizationId)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        // If not a member, add them
        if (!membership) {
          const membershipId = `mbr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          await db
            .insertInto('organization_members')
            .values({
              id: membershipId,
              organization_id: organizationId,
              user_id: userId,
              role: 'member',
              joined_at: Date.now(),
              invited_by: null, // SSO auto-provisioning
            })
            .execute();
        }
      } else {
        // Create new user (SSO auto-provisioning)
        isNewUser = true;
        userId = `usr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const now = Date.now();

        // Create user with a placeholder password (SSO users don't use password auth)
        await db
          .insertInto('users')
          .values({
            id: userId,
            email,
            password_hash: 'SSO_USER', // Placeholder - SSO users don't use password authentication
            created_at: now,
            updated_at: now,
          })
          .execute();

        // Add user to organization
        const membershipId = `mbr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await db
          .insertInto('organization_members')
          .values({
            id: membershipId,
            organization_id: organizationId,
            user_id: userId,
            role: 'member',
            joined_at: now,
            invited_by: null, // SSO auto-provisioning
          })
          .execute();
      }

      return {
        userId,
        email,
        organizationId,
        firstName,
        lastName,
        isNewUser,
      };
    } catch (error) {
      this.env.logger.error('SSO callback error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('SSO authentication failed');
    }
  }

  /**
   * Create SSO connection for an organization
   */
  async createSSOConnection(input: CreateSSOConnectionInput): Promise<{
    id: string;
    organizationId: string;
  }> {
    const db = this.getDb();

    // Verify organization exists
    const organization = await db
      .selectFrom('organizations')
      .select(['id'])
      .where('id', '=', input.organizationId)
      .executeTakeFirst();

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Check if SSO connection already exists
    const existingConnection = await db
      .selectFrom('sso_connections')
      .select('id')
      .where('organization_id', '=', input.organizationId)
      .executeTakeFirst();

    if (existingConnection) {
      throw new Error('SSO connection already exists for this organization');
    }

    const connectionId = `sso_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    await db
      .insertInto('sso_connections')
      .values({
        id: connectionId,
        organization_id: input.organizationId,
        provider: input.provider,
        workos_organization_id: input.workosOrganizationId,
        workos_connection_id: input.workosConnectionId || null,
        enabled: 1,
        created_at: now,
        updated_at: now,
      })
      .execute();

    return {
      id: connectionId,
      organizationId: input.organizationId,
    };
  }

  /**
   * Get SSO connection for an organization
   */
  async getSSOConnection(organizationId: string): Promise<{
    id: string;
    organizationId: string;
    provider: string;
    workosOrganizationId: string;
    workosConnectionId: string | null;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  } | null> {
    const db = this.getDb();

    const connection = await db
      .selectFrom('sso_connections')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();

    if (!connection) {
      return null;
    }

    return {
      id: connection.id,
      organizationId: connection.organization_id,
      provider: connection.provider,
      workosOrganizationId: connection.workos_organization_id,
      workosConnectionId: connection.workos_connection_id,
      enabled: connection.enabled === 1,
      createdAt: connection.created_at,
      updatedAt: connection.updated_at,
    };
  }

  /**
   * Update SSO connection (enable/disable)
   */
  async updateSSOConnection(input: UpdateSSOConnectionInput): Promise<{
    success: boolean;
  }> {
    const db = this.getDb();

    const connection = await db
      .selectFrom('sso_connections')
      .select('id')
      .where('organization_id', '=', input.organizationId)
      .executeTakeFirst();

    if (!connection) {
      throw new Error('SSO connection not found');
    }

    await db
      .updateTable('sso_connections')
      .set({
        enabled: input.enabled ? 1 : 0,
        updated_at: Date.now(),
      })
      .where('organization_id', '=', input.organizationId)
      .execute();

    return { success: true };
  }

  /**
   * Delete SSO connection for an organization
   */
  async deleteSSOConnection(organizationId: string): Promise<{
    success: boolean;
  }> {
    const db = this.getDb();

    const connection = await db
      .selectFrom('sso_connections')
      .select('id')
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();

    if (!connection) {
      throw new Error('SSO connection not found');
    }

    await db
      .deleteFrom('sso_connections')
      .where('organization_id', '=', organizationId)
      .execute();

    return { success: true };
  }
}
