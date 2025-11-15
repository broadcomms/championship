import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely, sql } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface CreateWorkspaceInput {
  name: string;
  description?: string;
  userId: string;
}

interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
}

interface AddMemberInput {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Workspace Service - Private', { status: 501 });
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<{
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    createdAt: number;
    updatedAt: number;
  }> {
    const db = this.getDb();

    // Validate input
    if (!input.name || input.name.length === 0 || input.name.length > 200) {
      throw new Error('Workspace name must be between 1 and 200 characters');
    }

    if (input.description && input.description.length > 1000) {
      throw new Error('Description must not exceed 1000 characters');
    }

    // PHASE 2: Get user's personal organization (auto-created during signup)
    const userOrg = await db
      .selectFrom('organization_members')
      .innerJoin('organizations', 'organizations.id', 'organization_members.organization_id')
      .select(['organizations.id', 'organizations.name'])
      .where('organization_members.user_id', '=', input.userId)
      .where('organization_members.role', '=', 'owner')
      .executeTakeFirst();

    if (!userOrg) {
      throw new Error('User has no organization. This should not happen. Please contact support.');
    }

    // Check workspace limits at ORGANIZATION level (sum across all workspaces in org)
    const orgWorkspaceCount = await db
      .selectFrom('workspaces')
      .select(db.fn.count('id').as('count'))
      .where('organization_id', '=', userOrg.id)
      .executeTakeFirst();

    const workspaceCount = Number(orgWorkspaceCount?.count || 0);

    // Get organization's subscription plan limits
    const orgSubscription = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .select(['subscription_plans.max_workspaces', 'subscription_plans.name'])
      .where('subscriptions.organization_id', '=', userOrg.id)
      .where('subscriptions.status', '=', 'active')
      .orderBy('subscription_plans.max_workspaces', 'desc')
      .executeTakeFirst();

    // Default to free plan limits if no active subscription
    const maxWorkspaces = orgSubscription?.max_workspaces ?? 3;
    const planName = orgSubscription?.name ?? 'free';

    // Enforce workspace limit (-1 means unlimited)
    if (maxWorkspaces !== -1 && workspaceCount >= maxWorkspaces) {
      this.env.logger.warn('Workspace creation blocked - organization limit reached', {
        userId: input.userId,
        organizationId: userOrg.id,
        organizationName: userOrg.name,
        currentCount: workspaceCount,
        maxAllowed: maxWorkspaces,
        plan: planName,
      });

      throw new Error(
        `Organization workspace limit reached. Your ${planName} plan allows ${maxWorkspaces} workspace${maxWorkspaces !== 1 ? 's' : ''}. ` +
        `Your organization "${userOrg.name}" currently has ${workspaceCount}. Please upgrade your plan to create more workspaces.`
      );
    }

    this.env.logger.info('Creating workspace within organization limits', {
      userId: input.userId,
      organizationId: userOrg.id,
      organizationName: userOrg.name,
      currentCount: workspaceCount,
      maxAllowed: maxWorkspaces,
      plan: planName,
    });

    // Generate workspace ID
    const workspaceId = `wks_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    // Create workspace - AUTO-ASSIGN to user's organization
    await db
      .insertInto('workspaces')
      .values({
        id: workspaceId,
        name: input.name,
        description: input.description || null,
        owner_id: input.userId,
        organization_id: userOrg.id, // AUTO-ASSIGNED to personal org
        created_at: now,
        updated_at: now,
      })
      .execute();

    // Add creator as owner in workspace_members
    await db
      .insertInto('workspace_members')
      .values({
        workspace_id: workspaceId,
        user_id: input.userId,
        role: 'owner',
        added_at: now,
        added_by: input.userId,
      })
      .execute();

    // Update user's workspace_count
    await db
      .updateTable('users')
      .set({
        workspace_count: workspaceCount + 1,
        updated_at: now,
      })
      .where('id', '=', input.userId)
      .execute();

    this.env.logger.info('Workspace created successfully', {
      workspaceId,
      userId: input.userId,
      newWorkspaceCount: workspaceCount + 1,
    });

    return {
      id: workspaceId,
      name: input.name,
      description: input.description || null,
      ownerId: input.userId,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getWorkspaces(userId: string): Promise<{
    workspaces: Array<{
      id: string;
      name: string;
      description: string | null;
      role: string;
      memberCount: number;
      updatedAt: number;
    }>;
  }> {
    const db = this.getDb();

    // Get workspaces where user is a member
    const memberships = await db
      .selectFrom('workspace_members')
      .innerJoin('workspaces', 'workspaces.id', 'workspace_members.workspace_id')
      .select([
        'workspaces.id',
        'workspaces.name',
        'workspaces.description',
        'workspaces.updated_at',
        'workspace_members.role',
      ])
      .where('workspace_members.user_id', '=', userId)
      .execute();

    // Get member counts for each workspace
    const workspaces = await Promise.all(
      memberships.map(async (workspace) => {
        const memberCountResult = await db
          .selectFrom('workspace_members')
          .select(db.fn.count('user_id').as('count'))
          .where('workspace_id', '=', workspace.id)
          .executeTakeFirst();

        return {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          role: workspace.role,
          memberCount: Number(memberCountResult?.count || 0),
          updatedAt: workspace.updated_at,
        };
      })
    );

    return { workspaces };
  }

  async getWorkspace(workspaceId: string, userId: string): Promise<{
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    role: string;
    createdAt: number;
    updatedAt: number;
  }> {
    const db = this.getDb();

    // Get workspace details
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'name', 'description', 'owner_id', 'created_at', 'updated_at'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Get user's role
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      ownerId: workspace.owner_id,
      role: membership.role,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
    };
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    updates: UpdateWorkspaceInput
  ): Promise<{
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    updatedAt: number;
  }> {
    const db = this.getDb();

    // Check permissions (owner or admin)
    const hasPermission = await this.checkPermission(workspaceId, userId, 'admin');
    if (!hasPermission) {
      throw new Error('Access denied: Requires owner or admin role');
    }

    // Validate input
    if (updates.name !== undefined && (updates.name.length === 0 || updates.name.length > 200)) {
      throw new Error('Workspace name must be between 1 and 200 characters');
    }

    if (updates.description !== undefined && updates.description.length > 1000) {
      throw new Error('Description must not exceed 1000 characters');
    }

    const now = Date.now();

    // Update workspace
    const updateData: any = { updated_at: now };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;

    await db
      .updateTable('workspaces')
      .set(updateData)
      .where('id', '=', workspaceId)
      .execute();

    // Get updated workspace
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'name', 'description', 'owner_id', 'updated_at'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      ownerId: workspace.owner_id,
      updatedAt: workspace.updated_at,
    };
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<{ success: boolean }> {
    const db = this.getDb();

    // Check if user is the owner
    const workspace = await db
      .selectFrom('workspaces')
      .select('owner_id')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.owner_id !== userId) {
      throw new Error('Access denied: Only the workspace owner can delete it');
    }

    // Delete workspace (cascade will handle members and documents)
    await db.deleteFrom('workspaces').where('id', '=', workspaceId).execute();

    // Decrement user's workspace_count
    await db
      .updateTable('users')
      .set({
        workspace_count: sql.raw('GREATEST(workspace_count - 1, 0)'), // Prevent negative counts
        updated_at: Date.now(),
      })
      .where('id', '=', userId)
      .execute();

    this.env.logger.info('Workspace deleted and count updated', {
      workspaceId,
      userId,
    });

    return { success: true };
  }

  async getMembers(workspaceId: string, userId: string): Promise<{
    members: Array<{
      userId: string;
      email: string;
      role: string;
      addedAt: number;
      addedBy: string;
    }>;
  }> {
    const db = this.getDb();

    // Check if user has access to workspace
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Get all members with user details
    const members = await db
      .selectFrom('workspace_members')
      .innerJoin('users', 'users.id', 'workspace_members.user_id')
      .select([
        'workspace_members.user_id',
        'users.email',
        'workspace_members.role',
        'workspace_members.added_at',
        'workspace_members.added_by',
      ])
      .where('workspace_members.workspace_id', '=', workspaceId)
      .execute();

    return {
      members: members.map((m) => ({
        userId: m.user_id,
        email: m.email,
        role: m.role,
        addedAt: m.added_at,
        addedBy: m.added_by,
      })),
    };
  }

  async addMember(
    workspaceId: string,
    requestingUserId: string,
    input: AddMemberInput
  ): Promise<{
    userId: string;
    email: string;
    role: string;
    addedAt: number;
    addedBy: string;
  }> {
    const db = this.getDb();

    // Check permissions (owner or admin)
    const hasPermission = await this.checkPermission(workspaceId, requestingUserId, 'admin');
    if (!hasPermission) {
      throw new Error('Access denied: Requires owner or admin role');
    }

    // Validate role
    if (!['admin', 'member', 'viewer'].includes(input.role)) {
      throw new Error('Invalid role. Must be admin, member, or viewer');
    }

    // Find user by email
    const user = await db
      .selectFrom('users')
      .select(['id', 'email'])
      .where('email', '=', input.email)
      .executeTakeFirst();

    if (!user) {
      throw new Error('User not found with that email');
    }

    // Check if user is already a member
    const existingMember = await db
      .selectFrom('workspace_members')
      .select('user_id')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', user.id)
      .executeTakeFirst();

    if (existingMember) {
      throw new Error('User is already a member of this workspace');
    }

    const now = Date.now();

    // Add member
    await db
      .insertInto('workspace_members')
      .values({
        workspace_id: workspaceId,
        user_id: user.id,
        role: input.role,
        added_at: now,
        added_by: requestingUserId,
      })
      .execute();

    return {
      userId: user.id,
      email: user.email,
      role: input.role,
      addedAt: now,
      addedBy: requestingUserId,
    };
  }

  async updateMemberRole(
    workspaceId: string,
    requestingUserId: string,
    targetUserId: string,
    newRole: 'admin' | 'member' | 'viewer'
  ): Promise<{
    userId: string;
    email: string;
    role: string;
    addedAt: number;
    addedBy: string;
  }> {
    const db = this.getDb();

    // Check permissions (owner or admin)
    const hasPermission = await this.checkPermission(workspaceId, requestingUserId, 'admin');
    if (!hasPermission) {
      throw new Error('Access denied: Requires owner or admin role');
    }

    // Validate role
    if (!['admin', 'member', 'viewer'].includes(newRole)) {
      throw new Error('Invalid role. Must be admin, member, or viewer');
    }

    // Check if target user is a member
    const member = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', targetUserId)
      .executeTakeFirst();

    if (!member) {
      throw new Error('User is not a member of this workspace');
    }

    // Cannot change owner role
    if (member.role === 'owner') {
      throw new Error('Cannot change the role of the workspace owner');
    }

    // Update role
    await db
      .updateTable('workspace_members')
      .set({ role: newRole })
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', targetUserId)
      .execute();

    // Get updated member info
    const updatedMember = await db
      .selectFrom('workspace_members')
      .innerJoin('users', 'users.id', 'workspace_members.user_id')
      .select([
        'workspace_members.user_id',
        'users.email',
        'workspace_members.role',
        'workspace_members.added_at',
        'workspace_members.added_by',
      ])
      .where('workspace_members.workspace_id', '=', workspaceId)
      .where('workspace_members.user_id', '=', targetUserId)
      .executeTakeFirst();

    if (!updatedMember) {
      throw new Error('Member not found');
    }

    return {
      userId: updatedMember.user_id,
      email: updatedMember.email,
      role: updatedMember.role,
      addedAt: updatedMember.added_at,
      addedBy: updatedMember.added_by,
    };
  }

  async removeMember(
    workspaceId: string,
    requestingUserId: string,
    targetUserId: string
  ): Promise<{ success: boolean }> {
    const db = this.getDb();

    // Check permissions (owner or admin)
    const hasPermission = await this.checkPermission(workspaceId, requestingUserId, 'admin');
    if (!hasPermission) {
      throw new Error('Access denied: Requires owner or admin role');
    }

    // Check if target user is a member
    const member = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', targetUserId)
      .executeTakeFirst();

    if (!member) {
      throw new Error('User is not a member of this workspace');
    }

    // Cannot remove owner
    if (member.role === 'owner') {
      throw new Error('Cannot remove the workspace owner');
    }

    // Remove member
    await db
      .deleteFrom('workspace_members')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', targetUserId)
      .execute();

    return { success: true };
  }

  async checkPermission(
    workspaceId: string,
    userId: string,
    requiredRole: 'owner' | 'admin' | 'member' | 'viewer'
  ): Promise<boolean> {
    const db = this.getDb();

    const roleHierarchy = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    // Get user's role
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      return false;
    }

    // Check if user's role is sufficient
    const userRoleLevel = roleHierarchy[membership.role as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole];

    return userRoleLevel >= requiredRoleLevel;
  }

  async getWorkspaceLimits(userId: string): Promise<{
    currentCount: number;
    maxWorkspaces: number;
    planName: string;
    isAtLimit: boolean;
  }> {
    const db = this.getDb();

    // PHASE 2: Get user's personal organization
    const userOrg = await db
      .selectFrom('organization_members')
      .innerJoin('organizations', 'organizations.id', 'organization_members.organization_id')
      .select(['organizations.id', 'organizations.name'])
      .where('organization_members.user_id', '=', userId)
      .where('organization_members.role', '=', 'owner')
      .executeTakeFirst();

    if (!userOrg) {
      // Fallback: Return free plan limits if no organization (shouldn't happen)
      return {
        currentCount: 0,
        maxWorkspaces: 3,
        planName: 'Free',
        isAtLimit: false,
      };
    }

    // Count workspaces in user's organization
    const orgWorkspaceCount = await db
      .selectFrom('workspaces')
      .select(db.fn.count('id').as('count'))
      .where('organization_id', '=', userOrg.id)
      .executeTakeFirst();

    const currentCount = Number(orgWorkspaceCount?.count || 0);

    // Get organization's active subscription plan
    const orgSubscription = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .select(['subscription_plans.max_workspaces', 'subscription_plans.name', 'subscription_plans.display_name'])
      .where('subscriptions.organization_id', '=', userOrg.id)
      .where('subscriptions.status', '=', 'active')
      .orderBy('subscription_plans.max_workspaces', 'desc')
      .executeTakeFirst();

    // Default to free plan limits if no active subscription
    const maxWorkspaces = orgSubscription?.max_workspaces ?? 3;
    const planName = orgSubscription?.display_name || orgSubscription?.name || 'Free';

    // Check if at limit (-1 means unlimited)
    const isAtLimit = maxWorkspaces !== -1 && currentCount >= maxWorkspaces;

    return {
      currentCount,
      maxWorkspaces,
      planName,
      isAtLimit,
    };
  }
}
