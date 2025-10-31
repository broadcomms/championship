import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
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

    // Generate workspace ID
    const workspaceId = `wks_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    // Create workspace
    await db
      .insertInto('workspaces')
      .values({
        id: workspaceId,
        name: input.name,
        description: input.description || null,
        owner_id: input.userId,
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
}
