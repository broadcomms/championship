/**
 * Issue Assignment Service
 * Handles assignment and unassignment of compliance issues to team members.
 */

import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { Env } from './raindrop.gen';

type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Issue Assignment Service - Private', { status: 501 });
  }

  /**
   * Assign issue to a user
   */
  async assignIssue(input: {
    issueId: string;
    workspaceId: string;
    assignedTo: string;
    assignedBy: string;
    notes?: string;
  }): Promise<void> {
    const db = this.getDb();

    // Verify assignedBy has workspace access
    const assignerMembership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.assignedBy)
      .executeTakeFirst();

    if (!assignerMembership) {
      throw new Error('Access denied: Assigner is not a member of this workspace');
    }

    // Verify assignedTo has workspace access
    const assigneeMembership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.assignedTo)
      .executeTakeFirst();

    if (!assigneeMembership) {
      throw new Error('Cannot assign: User is not a member of this workspace');
    }

    // Verify issue exists
    const issue = await db
      .selectFrom('compliance_issues')
      .select(['id', 'workspace_id', 'assigned_to'])
      .where('id', '=', input.issueId)
      .where('workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!issue) {
      throw new Error('Issue not found');
    }

    const now = Date.now();

    // If already assigned to someone, unassign first
    if (issue.assigned_to) {
      await db
        .updateTable('issue_assignments')
        .set({
          unassigned_at: now,
        })
        .where('issue_id', '=', input.issueId)
        .where('unassigned_at', 'is', null)
        .execute();
    }

    // Update issue with new assignment
    await db
      .updateTable('compliance_issues')
      .set({
        assigned_to: input.assignedTo,
        updated_at: now,
      })
      .where('id', '=', input.issueId)
      .execute();

    // Create assignment record
    const assignmentId = `assign_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await db
      .insertInto('issue_assignments')
      .values({
        id: assignmentId,
        issue_id: input.issueId,
        workspace_id: input.workspaceId,
        assigned_by: input.assignedBy,
        assigned_to: input.assignedTo,
        assigned_at: now,
        unassigned_at: null,
        notes: input.notes || null,
        notification_sent: 0,
      })
      .execute();

    // Send email notification to assignee
    try {
      // Fetch assignee email
      const assignee = await db
        .selectFrom('users')
        .select('email')
        .where('id', '=', input.assignedTo)
        .executeTakeFirst();

      // Fetch assigner email for display name
      const assigner = await db
        .selectFrom('users')
        .select('email')
        .where('id', '=', input.assignedBy)
        .executeTakeFirst();

      // Fetch complete issue details
      const issueDetails = await db
        .selectFrom('compliance_issues')
        .select(['title', 'severity', 'framework'])
        .where('id', '=', input.issueId)
        .executeTakeFirst();

      // Fetch workspace name
      const workspace = await db
        .selectFrom('workspaces')
        .select('name')
        .where('id', '=', input.workspaceId)
        .executeTakeFirst();

      if (assignee && issueDetails && workspace) {
        // Extract user names from emails
        const assigneeName = assignee.email.split('@')[0];
        const assignerName = assigner ? assigner.email.split('@')[0] : 'Team Member';

        // Send email via queue
        await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
          type: 'issue_assignment',
          to: assignee.email,
          data: {
            assigneeName,
            assignerName,
            issueTitle: issueDetails.title,
            workspaceName: workspace.name,
            severity: issueDetails.severity,
            framework: issueDetails.framework || 'General',
            issueUrl: `https://app.auditguardx.com/workspaces/${input.workspaceId}/issues/${input.issueId}`,
            notes: input.notes || '',
          },
        });

        // Update notification_sent flag
        await db
          .updateTable('issue_assignments')
          .set({ notification_sent: 1 })
          .where('id', '=', assignmentId)
          .execute();

        this.env.logger.info('Issue assignment email sent', {
          assignmentId,
          issueId: input.issueId,
          assignedTo: assignee.email,
        });
      }
    } catch (emailError) {
      // Log error but don't fail the assignment
      this.env.logger.error('Failed to send issue assignment email', {
        error: emailError,
        assignmentId,
      });
    }
  }

  /**
   * Unassign issue from current assignee
   */
  async unassignIssue(input: {
    issueId: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Verify issue exists
    const issue = await db
      .selectFrom('compliance_issues')
      .select(['id', 'assigned_to'])
      .where('id', '=', input.issueId)
      .where('workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!issue) {
      throw new Error('Issue not found');
    }

    if (!issue.assigned_to) {
      throw new Error('Issue is not assigned to anyone');
    }

    const now = Date.now();

    // Update issue to remove assignment
    await db
      .updateTable('compliance_issues')
      .set({
        assigned_to: null,
        updated_at: now,
      })
      .where('id', '=', input.issueId)
      .execute();

    // Mark assignment as ended
    await db
      .updateTable('issue_assignments')
      .set({
        unassigned_at: now,
      })
      .where('issue_id', '=', input.issueId)
      .where('unassigned_at', 'is', null)
      .execute();

  }

  /**
   * Bulk assign multiple issues to a user
   */
  async bulkAssignIssues(input: {
    issueIds: string[];
    workspaceId: string;
    assignedTo: string;
    assignedBy: string;
    notes?: string;
  }): Promise<{ assigned: number; failed: number }> {
    const db = this.getDb();

    // Verify assignedBy has workspace access
    const assignerMembership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.assignedBy)
      .executeTakeFirst();

    if (!assignerMembership) {
      throw new Error('Access denied: Assigner is not a member of this workspace');
    }

    // Verify assignedTo has workspace access
    const assigneeMembership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.assignedTo)
      .executeTakeFirst();

    if (!assigneeMembership) {
      throw new Error('Cannot assign: User is not a member of this workspace');
    }

    let assigned = 0;
    let failed = 0;

    // Process each issue
    for (const issueId of input.issueIds) {
      try {
        await this.assignIssue({
          issueId,
          workspaceId: input.workspaceId,
          assignedTo: input.assignedTo,
          assignedBy: input.assignedBy,
          notes: input.notes,
        });
        assigned++;
      } catch (error) {
        failed++;
      }
    }


    return { assigned, failed };
  }

  /**
   * Get all issues assigned to a user
   */
  async getAssignedIssues(input: {
    workspaceId: string;
    userId: string;
    assignedTo: string;
    status?: IssueStatus[];
    limit?: number;
    offset?: number;
  }): Promise<{
    issues: Array<{
      id: string;
      checkId: string;
      documentId: string;
      documentName: string;
      severity: string;
      title: string;
      description: string;
      status: string;
      assignedAt: number;
      createdAt: number;
    }>;
    total: number;
  }> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Build query
    let query = db
      .selectFrom('compliance_issues as ci')
      .innerJoin('documents as d', 'd.id', 'ci.document_id')
      .innerJoin('issue_assignments as ia', (join) =>
        join
          .onRef('ia.issue_id', '=', 'ci.id')
          .on('ia.unassigned_at', 'is', null)
      )
      .select([
        'ci.id',
        'ci.check_id',
        'ci.document_id',
        'd.filename as document_name',
        'ci.severity',
        'ci.title',
        'ci.description',
        'ci.status',
        'ia.assigned_at',
        'ci.created_at',
      ])
      .where('ci.workspace_id', '=', input.workspaceId)
      .where('ci.assigned_to', '=', input.assignedTo);

    // Apply status filter
    if (input.status && input.status.length > 0) {
      query = query.where('ci.status', 'in', input.status);
    }

    // Get total count
    const countResult = await query
      .select((eb) => eb.fn.count('ci.id').as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count || 0);

    // Apply pagination
    const limit = input.limit || 20;
    const offset = input.offset || 0;

    const issues = await query
      .orderBy('ci.severity', 'desc')
      .orderBy('ci.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      issues: issues.map((issue) => ({
        id: issue.id,
        checkId: issue.check_id,
        documentId: issue.document_id,
        documentName: issue.document_name,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        assignedAt: issue.assigned_at,
        createdAt: issue.created_at,
      })),
      total,
    };
  }

  /**
   * Get assignment history for an issue
   */
  async getIssueAssignmentHistory(input: {
    issueId: string;
    workspaceId: string;
    userId: string;
  }): Promise<
    Array<{
      id: string;
      assignedBy: string;
      assignedTo: string;
      assignedAt: number;
      unassignedAt: number | null;
      notes: string | null;
    }>
  > {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    const assignments = await db
      .selectFrom('issue_assignments')
      .selectAll()
      .where('issue_id', '=', input.issueId)
      .where('workspace_id', '=', input.workspaceId)
      .orderBy('assigned_at', 'desc')
      .execute();

    return assignments.map((assignment) => ({
      id: assignment.id,
      assignedBy: assignment.assigned_by,
      assignedTo: assignment.assigned_to,
      assignedAt: assignment.assigned_at,
      unassignedAt: assignment.unassigned_at,
      notes: assignment.notes,
    }));
  }
}
