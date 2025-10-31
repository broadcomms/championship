import { Service } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';

interface AnalyzeDocumentInput {
  documentId: string;
  workspaceId: string;
  framework: string;
  content: string;
}

interface ComplianceIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  recommendation: string;
  location?: string;
  citation?: string;
}

interface AnalyzeDocumentOutput {
  score: number;
  issues: ComplianceIssue[];
  summary: string;
}

export default class extends Service<Env> {
  tools = {
    analyze_document: {
      description: 'Analyze a document for compliance with a specific framework',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          workspaceId: { type: 'string', description: 'Workspace ID' },
          framework: {
            type: 'string',
            description: 'Compliance framework (GDPR, HIPAA, SOC2, ISO27001, PCI_DSS)',
          },
          content: { type: 'string', description: 'Document content to analyze' },
        },
        required: ['documentId', 'workspaceId', 'framework', 'content'],
      },
      handler: this.analyzeDocument.bind(this),
    },

    validate_framework: {
      description: 'Validate framework compliance requirements',
      inputSchema: {
        type: 'object',
        properties: {
          framework: { type: 'string', description: 'Framework name' },
          requirements: { type: 'array', items: { type: 'string' } },
        },
        required: ['framework', 'requirements'],
      },
      handler: this.validateFramework.bind(this),
    },

    extract_issues: {
      description: 'Extract compliance issues from analysis results',
      inputSchema: {
        type: 'object',
        properties: {
          analysisText: { type: 'string' },
          framework: { type: 'string' },
        },
        required: ['analysisText', 'framework'],
      },
      handler: this.extractIssues.bind(this),
    },
  };

  private async analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentOutput> {
    this.env.logger.info('Analyzing document', {
      documentId: input.documentId,
      framework: input.framework,
    });

    // Use AI to analyze compliance
    const frameworkRules = this.getFrameworkRules(input.framework);

    const prompt = `Analyze the following document for compliance with ${input.framework}.

Framework Requirements:
${frameworkRules.join('\n')}

Document Content:
${input.content.substring(0, 4000)}

Provide a compliance analysis including:
1. Overall compliance score (0-100)
2. List of issues found with severity levels
3. Recommendations for each issue

Format as JSON with: { score: number, issues: [{severity, category, title, description, recommendation}], summary: string }`;

    try {
      const analysis = await this.env.AI.run('llama-3.1-8b-instruct-fast', {
        messages: [
          {
            role: 'system',
            content:
              'You are a compliance expert analyzing documents for regulatory compliance. Provide detailed, actionable feedback.',
          },
          { role: 'user', content: prompt },
        ],
      });

      // Parse AI response
      let result: AnalyzeDocumentOutput;
      try {
        const responseText =
          ('choices' in analysis && analysis.choices?.[0]?.message?.content) || '{}';
        result = JSON.parse(responseText);
      } catch {
        // Fallback if AI doesn't return valid JSON
        result = {
          score: 70,
          issues: this.generateFallbackIssues(input.framework, input.content),
          summary: `Analysis completed for ${input.framework} framework`,
        };
      }

      return result;
    } catch (error) {
      this.env.logger.error('Compliance analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      // Return fallback analysis
      return {
        score: 60,
        issues: this.generateFallbackIssues(input.framework, input.content),
        summary: `Partial analysis completed for ${input.framework}`,
      };
    }
  }

  private async validateFramework(input: {
    framework: string;
    requirements: string[];
  }): Promise<{ valid: boolean; missingRequirements: string[] }> {
    const frameworkRules = this.getFrameworkRules(input.framework);
    const missingRequirements = frameworkRules.filter(rule => !input.requirements.some(req => req.includes(rule)));

    return {
      valid: missingRequirements.length === 0,
      missingRequirements,
    };
  }

  private async extractIssues(input: {
    analysisText: string;
    framework: string;
  }): Promise<{ issues: ComplianceIssue[] }> {
    // Extract issues from analysis text
    const issues: ComplianceIssue[] = [];

    // Use AI to extract structured issues
    try {
      const prompt = `Extract compliance issues from the following analysis for ${input.framework}:

${input.analysisText}

Return as JSON array of issues with: severity (critical/high/medium/low/info), category, title, description, recommendation`;

      const result = await this.env.AI.run('llama-3.1-8b-instruct-fast', {
        messages: [
          {
            role: 'system',
            content: 'Extract structured compliance issues from analysis text. Return valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
      });

      const extractedText = ('choices' in result && result.choices?.[0]?.message?.content) || '[]';
      const extractedIssues = JSON.parse(extractedText);
      issues.push(...extractedIssues);
    } catch (error) {
      this.env.logger.error('Issue extraction failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    return { issues };
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
      ISO27001: [
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

  private generateFallbackIssues(framework: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = [];

    // Generate some basic issues based on common patterns
    if (content.length < 100) {
      issues.push({
        severity: 'high',
        category: 'Documentation',
        title: 'Insufficient documentation',
        description: 'Document appears to be incomplete or too short for comprehensive compliance review',
        recommendation: 'Provide complete documentation covering all required aspects of ' + framework,
      });
    }

    // Check for sensitive data patterns
    const hasPII = /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b|email|password|ssn/i.test(content);
    if (hasPII) {
      issues.push({
        severity: 'critical',
        category: 'Data Protection',
        title: 'Potential sensitive data exposure',
        description: 'Document may contain sensitive personal information',
        recommendation: 'Ensure proper data protection measures are documented and implemented',
      });
    }

    // Framework-specific checks
    if (framework === 'GDPR' && !content.toLowerCase().includes('consent')) {
      issues.push({
        severity: 'medium',
        category: 'GDPR Compliance',
        title: 'Missing consent documentation',
        description: 'No explicit mention of user consent mechanisms',
        recommendation: 'Document how user consent is obtained and managed',
      });
    }

    if (framework === 'HIPAA' && !content.toLowerCase().includes('encryption')) {
      issues.push({
        severity: 'high',
        category: 'HIPAA Security',
        title: 'Encryption not documented',
        description: 'No mention of encryption for protected health information',
        recommendation: 'Document encryption mechanisms for PHI at rest and in transit',
      });
    }

    return issues;
  }
}
