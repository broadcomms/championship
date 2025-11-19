import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface TrackUsageInput {
  workspaceId: string;
  resourceType: 'api_call' | 'document' | 'compliance_check' | 'assistant_message';
  resourceId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Usage Service - Private', { status: 501 });
  }

  async trackUsage(input: TrackUsageInput): Promise<{ tracked: boolean }> {
    const db = this.getDb();
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0]!;

    // Record individual usage event
    const usageId = `usg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      await db
        .insertInto('usage_tracking')
        .values({
          id: usageId,
          workspace_id: input.workspaceId,
          resource_type: input.resourceType,
          resource_id: input.resourceId || null,
          user_id: input.userId || null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          tracked_at: now,
        })
        .execute();

      // Update daily summary
      await this.updateDailySummary(input.workspaceId, today, input.resourceType);

      return { tracked: true };
    } catch (error) {
      this.env.logger.error(`Failed to track usage: ${error instanceof Error ? error.message : 'Unknown'}`);
      return { tracked: false };
    }
  }

  private async updateDailySummary(workspaceId: string, date: string, resourceType: string): Promise<void> {
    const db = this.getDb();
    const now = Date.now();

    // Check if summary exists
    const existing = await db
      .selectFrom('usage_summaries')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('date', '=', date)
      .executeTakeFirst();

    const fieldMap = {
      api_call: 'api_calls',
      document: 'documents_uploaded',
      compliance_check: 'compliance_checks',
      assistant_message: 'assistant_messages',
    };

    const field = fieldMap[resourceType as keyof typeof fieldMap];
    if (!field) return;

    if (existing) {
      // Increment existing summary
      await db
        .updateTable('usage_summaries')
        .set({
          [field]: (existing as any)[field] + 1,
          updated_at: now,
        })
        .where('workspace_id', '=', workspaceId)
        .where('date', '=', date)
        .execute();
    } else {
      // Create new summary
      const summaryId = `sum_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await db
        .insertInto('usage_summaries')
        .values({
          id: summaryId,
          workspace_id: workspaceId,
          date,
          api_calls: resourceType === 'api_call' ? 1 : 0,
          documents_uploaded: resourceType === 'document' ? 1 : 0,
          compliance_checks: resourceType === 'compliance_check' ? 1 : 0,
          assistant_messages: resourceType === 'assistant_message' ? 1 : 0,
          storage_bytes: 0,
          created_at: now,
          updated_at: now,
        })
        .execute();
    }
  }

  async getUsage(workspaceId: string, userId: string, days: number = 30): Promise<{
    current: {
      apiCalls: number;
      documentsUploaded: number;
      complianceChecks: number;
      assistantMessages: number;
    };
    daily: Array<{
      date: string;
      apiCalls: number;
      documentsUploaded: number;
      complianceChecks: number;
      assistantMessages: number;
    }>;
  }> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Get today's summary
    const today = new Date().toISOString().split('T')[0]!;
    const todaySummary = await db
      .selectFrom('usage_summaries')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('date', '=', today)
      .executeTakeFirst();

    // Get historical summaries
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0]!;

    const historicalSummaries = await db
      .selectFrom('usage_summaries')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('date', '>=', startDateStr)
      .orderBy('date', 'desc')
      .execute();

    return {
      current: {
        apiCalls: todaySummary?.api_calls || 0,
        documentsUploaded: todaySummary?.documents_uploaded || 0,
        complianceChecks: todaySummary?.compliance_checks || 0,
        assistantMessages: todaySummary?.assistant_messages || 0,
      },
      daily: historicalSummaries.map((summary) => ({
        date: summary.date,
        apiCalls: summary.api_calls,
        documentsUploaded: summary.documents_uploaded,
        complianceChecks: summary.compliance_checks,
        assistantMessages: summary.assistant_messages,
      })),
    };
  }

  async checkLimits(workspaceId: string): Promise<{
    limits: Record<string, { current: number; limit: number; percentage: number; allowed: boolean }>;
    overLimit: boolean;
  }> {
    const limitTypes = ['documents', 'compliance_checks', 'api_calls', 'assistant_messages'] as const;
    const limits: Record<string, { current: number; limit: number; percentage: number; allowed: boolean }> = {};

    let overLimit = false;

    for (const limitType of limitTypes) {
      const result = await this.env.BILLING_SERVICE.checkLimit(workspaceId, limitType);
      limits[limitType] = result;
      if (!result.allowed) {
        overLimit = true;
      }
    }

    return { limits, overLimit };
  }

  /**
   * Phase 4.2: Get workspace limits with formatted data for LimitWarningBanner
   */
  async getWorkspaceLimits(workspaceId: string, userId: string): Promise<{
    limits: {
      documents: { used: number; limit: number };
      compliance_checks: { used: number; limit: number };
      ai_messages: { used: number; limit: number };
      storage_bytes: { used: number; limit: number };
      team_members: { used: number; limit: number };
    };
  }> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Get limit checks from billing service
    const [docLimit, checkLimit, messageLimit] = await Promise.all([
      this.env.BILLING_SERVICE.checkLimit(workspaceId, 'documents'),
      this.env.BILLING_SERVICE.checkLimit(workspaceId, 'compliance_checks'),
      this.env.BILLING_SERVICE.checkLimit(workspaceId, 'assistant_messages'),
    ]);

    // Get team member count
    const teamCount = await db
      .selectFrom('workspace_members')
      .select(({ fn }) => fn.countAll().as('count'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    // Get storage usage (sum of document sizes)
    const storageResult = await db
      .selectFrom('documents')
      .select(({ fn }) => fn.sum<number>('file_size').as('total'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    // Get workspace subscription to determine limits
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'organization_id'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (!workspace.organization_id) {
      // No organization, use free plan defaults
      const defaults = {
        documents: 10,
        compliance_checks: 20,
        api_calls: 1000,
        assistant_messages: 50,
        storage_mb: 100,
        team_members: 3,
      };

      return {
        limits: {
          documents: {
            used: docLimit.current,
            limit: defaults.documents,
          },
          compliance_checks: {
            used: checkLimit.current,
            limit: defaults.compliance_checks,
          },
          ai_messages: {
            used: messageLimit.current,
            limit: defaults.assistant_messages,
          },
          storage_bytes: {
            used: Number(storageResult?.total || 0),
            limit: defaults.storage_mb * 1024 * 1024,
          },
          team_members: {
            used: Number(teamCount?.count || 0),
            limit: defaults.team_members,
          },
        },
      };
    }

    // Get subscription limits
    const subscriptionData = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscriptions.plan_id', 'subscription_plans.id')
      .select(['subscription_plans.limits'])
      .where('subscriptions.organization_id', '=', workspace.organization_id)
      .executeTakeFirst();

    const defaults = {
      documents: 10,
      compliance_checks: 20,
      api_calls: 1000,
      assistant_messages: 50,
      storage_mb: 100,
      team_members: 3,
    };

    const limits = subscriptionData ? JSON.parse(subscriptionData.limits) : defaults;

    return {
      limits: {
        documents: {
          used: docLimit.current,
          limit: limits.documents,
        },
        compliance_checks: {
          used: checkLimit.current,
          limit: limits.compliance_checks,
        },
        ai_messages: {
          used: messageLimit.current,
          limit: limits.assistant_messages,
        },
        storage_bytes: {
          used: Number(storageResult?.total || 0),
          limit: limits.storage_mb * 1024 * 1024,
        },
        team_members: {
          used: Number(teamCount?.count || 0),
          limit: limits.team_members,
        },
      },
    };
  }

  async getWorkspaceStats(workspaceId: string, userId: string): Promise<{
    total_documents: number;
    recent_uploads: number;
    compliance_checks: number;
    open_issues: number;
    completion_rate: number;
  }> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Calculate timestamp for "this week" (last 7 days)
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Get comprehensive stats
    const [docCount, recentDocCount, checkCount, openIssueCount, resolvedIssueCount] = await Promise.all([
      // Total documents
      db
        .selectFrom('documents')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst(),

      // Recent uploads (last 7 days)
      db
        .selectFrom('documents')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .where('uploaded_at', '>=', oneWeekAgo)
        .executeTakeFirst(),

      // Total compliance checks
      db
        .selectFrom('compliance_checks')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst(),

      // Open issues (includes in_progress and review)
      db
        .selectFrom('compliance_issues')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .where('status', 'in', ['open', 'in_progress', 'review'])
        .executeTakeFirst(),

      // Resolved issues
      db
        .selectFrom('compliance_issues')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .where('status', '=', 'resolved')
        .executeTakeFirst(),
    ]);

    // Calculate completion rate (resolved / total issues * 100)
    const totalIssues = (openIssueCount?.count || 0) + (resolvedIssueCount?.count || 0);
    const completionRate = totalIssues > 0 
      ? Math.round((resolvedIssueCount?.count || 0) / totalIssues * 100)
      : 0;

    return {
      total_documents: docCount?.count || 0,
      recent_uploads: recentDocCount?.count || 0,
      compliance_checks: checkCount?.count || 0,
      open_issues: openIssueCount?.count || 0,
      completion_rate: completionRate,
    };
  }

  async getWorkspaceActivity(workspaceId: string, userId: string, limit: number = 10): Promise<Array<{
    id: string;
    type: 'document' | 'compliance' | 'issue' | 'comment';
    title: string;
    description: string;
    user_email: string;
    timestamp: number;
  }>> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Gather activity from multiple sources
    const activities: Array<{
      id: string;
      type: 'document' | 'compliance' | 'issue' | 'comment';
      title: string;
      description: string;
      user_email: string;
      timestamp: number;
    }> = [];

    // Recent document uploads
    const recentDocs = await db
      .selectFrom('documents')
      .innerJoin('users', 'documents.uploaded_by', 'users.id')
      .select([
        'documents.id',
        'documents.filename',
        'documents.uploaded_at',
        'users.email',
      ])
      .where('documents.workspace_id', '=', workspaceId)
      .orderBy('documents.uploaded_at', 'desc')
      .limit(limit)
      .execute();

    recentDocs.forEach(doc => {
      activities.push({
        id: doc.id,
        type: 'document',
        title: 'Document uploaded',
        description: doc.filename,
        user_email: doc.email,
        timestamp: doc.uploaded_at,
      });
    });

    // Recent compliance checks
    const recentChecks = await db
      .selectFrom('compliance_checks')
      .innerJoin('documents', 'compliance_checks.document_id', 'documents.id')
      .innerJoin('users', 'compliance_checks.created_by', 'users.id')
      .select([
        'compliance_checks.id',
        'compliance_checks.framework',
        'compliance_checks.created_at',
        'documents.filename',
        'users.email',
      ])
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .where('compliance_checks.status', '=', 'completed')
      .orderBy('compliance_checks.created_at', 'desc')
      .limit(limit)
      .execute();

    recentChecks.forEach(check => {
      activities.push({
        id: check.id,
        type: 'compliance',
        title: `${check.framework} check completed`,
        description: check.filename,
        user_email: check.email,
        timestamp: check.created_at,
      });
    });

    // Recent issue status changes
    const recentIssueChanges = await db
      .selectFrom('issue_status_history')
      .innerJoin('compliance_issues', 'issue_status_history.issue_id', 'compliance_issues.id')
      .innerJoin('users', 'issue_status_history.changed_by', 'users.id')
      .select([
        'issue_status_history.id',
        'issue_status_history.new_status',
        'issue_status_history.changed_at',
        'compliance_issues.title as issue_title',
        'users.email',
      ])
      .where('compliance_issues.workspace_id', '=', workspaceId)
      .orderBy('issue_status_history.changed_at', 'desc')
      .limit(limit)
      .execute();

    recentIssueChanges.forEach(change => {
      activities.push({
        id: change.id,
        type: 'issue',
        title: `Issue ${change.new_status}`,
        description: change.issue_title,
        user_email: change.email,
        timestamp: change.changed_at,
      });
    });

    // Recent comments
    const recentComments = await db
      .selectFrom('issue_comments')
      .innerJoin('compliance_issues', 'issue_comments.issue_id', 'compliance_issues.id')
      .innerJoin('users', 'issue_comments.user_id', 'users.id')
      .select([
        'issue_comments.id',
        'issue_comments.comment_text',
        'issue_comments.created_at',
        'compliance_issues.title as issue_title',
        'users.email',
      ])
      .where('issue_comments.workspace_id', '=', workspaceId)
      .where('issue_comments.comment_type', '=', 'comment')
      .orderBy('issue_comments.created_at', 'desc')
      .limit(limit)
      .execute();

    recentComments.forEach(comment => {
      activities.push({
        id: comment.id,
        type: 'comment',
        title: 'New comment',
        description: `${comment.issue_title}: ${comment.comment_text.substring(0, 100)}...`,
        user_email: comment.email,
        timestamp: comment.created_at,
      });
    });

    // Sort all activities by timestamp (most recent first) and limit
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}
