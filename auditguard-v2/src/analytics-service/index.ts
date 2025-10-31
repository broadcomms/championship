import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

interface FrameworkScore {
  framework: string;
  score: number;
  checksPassed: number;
  checksFailed: number;
  totalChecks: number;
  lastCheckAt: number | null;
}

interface WorkspaceDashboard {
  overallScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  totalDocuments: number;
  documentsChecked: number;
  coveragePercentage: number;
  totalIssues: number;
  openIssues: number;
  riskDistribution: RiskDistribution;
  frameworkScores: FrameworkScore[];
  recentChecks: Array<{
    id: string;
    documentId: string;
    framework: string;
    score: number | null;
    issuesFound: number;
    createdAt: number;
  }>;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Analytics Service - Private', { status: 501 });
  }

  async calculateWorkspaceScore(workspaceId: string, userId: string): Promise<{
    scoreId: string;
    overallScore: number;
    riskLevel: string;
    documentsChecked: number;
    totalDocuments: number;
    issueBreakdown: RiskDistribution;
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
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Get total documents count
    const totalDocsResult = await db
      .selectFrom('documents')
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    const totalDocuments = totalDocsResult?.count || 0;

    // Get checked documents count (count distinct documents)
    const checkedDocs = await db
      .selectFrom('compliance_checks')
      .select('document_id')
      .where('workspace_id', '=', workspaceId)
      .where('status', '=', 'completed')
      .distinct()
      .execute();

    const documentsChecked = checkedDocs.length;

    // Get issues breakdown
    const issues = await db
      .selectFrom('compliance_issues')
      .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
      .select(['compliance_issues.severity'])
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .where('compliance_issues.status', '=', 'open')
      .execute();

    const issueBreakdown: RiskDistribution = {
      critical: issues.filter((i) => i.severity === 'critical').length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length,
      info: issues.filter((i) => i.severity === 'info').length,
    };

    // Calculate overall score
    const severityWeights = { critical: 20, high: 10, medium: 5, low: 2, info: 1 };
    const totalDeduction =
      issueBreakdown.critical * severityWeights.critical +
      issueBreakdown.high * severityWeights.high +
      issueBreakdown.medium * severityWeights.medium +
      issueBreakdown.low * severityWeights.low +
      issueBreakdown.info * severityWeights.info;

    const overallScore = Math.max(0, 100 - totalDeduction);

    // Determine risk level
    let riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
    if (overallScore < 40 || issueBreakdown.critical > 0) {
      riskLevel = 'critical';
    } else if (overallScore < 60 || issueBreakdown.high >= 3) {
      riskLevel = 'high';
    } else if (overallScore < 80) {
      riskLevel = 'medium';
    } else if (overallScore < 90) {
      riskLevel = 'low';
    } else {
      riskLevel = 'minimal';
    }

    // Get frameworks covered
    const frameworksResult = await db
      .selectFrom('compliance_checks')
      .select('framework')
      .where('workspace_id', '=', workspaceId)
      .where('status', '=', 'completed')
      .distinct()
      .execute();

    const frameworksCovered = JSON.stringify(frameworksResult.map((f) => f.framework));

    // Store score snapshot
    const scoreId = `scr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    await db
      .insertInto('workspace_scores')
      .values({
        id: scoreId,
        workspace_id: workspaceId,
        overall_score: overallScore,
        documents_checked: documentsChecked,
        total_documents: totalDocuments,
        critical_issues: issueBreakdown.critical,
        high_issues: issueBreakdown.high,
        medium_issues: issueBreakdown.medium,
        low_issues: issueBreakdown.low,
        info_issues: issueBreakdown.info,
        risk_level: riskLevel,
        frameworks_covered: frameworksCovered,
        calculated_at: now,
        calculated_by: userId,
      })
      .execute();

    return {
      scoreId,
      overallScore,
      riskLevel,
      documentsChecked,
      totalDocuments,
      issueBreakdown,
    };
  }

  async getWorkspaceDashboard(workspaceId: string, userId: string): Promise<WorkspaceDashboard> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Get latest workspace score
    const latestScore = await db
      .selectFrom('workspace_scores')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .orderBy('calculated_at', 'desc')
      .executeTakeFirst();

    // If no score exists, calculate one
    if (!latestScore) {
      await this.calculateWorkspaceScore(workspaceId, userId);
      return this.getWorkspaceDashboard(workspaceId, userId);
    }

    // Get total issues
    const totalIssuesResult = await db
      .selectFrom('compliance_issues')
      .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
      .select(({ fn }) => fn.count<number>('compliance_issues.id').as('count'))
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .executeTakeFirst();

    const totalIssues = totalIssuesResult?.count || 0;

    // Get open issues count
    const openIssuesResult = await db
      .selectFrom('compliance_issues')
      .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
      .select(({ fn }) => fn.count<number>('compliance_issues.id').as('count'))
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .where('compliance_issues.status', '=', 'open')
      .executeTakeFirst();

    const openIssues = openIssuesResult?.count || 0;

    // Get framework scores
    const frameworkScores = await db
      .selectFrom('framework_scores')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .orderBy('framework', 'asc')
      .execute();

    // Get recent checks
    const recentChecks = await db
      .selectFrom('compliance_checks')
      .select([
        'id',
        'document_id',
        'framework',
        'overall_score',
        'issues_found',
        'created_at',
      ])
      .where('workspace_id', '=', workspaceId)
      .orderBy('created_at', 'desc')
      .limit(10)
      .execute();

    const coveragePercentage =
      latestScore.total_documents > 0
        ? Math.round((latestScore.documents_checked / latestScore.total_documents) * 100)
        : 0;

    return {
      overallScore: latestScore.overall_score,
      riskLevel: latestScore.risk_level as 'critical' | 'high' | 'medium' | 'low' | 'minimal',
      totalDocuments: latestScore.total_documents,
      documentsChecked: latestScore.documents_checked,
      coveragePercentage,
      totalIssues,
      openIssues,
      riskDistribution: {
        critical: latestScore.critical_issues,
        high: latestScore.high_issues,
        medium: latestScore.medium_issues,
        low: latestScore.low_issues,
        info: latestScore.info_issues,
      },
      frameworkScores: frameworkScores.map((fs) => ({
        framework: fs.framework,
        score: fs.score,
        checksPassed: fs.checks_passed,
        checksFailed: fs.checks_failed,
        totalChecks: fs.total_checks,
        lastCheckAt: fs.last_check_at,
      })),
      recentChecks: recentChecks.map((rc) => ({
        id: rc.id,
        documentId: rc.document_id,
        framework: rc.framework,
        score: rc.overall_score,
        issuesFound: rc.issues_found,
        createdAt: rc.created_at,
      })),
    };
  }

  async updateIssueStatus(
    issueId: string,
    workspaceId: string,
    userId: string,
    status: 'open' | 'in_progress' | 'resolved' | 'dismissed',
    assignedTo?: string
  ): Promise<{
    id: string;
    status: string;
    assignedTo: string | null;
    resolvedAt: number | null;
    resolvedBy: string | null;
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
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Verify issue belongs to workspace
    const issue = await db
      .selectFrom('compliance_issues')
      .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
      .select(['compliance_issues.id', 'compliance_checks.workspace_id'])
      .where('compliance_issues.id', '=', issueId)
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!issue) {
      throw new Error('Issue not found');
    }

    // Update issue
    const now = Date.now();
    const updateData: {
      status: string;
      assigned_to?: string | null;
      resolved_at?: number | null;
      resolved_by?: string | null;
    } = { status };

    if (assignedTo !== undefined) {
      updateData.assigned_to = assignedTo || null;
    }

    if (status === 'resolved' || status === 'dismissed') {
      updateData.resolved_at = now;
      updateData.resolved_by = userId;
    } else {
      updateData.resolved_at = null;
      updateData.resolved_by = null;
    }

    await db.updateTable('compliance_issues').set(updateData).where('id', '=', issueId).execute();

    // Get updated issue
    const updated = await db
      .selectFrom('compliance_issues')
      .select(['id', 'status', 'assigned_to', 'resolved_at', 'resolved_by'])
      .where('id', '=', issueId)
      .executeTakeFirst();

    return {
      id: updated!.id,
      status: updated!.status,
      assignedTo: updated!.assigned_to,
      resolvedAt: updated!.resolved_at,
      resolvedBy: updated!.resolved_by,
    };
  }

  async getIssuesByStatus(
    workspaceId: string,
    userId: string,
    status?: 'open' | 'in_progress' | 'resolved' | 'dismissed'
  ): Promise<{
    issues: Array<{
      id: string;
      checkId: string;
      documentId: string;
      severity: string;
      category: string;
      title: string;
      description: string;
      recommendation: string | null;
      location: string | null;
      status: string;
      assignedTo: string | null;
      createdAt: number;
      resolvedAt: number | null;
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
      throw new Error('Access denied: You are not a member of this workspace');
    }

    let query = db
      .selectFrom('compliance_issues')
      .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
      .select([
        'compliance_issues.id',
        'compliance_issues.check_id',
        'compliance_issues.document_id',
        'compliance_issues.severity',
        'compliance_issues.category',
        'compliance_issues.title',
        'compliance_issues.description',
        'compliance_issues.recommendation',
        'compliance_issues.location',
        'compliance_issues.status',
        'compliance_issues.assigned_to',
        'compliance_issues.created_at',
        'compliance_issues.resolved_at',
      ])
      .where('compliance_checks.workspace_id', '=', workspaceId);

    if (status) {
      query = query.where('compliance_issues.status', '=', status);
    }

    const issues = await query.orderBy('compliance_issues.created_at', 'desc').execute();

    return {
      issues: issues.map((issue) => ({
        id: issue.id,
        checkId: issue.check_id,
        documentId: issue.document_id,
        severity: issue.severity,
        category: issue.category,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation,
        location: issue.location,
        status: issue.status,
        assignedTo: issue.assigned_to,
        createdAt: issue.created_at,
        resolvedAt: issue.resolved_at,
      })),
    };
  }

  async getTrendAnalysis(
    workspaceId: string,
    userId: string,
    days: number = 30
  ): Promise<{
    trends: Array<{
      date: number;
      overallScore: number;
      riskLevel: string;
      totalIssues: number;
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
      throw new Error('Access denied: You are not a member of this workspace');
    }

    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const scores = await db
      .selectFrom('workspace_scores')
      .select([
        'calculated_at',
        'overall_score',
        'risk_level',
        'critical_issues',
        'high_issues',
        'medium_issues',
        'low_issues',
        'info_issues',
      ])
      .where('workspace_id', '=', workspaceId)
      .where('calculated_at', '>=', cutoffTime)
      .orderBy('calculated_at', 'asc')
      .execute();

    return {
      trends: scores.map((s) => ({
        date: s.calculated_at,
        overallScore: s.overall_score,
        riskLevel: s.risk_level,
        totalIssues:
          s.critical_issues + s.high_issues + s.medium_issues + s.low_issues + s.info_issues,
      })),
    };
  }
}
