import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

type ComplianceFramework =
  | 'GDPR'
  | 'SOC2'
  | 'HIPAA'
  | 'PCI_DSS'
  | 'ISO_27001'
  | 'NIST_CSF'
  | 'CCPA'
  | 'FERPA'
  | 'GLBA'
  | 'FISMA'
  | 'PIPEDA'
  | 'COPPA'
  | 'SOX';

interface RunComplianceCheckInput {
  documentId: string;
  workspaceId: string;
  userId: string;
  framework: ComplianceFramework;
}

interface ComplianceIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  recommendation: string;
  location?: string;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Compliance Service - Private', { status: 501 });
  }

  async runComplianceCheck(input: RunComplianceCheckInput): Promise<{
    checkId: string;
    documentId: string;
    framework: string;
    status: string;
    createdAt: number;
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

    // Get document
    const document = await db
      .selectFrom('documents')
      .select(['id', 'filename', 'storage_key'])
      .where('id', '=', input.documentId)
      .where('workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    // Create compliance check record
    const checkId = `chk_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    await db
      .insertInto('compliance_checks')
      .values({
        id: checkId,
        document_id: input.documentId,
        workspace_id: input.workspaceId,
        framework: input.framework,
        status: 'processing',
        issues_found: 0,
        created_at: now,
        created_by: input.userId,
      })
      .execute();

    // Trigger async compliance analysis
    this.analyzeCompliance(checkId, input.documentId, input.workspaceId, input.framework, document.storage_key);

    return {
      checkId,
      documentId: input.documentId,
      framework: input.framework,
      status: 'processing',
      createdAt: now,
    };
  }

  private async analyzeCompliance(
    checkId: string,
    documentId: string,
    workspaceId: string,
    framework: string,
    storageKey: string
  ): Promise<void> {
    try {
      const db = this.getDb();

      // Get document content from SmartBucket
      const file = await this.env.DOCUMENTS_BUCKET.get(storageKey);
      if (!file) {
        throw new Error('Document file not found in storage');
      }

      const content = await file.text();

      // Get document chunks if available
      const chunks = await db
        .selectFrom('document_chunks')
        .select(['content'])
        .where('document_id', '=', documentId)
        .execute();

      const documentText = chunks.length > 0 ? chunks.map((c) => c.content).join('\n\n') : content;

      // Run AI compliance analysis using SmartInference
      const issues = await this.performAIComplianceAnalysis(documentText, framework);

      // Store issues in database
      for (const issue of issues) {
        const issueId = `iss_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await db
          .insertInto('compliance_issues')
          .values({
            id: issueId,
            check_id: checkId,
            document_id: documentId,
            severity: issue.severity,
            category: issue.category,
            title: issue.title,
            description: issue.description,
            recommendation: issue.recommendation,
            location: issue.location || null,
            status: 'open',
            created_at: Date.now(),
          })
          .execute();
      }

      // Calculate overall score (100 - issues weighted by severity)
      const severityWeights = { critical: 20, high: 10, medium: 5, low: 2, info: 1 };
      const totalDeduction = issues.reduce((sum, issue) => sum + (severityWeights[issue.severity] || 0), 0);
      const overallScore = Math.max(0, 100 - totalDeduction);

      // Update compliance check with results
      await db
        .updateTable('compliance_checks')
        .set({
          status: 'completed',
          overall_score: overallScore,
          issues_found: issues.length,
          completed_at: Date.now(),
        })
        .where('id', '=', checkId)
        .execute();
    } catch (error) {
      // Mark check as failed
      const db = this.getDb();
      await db
        .updateTable('compliance_checks')
        .set({
          status: 'failed',
          completed_at: Date.now(),
        })
        .where('id', '=', checkId)
        .execute();

      this.env.logger.error(`Compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performAIComplianceAnalysis(documentText: string, framework: string): Promise<ComplianceIssue[]> {
    try {
      // Get framework rules
      const frameworkRules = this.getFrameworkRules(framework);

      const prompt = `Analyze the following document for compliance with ${framework}.

Framework Requirements:
${frameworkRules.join('\n')}

Document Content:
${documentText.substring(0, 4000)}

Provide a compliance analysis including:
1. Overall compliance score (0-100)
2. List of issues found with severity levels
3. Recommendations for each issue

Format as JSON with: { score: number, issues: [{severity, category, title, description, recommendation}], summary: string }`;

      // Use AI for compliance analysis
      const analysis = await this.env.AI.run('llama-3.1-8b-instruct-fast', {
        messages: [
          {
            role: 'system',
            content: 'You are a compliance expert analyzing documents for regulatory compliance. Provide detailed, actionable feedback.',
          },
          { role: 'user', content: prompt },
        ],
      });

      // Parse AI response
      const responseText = ('choices' in analysis && analysis.choices?.[0]?.message?.content) || '{}';

      try {
        const result = JSON.parse(responseText);
        if (result.issues && Array.isArray(result.issues)) {
          return result.issues.filter((issue: ComplianceIssue) => issue.severity && issue.title);
        }
      } catch {
        // JSON parse failed, fallback
      }

      return this.getFallbackIssues(framework);
    } catch (error) {
      this.env.logger.error(`AI compliance analysis failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return this.getFallbackIssues(framework);
    }
  }

  private getFrameworkRules(framework: string): string[] {
    const rules: Record<string, string[]> = {
      GDPR: [
        'Lawfulness, fairness and transparency in data processing',
        'Purpose limitation - data collected for specific purposes',
        'Data minimization - only necessary data collected',
        'Accuracy of personal data',
        'Storage limitation - data kept only as long as necessary',
        'Integrity and confidentiality (security)',
        'Accountability and governance',
        'Data subject rights (access, rectification, erasure, portability)',
        'Privacy by design and by default',
        'Data breach notification within 72 hours',
      ],
      HIPAA: [
        'Administrative safeguards for PHI',
        'Physical safeguards for facilities and equipment',
        'Technical safeguards for electronic PHI',
        'Privacy Rule compliance',
        'Security Rule compliance',
        'Breach Notification Rule',
        'Minimum necessary standard',
        'Business Associate Agreements',
        'Patient rights (access, amendment, accounting)',
        'Training and awareness programs',
      ],
      SOC2: [
        'Security - protection against unauthorized access',
        'Availability - system availability for operation',
        'Processing integrity - complete, valid, accurate, timely processing',
        'Confidentiality - protection of confidential information',
        'Privacy - collection, use, retention, disclosure of personal information',
        'Risk assessment process',
        'Control environment',
        'Communication and information systems',
        'Monitoring of controls',
        'Logical and physical access controls',
      ],
      ISO_27001: [
        'Information security policies',
        'Organization of information security',
        'Human resource security',
        'Asset management',
        'Access control',
        'Cryptography',
        'Physical and environmental security',
        'Operations security',
        'Communications security',
        'System acquisition, development and maintenance',
        'Supplier relationships',
        'Information security incident management',
        'Business continuity management',
        'Compliance with legal and contractual requirements',
      ],
      PCI_DSS: [
        'Install and maintain firewall configuration',
        'Do not use vendor-supplied defaults for passwords',
        'Protect stored cardholder data',
        'Encrypt transmission of cardholder data',
        'Use and regularly update anti-virus software',
        'Develop and maintain secure systems and applications',
        'Restrict access to cardholder data by business need-to-know',
        'Assign unique ID to each person with computer access',
        'Restrict physical access to cardholder data',
        'Track and monitor all access to network resources',
        'Regularly test security systems and processes',
        'Maintain information security policy',
      ],
    };

    return rules[framework] || ['General compliance requirements'];
  }

  private getFallbackIssues(framework: string): ComplianceIssue[] {
    // Return basic framework-specific issues as fallback
    if (framework === 'GDPR') {
      return [
        {
          severity: 'medium',
          category: 'General',
          title: 'GDPR Compliance Review Required',
          description: 'Document requires manual review for GDPR compliance requirements.',
          recommendation: 'Conduct detailed review of data processing activities, consent mechanisms, and data subject rights.',
        },
      ];
    }

    return [
      {
        severity: 'medium',
        category: 'General',
        title: 'SOC 2 Compliance Review Required',
        description: 'Document requires manual review for SOC 2 Trust Service Criteria.',
        recommendation: 'Review security controls, availability measures, and processing integrity mechanisms.',
      },
    ];
  }

  async listComplianceChecks(workspaceId: string, userId: string): Promise<{
    checks: Array<{
      id: string;
      documentId: string;
      documentName: string;
      framework: string;
      status: string;
      overallScore: number | null;
      issuesFound: number;
      createdAt: number;
      completedAt: number | null;
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

    // Get all checks for workspace with document info
    const checks = await db
      .selectFrom('compliance_checks')
      .innerJoin('documents', 'documents.id', 'compliance_checks.document_id')
      .select([
        'compliance_checks.id',
        'compliance_checks.document_id',
        'documents.filename as document_name',
        'compliance_checks.framework',
        'compliance_checks.status',
        'compliance_checks.overall_score',
        'compliance_checks.issues_found',
        'compliance_checks.created_at',
        'compliance_checks.completed_at',
      ])
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .orderBy('compliance_checks.created_at', 'desc')
      .execute();

    return {
      checks: checks.map((check) => ({
        id: check.id,
        documentId: check.document_id,
        documentName: check.document_name,
        framework: check.framework,
        status: check.status,
        overallScore: check.overall_score,
        issuesFound: check.issues_found,
        createdAt: check.created_at,
        completedAt: check.completed_at,
      })),
    };
  }

  async getComplianceCheck(checkId: string, workspaceId: string, userId: string): Promise<{
    id: string;
    documentId: string;
    framework: string;
    status: string;
    overallScore: number | null;
    issuesFound: number;
    createdAt: number;
    completedAt: number | null;
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

    // Get check
    const check = await db
      .selectFrom('compliance_checks')
      .select([
        'id',
        'document_id',
        'framework',
        'status',
        'overall_score',
        'issues_found',
        'created_at',
        'completed_at',
      ])
      .where('id', '=', checkId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!check) {
      throw new Error('Compliance check not found');
    }

    return {
      id: check.id,
      documentId: check.document_id,
      framework: check.framework,
      status: check.status,
      overallScore: check.overall_score,
      issuesFound: check.issues_found,
      createdAt: check.created_at,
      completedAt: check.completed_at,
    };
  }

  async getComplianceIssues(checkId: string, workspaceId: string, userId: string): Promise<{
    issues: Array<{
      id: string;
      severity: string;
      category: string;
      title: string;
      description: string;
      recommendation: string | null;
      location: string | null;
      createdAt: number;
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

    // Verify check belongs to workspace
    const check = await db
      .selectFrom('compliance_checks')
      .select('workspace_id')
      .where('id', '=', checkId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!check) {
      throw new Error('Compliance check not found');
    }

    // Get issues
    const issues = await db
      .selectFrom('compliance_issues')
      .select([
        'id',
        'severity',
        'category',
        'title',
        'description',
        'recommendation',
        'location',
        'created_at',
      ])
      .where('check_id', '=', checkId)
      .orderBy('created_at', 'desc')
      .execute();

    return {
      issues: issues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        category: issue.category,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation,
        location: issue.location,
        createdAt: issue.created_at,
      })),
    };
  }
}
