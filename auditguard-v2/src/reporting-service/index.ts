import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface ExecutiveSummary {
  workspaceId: string;
  generatedAt: number;
  reportPeriod: {
    startDate: number;
    endDate: number;
  };
  overview: {
    overallScore: number;
    maturityLevel: number;
    totalDocuments: number;
    documentsChecked: number;
    coveragePercentage: number;
    totalIssues: number;
    criticalIssues: number;
  };
  keyFindings: string[];
  topRisks: Array<{
    category: string;
    severity: string;
    count: number;
    description: string;
  }>;
  frameworkSummary: Array<{
    framework: string;
    score: number;
    status: 'compliant' | 'needs_improvement' | 'non_compliant';
    coverage: number;
  }>;
  recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    estimatedEffort: string;
  }>;
  trends: {
    scoreChange: number;
    issueChange: number;
    coverageChange: number;
  };
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Reporting Service - Private', { status: 501 });
  }

  /**
   * PHASE 1.3.2: Generate Executive Summary
   * Creates a comprehensive executive summary with AI-powered insights
   */
  async generateExecutiveSummary(
    workspaceId: string,
    userId: string,
    options?: {
      startDate?: number;
      endDate?: number;
      frameworks?: string[];
    }
  ): Promise<ExecutiveSummary> {
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

    const endDate = options?.endDate || Date.now();
    const startDate = options?.startDate || endDate - 30 * 24 * 60 * 60 * 1000; // Default: last 30 days

    // Get workspace dashboard data
    const dashboard = await this.env.ANALYTICS_SERVICE.getWorkspaceDashboard(workspaceId, userId);

    // Get maturity level
    const maturity = await this.env.ANALYTICS_SERVICE.calculateMaturityLevel(workspaceId, userId);

    // Get top issues by severity (priority field doesn't exist in DB)
    const topIssues = await db
      .selectFrom('compliance_issues')
      .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
      .select([
        'compliance_issues.category',
        'compliance_issues.severity',
        'compliance_issues.title',
      ])
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .where('compliance_issues.status', '=', 'open')
      .where('compliance_issues.created_at', '>=', startDate)
      .where('compliance_issues.created_at', '<=', endDate)
      .orderBy('compliance_issues.created_at', 'desc')
      .limit(10)
      .execute();

    // Aggregate top risks by category
    const riskCounts = new Map<string, { severity: string; count: number; issues: string[] }>();
    for (const issue of topIssues) {
      const existing = riskCounts.get(issue.category) || {
        severity: issue.severity,
        count: 0,
        issues: [],
      };
      existing.count++;
      existing.issues.push(issue.title);
      // Keep highest severity
      if (this.getSeverityOrder(issue.severity) < this.getSeverityOrder(existing.severity)) {
        existing.severity = issue.severity;
      }
      riskCounts.set(issue.category, existing);
    }

    const topRisks = Array.from(riskCounts.entries())
      .map(([category, data]) => ({
        category,
        severity: data.severity,
        count: data.count,
        description: `${data.count} open issue(s) related to ${category}`,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get framework summary
    const frameworkSummary = dashboard.frameworkScores.map((fs) => ({
      framework: fs.framework,
      score: fs.score,
      status: (fs.score >= 80 ? 'compliant' : fs.score >= 60 ? 'needs_improvement' : 'non_compliant') as
        | 'compliant'
        | 'needs_improvement'
        | 'non_compliant',
      coverage: fs.totalChecks > 0 ? Math.round((fs.checksPassed / fs.totalChecks) * 100) : 0,
    }));

    // Calculate trends
    const trends = await this.env.ANALYTICS_SERVICE.getTrendAnalysis(workspaceId, userId, 30);
    let scoreChange = 0;
    let issueChange = 0;

    if (trends.trends.length >= 2) {
      const latest = trends.trends[trends.trends.length - 1];
      const previous = trends.trends[trends.trends.length - 2];
      scoreChange = latest.overallScore - previous.overallScore;
      issueChange = latest.totalIssues - previous.totalIssues;
    }

    const coverageChange = 0; // Simplified for now

    // Generate key findings using AI
    const keyFindings = await this.generateAIKeyFindings(dashboard, maturity, topRisks);

    // Generate recommendations
    const recommendations = this.generateRecommendations(dashboard, maturity, topRisks, frameworkSummary);

    return {
      workspaceId,
      generatedAt: Date.now(),
      reportPeriod: {
        startDate,
        endDate,
      },
      overview: {
        overallScore: dashboard.overallScore,
        maturityLevel: maturity.level,
        totalDocuments: dashboard.totalDocuments,
        documentsChecked: dashboard.documentsChecked,
        coveragePercentage: dashboard.coveragePercentage,
        totalIssues: dashboard.totalIssues,
        criticalIssues: dashboard.riskDistribution.critical,
      },
      keyFindings,
      topRisks,
      frameworkSummary,
      recommendations,
      trends: {
        scoreChange,
        issueChange,
        coverageChange,
      },
    };
  }

  /**
   * PHASE 1.3.4: Export Compliance Data
   * Export compliance data in JSON or CSV format
   */
  async exportComplianceData(
    workspaceId: string,
    userId: string,
    format: 'json' | 'csv',
    options?: {
      includeIssues?: boolean;
      includeChecks?: boolean;
      frameworks?: string[];
      startDate?: number;
      endDate?: number;
    }
  ): Promise<{
    data: string;
    filename: string;
    contentType: string;
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

    const includeIssues = options?.includeIssues !== false;
    const includeChecks = options?.includeChecks !== false;

    const exportData: {
      workspace: { id: string; exportedAt: number };
      summary?: any;
      checks?: any[];
      issues?: any[];
    } = {
      workspace: {
        id: workspaceId,
        exportedAt: Date.now(),
      },
    };

    // Get workspace summary
    const dashboard = await this.env.ANALYTICS_SERVICE.getWorkspaceDashboard(workspaceId, userId);
    exportData.summary = {
      overallScore: dashboard.overallScore,
      riskLevel: dashboard.riskLevel,
      totalDocuments: dashboard.totalDocuments,
      documentsChecked: dashboard.documentsChecked,
      coveragePercentage: dashboard.coveragePercentage,
      totalIssues: dashboard.totalIssues,
      openIssues: dashboard.openIssues,
      riskDistribution: dashboard.riskDistribution,
    };

    // Get compliance checks
    if (includeChecks) {
      let checksQuery = db
        .selectFrom('compliance_checks')
        .innerJoin('documents', 'compliance_checks.document_id', 'documents.id')
        .select([
          'compliance_checks.id',
          'compliance_checks.framework',
          'compliance_checks.status',
          'compliance_checks.overall_score',
          'compliance_checks.issues_found',
          'compliance_checks.created_at',
          'compliance_checks.completed_at',
          'documents.filename',
        ])
        .where('compliance_checks.workspace_id', '=', workspaceId);

      if (options?.frameworks && options.frameworks.length > 0) {
        checksQuery = checksQuery.where('compliance_checks.framework', 'in', options.frameworks);
      }

      if (options?.startDate) {
        checksQuery = checksQuery.where('compliance_checks.created_at', '>=', options.startDate);
      }

      if (options?.endDate) {
        checksQuery = checksQuery.where('compliance_checks.created_at', '<=', options.endDate);
      }

      exportData.checks = await checksQuery.execute();
    }

    // Get compliance issues
    if (includeIssues) {
      let issuesQuery = db
        .selectFrom('compliance_issues')
        .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
        .innerJoin('documents', 'compliance_checks.document_id', 'documents.id')
        .select([
          'compliance_issues.id',
          'compliance_issues.severity',
          'compliance_issues.category',
          'compliance_issues.title',
          'compliance_issues.description',
          'compliance_issues.recommendation',
          'compliance_issues.status',
          'compliance_issues.created_at',
          'compliance_checks.framework',
          'documents.filename',
        ])
        .where('compliance_checks.workspace_id', '=', workspaceId);

      if (options?.frameworks && options.frameworks.length > 0) {
        issuesQuery = issuesQuery.where('compliance_checks.framework', 'in', options.frameworks);
      }

      if (options?.startDate) {
        issuesQuery = issuesQuery.where('compliance_issues.created_at', '>=', options.startDate);
      }

      if (options?.endDate) {
        issuesQuery = issuesQuery.where('compliance_issues.created_at', '<=', options.endDate);
      }

      exportData.issues = await issuesQuery.execute();
    }

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      return {
        data: JSON.stringify(exportData, null, 2),
        filename: `compliance-export-${workspaceId}-${timestamp}.json`,
        contentType: 'application/json',
      };
    } else {
      // CSV format - export issues as CSV
      const csv = this.convertToCSV(exportData.issues || []);
      return {
        data: csv,
        filename: `compliance-issues-${workspaceId}-${timestamp}.csv`,
        contentType: 'text/csv',
      };
    }
  }

  /**
   * Save a generated report to the database
   */
  async saveReport(
    workspaceId: string,
    userId: string,
    report: {
      name: string;
      frameworks: string[];
      reportPeriod: { startDate: number; endDate: number };
      summary: any;
    }
  ): Promise<{ id: string; createdAt: number }> {
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

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const now = Date.now();

    await db
      .insertInto('compliance_reports')
      .values({
        id: reportId,
        workspace_id: workspaceId,
        name: report.name,
        created_at: now,
        created_by: userId,
        frameworks: JSON.stringify(report.frameworks),
        report_period: JSON.stringify(report.reportPeriod),
        summary: JSON.stringify(report.summary),
        status: 'completed',
      })
      .execute();

    return { id: reportId, createdAt: now };
  }

  /**
   * Get all saved reports for a workspace
   */
  async getReports(
    workspaceId: string,
    userId: string
  ): Promise<Array<{
    id: string;
    name: string;
    createdAt: number;
    createdBy: string;
    frameworks: string[];
    reportPeriod: { startDate: number; endDate: number };
    summary: {
      overallScore: number;
      totalIssues: number;
      criticalIssues: number;
      frameworks: Array<{ name: string; score: number }>;
    };
    status: string;
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
      throw new Error('Access denied: You are not a member of this workspace');
    }

    const reports = await db
      .selectFrom('compliance_reports')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .orderBy('created_at', 'desc')
      .execute();

    return reports.map((report) => ({
      id: report.id,
      name: report.name,
      createdAt: report.created_at,
      createdBy: report.created_by,
      frameworks: JSON.parse(report.frameworks),
      reportPeriod: JSON.parse(report.report_period),
      summary: JSON.parse(report.summary),
      status: report.status,
    }));
  }

  /**
   * Get a single saved report by ID
   */
  async getReport(
    workspaceId: string,
    userId: string,
    reportId: string
  ): Promise<{
    id: string;
    name: string;
    createdAt: number;
    createdBy: string;
    frameworks: string[];
    reportPeriod: { startDate: number; endDate: number };
    summary: any;
    status: string;
  } | null> {
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

    const report = await db
      .selectFrom('compliance_reports')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('id', '=', reportId)
      .executeTakeFirst();

    if (!report) {
      return null;
    }

    return {
      id: report.id,
      name: report.name,
      createdAt: report.created_at,
      createdBy: report.created_by,
      frameworks: JSON.parse(report.frameworks),
      reportPeriod: JSON.parse(report.report_period),
      summary: JSON.parse(report.summary),
      status: report.status,
    };
  }

  /**
   * Delete a saved report
   */
  async deleteReport(
    workspaceId: string,
    userId: string,
    reportId: string
  ): Promise<{ success: boolean }> {
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

    // Get report to check if user created it or has admin role
    const report = await db
      .selectFrom('compliance_reports')
      .select(['created_by'])
      .where('workspace_id', '=', workspaceId)
      .where('id', '=', reportId)
      .executeTakeFirst();

    if (!report) {
      throw new Error('Report not found');
    }

    // Check if user is creator or has admin role
    const isCreator = report.created_by === userId;
    
    const roleHierarchy: Record<string, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    const userRoleLevel = roleHierarchy[membership.role] ?? 0;
    const adminRoleLevel = roleHierarchy['admin'] ?? 3;
    const isAdminOrOwner = userRoleLevel >= adminRoleLevel;

    if (!isCreator && !isAdminOrOwner) {
      throw new Error('Access denied: Requires report creator, admin, or owner role');
    }

    // Delete the report
    await db
      .deleteFrom('compliance_reports')
      .where('workspace_id', '=', workspaceId)
      .where('id', '=', reportId)
      .execute();

    this.env.logger.info('Report deleted successfully', {
      workspaceId,
      reportId,
      deletedBy: userId,
    });

    return { success: true };
  }

  /**
   * Generate AI-powered key findings
   */
  private async generateAIKeyFindings(dashboard: any, maturity: any, topRisks: any[]): Promise<string[]> {
    const findings: string[] = [];

    // Maturity finding
    findings.push(
      `Organization is at CMMI Level ${maturity.level} (${maturity.name}) with a maturity score of ${maturity.score}/100`
    );

    // Coverage finding
    if (dashboard.coveragePercentage >= 80) {
      findings.push(`Excellent compliance coverage with ${dashboard.coveragePercentage}% of documents analyzed`);
    } else if (dashboard.coveragePercentage >= 50) {
      findings.push(`Good progress on compliance coverage (${dashboard.coveragePercentage}%), continue expanding coverage`);
    } else {
      findings.push(`Limited compliance coverage (${dashboard.coveragePercentage}%) - prioritize document analysis`);
    }

    // Risk finding
    if (dashboard.riskDistribution.critical > 0) {
      findings.push(
        `Critical: ${dashboard.riskDistribution.critical} critical issue(s) require immediate attention`
      );
    } else if (dashboard.riskDistribution.high >= 5) {
      findings.push(`${dashboard.riskDistribution.high} high-priority issues identified across compliance frameworks`);
    } else {
      findings.push('No critical issues identified - maintain current compliance posture');
    }

    // Framework finding
    if (dashboard.frameworkScores.length >= 3) {
      findings.push(
        `Multi-framework compliance approach with ${dashboard.frameworkScores.length} frameworks implemented`
      );
    } else if (dashboard.frameworkScores.length > 0) {
      findings.push(`Active compliance tracking for ${dashboard.frameworkScores.length} framework(s)`);
    }

    // Top risk finding
    if (topRisks.length > 0) {
      findings.push(`Primary compliance concern: ${topRisks[0].category} with ${topRisks[0].count} open issue(s)`);
    }

    return findings;
  }

  /**
   * Generate prioritized recommendations
   */
  private generateRecommendations(
    dashboard: any,
    maturity: any,
    topRisks: any[],
    frameworkSummary: any[]
  ): Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    estimatedEffort: string;
  }> {
    const recommendations: Array<{
      priority: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      description: string;
      estimatedEffort: string;
    }> = [];

    // Critical recommendations
    if (dashboard.riskDistribution.critical > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Address Critical Compliance Issues',
        description: `Resolve ${dashboard.riskDistribution.critical} critical issue(s) immediately to reduce regulatory risk`,
        estimatedEffort: '1-2 weeks',
      });
    }

    // High priority recommendations
    if (dashboard.coveragePercentage < 50) {
      recommendations.push({
        priority: 'high',
        title: 'Expand Compliance Coverage',
        description: `Increase document coverage from ${dashboard.coveragePercentage}% to at least 75% to ensure comprehensive compliance`,
        estimatedEffort: '2-4 weeks',
      });
    }

    if (topRisks.length > 0 && topRisks[0].count >= 5) {
      recommendations.push({
        priority: 'high',
        title: `Focus on ${topRisks[0].category}`,
        description: `Address ${topRisks[0].count} issues in ${topRisks[0].category} to reduce primary compliance risk`,
        estimatedEffort: '1-3 weeks',
      });
    }

    // Medium priority recommendations
    const nonCompliantFrameworks = frameworkSummary.filter((f) => f.status === 'non_compliant');
    if (nonCompliantFrameworks.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve Framework Compliance',
        description: `${nonCompliantFrameworks.length} framework(s) below compliance threshold - implement missing controls`,
        estimatedEffort: '4-8 weeks',
      });
    }

    // Add maturity advancement recommendation
    if (maturity.nextSteps && maturity.nextSteps.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: `Advance to CMMI Level ${maturity.level + 1}`,
        description: maturity.nextSteps[0],
        estimatedEffort: '2-3 months',
      });
    }

    // Low priority recommendations
    if (dashboard.frameworkScores.length < 3) {
      recommendations.push({
        priority: 'low',
        title: 'Expand Framework Coverage',
        description: 'Consider implementing additional compliance frameworks relevant to your industry',
        estimatedEffort: '1-2 months',
      });
    }

    return recommendations.slice(0, 8); // Top 8 recommendations
  }

  /**
   * Helper to get severity order for sorting
   */
  private getSeverityOrder(severity: string): number {
    const order: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };
    return order[severity] || 5;
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) {
      return 'No data available';
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    // Add data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(value || '').replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * PHASE 2: Generate comprehensive compliance report
   */
  async generateComplianceReport(params: {
    workspaceId: string;
    userId: string;
    frameworks?: string[];
    dateRange?: { start: number; end: number };
    includeRecommendations?: boolean;
    format?: 'summary' | 'detailed';
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

    const now = Date.now();
    const reportId = `report_${now}_${Math.random().toString(36).substr(2, 9)}`;

    // Get workspace score
    const workspaceScore = await db
      .selectFrom('workspace_scores')
      .selectAll()
      .where('workspace_id', '=', params.workspaceId)
      .orderBy('calculated_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    // Get framework scores
    let frameworkQuery = db
      .selectFrom('framework_scores')
      .selectAll()
      .where('workspace_id', '=', params.workspaceId)
      .orderBy('last_check_at', 'desc');

    if (params.frameworks && params.frameworks.length > 0) {
      frameworkQuery = frameworkQuery.where('framework', 'in', params.frameworks);
    }

    const frameworkScores = await frameworkQuery.execute();

    // Get issues
    let issuesQuery = db
      .selectFrom('compliance_issues')
      .selectAll()
      .where('workspace_id', '=', params.workspaceId);

    if (params.dateRange) {
      issuesQuery = issuesQuery
        .where('created_at', '>=', params.dateRange.start)
        .where('created_at', '<=', params.dateRange.end);
    }

    if (params.frameworks && params.frameworks.length > 0) {
      issuesQuery = issuesQuery.where('framework', 'in', params.frameworks);
    }

    const issues = await issuesQuery.execute();

    // Count resolved issues
    const resolvedIssues = issues.filter(i => i.status === 'resolved').length;

    // Count documents analyzed
    const docCount = await db
      .selectFrom('documents')
      .select(db.fn.count('id').as('count'))
      .where('workspace_id', '=', params.workspaceId)
      .where('processing_status', '=', 'completed')
      .executeTakeFirst();

    // Group issues by category
    const issuesByCategory: Record<string, number> = {};
    for (const issue of issues) {
      const category = issue.category || 'Other';
      issuesByCategory[category] = (issuesByCategory[category] || 0) + 1;
    }

    // Generate executive summary
    const executiveSummary = `This compliance report covers ${params.frameworks?.join(', ') || 'all frameworks'} for the period ${params.dateRange ? new Date(params.dateRange.start).toLocaleDateString() + ' to ' + new Date(params.dateRange.end).toLocaleDateString() : 'all time'}. Overall compliance score: ${workspaceScore?.overall_score?.toFixed(1) || 'N/A'}%. Total issues: ${issues.length} (${resolvedIssues} resolved).`;

    // Build framework reports
    const frameworkReports = frameworkScores.map(fs => {
      const frameworkIssues = issues.filter(i => i.framework === fs.framework);
      
      const keyFindings: string[] = [];
      const criticalCount = frameworkIssues.filter(i => i.severity === 'critical').length;
      if (criticalCount > 0) {
        keyFindings.push(`${criticalCount} critical issues require immediate attention`);
      }

      const recommendations: string[] = [];
      if (fs.score < 70) {
        recommendations.push(`Improve ${fs.framework} compliance by addressing high-severity issues first`);
      }

      return {
        framework: fs.framework,
        score: fs.score,
        issuesByCategory: frameworkIssues.reduce((acc, i) => {
          const cat = i.category || 'Other';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        keyFindings,
        recommendations,
      };
    });

    // Generate action items
    const actionItems = issues
      .filter(i => i.status === 'open' && (i.severity === 'critical' || i.severity === 'high'))
      .slice(0, 10)
      .map(i => `${i.severity.toUpperCase()}: ${i.title}`);

    const report = {
      reportId,
      generatedAt: now,
      period: params.dateRange || { start: 0, end: now },
      summary: {
        overallScore: workspaceScore?.overall_score || 0,
        totalIssues: issues.length,
        resolvedIssues,
        documentsAnalyzed: Number(docCount?.count || 0),
      },
      frameworkReports,
      executiveSummary,
      actionItems,
    };

    // Store report metadata
    this.env.logger.info('Compliance report generated', {
      reportId,
      workspaceId: params.workspaceId,
      frameworks: params.frameworks,
      issueCount: issues.length,
    });

    return report;
  }

  /**
   * PHASE 2: Get saved reports list
   */
  async getSavedReports(params: {
    workspaceId: string;
    userId: string;
    limit?: number;
    offset?: number;
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

    // Get all reports for workspace
    // Note: Currently reports are generated on-demand and not persisted
    // This would typically query a reports table
    // For now, return recent executive summaries as a proxy

    const limit = params.limit || 20;
    const offset = params.offset || 0;

    // Get recent compliance checks as proxy for reports
    const checks = await db
      .selectFrom('compliance_checks')
      .innerJoin('users', 'users.id', 'compliance_checks.created_by')
      .select([
        'compliance_checks.id',
        'compliance_checks.framework',
        'compliance_checks.created_at',
        'compliance_checks.created_by',
        'users.email as creator_email',
      ])
      .where('compliance_checks.workspace_id', '=', params.workspaceId)
      .orderBy('compliance_checks.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      reports: checks.map(c => ({
        id: c.id,
        name: `${c.framework} Compliance Report`,
        frameworks: [c.framework],
        period: {
          start: c.created_at - 30 * 24 * 60 * 60 * 1000, // 30 days before
          end: c.created_at,
        },
        createdAt: c.created_at,
        createdBy: {
          id: c.created_by,
          name: c.creator_email.split('@')[0],
        },
      })),
      total: checks.length,
    };
  }

  /**
   * PHASE 2: Get analytics dashboard data
   */
  async getAnalyticsDashboard(params: {
    workspaceId: string;
    userId: string;
    metrics: string[];
    dateRange?: { start: number; end: number };
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

    const result: any = {};

    // Compliance trends
    if (params.metrics.includes('compliance_trends')) {
      let trendsQuery = db
        .selectFrom('compliance_trends')
        .select(['date', 'overall_score'])
        .where('workspace_id', '=', params.workspaceId)
        .orderBy('date', 'asc');

      if (params.dateRange) {
        const startDate = new Date(params.dateRange.start).toISOString().split('T')[0];
        const endDate = new Date(params.dateRange.end).toISOString().split('T')[0];
        trendsQuery = trendsQuery
          .where('date', '>=', startDate)
          .where('date', '<=', endDate);
      }

      const trends = await trendsQuery.execute();
      
      let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
      if (trends.length >= 2) {
        const firstScore = trends[0].overall_score;
        const lastScore = trends[trends.length - 1].overall_score;
        if (lastScore > firstScore + 5) trendDirection = 'improving';
        else if (lastScore < firstScore - 5) trendDirection = 'declining';
      }

      result.complianceTrends = {
        scoreHistory: trends.map(t => ({
          date: t.date,
          score: t.overall_score,
        })),
        trend: trendDirection,
      };
    }

    // Issue velocity
    if (params.metrics.includes('issue_velocity')) {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const issuesCreated = await db
        .selectFrom('compliance_issues')
        .select(db.fn.count('id').as('count'))
        .where('workspace_id', '=', params.workspaceId)
        .where('created_at', '>=', thirtyDaysAgo)
        .executeTakeFirst();

      const issuesResolved = await db
        .selectFrom('compliance_issues')
        .select(db.fn.count('id').as('count'))
        .where('workspace_id', '=', params.workspaceId)
        .where('status', '=', 'resolved')
        .where('updated_at', '>=', thirtyDaysAgo)
        .executeTakeFirst();

      // Calculate avg time to resolve (simplified)
      const resolvedIssues = await db
        .selectFrom('compliance_issues')
        .select(['created_at', 'updated_at'])
        .where('workspace_id', '=', params.workspaceId)
        .where('status', '=', 'resolved')
        .where('updated_at', '>=', thirtyDaysAgo)
        .execute();

      let avgTimeToResolve = 0;
      if (resolvedIssues.length > 0) {
        const totalTime = resolvedIssues.reduce((sum, i) => sum + (i.updated_at - i.created_at), 0);
        avgTimeToResolve = Math.round(totalTime / resolvedIssues.length / (1000 * 60 * 60)); // hours
      }

      result.issueVelocity = {
        created: Number(issuesCreated?.count || 0),
        resolved: Number(issuesResolved?.count || 0),
        avgTimeToResolve,
      };
    }

    // Team performance
    if (params.metrics.includes('team_performance')) {
      const members = await db
        .selectFrom('workspace_members')
        .select('user_id')
        .where('workspace_id', '=', params.workspaceId)
        .execute();

      const activeMembers = await db
        .selectFrom('workspace_members')
        .innerJoin('issue_assignments', 'issue_assignments.assigned_to', 'workspace_members.user_id')
        .select('workspace_members.user_id')
        .where('workspace_members.workspace_id', '=', params.workspaceId)
        .groupBy('workspace_members.user_id')
        .execute();

      // Get issues by member
      const issuesByMember: Record<string, number> = {};
      for (const member of members) {
        const count = await db
          .selectFrom('issue_assignments')
          .innerJoin('compliance_issues', 'compliance_issues.id', 'issue_assignments.issue_id')
          .select(db.fn.count('issue_assignments.id').as('count'))
          .where('issue_assignments.assigned_to', '=', member.user_id)
          .where('compliance_issues.workspace_id', '=', params.workspaceId)
          .executeTakeFirst();

        issuesByMember[member.user_id] = Number(count?.count || 0);
      }

      result.teamPerformance = {
        totalMembers: members.length,
        activeMembers: activeMembers.length,
        issuesByMember,
      };
    }

    // Document stats
    if (params.metrics.includes('document_stats')) {
      const totalDocs = await db
        .selectFrom('documents')
        .select(db.fn.count('id').as('count'))
        .where('workspace_id', '=', params.workspaceId)
        .executeTakeFirst();

      const analyzedDocs = await db
        .selectFrom('documents')
        .select(db.fn.count('id').as('count'))
        .where('workspace_id', '=', params.workspaceId)
        .where('processing_status', '=', 'completed')
        .executeTakeFirst();

      const avgScore = await db
        .selectFrom('compliance_checks')
        .select(db.fn.avg('overall_score').as('avg'))
        .where('workspace_id', '=', params.workspaceId)
        .executeTakeFirst();

      result.documentStats = {
        totalDocuments: Number(totalDocs?.count || 0),
        documentsAnalyzed: Number(analyzedDocs?.count || 0),
        avgComplianceScore: Math.round(Number(avgScore?.avg || 0) * 10) / 10,
      };
    }

    return result;
  }
}

