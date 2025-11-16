import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface UpdateOrganizationSettingsInput {
  name?: string;
  slug?: string;
  billing_email?: string;
}

interface AddOrganizationMemberInput {
  email: string;
  role: 'admin' | 'member' | 'billing';
}

interface OrganizationSettings {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  billing_email: string | null;
  stripe_customer_id: string | null;
  created_at: number;
  updated_at: number;
  member_count: number;
  workspace_count: number;
  subscription_plan: string | null;
  subscription_status: string | null;
}

interface OrganizationMember {
  id: string;
  user_id: string;
  email: string;
  role: string;
  joined_at: number;
  invited_by: string | null;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Organization Service - Private', { status: 501 });
  }

  /**
   * Check if user has permission to access/modify organization
   * User must be owner or admin
   */
  private async checkOrganizationPermission(
    organizationId: string,
    userId: string,
    requiredRole: 'owner' | 'admin' | 'member' = 'member'
  ): Promise<boolean> {
    const db = this.getDb();

    const membership = await db
      .selectFrom('organization_members')
      .select(['role'])
      .where('organization_id', '=', organizationId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      return false;
    }

    // Owner can do everything
    if (membership.role === 'owner') {
      return true;
    }

    // Admin can do everything except delete organization or change owner
    if (requiredRole === 'admin' && membership.role === 'admin') {
      return true;
    }

    // Member has basic access
    if (requiredRole === 'member' && (membership.role === 'admin' || membership.role === 'member' || membership.role === 'billing')) {
      return true;
    }

    return false;
  }

  /**
   * Get organization settings
   * Returns organization details with aggregated stats
   */
  async getOrganizationSettings(
    organizationId: string,
    userId: string
  ): Promise<OrganizationSettings> {
    const db = this.getDb();

    // Check permission (member-level access required to view)
    const hasPermission = await this.checkOrganizationPermission(organizationId, userId, 'member');
    if (!hasPermission) {
      throw new Error('You do not have permission to view this organization');
    }

    // Get organization details
    const org = await db
      .selectFrom('organizations')
      .selectAll()
      .where('id', '=', organizationId)
      .executeTakeFirst();

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get member count
    const memberCountResult = await db
      .selectFrom('organization_members')
      .select(db.fn.count('id').as('count'))
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();

    const memberCount = Number(memberCountResult?.count || 0);

    // Get workspace count
    const workspaceCountResult = await db
      .selectFrom('workspaces')
      .select(db.fn.count('id').as('count'))
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();

    const workspaceCount = Number(workspaceCountResult?.count || 0);

    // Get active subscription info
    const subscription = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .select([
        'subscription_plans.name as plan_name',
        'subscriptions.status as subscription_status',
      ])
      .where('subscriptions.organization_id', '=', organizationId)
      .where('subscriptions.status', 'in', ['active', 'trialing', 'past_due'])
      .orderBy('subscriptions.created_at', 'desc')
      .executeTakeFirst();

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      owner_user_id: org.owner_user_id,
      billing_email: org.billing_email,
      stripe_customer_id: org.stripe_customer_id,
      created_at: org.created_at,
      updated_at: org.updated_at,
      member_count: memberCount,
      workspace_count: workspaceCount,
      subscription_plan: subscription?.plan_name || null,
      subscription_status: subscription?.subscription_status || null,
    };
  }

  /**
   * Update organization settings
   * Only owner or admin can update
   */
  async updateOrganizationSettings(
    organizationId: string,
    userId: string,
    updates: UpdateOrganizationSettingsInput
  ): Promise<OrganizationSettings> {
    const db = this.getDb();

    // Check permission (admin-level access required to update)
    const hasPermission = await this.checkOrganizationPermission(organizationId, userId, 'admin');
    if (!hasPermission) {
      throw new Error('You do not have permission to update this organization');
    }

    // Validate slug if provided
    if (updates.slug !== undefined) {
      if (!updates.slug || updates.slug.length === 0 || updates.slug.length > 100) {
        throw new Error('Organization slug must be between 1 and 100 characters');
      }

      // Check if slug is already taken (by another organization)
      const existingOrg = await db
        .selectFrom('organizations')
        .select(['id'])
        .where('slug', '=', updates.slug)
        .where('id', '!=', organizationId)
        .executeTakeFirst();

      if (existingOrg) {
        throw new Error('Organization slug is already taken');
      }
    }

    // Validate name if provided
    if (updates.name !== undefined) {
      if (!updates.name || updates.name.length === 0 || updates.name.length > 200) {
        throw new Error('Organization name must be between 1 and 200 characters');
      }
    }

    // Validate billing email if provided
    if (updates.billing_email !== undefined && updates.billing_email !== null) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.billing_email)) {
        throw new Error('Invalid billing email format');
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: Date.now(),
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    if (updates.slug !== undefined) {
      updateData.slug = updates.slug;
    }

    if (updates.billing_email !== undefined) {
      updateData.billing_email = updates.billing_email;
    }

    // Update organization
    await db
      .updateTable('organizations')
      .set(updateData)
      .where('id', '=', organizationId)
      .execute();

    this.env.logger.info('Organization settings updated', {
      organizationId,
      userId,
      updates: Object.keys(updateData),
    });

    // Return updated settings
    return this.getOrganizationSettings(organizationId, userId);
  }

  /**
   * Get organization members
   * Returns list of members with their roles and user info
   */
  async getOrganizationMembers(
    organizationId: string,
    userId: string
  ): Promise<OrganizationMember[]> {
    const db = this.getDb();

    // Check permission (member-level access required to view)
    const hasPermission = await this.checkOrganizationPermission(organizationId, userId, 'member');
    if (!hasPermission) {
      throw new Error('You do not have permission to view organization members');
    }

    // Get all members with user details
    const members = await db
      .selectFrom('organization_members')
      .innerJoin('users', 'users.id', 'organization_members.user_id')
      .select([
        'organization_members.id',
        'organization_members.user_id',
        'users.email',
        'organization_members.role',
        'organization_members.joined_at',
        'organization_members.invited_by',
      ])
      .where('organization_members.organization_id', '=', organizationId)
      .orderBy('organization_members.joined_at', 'asc')
      .execute();

    return members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      email: m.email,
      role: m.role,
      joined_at: m.joined_at,
      invited_by: m.invited_by,
    }));
  }

  /**
   * Add organization member
   * Only owner or admin can add members
   */
  async addOrganizationMember(
    organizationId: string,
    userId: string,
    input: AddOrganizationMemberInput
  ): Promise<OrganizationMember> {
    const db = this.getDb();

    // Check permission (admin-level access required to add members)
    const hasPermission = await this.checkOrganizationPermission(organizationId, userId, 'admin');
    if (!hasPermission) {
      throw new Error('You do not have permission to add members to this organization');
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new Error('Invalid email format');
    }

    // Find user by email
    const targetUser = await db
      .selectFrom('users')
      .select(['id', 'email'])
      .where('email', '=', input.email.toLowerCase())
      .executeTakeFirst();

    if (!targetUser) {
      throw new Error('User not found with this email. They must create an account first.');
    }

    // Check if user is already a member
    const existingMember = await db
      .selectFrom('organization_members')
      .select(['id'])
      .where('organization_id', '=', organizationId)
      .where('user_id', '=', targetUser.id)
      .executeTakeFirst();

    if (existingMember) {
      throw new Error('User is already a member of this organization');
    }

    // Create member record
    const memberId = `om_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    await db
      .insertInto('organization_members')
      .values({
        id: memberId,
        organization_id: organizationId,
        user_id: targetUser.id,
        role: input.role,
        joined_at: now,
        invited_by: userId,
      })
      .execute();

    this.env.logger.info('Organization member added', {
      organizationId,
      userId,
      newMemberId: targetUser.id,
      role: input.role,
    });

    return {
      id: memberId,
      user_id: targetUser.id,
      email: targetUser.email,
      role: input.role,
      joined_at: now,
      invited_by: userId,
    };
  }

  /**
   * Remove organization member
   * Only owner or admin can remove members
   * Cannot remove the owner
   */
  async removeOrganizationMember(
    organizationId: string,
    userId: string,
    memberId: string
  ): Promise<{ success: boolean }> {
    const db = this.getDb();

    // Check permission (admin-level access required to remove members)
    const hasPermission = await this.checkOrganizationPermission(organizationId, userId, 'admin');
    if (!hasPermission) {
      throw new Error('You do not have permission to remove members from this organization');
    }

    // Get member to remove
    const memberToRemove = await db
      .selectFrom('organization_members')
      .select(['user_id', 'role'])
      .where('id', '=', memberId)
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();

    if (!memberToRemove) {
      throw new Error('Member not found');
    }

    // Cannot remove the owner
    if (memberToRemove.role === 'owner') {
      throw new Error('Cannot remove the organization owner');
    }

    // Remove member
    await db
      .deleteFrom('organization_members')
      .where('id', '=', memberId)
      .where('organization_id', '=', organizationId)
      .execute();

    this.env.logger.info('Organization member removed', {
      organizationId,
      userId,
      removedMemberId: memberToRemove.user_id,
    });

    return { success: true };
  }

  /**
   * Update organization member role
   * Only owner or admin can update roles
   * Cannot change the owner's role
   */
  async updateOrganizationMemberRole(
    organizationId: string,
    userId: string,
    memberId: string,
    newRole: 'admin' | 'member' | 'billing'
  ): Promise<OrganizationMember> {
    const db = this.getDb();

    // Check permission (admin-level access required to update roles)
    const hasPermission = await this.checkOrganizationPermission(organizationId, userId, 'admin');
    if (!hasPermission) {
      throw new Error('You do not have permission to update member roles');
    }

    // Get member to update
    const member = await db
      .selectFrom('organization_members')
      .innerJoin('users', 'users.id', 'organization_members.user_id')
      .select([
        'organization_members.id',
        'organization_members.user_id',
        'organization_members.role',
        'organization_members.joined_at',
        'organization_members.invited_by',
        'users.email',
      ])
      .where('organization_members.id', '=', memberId)
      .where('organization_members.organization_id', '=', organizationId)
      .executeTakeFirst();

    if (!member) {
      throw new Error('Member not found');
    }

    // Cannot change the owner's role
    if (member.role === 'owner') {
      throw new Error('Cannot change the organization owner\'s role');
    }

    // Update role
    await db
      .updateTable('organization_members')
      .set({ role: newRole })
      .where('id', '=', memberId)
      .where('organization_id', '=', organizationId)
      .execute();

    this.env.logger.info('Organization member role updated', {
      organizationId,
      userId,
      memberId,
      oldRole: member.role,
      newRole,
    });

    return {
      id: member.id,
      user_id: member.user_id,
      email: member.email,
      role: newRole,
      joined_at: member.joined_at,
      invited_by: member.invited_by,
    };
  }

  /**
   * Get user's organizations
   * Returns all organizations where user is a member
   */
  async getUserOrganizations(userId: string): Promise<Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    member_count: number;
    workspace_count: number;
  }>> {
    const db = this.getDb();

    const organizations = await db
      .selectFrom('organization_members')
      .innerJoin('organizations', 'organizations.id', 'organization_members.organization_id')
      .select([
        'organizations.id',
        'organizations.name',
        'organizations.slug',
        'organization_members.role',
      ])
      .where('organization_members.user_id', '=', userId)
      .orderBy('organization_members.joined_at', 'asc')
      .execute();

    // Get member and workspace counts for each organization
    const orgsWithCounts = await Promise.all(
      organizations.map(async (org) => {
        const memberCountResult = await db
          .selectFrom('organization_members')
          .select(db.fn.count('id').as('count'))
          .where('organization_id', '=', org.id)
          .executeTakeFirst();

        const workspaceCountResult = await db
          .selectFrom('workspaces')
          .select(db.fn.count('id').as('count'))
          .where('organization_id', '=', org.id)
          .executeTakeFirst();

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: org.role,
          member_count: Number(memberCountResult?.count || 0),
          workspace_count: Number(workspaceCountResult?.count || 0),
        };
      })
    );

    return orgsWithCounts;
  }

  /**
   * Get organization usage statistics
   * Aggregates usage across all workspaces in the organization
   */
  async getOrganizationUsage(
    organizationId: string,
    userId: string,
    period: 'current' | 'last30days' | 'all-time' = 'current'
  ): Promise<{
    organization_id: string;
    period: string;
    start_date: string;
    end_date: string;
    total_documents: number;
    total_checks: number;
    total_messages: number;
    total_api_calls: number;
    total_storage_bytes: number;
    by_workspace: Array<{
      workspace_id: string;
      workspace_name: string;
      documents: number;
      checks: number;
      messages: number;
      storage_bytes: number;
      percentage_of_total: number;
    }>;
  }> {
    const db = this.getDb();

    // Check permission (member-level access required)
    const hasPermission = await this.checkOrganizationPermission(organizationId, userId, 'member');
    if (!hasPermission) {
      throw new Error('You do not have permission to view organization usage');
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case 'current':
        // Current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all-time':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get organization-wide usage from organization_usage_daily
    const orgUsageResult = await db
      .selectFrom('organization_usage_daily')
      .select(({ fn }) => [
        fn.sum('documents_created').as('total_documents'),
        fn.sum('compliance_checks_count').as('total_checks'),
        fn.sum('assistant_messages_count').as('total_messages'),
        fn.sum('api_calls_count').as('total_api_calls'),
        fn.sum('storage_bytes').as('total_storage_bytes'),
      ])
      .where('organization_id', '=', organizationId)
      .where('date', '>=', startDateStr)
      .where('date', '<=', endDateStr)
      .executeTakeFirst();

    const totalDocuments = Number(orgUsageResult?.total_documents || 0);
    const totalChecks = Number(orgUsageResult?.total_checks || 0);
    const totalMessages = Number(orgUsageResult?.total_messages || 0);
    const totalApiCalls = Number(orgUsageResult?.total_api_calls || 0);
    const totalStorageBytes = Number(orgUsageResult?.total_storage_bytes || 0);

    // Get usage breakdown by workspace
    const workspaceUsage = await db
      .selectFrom('workspaces as w')
      .leftJoin('documents as d', 'd.workspace_id', 'w.id')
      .leftJoin('compliance_checks as cc', 'cc.workspace_id', 'w.id')
      .select(({ fn }) => [
        'w.id as workspace_id',
        'w.name as workspace_name',
        fn.countAll<number>().as('documents'),
        fn.count('cc.id').as('checks'),
        fn.sum('d.file_size').as('storage_bytes'),
      ])
      .where('w.organization_id', '=', organizationId)
      .groupBy(['w.id', 'w.name'])
      .execute();

    const byWorkspace = workspaceUsage.map((ws) => {
      const documents = Number(ws.documents || 0);
      const checks = Number(ws.checks || 0);
      const storageBytes = Number(ws.storage_bytes || 0);

      return {
        workspace_id: ws.workspace_id,
        workspace_name: ws.workspace_name,
        documents,
        checks,
        messages: 0, // Would need to track this separately
        storage_bytes: storageBytes,
        percentage_of_total:
          totalStorageBytes > 0
            ? Math.round((storageBytes / totalStorageBytes) * 100)
            : 0,
      };
    });

    return {
      organization_id: organizationId,
      period,
      start_date: startDateStr,
      end_date: endDateStr,
      total_documents: totalDocuments,
      total_checks: totalChecks,
      total_messages: totalMessages,
      total_api_calls: totalApiCalls,
      total_storage_bytes: totalStorageBytes,
      by_workspace: byWorkspace,
    };
  }

  /**
   * Get usage forecast for organization
   * Calculates projected end-of-month usage based on current trends
   */
  async getOrganizationUsageForecast(
    organizationId: string,
    userId: string
  ): Promise<{
    organization_id: string;
    current_date: string;
    end_of_month_date: string;
    days_remaining: number;
    plan_limits: {
      max_documents: number;
      max_checks: number;
      max_messages: number;
      max_storage_gb: number;
    };
    current_usage: {
      documents: number;
      checks: number;
      messages: number;
      storage_bytes: number;
    };
    projected_usage: {
      documents: number;
      checks: number;
      messages: number;
      storage_bytes: number;
    };
    usage_percentages: {
      documents: number;
      checks: number;
      messages: number;
      storage: number;
    };
    alerts: Array<{
      metric: string;
      current: number;
      projected: number;
      limit: number;
      percentage: number;
      severity: 'info' | 'warning' | 'critical';
      message: string;
    }>;
  }> {
    const db = this.getDb();

    // Check permission
    const hasPermission = await this.checkOrganizationPermission(organizationId, userId, 'member');
    if (!hasPermission) {
      throw new Error('You do not have permission to view organization usage forecast');
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const daysInMonth = endOfMonth.getDate();
    const daysPassed = now.getDate();
    const daysRemaining = daysInMonth - daysPassed;

    // Get current month usage
    const currentUsage = await this.getOrganizationUsage(organizationId, userId, 'current');

    // Get organization's subscription plan limits
    const subscription = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .select(['subscription_plans.limits'])
      .where('subscriptions.organization_id', '=', organizationId)
      .where('subscriptions.status', 'in', ['active', 'trialing'])
      .orderBy('subscriptions.created_at', 'desc')
      .executeTakeFirst();

    // Parse plan limits (stored as JSON)
    let planLimits = {
      max_documents: 1000,
      max_checks: 500,
      max_messages: 1000,
      max_storage_gb: 10,
    };

    if (subscription?.limits) {
      try {
        const limits = JSON.parse(subscription.limits as string);
        planLimits = {
          max_documents: limits.max_documents || -1,
          max_checks: limits.max_checks || -1,
          max_messages: limits.max_ai_messages || -1,
          max_storage_gb: limits.max_storage_gb || -1,
        };
      } catch (err) {
        this.env.logger.error('Failed to parse plan limits', { error: err });
      }
    }

    // Calculate daily averages
    const dailyDocuments = daysPassed > 0 ? currentUsage.total_documents / daysPassed : 0;
    const dailyChecks = daysPassed > 0 ? currentUsage.total_checks / daysPassed : 0;
    const dailyMessages = daysPassed > 0 ? currentUsage.total_messages / daysPassed : 0;
    const dailyStorage = daysPassed > 0 ? currentUsage.total_storage_bytes / daysPassed : 0;

    // Project to end of month
    const projectedDocuments = Math.round(dailyDocuments * daysInMonth);
    const projectedChecks = Math.round(dailyChecks * daysInMonth);
    const projectedMessages = Math.round(dailyMessages * daysInMonth);
    const projectedStorage = Math.round(dailyStorage * daysInMonth);

    // Calculate percentages
    const docPercentage = planLimits.max_documents > 0
      ? Math.round((projectedDocuments / planLimits.max_documents) * 100)
      : 0;
    const checkPercentage = planLimits.max_checks > 0
      ? Math.round((projectedChecks / planLimits.max_checks) * 100)
      : 0;
    const messagePercentage = planLimits.max_messages > 0
      ? Math.round((projectedMessages / planLimits.max_messages) * 100)
      : 0;
    const storageGb = projectedStorage / (1024 * 1024 * 1024);
    const storagePercentage = planLimits.max_storage_gb > 0
      ? Math.round((storageGb / planLimits.max_storage_gb) * 100)
      : 0;

    // Generate alerts
    const alerts: Array<{
      metric: string;
      current: number;
      projected: number;
      limit: number;
      percentage: number;
      severity: 'info' | 'warning' | 'critical';
      message: string;
    }> = [];

    // Check documents
    if (planLimits.max_documents > 0 && docPercentage >= 70) {
      alerts.push({
        metric: 'documents',
        current: currentUsage.total_documents,
        projected: projectedDocuments,
        limit: planLimits.max_documents,
        percentage: docPercentage,
        severity: docPercentage >= 90 ? 'critical' : 'warning',
        message: `Projected to use ${docPercentage}% of document limit (${projectedDocuments}/${planLimits.max_documents})`,
      });
    }

    // Check compliance checks
    if (planLimits.max_checks > 0 && checkPercentage >= 70) {
      alerts.push({
        metric: 'checks',
        current: currentUsage.total_checks,
        projected: projectedChecks,
        limit: planLimits.max_checks,
        percentage: checkPercentage,
        severity: checkPercentage >= 90 ? 'critical' : 'warning',
        message: `Projected to use ${checkPercentage}% of compliance check limit (${projectedChecks}/${planLimits.max_checks})`,
      });
    }

    // Check AI messages
    if (planLimits.max_messages > 0 && messagePercentage >= 70) {
      alerts.push({
        metric: 'messages',
        current: currentUsage.total_messages,
        projected: projectedMessages,
        limit: planLimits.max_messages,
        percentage: messagePercentage,
        severity: messagePercentage >= 90 ? 'critical' : 'warning',
        message: `Projected to use ${messagePercentage}% of AI message limit (${projectedMessages}/${planLimits.max_messages})`,
      });
    }

    // Check storage
    if (planLimits.max_storage_gb > 0 && storagePercentage >= 70) {
      alerts.push({
        metric: 'storage',
        current: currentUsage.total_storage_bytes,
        projected: projectedStorage,
        limit: planLimits.max_storage_gb * 1024 * 1024 * 1024,
        percentage: storagePercentage,
        severity: storagePercentage >= 90 ? 'critical' : 'warning',
        message: `Projected to use ${storagePercentage}% of storage limit (${storageGb.toFixed(2)} GB/${planLimits.max_storage_gb} GB)`,
      });
    }

    return {
      organization_id: organizationId,
      current_date: now.toISOString().split('T')[0],
      end_of_month_date: endOfMonth.toISOString().split('T')[0],
      days_remaining: daysRemaining,
      plan_limits: planLimits,
      current_usage: {
        documents: currentUsage.total_documents,
        checks: currentUsage.total_checks,
        messages: currentUsage.total_messages,
        storage_bytes: currentUsage.total_storage_bytes,
      },
      projected_usage: {
        documents: projectedDocuments,
        checks: projectedChecks,
        messages: projectedMessages,
        storage_bytes: projectedStorage,
      },
      usage_percentages: {
        documents: docPercentage,
        checks: checkPercentage,
        messages: messagePercentage,
        storage: storagePercentage,
      },
      alerts,
    };
  }
}
