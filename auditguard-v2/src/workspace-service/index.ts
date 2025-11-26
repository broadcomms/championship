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
    organization_id: string | null;
    role: string;
    createdAt: number;
    updatedAt: number;
  }> {
    const db = this.getDb();

    // Get workspace details
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'name', 'description', 'owner_id', 'organization_id', 'created_at', 'updated_at'])
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
      organization_id: workspace.organization_id,
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
        workspace_count: sql.raw('MAX(workspace_count - 1, 0)'), // Prevent negative counts (SQLite compatible)
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

    // First, check if user is the workspace owner (for backwards compatibility)
    const workspace = await db
      .selectFrom('workspaces')
      .select('owner_id')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (workspace && workspace.owner_id === userId) {
      // Workspace owner has full permissions (owner role level = 4)
      const requiredRoleLevel = roleHierarchy[requiredRole];
      return roleHierarchy.owner >= requiredRoleLevel;
    }

    // Get user's role from workspace_members
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

  /**
   * Create a workspace invitation
   */
  async createInvitation(params: {
    workspaceId: string;
    email: string;
    role: 'admin' | 'member' | 'viewer';
    invitedBy: string;
  }): Promise<{
    id: string;
    invitationToken: string;
    expiresAt: number;
  }> {
    const db = this.getDb();
    const { workspaceId, email, role, invitedBy } = params;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address');
    }

    // Check if workspace exists and get workspace details
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'name', 'owner_id'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check if inviter has permission (must be admin or owner)
    const inviterMember = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', invitedBy)
      .executeTakeFirst();

    const isOwner = workspace.owner_id === invitedBy;
    const isAdmin = inviterMember?.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new Error('Only workspace owners and admins can invite members');
    }

    // Check if user is already a member
    const existingMember = await db
      .selectFrom('workspace_members')
      .innerJoin('users', 'users.id', 'workspace_members.user_id')
      .select('workspace_members.user_id')
      .where('workspace_members.workspace_id', '=', workspaceId)
      .where('users.email', '=', email.toLowerCase())
      .executeTakeFirst();

    if (existingMember) {
      throw new Error('User is already a member of this workspace');
    }

    // Check if there's a pending invitation for this email
    const existingInvitation = await db
      .selectFrom('workspace_invitations')
      .select(['id', 'status'])
      .where('workspace_id', '=', workspaceId)
      .where('email', '=', email.toLowerCase())
      .where('status', '=', 'pending')
      .executeTakeFirst();

    if (existingInvitation) {
      throw new Error('An invitation has already been sent to this email');
    }

    // Generate invitation token (crypto-random)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const invitationToken = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');

    // Create invitation (expires in 7 days)
    const id = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + (7 * 24 * 60 * 60 * 1000);

    await db
      .insertInto('workspace_invitations')
      .values({
        id,
        workspace_id: workspaceId,
        email: email.toLowerCase(),
        role,
        invited_by: invitedBy,
        invitation_token: invitationToken,
        status: 'pending',
        expires_at: expiresAt,
        accepted_at: null,
        accepted_by: null,
        created_at: now,
      })
      .execute();

    this.env.logger.info('Workspace invitation created', {
      invitationId: id,
      workspaceId,
      email,
      role,
      invitedBy,
    });

    return {
      id,
      invitationToken,
      expiresAt,
    };
  }

  /**
   * Accept a workspace invitation
   */
  async acceptInvitation(params: {
    invitationToken: string;
    userId: string;
  }): Promise<{
    success: boolean;
    workspaceId: string;
    workspaceName: string;
  }> {
    const db = this.getDb();
    const { invitationToken, userId } = params;
    const now = Date.now();

    // Find invitation by token
    const invitation = await db
      .selectFrom('workspace_invitations')
      .innerJoin('workspaces', 'workspaces.id', 'workspace_invitations.workspace_id')
      .select([
        'workspace_invitations.id',
        'workspace_invitations.workspace_id',
        'workspace_invitations.email',
        'workspace_invitations.role',
        'workspace_invitations.status',
        'workspace_invitations.expires_at',
        'workspaces.name as workspace_name',
      ])
      .where('workspace_invitations.invitation_token', '=', invitationToken)
      .executeTakeFirst();

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    // Check if invitation is expired
    if (invitation.expires_at < now) {
      // Mark as expired
      await db
        .updateTable('workspace_invitations')
        .set({ status: 'expired' })
        .where('id', '=', invitation.id)
        .execute();

      throw new Error('This invitation has expired');
    }

    // Check if invitation is already used or cancelled
    if (invitation.status !== 'pending') {
      throw new Error(`This invitation has already been ${invitation.status}`);
    }

    // Verify user email matches invitation
    const user = await db
      .selectFrom('users')
      .select('email')
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      throw new Error('User not found');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error('This invitation was sent to a different email address');
    }

    // Check if user is already a member
    const existingMember = await db
      .selectFrom('workspace_members')
      .select('user_id')
      .where('workspace_id', '=', invitation.workspace_id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (existingMember) {
      // Mark invitation as accepted even though user is already a member
      await db
        .updateTable('workspace_invitations')
        .set({
          status: 'accepted',
          accepted_at: now,
          accepted_by: userId,
        })
        .where('id', '=', invitation.id)
        .execute();

      return {
        success: true,
        workspaceId: invitation.workspace_id,
        workspaceName: invitation.workspace_name,
      };
    }

    // Add user as workspace member
    await db
      .insertInto('workspace_members')
      .values({
        workspace_id: invitation.workspace_id,
        user_id: userId,
        role: invitation.role,
        added_at: now,
        added_by: invitation.id, // Use invitation ID as added_by to track invitation source
      })
      .execute();

    // Mark invitation as accepted
    await db
      .updateTable('workspace_invitations')
      .set({
        status: 'accepted',
        accepted_at: now,
        accepted_by: userId,
      })
      .where('id', '=', invitation.id)
      .execute();

    this.env.logger.info('Workspace invitation accepted', {
      invitationId: invitation.id,
      workspaceId: invitation.workspace_id,
      userId,
      email: invitation.email,
      role: invitation.role,
    });

    return {
      success: true,
      workspaceId: invitation.workspace_id,
      workspaceName: invitation.workspace_name,
    };
  }

  /**
   * Cancel a workspace invitation
   */
  async cancelInvitation(params: {
    invitationId: string;
    cancelledBy: string;
  }): Promise<{ success: boolean }> {
    const db = this.getDb();
    const { invitationId, cancelledBy } = params;

    // Get invitation details
    const invitation = await db
      .selectFrom('workspace_invitations')
      .innerJoin('workspaces', 'workspaces.id', 'workspace_invitations.workspace_id')
      .select([
        'workspace_invitations.workspace_id',
        'workspace_invitations.status',
        'workspaces.owner_id',
      ])
      .where('workspace_invitations.id', '=', invitationId)
      .executeTakeFirst();

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Check permission (must be admin, owner, or the person who sent the invitation)
    const member = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', invitation.workspace_id)
      .where('user_id', '=', cancelledBy)
      .executeTakeFirst();

    const isOwner = invitation.owner_id === cancelledBy;
    const isAdmin = member?.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new Error('Only workspace owners and admins can cancel invitations');
    }

    // Can only cancel pending invitations
    if (invitation.status !== 'pending') {
      throw new Error(`Cannot cancel invitation with status: ${invitation.status}`);
    }

    // Cancel invitation
    await db
      .updateTable('workspace_invitations')
      .set({ status: 'cancelled' })
      .where('id', '=', invitationId)
      .execute();

    this.env.logger.info('Workspace invitation cancelled', {
      invitationId,
      cancelledBy,
    });

    return { success: true };
  }

  /**
   * Get workspace invitations
   */
  async getWorkspaceInvitations(workspaceId: string): Promise<Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    invitedBy: string;
    inviterName: string;
    expiresAt: number;
    createdAt: number;
  }>> {
    const db = this.getDb();

    const invitations = await db
      .selectFrom('workspace_invitations')
      .innerJoin('users', 'users.id', 'workspace_invitations.invited_by')
      .select([
        'workspace_invitations.id',
        'workspace_invitations.email',
        'workspace_invitations.role',
        'workspace_invitations.status',
        'workspace_invitations.invited_by',
        'workspace_invitations.expires_at',
        'workspace_invitations.created_at',
        'users.email as inviter_email',
      ])
      .where('workspace_invitations.workspace_id', '=', workspaceId)
      .orderBy('workspace_invitations.created_at', 'desc')
      .execute();

    return invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      invitedBy: inv.invited_by,
      inviterName: inv.inviter_email.split('@')[0],
      expiresAt: inv.expires_at,
      createdAt: inv.created_at,
    }));
  }

  /**
   * PHASE 2: Get workspace members with detailed activity stats
   */
  async getMembersDetailed(params: {
    workspaceId: string;
    userId: string;
    includeActivity?: boolean;
  }) {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', params.workspaceId)
      .where('user_id', '=', params.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: Not a workspace member');
    }

    // Get all workspace members with user details
    const members = await db
      .selectFrom('workspace_members')
      .innerJoin('users', 'users.id', 'workspace_members.user_id')
      .select([
        'workspace_members.user_id as id',
        'workspace_members.role',
        'workspace_members.added_at as joined_at',
        'workspace_members.added_by',
        'users.email',
        'users.created_at as user_created_at',
      ])
      .where('workspace_members.workspace_id', '=', params.workspaceId)
      .orderBy('workspace_members.added_at', 'asc')
      .execute();

    // Get activity stats if requested
    let activityStats: Record<string, any> = {};
    if (params.includeActivity) {
      for (const member of members) {
        // Get issue assignments
        const issueCount = await db
          .selectFrom('issue_assignments')
          .innerJoin('compliance_issues', 'compliance_issues.id', 'issue_assignments.issue_id')
          .select(db.fn.count('issue_assignments.id').as('count'))
          .where('issue_assignments.assigned_to', '=', member.id)
          .where('compliance_issues.workspace_id', '=', params.workspaceId)
          .executeTakeFirst();

        // Get documents uploaded
        const docCount = await db
          .selectFrom('documents')
          .select(db.fn.count('id').as('count'))
          .where('workspace_id', '=', params.workspaceId)
          .where('uploaded_by', '=', member.id)
          .executeTakeFirst();

        activityStats[member.id] = {
          lastLogin: null, // TODO: Add last_login tracking to users table
          issuesAssigned: Number(issueCount?.count || 0),
          documentsUploaded: Number(docCount?.count || 0),
        };
      }
    }

    // Get user who added each member
    const adderIds = [...new Set(members.map(m => m.added_by))];
    const adders = await db
      .selectFrom('users')
      .select(['id', 'email'])
      .where('id', 'in', adderIds)
      .execute();
    
    const adderMap = Object.fromEntries(adders.map(a => [a.id, a.email.split('@')[0]]));

    return {
      members: members.map(m => ({
        id: m.id,
        name: m.email.split('@')[0],
        email: m.email,
        role: m.role,
        addedAt: m.joined_at,
        addedBy: {
          id: m.added_by,
          name: adderMap[m.added_by] || 'System',
        },
        activity: params.includeActivity ? activityStats[m.id] : undefined,
      })),
      total: members.length,
    };
  }

  /**
   * PHASE 2: Get workspace activity feed
   */
  async getActivityFeed(params: {
    workspaceId: string;
    userId: string;
    activityTypes?: string[];
    filterUserId?: string;
    limit?: number;
    since?: number;
  }) {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', params.workspaceId)
      .where('user_id', '=', params.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: Not a workspace member');
    }

    const activities: any[] = [];
    const limit = params.limit || 50;
    const since = params.since || 0;

    // Get document upload activities
    if (!params.activityTypes || params.activityTypes.includes('document_uploaded')) {
      let docQuery = db
        .selectFrom('documents')
        .innerJoin('users', 'users.id', 'documents.uploaded_by')
        .select([
          sql`'document_uploaded'`.as('type'),
          'documents.id as entity_id',
          'documents.filename as description',
          'documents.uploaded_by as user_id',
          'users.email as user_email',
          'documents.uploaded_at as timestamp',
        ])
        .where('documents.workspace_id', '=', params.workspaceId)
        .where('documents.uploaded_at', '>=', since);

      if (params.filterUserId) {
        docQuery = docQuery.where('documents.uploaded_by', '=', params.filterUserId);
      }

      const docs = await docQuery.limit(limit).execute();
      activities.push(...docs);
    }

    // Get issue created activities  
    // Note: Compliance issues don't have a created_by field since they're auto-generated
    // We'll fetch them but without user attribution
    if (!params.activityTypes || params.activityTypes.includes('issue_created')) {
      let issueQuery = db
        .selectFrom('compliance_issues')
        .select([
          sql`'issue_created'`.as('type'),
          'compliance_issues.id as entity_id',
          'compliance_issues.title as description',
          sql`NULL`.as('user_id'),
          sql`'System'`.as('user_email'),
          'compliance_issues.created_at as timestamp',
        ])
        .where('compliance_issues.workspace_id', '=', params.workspaceId)
        .where('compliance_issues.created_at', '>=', since);

      const issues = await issueQuery.limit(limit).execute();
      activities.push(...issues);
    }

    // Get issue resolved activities
    if (!params.activityTypes || params.activityTypes.includes('issue_resolved')) {
      let resolvedQuery = db
        .selectFrom('issue_status_history')
        .innerJoin('compliance_issues', 'compliance_issues.id', 'issue_status_history.issue_id')
        .innerJoin('users', 'users.id', 'issue_status_history.changed_by')
        .select([
          sql`'issue_resolved'`.as('type'),
          'compliance_issues.id as entity_id',
          'compliance_issues.title as description',
          'issue_status_history.changed_by as user_id',
          'users.email as user_email',
          'issue_status_history.changed_at as timestamp',
        ])
        .where('compliance_issues.workspace_id', '=', params.workspaceId)
        .where('issue_status_history.new_status', '=', 'resolved')
        .where('issue_status_history.changed_at', '>=', since);

      if (params.filterUserId) {
        resolvedQuery = resolvedQuery.where('issue_status_history.changed_by', '=', params.filterUserId);
      }

      const resolved = await resolvedQuery.limit(limit).execute();
      activities.push(...resolved);
    }

    // Get member added activities
    if (!params.activityTypes || params.activityTypes.includes('member_added')) {
      let memberQuery = db
        .selectFrom('workspace_members')
        .innerJoin('users as u1', 'u1.id', 'workspace_members.user_id')
        .innerJoin('users as u2', 'u2.id', 'workspace_members.added_by')
        .select([
          sql`'member_added'`.as('type'),
          'workspace_members.user_id as entity_id',
          'u1.email as description',
          'workspace_members.added_by as user_id',
          'u2.email as user_email',
          'workspace_members.added_at as timestamp',
        ])
        .where('workspace_members.workspace_id', '=', params.workspaceId)
        .where('workspace_members.added_at', '>=', since);

      if (params.filterUserId) {
        memberQuery = memberQuery.where('workspace_members.added_by', '=', params.filterUserId);
      }

      const members = await memberQuery.limit(limit).execute();
      activities.push(...members);
    }

    // Sort by timestamp descending and limit
    activities.sort((a, b) => b.timestamp - a.timestamp);
    const limitedActivities = activities.slice(0, limit);

    return {
      activities: limitedActivities.map(a => ({
        id: `${a.type}_${a.entity_id}`,
        type: a.type,
        description: a.description,
        user: {
          id: a.user_id,
          name: a.user_email.split('@')[0],
        },
        timestamp: a.timestamp,
        metadata: {
          entityId: a.entity_id,
        },
      })),
      total: limitedActivities.length,
    };
  }

  /**
   * PHASE 2: Get workspace usage statistics
   */
  async getUsageStats(params: {
    workspaceId: string;
    userId: string;
    includeSubscriptionInfo?: boolean;
  }) {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', params.workspaceId)
      .where('user_id', '=', params.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: Not a workspace member');
    }

    // Get workspace info
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'organization_id'])
      .where('id', '=', params.workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Get organization subscription plan
    let billingTier = 'free';
    let subscriptionStatus = 'active';
    let subscriptionPeriodEnd: number | null = null;
    
    const subscription = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .select(['subscription_plans.name', 'subscriptions.status', 'subscriptions.current_period_end'])
      .where('subscriptions.organization_id', '=', workspace.organization_id)
      .where('subscriptions.status', '!=', 'canceled')
      .executeTakeFirst();

    if (subscription) {
      billingTier = subscription.name || 'free';
      subscriptionStatus = subscription.status || 'active';
      subscriptionPeriodEnd = subscription.current_period_end || null;
    }

    // Count documents
    const docCount = await db
      .selectFrom('documents')
      .select(db.fn.count('id').as('count'))
      .where('workspace_id', '=', params.workspaceId)
      .executeTakeFirst();

    // Count compliance checks this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const checkCount = await db
      .selectFrom('compliance_checks')
      .select(db.fn.count('id').as('count'))
      .where('workspace_id', '=', params.workspaceId)
      .where('created_at', '>=', monthStart.getTime())
      .executeTakeFirst();

    // Count assistant messages this month (using query_count from assistant_analytics_daily)
    const msgCount = await db
      .selectFrom('assistant_analytics_daily')
      .select(db.fn.sum('query_count').as('total'))
      .where('workspace_id', '=', params.workspaceId)
      .where('date', '>=', formatDate(monthStart.getTime()))
      .executeTakeFirst();

    // Calculate storage (simplified - sum of document file sizes)
    const storageResult = await db
      .selectFrom('documents')
      .select(db.fn.sum('file_size').as('total'))
      .where('workspace_id', '=', params.workspaceId)
      .executeTakeFirst();

    // Define plan limits based on subscription tier
    const planLimits = {
      free: {
        documents: 10,
        checksPerMonth: 50,
        messagesPerMonth: 100,
        storageMB: 100,
      },
      starter: {
        documents: 100,
        checksPerMonth: 500,
        messagesPerMonth: 1000,
        storageMB: 1000,
      },
      professional: {
        documents: 1000,
        checksPerMonth: 5000,
        messagesPerMonth: 10000,
        storageMB: 10000,
      },
      enterprise: {
        documents: -1, // unlimited
        checksPerMonth: -1,
        messagesPerMonth: -1,
        storageMB: -1,
      },
    };

    const tier = billingTier as keyof typeof planLimits;
    const limits = planLimits[tier] || planLimits.free;

    const currentDocs = Number(docCount?.count || 0);
    const currentChecks = Number(checkCount?.count || 0);
    const currentMessages = Number(msgCount?.total || 0);
    const currentStorageMB = Math.round((Number(storageResult?.total || 0)) / (1024 * 1024));

    // Generate recommendations
    const recommendations: string[] = [];
    if (limits.documents > 0 && currentDocs / limits.documents > 0.8) {
      recommendations.push('You are approaching your document limit. Consider upgrading your plan.');
    }
    if (limits.checksPerMonth > 0 && currentChecks / limits.checksPerMonth > 0.8) {
      recommendations.push('You are approaching your compliance checks limit for this month.');
    }
    if (limits.storageMB > 0 && currentStorageMB / limits.storageMB > 0.8) {
      recommendations.push('You are approaching your storage limit. Consider archiving old documents.');
    }

    const result: any = {
      usage: {
        documents: {
          current: currentDocs,
          limit: limits.documents,
        },
        complianceChecks: {
          current: currentChecks,
          limit: limits.checksPerMonth,
        },
        assistantMessages: {
          current: currentMessages,
          limit: limits.messagesPerMonth,
        },
        storage: {
          currentMB: currentStorageMB,
          limitMB: limits.storageMB,
        },
      },
      recommendations,
    };

    if (params.includeSubscriptionInfo) {
      result.subscription = {
        plan: billingTier,
        status: subscriptionStatus,
        currentPeriodEnd: subscriptionPeriodEnd,
      };
    }

    return result;
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}
