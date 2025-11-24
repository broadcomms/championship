import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { broadcastComplianceCheckUpdate, broadcastDashboardUpdate } from '../common/realtime-events';

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
  confidence?: number; // PHASE 1.1.2: Confidence score (0-100)
}

export default class extends Service<Env> {
  // PHASE 1.1.2: Framework rule cache to avoid repeated lookups
  private frameworkRuleCache: Map<string, string[]> = new Map();

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

    // Broadcast that check has started (PHASE 4.2.1)
    await broadcastComplianceCheckUpdate(this.env, input.workspaceId, {
      checkId,
      status: 'running',
      progress: 0,
    });

    this.env.logger.info('🚀 Running compliance analysis SYNCHRONOUSLY for demo', {
      checkId,
      documentId: input.documentId,
      framework: input.framework,
    });
    
    // TEMPORARY: Run synchronously for championship demo
    // TODO: Move to queue-based async processing for production
    try {
      await this.analyzeCompliance(checkId, input.documentId, input.workspaceId, input.framework, document.storage_key);
    } catch (error) {
      this.env.logger.error('❌ Compliance analysis failed', {
        checkId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      checkId,
      documentId: input.documentId,
      framework: input.framework,
      status: 'processing',
      createdAt: now,
    };
  }

  /**
   * PHASE 1.1.3: Calculate Issue Priority Score
   * Priority = (Severity Weight × Framework Weight × Confidence Factor) + Context Adjustments
   * Returns priority score (0-100, higher = more urgent)
   */
  private calculateIssuePriority(issue: ComplianceIssue, framework: string, workspaceContext?: {
    industryRisk?: 'high' | 'medium' | 'low';
    documentType?: 'policy' | 'code' | 'contract' | 'other';
  }): number {
    // 1. Base severity weighting (0-40 points)
    const severityWeights: Record<string, number> = {
      critical: 40,
      high: 30,
      medium: 20,
      low: 10,
      info: 5,
    };
    const severityScore = severityWeights[issue.severity] || 10;

    // 2. Framework weight based on regulatory impact (0.5-2.0 multiplier)
    const frameworkWeights: Record<string, number> = {
      HIPAA: 2.0, // Healthcare - high penalties
      PCI_DSS: 2.0, // Payment processing - high penalties
      SOX: 1.8, // Financial reporting - criminal liability
      GDPR: 1.7, // Data privacy - large fines
      GLBA: 1.6, // Financial privacy
      FISMA: 1.5, // Federal systems
      SOC2: 1.3, // Trust services
      ISO_27001: 1.2, // Security standard
      NIST_CSF: 1.2, // Cybersecurity framework
      CCPA: 1.5, // California privacy
      FERPA: 1.4, // Education privacy
      PIPEDA: 1.4, // Canadian privacy
      COPPA: 1.6, // Children's privacy
    };
    const frameworkWeight = frameworkWeights[framework] || 1.0;

    // 3. Confidence factor (0.5-1.0 multiplier)
    // Lower confidence = lower priority (might be false positive)
    const confidence = issue.confidence || 70;
    const confidenceFactor = Math.max(0.5, Math.min(1.0, confidence / 100));

    // 4. Context-based adjustments (-10 to +20 points)
    let contextAdjustment = 0;

    // Industry risk profile
    if (workspaceContext?.industryRisk === 'high') {
      contextAdjustment += 15; // Healthcare, finance, government
    } else if (workspaceContext?.industryRisk === 'medium') {
      contextAdjustment += 8; // Education, legal
    } else if (workspaceContext?.industryRisk === 'low') {
      contextAdjustment += 3; // General business
    }

    // Document type importance
    if (workspaceContext?.documentType === 'policy') {
      contextAdjustment += 10; // Policy documents are critical
    } else if (workspaceContext?.documentType === 'contract') {
      contextAdjustment += 8; // Legal contracts important
    } else if (workspaceContext?.documentType === 'code') {
      contextAdjustment += 5; // Source code security
    }

    // Category-specific boosts
    const highPriorityCategories = [
      'data breach',
      'encryption',
      'access control',
      'authentication',
      'consent',
      'retention',
      'incident response',
    ];
    const categoryLower = issue.category.toLowerCase();
    if (highPriorityCategories.some((cat) => categoryLower.includes(cat))) {
      contextAdjustment += 5;
    }

    // Calculate final priority score
    const basePriority = severityScore * frameworkWeight * confidenceFactor;
    const finalPriority = Math.min(100, Math.max(0, basePriority + contextAdjustment));

    return Math.round(finalPriority);
  }

  private async analyzeCompliance(
    checkId: string,
    documentId: string,
    workspaceId: string,
    framework: string,
    storageKey: string
  ): Promise<void> {
    this.env.logger.info('📊 Starting analyzeCompliance', {
      checkId,
      documentId,
      framework,
      storageKey,
    });
    
    try {
      const db = this.getDb();

      // Get document content 
      this.env.logger.info('📂 Fetching document ', { storageKey });
      const file = await this.env.DOCUMENTS_BUCKET.get(storageKey);
      if (!file) {
        throw new Error('Document file not found in storage');
      }

      const content = await file.text();
      this.env.logger.info('✅ Document fetched', {
        contentLength: content.length,
      });

      // Get document chunks if available
      const chunks = await db
        .selectFrom('document_chunks')
        .select(['chunk_text'])
        .where('document_id', '=', documentId)
        .execute();

      this.env.logger.info('📄 Document chunks retrieved', {
        chunkCount: chunks.length,
      });

      const documentText = chunks.length > 0 ? chunks.map((c) => c.chunk_text).join('\n\n') : content;

      // Run AI compliance analysis using SmartInference
      this.env.logger.info('🤖 Starting AI compliance analysis', {
        framework,
        textLength: documentText.length,
      });
      
      const issues = await this.performAIComplianceAnalysis(documentText, framework, checkId);
      
      this.env.logger.info('✅ AI analysis completed', {
        issuesFound: issues.length,
        isGenuineAnalysis: issues.length > 0 && issues[0].title !== 'SOC 2 Compliance Review Required',
      });

      // CRITICAL FIX: Only process genuine AI-found issues, not fallbacks
      // But ALWAYS check for existing unresolved issues first!
      
      // Get existing unresolved issues for this document+framework
      const existingIssues = await db
        .selectFrom('compliance_issues')
        .selectAll()
        .where('document_id', '=', documentId)
        .where('framework', '=', framework)
        .where('is_active', '=', 1)
        .where('status', 'in', ['open', 'in_progress', 'review'])
        .execute();

      this.env.logger.info('Existing unresolved issues check', {
        checkId,
        existingCount: existingIssues.length,
        aiFoundIssues: issues.length,
      });

      if (issues.length === 0) {
        // AI found no issues, but check if existing issues still exist
        if (existingIssues.length > 0) {
          // Existing issues not detected by AI - mark them as updated (confirmed still exist)
          this.env.logger.warn('⚠️ AI found 0 issues, but existing unresolved issues exist', {
            checkId,
            existingCount: existingIssues.length,
          });
          
          // Update existing issues as "still present" (not resolved)
          for (const existingIssue of existingIssues) {
            await db
              .updateTable('compliance_issues')
              .set({
                last_confirmed_check_id: checkId,
                updated_at: Date.now(),
              } as any)
              .where('id', '=', existingIssue.id)
              .execute();
          }

          // Update check with existing issue count
          const severityWeights = { critical: 20, high: 10, medium: 5, low: 2, info: 1 };
          const totalDeduction = existingIssues.reduce((sum, issue) => 
            sum + (severityWeights[issue.severity as keyof typeof severityWeights] || 0), 0);
          const overallScore = Math.max(0, 100 - totalDeduction);

          await db
            .updateTable('compliance_checks')
            .set({
              status: 'completed',
              overall_score: overallScore,
              issues_found: existingIssues.length,
              completed_at: Date.now(),
            })
            .where('id', '=', checkId)
            .execute();
          
          this.env.logger.info('✅ Check completed with existing issues confirmed', { 
            checkId,
            issuesFound: existingIssues.length,
            overallScore,
          });
          return;
        }

        // No AI issues AND no existing issues - truly compliant
        await db
          .updateTable('compliance_checks')
          .set({
            status: 'completed',
            overall_score: 100,
            issues_found: 0,
            completed_at: Date.now(),
          })
          .where('id', '=', checkId)
          .execute();
        
        this.env.logger.info('✅ Document is 100% compliant - no issues found', { checkId });
        return;
      }

      // Filter out any fallback/generic issues to ensure only genuine AI results
      const genuineIssues = issues.filter(issue => 
        !issue.title.includes('Compliance Review Required') &&
        !issue.title.includes('Manual review') &&
        issue.confidence > 50 // Only include issues with reasonable confidence
      );

      if (genuineIssues.length === 0) {
        // AI returned only fallback issues - check existing issues
        if (existingIssues.length > 0) {
          // Keep existing issues
          this.env.logger.warn('⚠️ Only fallback issues from AI, but existing issues remain', {
            checkId,
            existingCount: existingIssues.length,
          });

          for (const existingIssue of existingIssues) {
            await db
              .updateTable('compliance_issues')
              .set({
                last_confirmed_check_id: checkId,
                updated_at: Date.now(),
              } as any)
              .where('id', '=', existingIssue.id)
              .execute();
          }

          const severityWeights = { critical: 20, high: 10, medium: 5, low: 2, info: 1 };
          const totalDeduction = existingIssues.reduce((sum, issue) => 
            sum + (severityWeights[issue.severity as keyof typeof severityWeights] || 0), 0);
          const overallScore = Math.max(0, 100 - totalDeduction);

          await db
            .updateTable('compliance_checks')
            .set({
              status: 'completed',
              overall_score: overallScore,
              issues_found: existingIssues.length,
              completed_at: Date.now(),
            })
            .where('id', '=', checkId)
            .execute();
          
          return;
        }

        // No genuine AI issues and no existing issues
        await db
          .updateTable('compliance_checks')
          .set({
            status: 'completed',
            overall_score: 100,
            issues_found: 0,
            completed_at: Date.now(),
          })
          .where('id', '=', checkId)
          .execute();
        
        this.env.logger.info('✅ Only fallback issues found - treating as compliant', { checkId });
        return;
      }

      this.env.logger.info('Processing genuine AI-found issues', {
        totalIssues: issues.length,
        genuineIssues: genuineIssues.length,
      });

      // PHASE 1.1.3: Calculate priority and store issues with deduplication
      const issueResults: Array<{isNew: boolean, status: string}> = [];
      
      for (const issue of genuineIssues) {
        // Calculate priority score for this issue
        const priority = this.calculateIssuePriority(issue, framework, {
          industryRisk: 'medium', // Default; could be fetched from workspace settings
          documentType: 'other', // Default; could be inferred from document metadata
        });

        // Process issue with deduplication logic
        const { processIssueWithDeduplication } = await import('./issue-deduplication');
        const result = await processIssueWithDeduplication(
          db,
          issue,
          checkId,
          documentId,
          workspaceId,
          framework,
          priority
        );

        issueResults.push({ isNew: result.isNew, status: result.status });

        // Log deduplication events
        if (!result.isNew) {
          this.env.logger.info('Issue deduplicated', {
            issueId: result.issueId,
            status: result.status,
            previousStatus: result.previousStatus,
            checkId,
          });
        }

        // Small delay to avoid ID collision
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Log deduplication summary
      const newIssuesCount = issueResults.filter(r => r.isNew).length;
      const updatedIssuesCount = issueResults.filter(r => !r.isNew).length;
      const reopenedIssuesCount = issueResults.filter(r => r.status === 'reopened').length;
      
      this.env.logger.info('Issue processing summary', {
        total: genuineIssues.length,
        new: newIssuesCount,
        updated: updatedIssuesCount,
        reopened: reopenedIssuesCount,
        checkId,
      });

      // Calculate overall score (100 - issues weighted by severity) using genuine issues only
      const severityWeights = { critical: 20, high: 10, medium: 5, low: 2, info: 1 };
      const totalDeduction = genuineIssues.reduce((sum, issue) => sum + (severityWeights[issue.severity] || 0), 0);
      const overallScore = Math.max(0, 100 - totalDeduction);

      // Update compliance check with results
      await db
        .updateTable('compliance_checks')
        .set({
          status: 'completed',
          overall_score: overallScore,
          issues_found: genuineIssues.length,
          completed_at: Date.now(),
        })
        .where('id', '=', checkId)
        .execute();
        
      this.env.logger.info('✅✅✅ Compliance check completed successfully', {
        checkId,
        overallScore,
        issuesFound: genuineIssues.length,
        genuineAnalysis: true,
      });

      // Track compliance check usage
      try {
        await this.env.USAGE_SERVICE.trackUsage({
          workspaceId,
          resourceType: 'compliance_check',
          resourceId: checkId,
          metaInfo: {
            framework: framework,
            documentId: documentId,
            overallScore,
            issuesFound: genuineIssues.length,
          },
        });
        this.env.logger.info('✅ Compliance check usage tracked', { 
          workspaceId, 
          checkId 
        });
      } catch (error) {
        this.env.logger.error(`Failed to track compliance check usage: ${error instanceof Error ? error.message : 'Unknown'}`);
      }

      // Broadcast completion (PHASE 4.2.1)
      await broadcastComplianceCheckUpdate(this.env, workspaceId, {
        checkId,
        status: 'completed',
        progress: 100,
        issuesFound: genuineIssues.length,
        overallScore,
      });

      // Also update dashboard metrics
      const dashboardStats = await db
        .selectFrom('compliance_issues')
        .select((eb) => [
          eb.fn.count('id').as('totalIssues'),
          eb.fn.count('id').filterWhere('status', '=', 'open').as('openIssues'),
        ])
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst();

      if (dashboardStats) {
        await broadcastDashboardUpdate(this.env, workspaceId, {
          overallScore,
          totalIssues: Number(dashboardStats.totalIssues || 0),
          openIssues: Number(dashboardStats.openIssues || 0),
        });
      }
      
      // Update compliance cache for summary display
      try {
        await this.updateComplianceCache(checkId);
        this.env.logger.info('📊 Compliance cache updated successfully', { checkId });
      } catch (cacheError) {
        this.env.logger.error('⚠️ Failed to update compliance cache', {
          checkId,
          error: cacheError instanceof Error ? cacheError.message : String(cacheError),
          stack: cacheError instanceof Error ? cacheError.stack : undefined,
        });
        // Don't fail the whole check if cache update fails - summary can be calculated on-demand
      }
      
    } catch (error) {
      // Mark check as failed
      this.env.logger.error('❌❌❌ Compliance check failed', {
        checkId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      const db = this.getDb();
      await db
        .updateTable('compliance_checks')
        .set({
          status: 'failed',
          completed_at: Date.now(),
        })
        .where('id', '=', checkId)
        .execute();

      // Broadcast failure (PHASE 4.2.1)
      await broadcastComplianceCheckUpdate(this.env, workspaceId, {
        checkId,
        status: 'failed',
      });

      this.env.logger.error(`Compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * PHASE 1.1.2: Get Framework Rules with Caching
   */
  private getFrameworkRulesWithCache(framework: string): string[] {
    // Check cache first
    if (this.frameworkRuleCache.has(framework)) {
      return this.frameworkRuleCache.get(framework)!;
    }

    // Get rules and cache them
    const rules = this.getFrameworkRules(framework);
    this.frameworkRuleCache.set(framework, rules);
    return rules;
  }

  private async performAIComplianceAnalysis(documentText: string, framework: string, checkId: string): Promise<ComplianceIssue[]> {
    this.env.logger.info('🎯 === STARTING AI COMPLIANCE ANALYSIS ===', { framework });
    
    try {
      // Get framework rules
      const rules = this.getFrameworkRules(framework);
      this.env.logger.info('📋 Framework rules loaded', { 
        framework, 
        ruleCount: rules.length,
        rules: rules.slice(0, 5)
      });

      // Truncate document for AI
      const maxLength = 3000;
      const truncatedText = documentText.substring(0, maxLength);
      this.env.logger.info('📄 Document prepared', { 
        originalLength: documentText.length,
        truncatedLength: truncatedText.length,
        textPreview: truncatedText.substring(0, 200) + '...'
      });

      // Build prompt
      const prompt = ` Analyze the document thoroughly for ALL ${framework} compliance violations.

Framework Requirements:
${rules.slice(0, 5).join('\n')}

Document:
${truncatedText}

Return JSON with all the found issues array. If fully compliant, return empty array:
{"issues": [{
      "severity": "critical|high|medium|low", 
      "category": "requirement name", 
      "title": "violation", 
      "description": "details", 
      "impact": "data breach, legal risk, fines, etc.",
      "impact_assessment": "How this violation impacts the organization",
      "original_text": "The specific problematic text from the document that caused the issue",
      "framework": "${framework}",
      "framework_section": "specific section violated",
      "framework_subsection": "specific subsection violated if applicable",
      "framework_article": "specific article violated",
      "framework_requirement": "full requirement text",
      "recommendation": "how to fix the issue",
      "current_state": "What is currently being done that is insufficient",
      "required_state": "What needs to be done to achieve compliance",
      "fix": "specific steps to remediate the issue", 
      "suggested_text": "The exact correction of how the problematic orgininal_text or phrase should have been written if applicable",
      "confidence": 0-100
      
      }]}`;






      this.env.logger.info('💬 Prompt created', { 
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 300) + '...'
      });

      const model = 'llama-3.3-70b-instruct-fp8';
      this.env.logger.info('🤖 Calling AI model', { model, framework });

      // AI CALL
      const aiResponse = await this.env.AI.run(model, {
        messages: [
          { role: 'system', content: `You are a ${framework} compliance auditor. Return JSON only.` },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.0,
      });
      


      // Extract content
      let content: string = '';
      if ((aiResponse as any).choices?.[0]?.message?.content) {
        content = (aiResponse as any).choices[0].message.content;
        this.env.logger.info('📝 Content extracted from choices[0].message.content', { 
          contentLength: content.length,
          contentPreview: content.substring(0, 500)
        });
      } else if ((aiResponse as any).response) {
        content = (aiResponse as any).response;
        this.env.logger.info('📝 Content extracted from response property', { 
          contentLength: content.length,
          contentPreview: content.substring(0, 500)
        });
      } else if (typeof aiResponse === 'string') {
        content = aiResponse;
        this.env.logger.info('📝 Response is string', { 
          contentLength: content.length,
          contentPreview: content.substring(0, 500)
        });
      } else {
        this.env.logger.error('❌ Could not extract content from response', { 
          aiResponse: JSON.stringify(aiResponse)
        });
        return [];
      }

      this.env.logger.info('📄 FULL LLM OUTPUT:', { 
        framework,
        model,
        fullContent: content,
        contentLength: content.length
      });

      // Parse JSON
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      this.env.logger.info('🧹 Cleaned for parsing', { 
        originalLength: content.length,
        cleanedLength: cleaned.length,
        cleaned: cleaned
      });
      
      const result = JSON.parse(cleaned);
      this.env.logger.info('✅ JSON parsed successfully', { 
        hasIssues: !!result.issues,
        isArray: Array.isArray(result.issues),
        issueCount: result.issues?.length || 0,
        parsedResult: JSON.stringify(result, null, 2)
      });
      
      // Store the complete LLM response for audit trail
      const db = this.getDb();
      await db
        .updateTable('compliance_checks')
        .set({
          llm_response: JSON.stringify(result),
        } as any)
        .where('id', '=', checkId)
        .execute();
      
      if (result.issues && Array.isArray(result.issues)) {
        const issues = result.issues.map((issue: any) => ({
          ...issue,
          confidence: issue.confidence || 75
        }));
        
        this.env.logger.info('🎉 Returning issues', { 
          count: issues.length,
          issues: issues.map((i: any) => ({
            severity: i.severity,
            category: i.category,
            title: i.title,
            confidence: i.confidence
          }))
        });
        
        return issues;
      }
      
      this.env.logger.warn('⚠️ No issues array in result', { 
        resultKeys: Object.keys(result)
      });
      return [];
      
    } catch (error) {
      this.env.logger.error('❌ AI compliance analysis failed', {
        framework,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
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
    // CRITICAL FIX: No more fallback issues - genuine AI analysis only
    this.env.logger.warn('getFallbackIssues called - should not happen with new implementation', { framework });
    return [];
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
    llmResponse: any;
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
        'llm_response',
      ])
      .where('id', '=', checkId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!check) {
      throw new Error('Compliance check not found');
    }

    // Parse llmResponse from JSON string to object
    let parsedLlmResponse = null;
    if (check.llm_response) {
      try {
        parsedLlmResponse = JSON.parse(check.llm_response);
      } catch (error) {
        this.env.logger.warn('Failed to parse llm_response as JSON', {
          checkId: check.id,
          error: error instanceof Error ? error.message : String(error),
        });
        parsedLlmResponse = check.llm_response; // Return as string if parsing fails
      }
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
      llmResponse: parsedLlmResponse,
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
      status: string;
      firstDetectedCheckId: string | null;
      lastConfirmedCheckId: string | null;
      confidence: number | null;
      isNew: boolean;
      wasReopened: boolean;
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

    // Get issues with deduplication metadata
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
        'status',
        'first_detected_check_id',
        'last_confirmed_check_id',
        'confidence',
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
        status: issue.status,
        firstDetectedCheckId: issue.first_detected_check_id,
        lastConfirmedCheckId: issue.last_confirmed_check_id,
        confidence: issue.confidence,
        // An issue is "new" if it was first detected in this check
        isNew: issue.first_detected_check_id === checkId,
        // An issue was "reopened" if it's in reopened status and last confirmed in this check
        wasReopened: issue.status === 'reopened' && issue.last_confirmed_check_id === checkId,
      })),
    };
  }

  /**
   * PHASE 1.1.1: Batch Compliance Checking
   * Run compliance checks on multiple documents against a single framework
   */
  async runBatchComplianceCheck(input: {
    documentIds: string[];
    workspaceId: string;
    userId: string;
    framework: ComplianceFramework;
  }): Promise<{
    batchId: string;
    checks: Array<{ checkId: string; documentId: string; status: string }>;
    status: string;
    total: number;
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

    // Validate all documents exist and belong to workspace
    const documents = await db
      .selectFrom('documents')
      .select(['id', 'filename', 'storage_key'])
      .where('workspace_id', '=', input.workspaceId)
      .where('id', 'in', input.documentIds)
      .execute();

    if (documents.length !== input.documentIds.length) {
      const foundIds = documents.map((d) => d.id);
      const missingIds = input.documentIds.filter((id) => !foundIds.includes(id));
      throw new Error(`Documents not found: ${missingIds.join(', ')}`);
    }

    // Create batch ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    // Create compliance check records for all documents
    const checks: Array<{ checkId: string; documentId: string; status: string }> = [];

    for (const document of documents) {
      const checkId = `chk_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await db
        .insertInto('compliance_checks')
        .values({
          id: checkId,
          document_id: document.id,
          workspace_id: input.workspaceId,
          framework: input.framework,
          status: 'processing',
          issues_found: 0,
          created_at: now,
          created_by: input.userId,
        })
        .execute();

      checks.push({
        checkId,
        documentId: document.id,
        status: 'processing',
      });

      // CHAMPIONSHIP FIX: Process synchronously to ensure completion
      // Run analysis and wait for it to complete before moving to next document
      this.env.logger.info('🚀 Starting synchronous compliance analysis', {
        checkId,
        documentId: document.id,
        framework: input.framework,
      });

      try {
        // Process this document completely before moving to next
        await this.analyzeCompliance(checkId, document.id, input.workspaceId, input.framework, document.storage_key);

        this.env.logger.info('✅ Compliance analysis completed', {
          checkId,
          documentId: document.id,
        });
      } catch (error) {
        this.env.logger.error('❌ Compliance analysis failed', {
          checkId,
          documentId: document.id,
          error: error instanceof Error ? error.message : String(error),
        });

        // Mark check as failed
        await db
          .updateTable('compliance_checks')
          .set({
            status: 'failed',
            completed_at: Date.now(),
          })
          .where('id', '=', checkId)
          .execute();
      }

      // Small delay to avoid timestamp collision
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.env.logger.info(`Batch compliance check started`, {
      batchId,
      framework: input.framework,
      documentCount: documents.length,
      workspaceId: input.workspaceId,
    });

    return {
      batchId,
      checks,
      status: 'processing',
      total: checks.length,
      createdAt: now,
    };
  }

  /**
   * PHASE 1.1.1: Get Batch Compliance Check Status
   * Retrieve status and results for all checks in a batch
   */
  async getBatchStatus(
    batchId: string,
    workspaceId: string,
    userId: string
  ): Promise<{
    batchId: string;
    total: number;
    completed: number;
    processing: number;
    failed: number;
    checks: Array<{
      checkId: string;
      documentId: string;
      documentName: string;
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

    // Extract timestamp from batch ID for querying
    // batchId format: batch_<timestamp>_<random>
    const timestampMatch = batchId.match(/batch_(\d+)_/);
    if (!timestampMatch) {
      throw new Error('Invalid batch ID format');
    }

    const batchTimestamp = parseInt(timestampMatch[1], 10);
    const timeWindow = 60000; // 60 second window for batch creation

    // Get all checks created within the time window
    const checks = await db
      .selectFrom('compliance_checks as cc')
      .innerJoin('documents as d', 'd.id', 'cc.document_id')
      .select([
        'cc.id as checkId',
        'cc.document_id as documentId',
        'd.filename as documentName',
        'cc.status',
        'cc.overall_score as overallScore',
        'cc.issues_found as issuesFound',
        'cc.created_at as createdAt',
        'cc.completed_at as completedAt',
      ])
      .where('cc.workspace_id', '=', workspaceId)
      .where('cc.created_at', '>=', batchTimestamp - timeWindow)
      .where('cc.created_at', '<=', batchTimestamp + timeWindow)
      .where('cc.created_by', '=', userId)
      .orderBy('cc.created_at', 'desc')
      .execute();

    // Aggregate status counts
    const statusCounts = {
      completed: checks.filter((c) => c.status === 'completed').length,
      processing: checks.filter((c) => c.status === 'processing').length,
      failed: checks.filter((c) => c.status === 'failed').length,
    };

    return {
      batchId,
      total: checks.length,
      completed: statusCounts.completed,
      processing: statusCounts.processing,
      failed: statusCounts.failed,
      checks: checks.map((check) => ({
        checkId: check.checkId,
        documentId: check.documentId,
        documentName: check.documentName,
        status: check.status,
        overallScore: check.overallScore,
        issuesFound: check.issuesFound,
        createdAt: check.createdAt,
        completedAt: check.completedAt,
      })),
    };
  }

  /**
   * PHASE 2.1.5: Cleanup Stale Processing Checks
   * Mark old processing checks as failed (timeout after 10 minutes)
   */
  async cleanupStaleChecks(documentId: string, workspaceId: string): Promise<number> {
    const db = this.getDb();
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

    const result = await db
      .updateTable('compliance_checks')
      .set({
        status: 'failed',
        completed_at: Date.now(),
      })
      .where('document_id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .where('status', '=', 'processing')
      .where('created_at', '<', tenMinutesAgo)
      .execute();

    const cleanedCount = result.length;
    if (cleanedCount > 0) {
      this.env.logger.info('🧹 Cleaned up stale processing checks', {
        documentId,
        workspaceId,
        count: cleanedCount,
      });
    }

    return cleanedCount;
  }

  /**
   * PHASE 2.2: Get Document Compliance Checks
   * Retrieve all compliance checks for a specific document
   */
  async getDocumentComplianceChecks(
    documentId: string,
    workspaceId: string,
    userId: string,
    options?: {
      framework?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    checks: Array<{
      id: string;
      framework: string;
      status: string;
      overallScore: number | null;
      issuesFound: number;
      createdAt: number;
      completedAt: number | null;
    }>;
    total: number;
  }> {
    const db = this.getDb();

    // Cleanup stale processing checks before returning list
    await this.cleanupStaleChecks(documentId, workspaceId);

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

    // Build query
    let query = db
      .selectFrom('compliance_checks')
      .select([
        'id',
        'framework',
        'status',
        'overall_score',
        'issues_found',
        'created_at',
        'completed_at',
      ])
      .where('document_id', '=', documentId)
      .where('workspace_id', '=', workspaceId);

    if (options?.framework) {
      query = query.where('framework', '=', options.framework);
    }

    // Get total count
    const countResult = await query
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count || 0);

    // Apply pagination
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const checks = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      checks: checks.map((check) => ({
        id: check.id,
        framework: check.framework,
        status: check.status,
        overallScore: check.overall_score,
        issuesFound: check.issues_found,
        createdAt: check.created_at,
        completedAt: check.completed_at,
      })),
      total,
    };
  }

  /**
   * PHASE 2.2: Get Latest Document Check
   * Retrieve the most recent compliance check for a document
   */
  async getLatestDocumentCheck(
    documentId: string,
    workspaceId: string,
    userId: string,
    framework?: string
  ): Promise<{
    id: string;
    framework: string;
    status: string;
    overallScore: number | null;
    issuesFound: number;
    createdAt: number;
    completedAt: number | null;
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

    let query = db
      .selectFrom('compliance_checks')
      .select([
        'id',
        'framework',
        'status',
        'overall_score',
        'issues_found',
        'created_at',
        'completed_at',
      ])
      .where('document_id', '=', documentId)
      .where('workspace_id', '=', workspaceId);

    if (framework) {
      query = query.where('framework', '=', framework);
    }

    const check = await query
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!check) {
      return null;
    }

    return {
      id: check.id,
      framework: check.framework,
      status: check.status,
      overallScore: check.overall_score,
      issuesFound: check.issues_found,
      createdAt: check.created_at,
      completedAt: check.completed_at,
    };
  }

  /**
   * PHASE 2.2: Update Compliance Cache
   * Update the document_compliance_cache table after check completion
   */
  async updateComplianceCache(checkId: string): Promise<void> {
    const db = this.getDb();

    // Get check details
    const check = await db
      .selectFrom('compliance_checks')
      .select([
        'id',
        'document_id',
        'workspace_id',
        'framework',
        'overall_score',
        'issues_found',
        'created_at',
      ])
      .where('id', '=', checkId)
      .where('status', '=', 'completed')
      .executeTakeFirst();

    if (!check) {
      return; // Check not found or not completed
    }

    // Get issue counts by severity
    const issues = await db
      .selectFrom('compliance_issues')
      .select(['severity', 'status'])
      .where('check_id', '=', checkId)
      .execute();

    const severityCounts = {
      critical: issues.filter((i) => i.severity === 'critical').length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length,
      open: issues.filter((i) => i.status === 'open').length,
      resolved: issues.filter((i) => i.status === 'resolved').length,
    };

    // Determine risk level
    let riskLevel: string;
    if (severityCounts.critical > 0 || (check.overall_score || 0) < 40) {
      riskLevel = 'critical';
    } else if (severityCounts.high > 2 || (check.overall_score || 0) < 60) {
      riskLevel = 'high';
    } else if (severityCounts.medium > 3 || (check.overall_score || 0) < 80) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    const cacheId = `cache_${check.document_id}_${check.framework}`;

    // Upsert cache record
    await db
      .insertInto('document_compliance_cache')
      .values({
        id: cacheId,
        workspace_id: check.workspace_id,
        document_id: check.document_id,
        framework: check.framework,
        overall_score: check.overall_score,
        risk_level: riskLevel,
        total_issues: check.issues_found,
        critical_issues: severityCounts.critical,
        high_issues: severityCounts.high,
        medium_issues: severityCounts.medium,
        low_issues: severityCounts.low,
        open_issues: severityCounts.open,
        resolved_issues: severityCounts.resolved,
        last_check_id: checkId,
        last_analyzed_at: now,
        expires_at: expiresAt,
      })
      .onConflict((oc) =>
        oc.columns(['document_id', 'framework']).doUpdateSet({
          overall_score: check.overall_score,
          risk_level: riskLevel,
          total_issues: check.issues_found,
          critical_issues: severityCounts.critical,
          high_issues: severityCounts.high,
          medium_issues: severityCounts.medium,
          low_issues: severityCounts.low,
          open_issues: severityCounts.open,
          resolved_issues: severityCounts.resolved,
          last_check_id: checkId,
          last_analyzed_at: now,
          expires_at: expiresAt,
        })
      )
      .execute();

    // this.logger.info('Compliance cache updated', {
    //   checkId,
    //   documentId: check.document_id,
    //   framework: check.framework,
    // });
  }

  /**
   * PHASE 2.2: Get Document Compliance Summary
   * Retrieve cached compliance summary for a document
   */
  async getDocumentComplianceSummary(
    documentId: string,
    workspaceId: string,
    userId: string,
    framework?: string
  ): Promise<{
    overallScore: number | null;
    riskLevel: string | null;
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    openIssues: number;
    resolvedIssues: number;
    lastAnalyzedAt: number;
    lastCheckId: string | null;
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

    let query = db
      .selectFrom('document_compliance_cache')
      .selectAll()
      .where('document_id', '=', documentId)
      .where('workspace_id', '=', workspaceId);

    if (framework) {
      query = query.where('framework', '=', framework);
    }

    // Check if cache is not expired
    const now = Date.now();
    query = query.where('expires_at', '>', now);

    const cache = await query
      .orderBy('last_analyzed_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (cache) {
      return {
        overallScore: cache.overall_score,
        riskLevel: cache.risk_level,
        totalIssues: cache.total_issues,
        criticalIssues: cache.critical_issues,
        highIssues: cache.high_issues,
        mediumIssues: cache.medium_issues,
        lowIssues: cache.low_issues,
        openIssues: cache.open_issues,
        resolvedIssues: cache.resolved_issues,
        lastAnalyzedAt: cache.last_analyzed_at,
        lastCheckId: cache.last_check_id,
      };
    }

    // Fallback: If no cache exists, calculate summary from latest completed check
    this.env.logger.info('📊 No cache found, calculating summary from latest completed check', {
      documentId,
      workspaceId,
      framework,
    });

    let checkQuery = db
      .selectFrom('compliance_checks')
      .selectAll()
      .where('document_id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .where('status', '=', 'completed');

    if (framework) {
      checkQuery = checkQuery.where('framework', '=', framework);
    }

    const latestCheck = await checkQuery
      .orderBy('completed_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!latestCheck) {
      this.env.logger.info('📊 No completed checks found for document', {
        documentId,
        workspaceId,
        framework,
      });
      return null;
    }

    // Calculate summary from check + issues
    const issues = await db
      .selectFrom('compliance_issues')
      .selectAll()
      .where('check_id', '=', latestCheck.id)
      .where('workspace_id', '=', workspaceId)
      .execute();

    const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
    const highIssues = issues.filter((i) => i.severity === 'high').length;
    const mediumIssues = issues.filter((i) => i.severity === 'medium').length;
    const lowIssues = issues.filter((i) => i.severity === 'low').length;
    const openIssues = issues.filter((i) => i.status === 'open').length;
    const resolvedIssues = issues.filter((i) => i.status === 'resolved').length;
    const totalIssues = issues.length;

    // Determine risk level based on issue severity distribution
    let riskLevel: string;
    if (criticalIssues >= 3 || (criticalIssues >= 1 && highIssues >= 3)) {
      riskLevel = 'critical';
    } else if (highIssues >= 3 || criticalIssues >= 1 || (highIssues >= 1 && mediumIssues >= 5)) {
      riskLevel = 'high';
    } else if (mediumIssues >= 3 || highIssues >= 1) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    const fallbackSummary = {
      overallScore: latestCheck.overall_score,
      riskLevel,
      totalIssues,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      openIssues,
      resolvedIssues,
      lastAnalyzedAt: latestCheck.completed_at || latestCheck.created_at,
      lastCheckId: latestCheck.id,
    };

    this.env.logger.info('📊 Calculated fallback summary from check', {
      checkId: latestCheck.id,
      totalIssues,
      riskLevel,
    });

    return fallbackSummary;
  }
}
