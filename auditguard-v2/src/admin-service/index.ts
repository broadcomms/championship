import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface CreateAdminInput {
  userId: string;
  role: 'super_admin' | 'support' | 'billing_admin';
  permissions: string[];
  createdBy: string;
}

interface SystemStatsResponse {
  totalUsers: number;
  totalWorkspaces: number;
  totalDocuments: number;
  totalChecks: number;
  activeSubscriptions: number;
  revenue: {
    monthly: number;
    yearly: number;
  };
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Admin Service - Private', { status: 501 });
  }

  async isAdmin(userId: string): Promise<boolean> {
    const db = this.getDb();

    const admin = await db.selectFrom('admin_users').select('user_id').where('user_id', '=', userId).executeTakeFirst();

    return !!admin;
  }

  async createAdmin(adminUserId: string, input: CreateAdminInput): Promise<{ success: boolean }> {
    const db = this.getDb();

    // Verify caller is super_admin
    const caller = await db
      .selectFrom('admin_users')
      .select('role')
      .where('user_id', '=', adminUserId)
      .executeTakeFirst();

    if (!caller || caller.role !== 'super_admin') {
      throw new Error('Access denied: Only super admins can create admin users');
    }

    // Check if user exists
    const user = await db.selectFrom('users').select('id').where('id', '=', input.userId).executeTakeFirst();

    if (!user) {
      throw new Error('User not found');
    }

    // Create admin
    const now = Date.now();

    await db
      .insertInto('admin_users')
      .values({
        user_id: input.userId,
        role: input.role,
        permissions: JSON.stringify(input.permissions),
        created_at: now,
        created_by: input.createdBy,
      })
      .execute();

    // Log action
    await this.logAdminAction(adminUserId, 'create_admin', 'admin_user', input.userId, {
      role: input.role,
      permissions: input.permissions,
    });

    return { success: true };
  }

  async getSystemStats(adminUserId: string): Promise<SystemStatsResponse> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    // Get stats
    const [userCount, workspaceCount, documentCount, checkCount, subscriptionCount] = await Promise.all([
      db
        .selectFrom('users')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .executeTakeFirst(),

      db
        .selectFrom('workspaces')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .executeTakeFirst(),

      db
        .selectFrom('documents')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .executeTakeFirst(),

      db
        .selectFrom('compliance_checks')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .executeTakeFirst(),

      db
        .selectFrom('subscriptions')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('status', '=', 'active')
        .executeTakeFirst(),
    ]);

    // Calculate revenue (from active subscriptions)
    const subscriptions = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscriptions.plan_id', 'subscription_plans.id')
      .select(['subscription_plans.price_monthly', 'subscription_plans.price_yearly'])
      .where('subscriptions.status', '=', 'active')
      .execute();

    let monthlyRevenue = 0;
    let yearlyRevenue = 0;

    for (const sub of subscriptions) {
      monthlyRevenue += sub.price_monthly;
      yearlyRevenue += sub.price_yearly;
    }

    return {
      totalUsers: userCount?.count || 0,
      totalWorkspaces: workspaceCount?.count || 0,
      totalDocuments: documentCount?.count || 0,
      totalChecks: checkCount?.count || 0,
      activeSubscriptions: subscriptionCount?.count || 0,
      revenue: {
        monthly: monthlyRevenue,
        yearly: yearlyRevenue,
      },
    };
  }

  async getAllUsers(adminUserId: string, limit: number = 50, offset: number = 0): Promise<{
    users: Array<{
      id: string;
      email: string;
      createdAt: number;
      workspaceCount: number;
    }>;
    total: number;
  }> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const users = await db
      .selectFrom('users')
      .leftJoin('workspaces', 'users.id', 'workspaces.owner_id')
      .select(['users.id', 'users.email', 'users.created_at', ({ fn }) => fn.count<number>('workspaces.id').as('workspace_count')])
      .groupBy('users.id')
      .orderBy('users.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    const totalResult = await db
      .selectFrom('users')
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .executeTakeFirst();

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        workspaceCount: u.workspace_count || 0,
      })),
      total: totalResult?.count || 0,
    };
  }

  async getSystemSettings(adminUserId: string): Promise<{
    settings: Record<string, { value: string; type: string; description: string | null }>;
  }> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const settings = await db.selectFrom('system_settings').selectAll().execute();

    const result: Record<string, { value: string; type: string; description: string | null }> = {};

    for (const setting of settings) {
      result[setting.key] = {
        value: setting.value,
        type: setting.value_type,
        description: setting.description,
      };
    }

    return { settings: result };
  }

  async updateSystemSetting(
    adminUserId: string,
    key: string,
    value: string
  ): Promise<{ success: boolean; key: string; value: string }> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const now = Date.now();

    await db
      .updateTable('system_settings')
      .set({
        value,
        updated_at: now,
        updated_by: adminUserId,
      })
      .where('key', '=', key)
      .execute();

    // Log action
    await this.logAdminAction(adminUserId, 'update_setting', 'system_setting', key, { value });

    return { success: true, key, value };
  }

  async getAuditLog(adminUserId: string, limit: number = 50): Promise<{
    logs: Array<{
      id: string;
      adminUserId: string;
      adminEmail: string;
      action: string;
      resourceType: string;
      resourceId: string | null;
      changes: Record<string, unknown> | null;
      createdAt: number;
    }>;
  }> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const logs = await db
      .selectFrom('admin_audit_log')
      .innerJoin('users', 'admin_audit_log.admin_user_id', 'users.id')
      .select([
        'admin_audit_log.id',
        'admin_audit_log.admin_user_id',
        'users.email as admin_email',
        'admin_audit_log.action',
        'admin_audit_log.resource_type',
        'admin_audit_log.resource_id',
        'admin_audit_log.changes',
        'admin_audit_log.created_at',
      ])
      .orderBy('admin_audit_log.created_at', 'desc')
      .limit(limit)
      .execute();

    return {
      logs: logs.map((log) => ({
        id: log.id,
        adminUserId: log.admin_user_id,
        adminEmail: log.admin_email,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        changes: log.changes ? JSON.parse(log.changes) : null,
        createdAt: log.created_at,
      })),
    };
  }

  private async logAdminAction(
    adminUserId: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    changes?: Record<string, unknown>
  ): Promise<void> {
    const db = this.getDb();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      await db
        .insertInto('admin_audit_log')
        .values({
          id: logId,
          admin_user_id: adminUserId,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          changes: changes ? JSON.stringify(changes) : null,
          ip_address: null,
          created_at: Date.now(),
        })
        .execute();
    } catch (error) {
      this.env.logger.error(`Failed to log admin action: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async queryAnalytics(adminUserId: string, query: string): Promise<{
    result: Record<string, unknown>;
    query: string;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    // Use SmartSQL for natural language queries
    try {
      const result = await this.env.ANALYTICS_SMARTSQL.executeQuery({
        textQuery: query,
      });

      // Log the query
      await this.logAdminAction(adminUserId, 'analytics_query', 'smartsql', null, { query });

      return {
        result: result as unknown as Record<string, unknown>,
        query,
      };
    } catch (error) {
      this.env.logger.error(`SmartSQL query failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      throw new Error('Analytics query failed');
    }
  }
}
