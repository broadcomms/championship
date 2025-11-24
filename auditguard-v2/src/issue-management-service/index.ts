/**
 * Issue Management Service
 * Handles CRUD operations for compliance issues including status updates,
 * filtering, search, and bulk operations.
 */

import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { Env } from './raindrop.gen';

type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Issue Management Service - Private', { status: 501 });
  }

  /**
   * Get issues for a document with filters and pagination
   */
  async getDocumentIssues(input: {
    workspaceId: string;
    documentId: string;
    userId: string;
    checkId?: string;
    severity?: IssueSeverity[];
    status?: IssueStatus[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    issues: Array<{
      id: string;
      checkId: string;
      severity: string;
      category: string;
      title: string;
      description: string;
      recommendation: string | null;
      excerpt: string | null;
      regulationCitation: string | null;
      riskScore: number | null;
      sectionRef: string | null;
      status: string;
      assignedTo: string | null;
      resolvedAt: number | null;
      resolvedBy: string | null;
      createdAt: number;
      updatedAt: number | null;
    }>;
    total: number;
    hasMore: boolean;
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
      .selectFrom('compliance_issues')
      .selectAll()
      .where('document_id', '=', input.documentId)
      .where('workspace_id', '=', input.workspaceId);

    // Apply filters
    if (input.checkId) {
      query = query.where('check_id', '=', input.checkId);
    }

    if (input.severity && input.severity.length > 0) {
      query = query.where('severity', 'in', input.severity);
    }

    if (input.status && input.status.length > 0) {
      query = query.where('status', 'in', input.status);
    }

    // Search across title, description, and recommendation
    if (input.search) {
      const searchTerm = `%${input.search}%`;
      query = query.where((eb) =>
        eb.or([
          eb('title', 'like', searchTerm),
          eb('description', 'like', searchTerm),
          eb('recommendation', 'like', searchTerm),
        ])
      );
    }

    // Get total count
    const countResult = await query
      .select((eb) => eb.fn.count('id').as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count || 0);

    // Apply pagination
    const limit = input.limit || 20;
    const offset = input.offset || 0;

    const issues = await query
      .orderBy('severity', 'desc')
      .orderBy('created_at', 'desc')
      .limit(limit + 1) // Fetch one extra to determine hasMore
      .offset(offset)
      .execute();

    const hasMore = issues.length > limit;
    const resultIssues = issues.slice(0, limit);

    return {
      issues: resultIssues.map((issue) => ({
        id: issue.id,
        checkId: issue.check_id,
        severity: issue.severity,
        category: issue.category,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation,
        excerpt: issue.excerpt || null,
        regulationCitation: issue.regulation_citation || null,
        riskScore: issue.risk_score || null,
        sectionRef: issue.section_ref || null,
        status: issue.status,
        assignedTo: issue.assigned_to,
        resolvedAt: issue.resolved_at,
        resolvedBy: issue.resolved_by,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at || null,
      })),
      total,
      hasMore,
    };
  }

  /**
   * Get single issue with full details
   */
  async getIssueDetails(input: {
    workspaceId: string;
    issueId: string;
    userId: string;
  }): Promise<{
    id: string;
    checkId: string;
    documentId: string;
    workspaceId: string;
    documentName: string;
    framework: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    recommendation: string | null;
    excerpt: string | null;
    fullExcerpt: string | null;
    regulationCitation: string | null;
    remediationSteps: string[] | null;
    riskScore: number | null;
    sectionRef: string | null;
    chunkIds: string[] | null;
    confidence: number | null;
    status: string;
    assignedTo: string | null;
    assignedAt: number | null;
    dueDate: number | null;
    priorityLevel: string | null;
    resolvedAt: number | null;
    resolvedBy: string | null;
    resolutionNotes: string | null;
    createdAt: number;
    updatedAt: number | null;
    llmResponse: any | null;
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

    // Get issue with document and check info
    const issue = await db
      .selectFrom('compliance_issues as ci')
      .innerJoin('documents as d', 'd.id', 'ci.document_id')
      .innerJoin('compliance_checks as cc', 'cc.id', 'ci.check_id')
      .select([
        'ci.id',
        'ci.check_id',
        'ci.document_id',
        'ci.workspace_id',
        'd.filename as document_name',
        'ci.framework',
        'ci.severity',
        'ci.category',
        'ci.title',
        'ci.description',
        'ci.recommendation',
        'ci.excerpt',
        'ci.full_excerpt',
        'ci.regulation_citation',
        'ci.remediation_steps',
        'ci.risk_score',
        'ci.section_ref',
        'ci.chunk_ids',
        'ci.confidence',
        'ci.status',
        'ci.assigned_to',
        'ci.assigned_at',
        'ci.due_date',
        'ci.priority_level',
        'ci.resolved_at',
        'ci.resolved_by',
        'ci.resolution_notes',
        'ci.created_at',
        'ci.updated_at',
        'ci.llm_response',
      ])
      .where('ci.id', '=', input.issueId)
      .where('ci.workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!issue) {
      throw new Error('Issue not found');
    }

    // Parse llm_response JSON if present
    let llmResponse = null;
    if (issue.llm_response) {
      try {
        llmResponse = JSON.parse(issue.llm_response);
      } catch (error) {
        console.error('Failed to parse llm_response:', error);
        llmResponse = null;
      }
    }

    return {
      id: issue.id,
      checkId: issue.check_id,
      documentId: issue.document_id,
      workspaceId: issue.workspace_id || input.workspaceId,
      documentName: issue.document_name,
      framework: issue.framework || '',
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      description: issue.description,
      recommendation: issue.recommendation,
      excerpt: issue.excerpt || null,
      fullExcerpt: issue.full_excerpt || null,
      regulationCitation: issue.regulation_citation || null,
      remediationSteps: issue.remediation_steps
        ? JSON.parse(issue.remediation_steps)
        : null,
      riskScore: issue.risk_score || null,
      sectionRef: issue.section_ref || null,
      chunkIds: issue.chunk_ids ? JSON.parse(issue.chunk_ids) : null,
      confidence: issue.confidence || null,
      status: issue.status,
      assignedTo: issue.assigned_to,
      assignedAt: issue.assigned_at || null,
      dueDate: issue.due_date || null,
      priorityLevel: issue.priority_level || null,
      resolvedAt: issue.resolved_at,
      resolvedBy: issue.resolved_by,
      resolutionNotes: issue.resolution_notes || null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at || null,
      llmResponse: llmResponse,
    };
  }

  /**
   * Mark issue as resolved
   */
  async resolveIssue(input: {
    issueId: string;
    workspaceId: string;
    userId: string;
    resolutionNotes?: string;
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

    const now = Date.now();

    // Get current status for history
    const issue = await db
      .selectFrom('compliance_issues')
      .select(['id', 'status', 'workspace_id'])
      .where('id', '=', input.issueId)
      .where('workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!issue) {
      throw new Error('Issue not found');
    }

    const oldStatus = issue.status;

    // Update issue as resolved
    await db
      .updateTable('compliance_issues')
      .set({
        status: 'resolved',
        resolved_at: now,
        resolved_by: input.userId,
        resolution_notes: input.resolutionNotes || null,
        updated_at: now,
      })
      .where('id', '=', input.issueId)
      .execute();

    // Record status change in history
    const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await db
      .insertInto('issue_status_history')
      .values({
        id: historyId,
        issue_id: input.issueId,
        workspace_id: input.workspaceId,
        old_status: oldStatus,
        new_status: 'resolved',
        changed_by: input.userId,
        changed_at: now,
        notes: input.resolutionNotes || null,
      })
      .execute();

    // Log would go here if needed
  }

  /**
   * Bulk update issues
   */
  async bulkUpdateIssues(input: {
    issueIds: string[];
    workspaceId: string;
    userId: string;
    action: 'resolve' | 'dismiss' | 'reopen';
    notes?: string;
  }): Promise<{ updated: number; failed: number }> {
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

    // Map action to status
    const statusMap: Record<string, IssueStatus> = {
      resolve: 'resolved',
      dismiss: 'dismissed',
      reopen: 'open',
    };

    const newStatus = statusMap[input.action];
    if (!newStatus) {
      throw new Error(`Invalid action: ${input.action}`);
    }

    const now = Date.now();
    let updated = 0;
    let failed = 0;

    // Process each issue
    for (const issueId of input.issueIds) {
      try {
        // Get current status
        const issue = await db
          .selectFrom('compliance_issues')
          .select(['id', 'status'])
          .where('id', '=', issueId)
          .where('workspace_id', '=', input.workspaceId)
          .executeTakeFirst();

        if (!issue) {
          failed++;
          continue;
        }

        const oldStatus = issue.status;

        // Update issue
        const updateData: any = {
          status: newStatus,
          updated_at: now,
        };

        if (input.action === 'resolve') {
          updateData.resolved_at = now;
          updateData.resolved_by = input.userId;
          updateData.resolution_notes = input.notes || null;
        }

        await db
          .updateTable('compliance_issues')
          .set(updateData)
          .where('id', '=', issueId)
          .execute();

        // Record history
        const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await db
          .insertInto('issue_status_history')
          .values({
            id: historyId,
            issue_id: issueId,
            workspace_id: input.workspaceId,
            old_status: oldStatus,
            new_status: newStatus,
            changed_by: input.userId,
            changed_at: now,
            notes: input.notes || null,
          })
          .execute();


        updated++;
      } catch (error) {
        failed++;
      }
    }


    return { updated, failed };
  }

  /**
   * Update issue status with event publishing
   */
  async updateIssueStatus(input: {
    issueId: string;
    workspaceId: string;
    userId: string;
    newStatus: IssueStatus;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const db = this.getDb();

    try {
      // Verify workspace access
      const membership = await db
        .selectFrom('workspace_members')
        .select('role')
        .where('workspace_id', '=', input.workspaceId)
        .where('user_id', '=', input.userId)
        .executeTakeFirst();

      if (!membership) {
        return { success: false, error: 'Access denied: Not a workspace member' };
      }

      const now = Date.now();

      // Get current issue
      const issue = await db
        .selectFrom('compliance_issues')
        .select(['id', 'status', 'title', 'assigned_to'])
        .where('id', '=', input.issueId)
        .where('workspace_id', '=', input.workspaceId)
        .executeTakeFirst();

      if (!issue) {
        return { success: false, error: 'Issue not found' };
      }

      const oldStatus = issue.status;

      // Update issue
      const updateData: any = {
        status: input.newStatus,
        updated_at: now,
      };

      if (input.newStatus === 'resolved') {
        updateData.resolved_at = now;
        updateData.resolved_by = input.userId;
        updateData.resolution_notes = input.notes || null;
      }

      await db
        .updateTable('compliance_issues')
        .set(updateData)
        .where('id', '=', input.issueId)
        .execute();

      // Record status change in history
      const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await db
        .insertInto('issue_status_history')
        .values({
          id: historyId,
          issue_id: input.issueId,
          workspace_id: input.workspaceId,
          old_status: oldStatus,
          new_status: input.newStatus,
          changed_by: input.userId,
          changed_at: now,
          notes: input.notes || null,
        })
        .execute();

      // Notify via internal webhook (fire-and-forget)
      fetch('http://notification-service/internal/webhook/issue-status-changed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: input.issueId,
          workspaceId: input.workspaceId,
          issueTitle: issue.title,
          assignedTo: issue.assigned_to,
          oldStatus,
          newStatus: input.newStatus,
          changedBy: input.userId,
          notes: input.notes,
          timestamp: now,
        })
      }).catch(err => {
        this.env.logger.error('Failed to send status change notification', { error: err });
      });

      this.env.logger.info('Issue status updated', {
        issueId: input.issueId,
        oldStatus,
        newStatus: input.newStatus,
      });

      return { success: true };
    } catch (error: any) {
      this.env.logger.error('Failed to update issue status', {
        error: error.message,
        issueId: input.issueId,
      });
      return { success: false, error: error.message };
    }
  }
}

