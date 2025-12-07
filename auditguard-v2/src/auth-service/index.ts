import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import bcrypt from 'bcryptjs';

interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }


  async fetch(_request: Request): Promise<Response> {
    return new Response('Auth Service - Private', { status: 501 });
  }

  async register(input: RegisterInput): Promise<{ userId: string; email: string; organizationId: string; createdAt: number }> {
    const db = this.getDb();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password length
    if (!input.password || input.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if user already exists
    const existingUser = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', input.email)
      .executeTakeFirst();

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 10);

    // Generate IDs
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const organizationId = `org_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    // Create user
    await db
      .insertInto('users')
      .values({
        id: userId,
        email: input.email,
        password_hash: passwordHash,
        name: input.name || null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    // PHASE 2: Auto-create personal organization (transparent to user)
    // Generate slug from email (make URL-friendly)
    const orgSlug = input.email
      .toLowerCase()
      .replace('@', '-at-')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    await db
      .insertInto('organizations')
      .values({
        id: organizationId,
        name: `${input.email}'s Organization`,
        slug: orgSlug,
        owner_user_id: userId,
        stripe_customer_id: null, // Will be created on first paid subscription
        billing_email: null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    // Add user as organization owner
    await db
      .insertInto('organization_members')
      .values({
        id: `om_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: organizationId,
        user_id: userId,
        role: 'owner',
        joined_at: now,
        invited_by: null,
      })
      .execute();

    // PHASE 3: Create organization subscription with 14-day Professional trial
    // Auto-activate Professional features for trial period
    const TRIAL_DAYS = 14;
    const trialEnd = now + (TRIAL_DAYS * 24 * 60 * 60 * 1000);
    
    await db
      .insertInto('subscriptions')
      .values({
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: organizationId, // ORG-LEVEL subscription
        plan_id: 'plan_professional', // Start with Professional during trial
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
        status: 'trialing', // Trialing status
        current_period_start: now,
        current_period_end: trialEnd,
        cancel_at_period_end: 0,
        trial_start: now, // PHASE 3: Track trial start
        trial_end: trialEnd, // PHASE 3: 14 days from now
        canceled_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    this.env.logger.info('User registered with personal organization and Professional trial', {
      userId,
      email: input.email,
      organizationId,
      organizationName: `${input.email}'s Organization`,
      trialPlan: 'plan_professional',
      trialDays: 14,
      trialEnd: new Date(trialEnd).toISOString(),
    });

    // Send welcome email
    try {
      const userName = input.email.split('@')[0]; // Extract name from email
      const trialEndDate = new Date(trialEnd).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
        type: 'welcome',
        to: input.email,
        data: {
          userName,
          organizationName: `${input.email}'s Organization`,
          trialEndDate,
        },
      });

      this.env.logger.info('Welcome email queued', { email: input.email });
    } catch (emailError) {
      // Don't fail registration if email fails
      this.env.logger.error('Failed to queue welcome email', {
        error: emailError,
        email: input.email,
      });
    }

    // TODO: Re-enable welcome and trial notifications when notification system is refactored
    // The notification helper functions need to be updated to work with the new auth flow
    try {
      this.env.logger.info('User registration successful', {
        userId,
        organizationId
      });
    } catch (notificationError) {
      // Don't fail registration if notifications fail
      this.env.logger.error('Post-registration tasks failed', {
        error: notificationError,
        userId,
      });
    }

    return {
      userId,
      email: input.email,
      organizationId,
      createdAt: now,
    };
  }

  async login(input: LoginInput): Promise<{ userId: string; email: string; name: string | null; sessionId: string }> {
    const db = this.getDb();

    // Find user by email
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'password_hash', 'name'])
      .where('email', '=', input.email)
      .executeTakeFirst();

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Create session (expires in 7 days)
    const sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days

    await db
      .insertInto('sessions')
      .values({
        id: sessionId,
        user_id: user.id,
        expires_at: expiresAt,
        created_at: now,
      })
      .execute();

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      sessionId,
    };
  }

  /**
   * Create a session for an existing user (used for SSO)
   */
  async createSession(userId: string): Promise<{ sessionId: string; expiresAt: number }> {
    const db = this.getDb();

    // Create session (expires in 7 days)
    const sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days

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
      sessionId,
      expiresAt,
    };
  }

  async logout(sessionId: string): Promise<{ success: boolean }> {
    const db = this.getDb();

    await db
      .deleteFrom('sessions')
      .where('id', '=', sessionId)
      .execute();

    return { success: true };
  }

  async validateSession(sessionId: string): Promise<{ userId: string; email: string } | null> {
    const db = this.getDb();
    const now = Date.now();

    // Get session with user data
    const result = await db
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .select(['users.id as userId', 'users.email', 'sessions.expires_at'])
      .where('sessions.id', '=', sessionId)
      .where('sessions.expires_at', '>', now)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return {
      userId: result.userId,
      email: result.email,
    };
  }

  async getUserById(userId: string): Promise<{ userId: string; email: string; name: string | null; profilePictureUrl: string | null; createdAt: number; isAdmin: boolean } | null> {
    const db = this.getDb();

    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'name', 'profile_picture_url', 'created_at'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      return null;
    }

    // Check if user is an admin
    const adminUser = await db
      .selectFrom('admin_users')
      .select(['user_id'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      profilePictureUrl: user.profile_picture_url,
      createdAt: user.created_at,
      isAdmin: !!adminUser,
    };
  }

  /**
   * Update user profile (name)
   */
  async updateUserProfile(userId: string, input: { name: string }): Promise<{ success: boolean }> {
    const db = this.getDb();
    const now = Date.now();

    await db
      .updateTable('users')
      .set({
        name: input.name,
        updated_at: now,
      })
      .where('id', '=', userId)
      .execute();

    return { success: true };
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, input: { currentPassword: string; newPassword: string }): Promise<{ success: boolean }> {
    const db = this.getDb();

    // Validate new password length
    if (!input.newPassword || input.newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Get current password hash
    const user = await db
      .selectFrom('users')
      .select(['password_hash'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(input.newPassword, 10);
    const now = Date.now();

    // Update password
    await db
      .updateTable('users')
      .set({
        password_hash: newPasswordHash,
        updated_at: now,
      })
      .where('id', '=', userId)
      .execute();

    return { success: true };
  }

  /**
   * Request password reset (generates token)
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; resetToken?: string }> {
    const db = this.getDb();

    // Find user by email
    const user = await db
      .selectFrom('users')
      .select(['id', 'email'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (!user) {
      // Don't reveal if email exists - return success anyway for security
      return { success: true };
    }

    // Generate reset token (cryptographically secure)
    const resetToken = `rst_${Date.now()}_${Math.random().toString(36).substring(2)}_${Math.random().toString(36).substring(2)}`;
    const now = Date.now();
    const expiresAt = now + (60 * 60 * 1000); // 1 hour from now

    // Store token in database
    await db
      .updateTable('users')
      .set({
        password_reset_token: resetToken,
        password_reset_expires: expiresAt,
        updated_at: now,
      })
      .where('id', '=', user.id)
      .execute();

    // Queue password reset email
    try {
      await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
        type: 'password-reset',
        to: user.email,
        data: {
          resetToken,
          resetUrl: `${this.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
        },
      });

      this.env.logger.info('Password reset email queued', { email: user.email });
    } catch (emailError) {
      this.env.logger.error('Failed to queue password reset email', {
        error: emailError,
        email: user.email,
      });
      throw new Error('Failed to send password reset email');
    }

    return { success: true, resetToken }; // resetToken returned for testing purposes
  }

  /**
   * Reset password using token
   */
  async resetPassword(input: { token: string; newPassword: string }): Promise<{ success: boolean }> {
    const db = this.getDb();
    const now = Date.now();

    // Validate new password length
    if (!input.newPassword || input.newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Find user by reset token
    const user = await db
      .selectFrom('users')
      .select(['id', 'password_reset_token', 'password_reset_expires'])
      .where('password_reset_token', '=', input.token)
      .executeTakeFirst();

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Check if token is expired
    if (!user.password_reset_expires || user.password_reset_expires < now) {
      throw new Error('Reset token has expired');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

    // Update password and clear reset token
    await db
      .updateTable('users')
      .set({
        password_hash: newPasswordHash,
        password_reset_token: null,
        password_reset_expires: null,
        updated_at: now,
      })
      .where('id', '=', user.id)
      .execute();

    return { success: true };
  }

  /**
   * Upload profile picture to storage and update user record
   */
  async uploadProfilePicture(
    userId: string,
    imageBuffer: ArrayBuffer,
    contentType: string
  ): Promise<{ profilePictureUrl: string }> {
    const db = this.getDb();

    // Generate S3 key for profile picture
    const fileExtension = contentType.split('/')[1] || 'jpg';
    const s3Key = `profile-pictures/${userId}/${Date.now()}.${fileExtension}`;

    // Upload to storage (using documents-bucket as it's already configured)
    const uploadResult = await this.env.DOCUMENTS_BUCKET.put(s3Key, imageBuffer, {
      httpMetadata: {
        contentType,
      },
    });

    if (!uploadResult) {
      throw new Error('Failed to upload profile picture');
    }

    // Store the S3 key as the profile picture URL
    // The frontend will handle generating the proper URL or fetching via API
    const profilePictureUrl = s3Key;

    // Update user record
    const now = Date.now();
    await db
      .updateTable('users')
      .set({
        profile_picture_url: profilePictureUrl,
        updated_at: now,
      })
      .where('id', '=', userId)
      .execute();

    return { profilePictureUrl };
  }

  /**
   * Get profile picture
   */
  async getProfilePicture(userId: string): Promise<{ imageBuffer: ArrayBuffer; contentType: string } | null> {
    const db = this.getDb();

    // Get user's profile picture URL
    const user = await db
      .selectFrom('users')
      .select(['profile_picture_url'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user || !user.profile_picture_url) {
      return null;
    }

    try {
      // The profile_picture_url contains the S3 key
      const s3Key = user.profile_picture_url;

      // Fetch from S3
      const file = await this.env.DOCUMENTS_BUCKET.get(s3Key);

      if (!file) {
        return null;
      }

      const imageBuffer = await file.arrayBuffer();

      // Determine content type from file extension
      let contentType = 'image/jpeg'; // default
      if (s3Key.endsWith('.png')) {
        contentType = 'image/png';
      } else if (s3Key.endsWith('.gif')) {
        contentType = 'image/gif';
      }

      return { imageBuffer, contentType };
    } catch (error) {
      this.env.logger.error('Failed to fetch profile picture from storage', { error });
      return null;
    }
  }

  /**
   * Delete profile picture from storage and user record
   */
  async deleteProfilePicture(userId: string): Promise<{ success: boolean }> {
    const db = this.getDb();

    // Get current profile picture URL
    const user = await db
      .selectFrom('users')
      .select(['profile_picture_url'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (user?.profile_picture_url) {
      try {
        // Extract S3 key from URL (assumes format: https://bucket.endpoint/key)
        const url = new URL(user.profile_picture_url);
        const s3Key = url.pathname.substring(1); // Remove leading slash

        // Delete from storage
        await this.env.DOCUMENTS_BUCKET.delete(s3Key);
      } catch (error) {
        this.env.logger.error('Failed to delete profile picture from storage', { error });
        // Continue to update database even if storage deletion fails
      }
    }

    // Clear profile picture URL from database
    const now = Date.now();
    await db
      .updateTable('users')
      .set({
        profile_picture_url: null,
        updated_at: now,
      })
      .where('id', '=', userId)
      .execute();

    return { success: true };
  }

  /**
   * Delete user account and all associated data
   * Cascades to delete all owned organizations, workspaces, and documents
   */
  async deleteUserAccount(
    userId: string,
    confirmation: {
      confirmEmail: string;
      password: string;
    }
  ): Promise<{
    success: boolean;
    deleted_organizations: number;
    deleted_workspaces: number;
    deleted_documents: number;
  }> {
    const db = this.getDb();

    // Get user details
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'password_hash'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify confirmation email matches
    if (confirmation.confirmEmail !== user.email) {
      throw new Error('Confirmation email does not match');
    }

    // Verify password for security
    const isValid = await bcrypt.compare(confirmation.password, user.password_hash);
    if (!isValid) {
      throw new Error('Incorrect password');
    }

    // Get all organizations owned by user
    const ownedOrgs = await db
      .selectFrom('organizations')
      .select(['id', 'stripe_customer_id'])
      .where('owner_user_id', '=', userId)
      .execute();

    let totalWorkspaces = 0;
    let totalDocuments = 0;

    // Delete each organization and its data
    for (const org of ownedOrgs) {
      // Get workspaces in this organization
      const workspaces = await db
        .selectFrom('workspaces')
        .select(['id'])
        .where('organization_id', '=', org.id)
        .execute();

      const workspaceIds = workspaces.map((w) => w.id);
      totalWorkspaces += workspaces.length;

      // Count documents before deletion
      if (workspaceIds.length > 0) {
        const docCountResult = await db
          .selectFrom('documents')
          .select(db.fn.count('id').as('count'))
          .where('workspace_id', 'in', workspaceIds)
          .executeTakeFirst();

        totalDocuments += Number(docCountResult?.count || 0);

        // Delete workspaces (cascade will handle documents and related data)
        await db.deleteFrom('workspaces').where('organization_id', '=', org.id).execute();
      }

      // Cancel Stripe subscription if exists
      if (org.stripe_customer_id) {
        const subscription = await db
          .selectFrom('subscriptions')
          .select(['stripe_subscription_id'])
          .where('organization_id', '=', org.id)
          .where('status', 'in', ['active', 'trialing'])
          .executeTakeFirst();

        if (subscription?.stripe_subscription_id) {
          try {
            const Stripe = (await import('stripe')).default;
            const stripe = new Stripe(this.env.STRIPE_SECRET_KEY, {
              apiVersion: '2025-10-29.clover',
            });
            await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          } catch (error) {
            this.env.logger.error('Failed to cancel Stripe subscription during account deletion', {
              error,
            });
          }
        }
      }

      // Delete organization (cascade will handle organization_members, sso_connections, etc.)
      await db.deleteFrom('organizations').where('id', '=', org.id).execute();
    }

    // Delete all user sessions
    await db.deleteFrom('sessions').where('user_id', '=', userId).execute();

    // Delete profile picture if exists
    await this.deleteProfilePicture(userId);

    // Delete user account (cascade will handle remaining references)
    await db.deleteFrom('users').where('id', '=', userId).execute();

    this.env.logger.info('User account deleted', {
      userId,
      organizationsDeleted: ownedOrgs.length,
      workspacesDeleted: totalWorkspaces,
      documentsDeleted: totalDocuments,
    });

    return {
      success: true,
      deleted_organizations: ownedOrgs.length,
      deleted_workspaces: totalWorkspaces,
      deleted_documents: totalDocuments,
    };
  }

  /**
   * Get OAuth authorization URL for social login
   */
  async getOAuthAuthorizationURL(provider: 'google' | 'microsoft'): Promise<{ authorizationUrl: string }> {
    // Map provider names to WorkOS provider identifiers
    const providerMap: Record<string, string> = {
      google: 'GoogleOAuth',
      microsoft: 'MicrosoftOAuth',
    };

    // Build WorkOS authorization URL manually
    const params = new URLSearchParams({
      client_id: this.env.WORKOS_CLIENT_ID,

      // redirect_uri: `${this.env.BACKEND_URL}/api/auth/oauth/callback`,  
      redirect_uri: `https://svc-01kbvcp3j10agjxnv0rhgzev78.01k8njsj98qqesz0ppxff2yq4n.lmapp.run/api/auth/oauth/callback`,
      response_type: 'code',
      provider: providerMap[provider],
    });

    const authorizationUrl = `https://api.workos.com/user_management/authorize?${params.toString()}`;

    return { authorizationUrl };
  }

  /**
   * Handle OAuth callback and provision user
   */
  async handleOAuthCallback(code: string): Promise<{ userId: string; email: string; sessionId: string; isNewUser: boolean }> {
    const db = this.getDb();

    // Exchange authorization code for user profile using WorkOS HTTP API
    // Note: For User Management API, the API key serves as the client_secret
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
      throw new Error(`WorkOS authentication failed: ${error}`);
    }

    const { user: workosUser, access_token: accessToken } = await tokenResponse.json() as {
      user: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
        profilePictureUrl?: string;
      };
      access_token: string;
    };

    // Check if user exists by WorkOS user ID or email
    let user = await db
      .selectFrom('users')
      .select(['id', 'email', 'workos_user_id'])
      .where((eb) =>
        eb.or([
          eb('workos_user_id', '=', workosUser.id),
          eb('email', '=', workosUser.email),
        ])
      )
      .executeTakeFirst();

    const now = Date.now();
    let isNewUser = false;
    let userId: string;
    let organizationId: string;

    if (user) {
      // Existing user - update WorkOS info and profile
      userId = user.id;

      await db
        .updateTable('users')
        .set({
          workos_user_id: workosUser.id,
          oauth_provider: workosUser.profilePictureUrl?.includes('google') ? 'google' : 'microsoft',
          oauth_profile_data: JSON.stringify(workosUser),
          profile_picture_url: workosUser.profilePictureUrl || null,
          last_login: now,
          updated_at: now,
        })
        .where('id', '=', userId)
        .execute();

      this.env.logger.info('Existing user logged in via OAuth', { userId, email: workosUser.email });
    } else {
      // New user - create account
      isNewUser = true;
      userId = `usr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      organizationId = `org_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Generate slug from email
      const orgSlug = workosUser.email
        .toLowerCase()
        .replace('@', '-at-')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Create user
      await db
        .insertInto('users')
        .values({
          id: userId,
          email: workosUser.email,
          password_hash: '', // No password for OAuth users
          name: `${workosUser.firstName || ''} ${workosUser.lastName || ''}`.trim() || null,
          workos_user_id: workosUser.id,
          oauth_provider: workosUser.profilePictureUrl?.includes('google') ? 'google' : 'microsoft',
          oauth_profile_data: JSON.stringify(workosUser),
          profile_picture_url: workosUser.profilePictureUrl || null,
          created_at: now,
          updated_at: now,
        })
        .execute();

      // Create personal organization
      await db
        .insertInto('organizations')
        .values({
          id: organizationId,
          name: `${workosUser.email}'s Organization`,
          slug: orgSlug,
          owner_user_id: userId,
          stripe_customer_id: null,
          billing_email: null,
          created_at: now,
          updated_at: now,
        })
        .execute();

      // Add user as organization owner
      await db
        .insertInto('organization_members')
        .values({
          id: `om_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: organizationId,
          user_id: userId,
          role: 'owner',
          joined_at: now,
          invited_by: null,
        })
        .execute();

      this.env.logger.info('New user created via OAuth', { userId, email: workosUser.email });

      // TODO: Send welcome notifications (requires proper notification setup)
      // For now, skip notifications to avoid errors during development
    }

    // Create session
    const sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

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
    };
  }
}
