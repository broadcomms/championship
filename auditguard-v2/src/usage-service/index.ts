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

  async getWorkspaceStats(workspaceId: string, userId: string): Promise<{
    totalDocuments: number;
    totalChecks: number;
    totalIssues: number;
    averageScore: number;
    storageUsed: number;
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

    // Get stats
    const [docCount, checkCount, issueCount, latestScore] = await Promise.all([
      db
        .selectFrom('documents')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst(),

      db
        .selectFrom('compliance_checks')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst(),

      db
        .selectFrom('compliance_issues')
        .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
        .select(({ fn }) => fn.count<number>('compliance_issues.id').as('count'))
        .where('compliance_checks.workspace_id', '=', workspaceId)
        .where('compliance_issues.status', '=', 'open')
        .executeTakeFirst(),

      db
        .selectFrom('workspace_scores')
        .select('overall_score')
        .where('workspace_id', '=', workspaceId)
        .orderBy('calculated_at', 'desc')
        .limit(1)
        .executeTakeFirst(),
    ]);

    // Calculate storage (sum of all document file sizes)
    const storageResult = await db
      .selectFrom('documents')
      .select(({ fn }) => fn.sum<number>('file_size').as('total'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    return {
      totalDocuments: docCount?.count || 0,
      totalChecks: checkCount?.count || 0,
      totalIssues: issueCount?.count || 0,
      averageScore: latestScore?.overall_score || 0,
      storageUsed: storageResult?.total || 0,
    };
  }
}
