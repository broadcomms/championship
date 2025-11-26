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

  /**
   * NEW: Advanced issue filtering with multiple criteria
   * Supports AI assistant tool: get_issues_with_advanced_filters
   */
  async getIssuesAdvanced(input: {
    workspaceId: string;
    userId: string;
    framework?: string;
    severity?: IssueSeverity[];
    status?: IssueStatus[];
    priorityLevel?: string[];
    assignedTo?: string;
    unassignedOnly?: boolean;
    dueDate?: { before?: number; after?: number };
    createdDate?: { before?: number; after?: number };
    search?: string;
    sort?: { field: string; direction: 'asc' | 'desc' };
    pagination?: { limit: number; offset: number };
  }): Promise<any> {
    const db = this.getDb();

    // Verify access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Build query
    let query = db
      .selectFrom('compliance_issues')
      .selectAll()
      .where('workspace_id', '=', input.workspaceId);

    // Apply filters
    if (input.framework) {
      query = query.where('framework', '=', input.framework.toUpperCase());
    }

    if (input.severity && input.severity.length > 0) {
      query = query.where('severity', 'in', input.severity);
    }

    if (input.status && input.status.length > 0) {
      query = query.where('status', 'in', input.status);
    }

    if (input.priorityLevel && input.priorityLevel.length > 0) {
      query = query.where('priority_level', 'in', input.priorityLevel);
    }

    if (input.assignedTo) {
      query = query.where('assigned_to', '=', input.assignedTo);
    }

    if (input.unassignedOnly) {
      query = query.where('assigned_to', 'is', null);
    }

    if (input.dueDate?.before) {
      query = query.where('due_date', '<=', input.dueDate.before);
    }

    if (input.dueDate?.after) {
      query = query.where('due_date', '>=', input.dueDate.after);
    }

    if (input.createdDate?.before) {
      query = query.where('created_at', '<=', input.createdDate.before);
    }

    if (input.createdDate?.after) {
      query = query.where('created_at', '>=', input.createdDate.after);
    }

    if (input.search) {
      const searchTerm = `%${input.search}%`;
      query = query.where((eb) =>
        eb.or([
          eb('title', 'like', searchTerm),
          eb('description', 'like', searchTerm),
          eb('category', 'like', searchTerm),
        ])
      );
    }

    // Get total count before pagination
    const countQuery = query.select(db.fn.count<number>('id').as('count'));
    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count || 0);

    // Apply sorting
    const sortField = input.sort?.field || 'created_at';
    const sortDirection = input.sort?.direction || 'desc';
    query = query.orderBy(sortField as any, sortDirection);

    // Apply pagination
    const limit = input.pagination?.limit || 20;
    const offset = input.pagination?.offset || 0;
    query = query.limit(limit).offset(offset);

    const issues = await query.execute();

    return {
      issues: issues.map(i => ({
        id: i.id,
        framework: i.framework,
        severity: i.severity,
        category: i.category,
        title: i.title,
        description: i.description,
        recommendation: i.recommendation,
        status: i.status,
        priorityLevel: i.priority_level,
        assignedTo: i.assigned_to,
        dueDate: i.due_date,
        createdAt: i.created_at,
        updatedAt: i.updated_at
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    };
  }

  /**
   * NEW: Get complete issue details with history and comments
   * Supports AI assistant tool: get_issue_full_details
   */
  async getIssueFullDetails(input: {
    workspaceId: string;
    userId: string;
    issueId: string;
    includeHistory?: boolean;
    includeComments?: boolean;
    includeLLMAnalysis?: boolean;
  }): Promise<any> {
    const db = this.getDb();

    // Verify access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Get issue
    const issue = await db
      .selectFrom('compliance_issues')
      .selectAll()
      .where('id', '=', input.issueId)
      .where('workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!issue) {
      throw new Error('Issue not found');
    }

    // Get history if requested
    let history = null;
    if (input.includeHistory) {
      history = await db
        .selectFrom('issue_status_history')
        .selectAll()
        .where('issue_id', '=', input.issueId)
        .orderBy('changed_at', 'desc')
        .execute();
    }

    // Get comments if requested
    let comments = null;
    if (input.includeComments) {
      comments = await db
        .selectFrom('issue_comments')
        .selectAll()
        .where('issue_id', '=', input.issueId)
        .orderBy('created_at', 'desc')
        .execute();
    }

    // Parse LLM response if requested
    let llmAnalysis = null;
    if (input.includeLLMAnalysis && issue.llm_response) {
      try {
        llmAnalysis = JSON.parse(issue.llm_response);
      } catch (e) {
        this.env.logger.warn('Failed to parse LLM response', { issueId: input.issueId });
      }
    }

    return {
      issue: {
        id: issue.id,
        checkId: issue.check_id,
        documentId: issue.document_id,
        framework: issue.framework,
        severity: issue.severity,
        category: issue.category,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation,
        excerpt: issue.excerpt,
        regulationCitation: issue.regulation_citation,
        riskScore: issue.risk_score,
        sectionRef: issue.section_ref,
        status: issue.status,
        priorityLevel: issue.priority_level,
        assignedTo: issue.assigned_to,
        dueDate: issue.due_date,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        resolvedAt: issue.resolved_at,
        resolvedBy: issue.resolved_by,
        resolutionNotes: issue.resolution_notes,
        llmAnalysis
      },
      history: history?.map(h => ({
        id: h.id,
        oldStatus: h.old_status,
        newStatus: h.new_status,
        changedBy: h.changed_by,
        changedAt: h.changed_at,
        notes: h.notes
      })) || null,
      comments: comments?.map(c => ({
        id: c.id,
        userId: c.user_id,
        comment: c.comment,
        createdAt: c.created_at
      })) || null
    };
  }

  /**
   * NEW: Get issue assignments and workload stats
   * Supports AI assistant tool: get_issue_assignment_info
   */
  async getIssueAssignments(input: {
    workspaceId: string;
    userId: string;
    assignedUserId?: string;
    includeWorkloadStats?: boolean;
  }): Promise<any> {
    const db = this.getDb();

    // Verify access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Build query
    let query = db
      .selectFrom('compliance_issues')
      .select([
        'id',
        'title',
        'severity',
        'status',
        'assigned_to',
        'due_date',
        'priority_level',
        'created_at'
      ])
      .where('workspace_id', '=', input.workspaceId)
      .where('assigned_to', 'is not', null);

    if (input.assignedUserId) {
      query = query.where('assigned_to', '=', input.assignedUserId);
    }

    const assignments = await query.orderBy('priority_level', 'asc').execute();

    // Calculate workload stats if requested
    let workloadStats = null;
    if (input.includeWorkloadStats) {
      const stats = await db
        .selectFrom('compliance_issues')
        .select([
          'assigned_to',
          'status',
          db.fn.count<number>('id').as('count')
        ])
        .where('workspace_id', '=', input.workspaceId)
        .where('assigned_to', 'is not', null)
        .groupBy(['assigned_to', 'status'])
        .execute();

      // Aggregate by user
      const userStats: Record<string, any> = {};
      stats.forEach(s => {
        if (!userStats[s.assigned_to!]) {
          userStats[s.assigned_to!] = { userId: s.assigned_to, open: 0, in_progress: 0, total: 0 };
        }
        const count = Number(s.count);
        userStats[s.assigned_to!][s.status] = count;
        userStats[s.assigned_to!].total += count;
      });

      workloadStats = Object.values(userStats);
    }

    // Count unassigned issues
    const unassignedCount = await db
      .selectFrom('compliance_issues')
      .select(db.fn.count<number>('id').as('count'))
      .where('workspace_id', '=', input.workspaceId)
      .where('assigned_to', 'is', null)
      .where('status', '!=', 'resolved')
      .executeTakeFirst();

    return {
      assignments: assignments.map(a => ({
        issueId: a.id,
        title: a.title,
        severity: a.severity,
        status: a.status,
        assignedTo: a.assigned_to,
        dueDate: a.due_date,
        priorityLevel: a.priority_level,
        createdAt: a.created_at
      })),
      workloadStats,
      unassignedCount: Number(unassignedCount?.count || 0),
      totalIssues: assignments.length
    };
  }
}

