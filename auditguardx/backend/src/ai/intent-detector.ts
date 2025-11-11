/**
 * Intent Detection System
 * Identifies user intent from natural language input
 */

export interface Intent {
  name: string;
  confidence: number;
  requiresAction: boolean;
  action?: string;
  parameters?: Record<string, any>;
}

interface IntentPattern {
  name: string;
  patterns: RegExp[];
  action: string;
  requiresAction: boolean;
  extractParams?: (text: string) => Record<string, any>;
}

export class IntentDetector {
  private intents: IntentPattern[] = [
    // Compliance Operations
    {
      name: 'check_compliance',
      patterns: [
        /check.*compliance/i,
        /run.*audit/i,
        /analyze.*for\s+(\w+)/i,
        /is.*compliant/i,
        /compliance.*check/i,
        /audit.*document/i,
        /scan.*for\s+(\w+)/i,
      ],
      action: 'check_compliance',
      requiresAction: true,
      extractParams: (text: string) => {
        const frameworks = ['gdpr', 'soc2', 'hipaa', 'iso27001', 'pci-dss', 'ccpa'];
        const found = frameworks.filter(f => text.toLowerCase().includes(f));
        return { frameworks: found.length > 0 ? found : ['all'] };
      },
    },

    // Document Management
    {
      name: 'upload_document',
      patterns: [
        /upload.*document/i,
        /add.*file/i,
        /import.*policy/i,
        /upload.*policy/i,
        /add.*document/i,
        /attach.*file/i,
      ],
      action: 'upload_document',
      requiresAction: true,
    },

    {
      name: 'search_documents',
      patterns: [
        /find.*document/i,
        /search.*for/i,
        /look.*for/i,
        /where.*is/i,
        /show.*documents/i,
        /list.*files/i,
      ],
      action: 'search_documents',
      requiresAction: true,
      extractParams: (text: string) => {
        const match = text.match(/(?:find|search|look for|show)\s+(.+?)(?:\s+document|\s+file|$)/i);
        return { query: match ? match[1] : text };
      },
    },

    // Report Generation
    {
      name: 'generate_report',
      patterns: [
        /generate.*report/i,
        /create.*summary/i,
        /export.*compliance/i,
        /make.*report/i,
        /prepare.*summary/i,
        /download.*report/i,
      ],
      action: 'generate_report',
      requiresAction: true,
      extractParams: (text: string) => {
        const types = ['executive', 'detailed', 'summary', 'full'];
        const periods = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

        let type = 'executive';
        let period = 'current';

        types.forEach(t => {
          if (text.toLowerCase().includes(t)) type = t;
        });

        periods.forEach(p => {
          if (text.toLowerCase().includes(p)) period = p;
        });

        return { reportType: type, period };
      },
    },

    // Issue Management
    {
      name: 'find_issues',
      patterns: [
        /show.*issues/i,
        /find.*problems/i,
        /what.*wrong/i,
        /list.*issues/i,
        /view.*problems/i,
        /critical.*issues/i,
        /unresolved.*issues/i,
      ],
      action: 'find_issues',
      requiresAction: true,
      extractParams: (text: string) => {
        const severities = ['critical', 'high', 'medium', 'low'];
        const statuses = ['open', 'resolved', 'pending', 'assigned'];

        let severity = null;
        let status = 'open';

        severities.forEach(s => {
          if (text.toLowerCase().includes(s)) severity = s;
        });

        statuses.forEach(s => {
          if (text.toLowerCase().includes(s)) status = s;
        });

        return { severity, status };
      },
    },

    {
      name: 'assign_task',
      patterns: [
        /assign.*to/i,
        /delegate.*to/i,
        /give.*to/i,
        /transfer.*to/i,
        /send.*to/i,
      ],
      action: 'assign_task',
      requiresAction: true,
      extractParams: (text: string) => {
        const match = text.match(/(?:assign|delegate|give|transfer|send).*to\s+(\w+)/i);
        return { assignee: match ? match[1] : null };
      },
    },

    {
      name: 'resolve_issue',
      patterns: [
        /resolve.*issue/i,
        /fix.*problem/i,
        /mark.*resolved/i,
        /close.*issue/i,
        /complete.*task/i,
      ],
      action: 'resolve_issue',
      requiresAction: true,
    },

    // Analytics & Insights
    {
      name: 'get_analytics',
      patterns: [
        /show.*analytics/i,
        /compliance.*score/i,
        /view.*metrics/i,
        /dashboard/i,
        /statistics/i,
        /how.*doing/i,
        /performance/i,
      ],
      action: 'get_analytics',
      requiresAction: true,
    },

    {
      name: 'get_trends',
      patterns: [
        /show.*trends/i,
        /compliance.*over time/i,
        /historical.*data/i,
        /progress/i,
        /improvement/i,
      ],
      action: 'get_trends',
      requiresAction: true,
    },

    // Automation & Scheduling
    {
      name: 'schedule_task',
      patterns: [
        /schedule.*check/i,
        /automate.*compliance/i,
        /set.*reminder/i,
        /recurring.*report/i,
        /daily.*audit/i,
        /weekly.*check/i,
      ],
      action: 'schedule_task',
      requiresAction: true,
      extractParams: (text: string) => {
        const frequencies = ['daily', 'weekly', 'monthly'];
        let frequency = 'weekly';

        frequencies.forEach(f => {
          if (text.toLowerCase().includes(f)) frequency = f;
        });

        return { frequency };
      },
    },

    // Help & Information
    {
      name: 'get_help',
      patterns: [
        /help/i,
        /what.*can.*do/i,
        /how.*to/i,
        /explain/i,
        /tell.*about/i,
        /what.*is/i,
      ],
      action: 'get_help',
      requiresAction: false,
    },

    // Team Collaboration
    {
      name: 'team_operations',
      patterns: [
        /add.*member/i,
        /invite.*user/i,
        /remove.*member/i,
        /show.*team/i,
        /list.*members/i,
      ],
      action: 'team_operations',
      requiresAction: true,
    },

    // General Questions
    {
      name: 'general_question',
      patterns: [
        /what/i,
        /when/i,
        /where/i,
        /why/i,
        /how/i,
        /who/i,
      ],
      action: 'answer_question',
      requiresAction: false,
    },
  ];

  /**
   * Detect intent from user message
   */
  async detect(message: string, nlpResult?: any): Promise<Intent> {
    // First, try pattern matching
    for (const intentConfig of this.intents) {
      for (const pattern of intentConfig.patterns) {
        if (pattern.test(message)) {
          const parameters = intentConfig.extractParams
            ? intentConfig.extractParams(message)
            : {};

          return {
            name: intentConfig.name,
            confidence: this.calculateConfidence(message, pattern),
            requiresAction: intentConfig.requiresAction,
            action: intentConfig.action,
            parameters,
          };
        }
      }
    }

    // If no pattern matches, try ML-based detection
    if (nlpResult && nlpResult.intent) {
      return {
        name: nlpResult.intent,
        confidence: nlpResult.confidence || 0.5,
        requiresAction: this.isActionIntent(nlpResult.intent),
        action: nlpResult.intent,
      };
    }

    // Default fallback
    return {
      name: 'unknown',
      confidence: 0.0,
      requiresAction: false,
    };
  }

  /**
   * Calculate confidence score for pattern match
   */
  private calculateConfidence(text: string, pattern: RegExp): number {
    // Base confidence for regex match
    let confidence = 0.8;

    // Increase confidence if the pattern matches more of the text
    const match = text.match(pattern);
    if (match && match[0]) {
      const coverage = match[0].length / text.length;
      confidence += coverage * 0.15;
    }

    // Decrease confidence for very short messages
    if (text.length < 10) {
      confidence -= 0.1;
    }

    // Cap between 0 and 1
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Determine if an intent requires action
   */
  private isActionIntent(intentName: string): boolean {
    const actionIntents = [
      'check_compliance',
      'upload_document',
      'generate_report',
      'find_issues',
      'assign_task',
      'resolve_issue',
      'search_documents',
      'schedule_task',
      'team_operations',
    ];

    return actionIntents.includes(intentName);
  }

  /**
   * Get all available intents for suggestions
   */
  getAvailableIntents(): string[] {
    return this.intents.map(i => i.name);
  }

  /**
   * Get example phrases for an intent
   */
  getIntentExamples(intentName: string): string[] {
    const intent = this.intents.find(i => i.name === intentName);
    if (!intent) return [];

    const examples: string[] = [];

    // Generate example phrases from patterns
    switch (intentName) {
      case 'check_compliance':
        examples.push(
          'Check GDPR compliance',
          'Run a SOC2 audit',
          'Analyze document for HIPAA',
          'Is this document compliant?'
        );
        break;

      case 'upload_document':
        examples.push(
          'Upload a new policy document',
          'Add privacy policy file',
          'Import compliance documentation'
        );
        break;

      case 'generate_report':
        examples.push(
          'Generate executive summary',
          'Create monthly compliance report',
          'Export quarterly audit results'
        );
        break;

      case 'find_issues':
        examples.push(
          'Show all critical issues',
          'Find unresolved problems',
          'What compliance issues do we have?'
        );
        break;

      case 'assign_task':
        examples.push(
          'Assign this issue to John',
          'Delegate task to Sarah',
          'Transfer to compliance team'
        );
        break;

      default:
        examples.push(`Example ${intentName} command`);
    }

    return examples;
  }

  /**
   * Validate intent parameters
   */
  validateParameters(intent: Intent): boolean {
    if (!intent.parameters) return true;

    switch (intent.name) {
      case 'assign_task':
        return !!intent.parameters.assignee;

      case 'check_compliance':
        return !!intent.parameters.frameworks;

      case 'generate_report':
        return !!intent.parameters.reportType;

      default:
        return true;
    }
  }

  /**
   * Enhance intent with context
   */
  enhanceWithContext(intent: Intent, context: any): Intent {
    // Add context-specific parameters
    if (intent.name === 'check_compliance' && !intent.parameters?.documentId) {
      if (context.selectedDocuments?.length > 0) {
        intent.parameters = {
          ...intent.parameters,
          documentId: context.selectedDocuments[0],
        };
      } else if (context.latestDocumentId) {
        intent.parameters = {
          ...intent.parameters,
          documentId: context.latestDocumentId,
        };
      }
    }

    // Add workspace context
    if (intent.requiresAction) {
      intent.parameters = {
        ...intent.parameters,
        workspaceId: context.workspaceId,
        userId: context.userId,
      };
    }

    return intent;
  }
}

export default IntentDetector;