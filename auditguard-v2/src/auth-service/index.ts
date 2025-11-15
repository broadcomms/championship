import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import bcrypt from 'bcryptjs';

interface RegisterInput {
  email: string;
  password: string;
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

    // Create free plan subscription at ORGANIZATION level (not workspace level)
    await db
      .insertInto('subscriptions')
      .values({
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: organizationId, // ORG-LEVEL subscription
        plan_id: 'plan_free',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
        status: 'active',
        current_period_start: now,
        current_period_end: now + (365 * 24 * 60 * 60 * 1000), // 1 year
        cancel_at_period_end: 0,
        trial_end: null,
        trial_start: null,
        canceled_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    this.env.logger.info('User registered with personal organization', {
      userId,
      email: input.email,
      organizationId,
      organizationName: `${input.email}'s Organization`,
    });

    return {
      userId,
      email: input.email,
      organizationId,
      createdAt: now,
    };
  }

  async login(input: LoginInput): Promise<{ userId: string; email: string; sessionId: string }> {
    const db = this.getDb();

    // Find user by email
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'password_hash'])
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
      sessionId,
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

  async getUserById(userId: string): Promise<{ userId: string; email: string; createdAt: number; isAdmin: boolean } | null> {
    const db = this.getDb();

    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'created_at'])
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
      createdAt: user.created_at,
      isAdmin: !!adminUser,
    };
  }
}
