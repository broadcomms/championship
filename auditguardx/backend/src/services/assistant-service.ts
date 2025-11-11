import { Service, ServiceContext, ServiceRequest, ServiceResponse } from '@liquidmetal/raindrop';
import { SmartMemory } from '@liquidmetal/smartmemory';
import { z } from 'zod';
import { IntentDetector } from '../ai/intent-detector';
import { ActionExecutor } from '../ai/action-executor';
import { ContextAggregator } from '../ai/context-aggregator';
import { NLPEngine } from '../ai/nlp-engine';
import { generateEmbedding } from '../utils/embeddings';

// Request/Response Schemas
const ChatRequestSchema = z.object({
  message: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  sessionId: z.string().optional(),
  context: z.object({
    currentPage: z.string().optional(),
    recentActions: z.array(z.string()).optional(),
    selectedDocuments: z.array(z.string()).optional(),
  }).optional(),
});

const ChatResponseSchema = z.object({
  message: z.string(),
  actions: z.array(z.object({
    type: z.enum(['navigate', 'api_call', 'download', 'display']),
    target: z.string().optional(),
    endpoint: z.string().optional(),
    method: z.string().optional(),
    payload: z.any().optional(),
    url: z.string().optional(),
    filename: z.string().optional(),
    data: z.any().optional(),
  })).optional(),
  suggestions: z.array(z.string()).optional(),
  context: z.object({
    intent: z.string().optional(),
    confidence: z.number().optional(),
    entities: z.array(z.object({
      type: z.string(),
      value: z.string(),
      confidence: z.number(),
    })).optional(),
  }).optional(),
  sessionId: z.string(),
});

export class EnhancedAssistantService extends Service {
  private memory!: SmartMemory;
  private intentDetector!: IntentDetector;
  private actionExecutor!: ActionExecutor;
  private contextAggregator!: ContextAggregator;
  private nlpEngine!: NLPEngine;
  private db: any;

  async initialize(context: ServiceContext) {
    // Initialize SmartMemory
    this.memory = context.resources.smartmemory['assistant-memory'];

    // Initialize database
    this.db = context.resources.sql['auditguard-db'];

    // Initialize AI components
    this.intentDetector = new IntentDetector();
    this.actionExecutor = new ActionExecutor(context);
    this.contextAggregator = new ContextAggregator(context);
    this.nlpEngine = new NLPEngine();
  }

  /**
   * Main chat endpoint - processes messages and returns intelligent responses
   */
  async chat(request: ServiceRequest): Promise<ServiceResponse> {
    const input = ChatRequestSchema.parse(request.body);

    // Get or create session
    const sessionId = input.sessionId || await this.createSession(input.userId, input.workspaceId);

    // Load conversation history from SmartMemory
    const history = await this.loadConversationHistory(sessionId, input.workspaceId, input.userId);

    // Aggregate current context
    const context = await this.contextAggregator.gather({
      workspaceId: input.workspaceId,
      userId: input.userId,
      currentPage: input.context?.currentPage,
      recentActions: input.context?.recentActions,
      selectedDocuments: input.context?.selectedDocuments,
    });

    // Process message with NLP
    const nlpResult = await this.nlpEngine.processMessage(input.message);

    // Detect intent
    const intent = await this.intentDetector.detect(input.message, nlpResult);

    // Store user message in memory
    await this.storeMessage(sessionId, {
      role: 'user',
      content: input.message,
      timestamp: new Date().toISOString(),
      intent: intent.name,
      entities: nlpResult.entities,
      context,
    });

    let response: string;
    let actions: any[] = [];

    // Execute actions if intent requires it
    if (intent.requiresAction) {
      const actionResult = await this.actionExecutor.execute(
        intent.action,
        nlpResult.entities,
        context
      );

      actions = actionResult.actions || [];
      response = await this.generateActionResponse(actionResult, context);

      // Track action execution
      await this.trackAnalytics('action_executed', {
        action: intent.action,
        success: actionResult.success,
        workspaceId: input.workspaceId,
        userId: input.userId,
      });
    } else {
      // Generate contextual response using AI
      response = await this.generateAIResponse(
        input.message,
        context,
        history,
        nlpResult
      );
    }

    // Store assistant response in memory
    await this.storeMessage(sessionId, {
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
      actions,
    });

    // Generate follow-up suggestions
    const suggestions = await this.generateSuggestions(
      response,
      context,
      intent,
      nlpResult
    );

    // Track chat message
    await this.trackAnalytics('chat_message', {
      workspaceId: input.workspaceId,
      userId: input.userId,
      intent: intent.name,
      hasActions: actions.length > 0,
    });

    const output = ChatResponseSchema.parse({
      message: response,
      actions,
      suggestions,
      context: {
        intent: intent.name,
        confidence: intent.confidence,
        entities: nlpResult.entities,
      },
      sessionId,
    });

    return { body: output };
  }

  /**
   * Execute a command directly
   */
  async executeCommand(request: ServiceRequest): Promise<ServiceResponse> {
    const { command, workspaceId, userId } = request.body;

    // Process command as a chat message with action intent
    const nlpResult = await this.nlpEngine.processMessage(command);
    const intent = await this.intentDetector.detect(command, nlpResult);

    if (!intent.requiresAction) {
      return {
        body: {
          success: false,
          message: 'Command not recognized. Try rephrasing or use the chat interface.',
        },
      };
    }

    const context = await this.contextAggregator.gather({
      workspaceId,
      userId,
    });

    const actionResult = await this.actionExecutor.execute(
      intent.action,
      nlpResult.entities,
      context
    );

    // Track command execution
    await this.trackAnalytics('action_executed', {
      action: intent.action,
      success: actionResult.success,
      source: 'command_palette',
      workspaceId,
      userId,
    });

    return {
      body: {
        success: actionResult.success,
        message: actionResult.message,
        actions: actionResult.actions,
        data: actionResult.data,
      },
    };
  }

  /**
   * Get contextual suggestions based on current state
   */
  async getSuggestions(request: ServiceRequest): Promise<ServiceResponse> {
    const { workspaceId, userId, context: userContext } = request.body;

    const context = await this.contextAggregator.gather({
      workspaceId,
      userId,
      ...userContext,
    });

    const suggestions = await this.generateContextualSuggestions(context);

    return {
      body: {
        suggestions,
        context: {
          workspaceId,
          complianceScore: context.complianceScore,
          unresolvedIssues: context.unresolvedIssues,
          pendingDocuments: context.pendingDocuments,
        },
      },
    };
  }

  /**
   * Get conversation history
   */
  async getHistory(request: ServiceRequest): Promise<ServiceResponse> {
    const { sessionId, workspaceId, userId, limit = 50 } = request.body;

    const history = await this.loadConversationHistory(
      sessionId,
      workspaceId,
      userId,
      limit
    );

    return {
      body: {
        sessionId,
        messages: history,
        totalMessages: history.length,
      },
    };
  }

  /**
   * Submit user feedback for learning
   */
  async feedback(request: ServiceRequest): Promise<ServiceResponse> {
    const { sessionId, messageId, feedback, userId, workspaceId } = request.body;

    // Store feedback in SmartMemory for learning
    await this.memory.store({
      timeline: 'user_feedback',
      data: {
        sessionId,
        messageId,
        feedback,
        userId,
        workspaceId,
        timestamp: new Date().toISOString(),
      },
    });

    // Update learning patterns
    await this.updateLearningPatterns(feedback, sessionId);

    // Track feedback
    await this.trackAnalytics('user_feedback', {
      type: feedback.type,
      rating: feedback.rating,
      workspaceId,
      userId,
    });

    return {
      body: {
        success: true,
        message: 'Thank you for your feedback! I\'ll use this to improve.',
      },
    };
  }

  /**
   * Private helper methods
   */

  private async createSession(userId: string, workspaceId: string): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.execute({
      sql: `INSERT INTO conversation_sessions (id, user_id, workspace_id, created_at, last_activity)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
      args: [sessionId, userId, workspaceId],
    });

    // Initialize SmartMemory session
    await this.memory.store({
      timeline: 'conversation_state',
      data: {
        sessionId,
        userId,
        workspaceId,
        startTime: new Date().toISOString(),
        messages: [],
      },
    });

    return sessionId;
  }

  private async loadConversationHistory(
    sessionId: string,
    workspaceId: string,
    userId: string,
    limit: number = 10
  ): Promise<any[]> {
    // First try to get from SmartMemory
    const memories = await this.memory.search({
      query: `sessionId:${sessionId}`,
      limit,
      threshold: 0.9,
    });

    if (memories.length > 0) {
      return memories.map(m => m.data.messages).flat();
    }

    // Fallback to database
    const result = await this.db.execute({
      sql: `SELECT role, content, timestamp, actions
            FROM conversation_messages
            WHERE session_id = ?
            ORDER BY timestamp DESC
            LIMIT ?`,
      args: [sessionId, limit],
    });

    return result.rows.reverse();
  }

  private async storeMessage(sessionId: string, message: any) {
    // Store in database
    await this.db.execute({
      sql: `INSERT INTO conversation_messages
            (session_id, role, content, timestamp, intent, entities, actions)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sessionId,
        message.role,
        message.content,
        message.timestamp,
        message.intent || null,
        JSON.stringify(message.entities || []),
        JSON.stringify(message.actions || []),
      ],
    });

    // Store in SmartMemory
    await this.memory.store({
      timeline: 'conversation_history',
      data: {
        sessionId,
        message,
      },
    });

    // Update session last activity
    await this.db.execute({
      sql: `UPDATE conversation_sessions
            SET last_activity = datetime('now')
            WHERE id = ?`,
      args: [sessionId],
    });
  }

  private async generateAIResponse(
    message: string,
    context: any,
    history: any[],
    nlpResult: any
  ): Promise<string> {
    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(context);

    // Build conversation context
    const conversationContext = this.buildConversationContext(history);

    // Generate response using AI model (placeholder - integrate with actual LLM)
    const response = await this.callAIModel({
      systemPrompt,
      conversationContext,
      userMessage: message,
      context: {
        workspace: context.workspaceName,
        complianceScore: context.complianceScore,
        unresolvedIssues: context.unresolvedIssues,
        userRole: context.userRole,
      },
    });

    return response;
  }

  private async generateActionResponse(
    actionResult: any,
    context: any
  ): Promise<string> {
    if (!actionResult.success) {
      return `I encountered an error while trying to ${actionResult.action}: ${actionResult.error}. Please try again or contact support if the issue persists.`;
    }

    // Generate contextual response based on action type
    switch (actionResult.action) {
      case 'check_compliance':
        return this.generateComplianceResponse(actionResult.data, context);

      case 'generate_report':
        return this.generateReportResponse(actionResult.data, context);

      case 'find_issues':
        return this.generateIssuesResponse(actionResult.data, context);

      case 'upload_document':
        return this.generateUploadResponse(actionResult.data, context);

      default:
        return actionResult.message || 'Action completed successfully.';
    }
  }

  private generateComplianceResponse(data: any, context: any): string {
    const { score, issues, framework } = data;

    let response = `I've completed the ${framework || 'compliance'} check. `;

    if (score >= 80) {
      response += `Great news! Your compliance score is ${score}%, which is excellent. `;
    } else if (score >= 60) {
      response += `Your compliance score is ${score}%, which shows good progress but has room for improvement. `;
    } else {
      response += `Your compliance score is ${score}%, which indicates significant compliance gaps that need attention. `;
    }

    if (issues.length > 0) {
      const criticalCount = issues.filter((i: any) => i.severity === 'critical').length;
      const highCount = issues.filter((i: any) => i.severity === 'high').length;

      response += `\n\nI found ${issues.length} issues:\n`;
      if (criticalCount > 0) {
        response += `• ${criticalCount} critical issues requiring immediate attention\n`;
      }
      if (highCount > 0) {
        response += `• ${highCount} high priority issues to address soon\n`;
      }

      response += '\nWould you like me to help you resolve these issues?';
    } else {
      response += 'No issues were found - excellent work!';
    }

    return response;
  }

  private generateReportResponse(data: any, context: any): string {
    const { reportId, format, pageCount, frameworks } = data;

    return `I've successfully generated your ${format} report covering ${frameworks.join(', ')}.
The report is ${pageCount} pages and includes:
• Executive summary
• Detailed compliance analysis
• Issue breakdown by severity
• Remediation recommendations
• Trend analysis

The report has been saved and is ready for download. Would you like me to email it to your team?`;
  }

  private generateIssuesResponse(data: any, context: any): string {
    const { issues, totalCount } = data;

    if (totalCount === 0) {
      return 'Good news! I didn\'t find any issues matching your criteria. Your compliance posture looks strong.';
    }

    let response = `I found ${totalCount} issue${totalCount > 1 ? 's' : ''} matching your search:\n\n`;

    // Group by severity
    const bySeverity = issues.reduce((acc: any, issue: any) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {});

    Object.entries(bySeverity).forEach(([severity, count]) => {
      response += `• ${count} ${severity} issue${count > 1 ? 's' : ''}\n`;
    });

    response += '\nWould you like me to show you the details or help you prioritize which ones to tackle first?';

    return response;
  }

  private generateUploadResponse(data: any, context: any): string {
    const { filename, documentId, estimatedTime } = data;

    return `I've successfully received "${filename}" and started processing it.

Here's what's happening:
1. Extracting text content
2. Analyzing for compliance frameworks
3. Generating searchable chunks
4. Creating vector embeddings for AI search

This typically takes ${estimatedTime}, and I'll notify you when it's complete.

Based on the document type, I recommend running compliance checks for:
• GDPR (if it contains personal data policies)
• SOC2 (if it's a security document)
• ISO 27001 (for general compliance)

Would you like me to automatically run these checks once processing is complete?`;
  }

  private async generateSuggestions(
    response: string,
    context: any,
    intent: any,
    nlpResult: any
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Context-based suggestions
    if (context.unresolvedIssues > 0 && context.criticalIssues > 0) {
      suggestions.push(`Review ${context.criticalIssues} critical issues`);
    }

    if (context.pendingDocuments > 0) {
      suggestions.push(`Check compliance for ${context.pendingDocuments} pending documents`);
    }

    if (context.complianceScore < 70) {
      suggestions.push('Get recommendations to improve compliance score');
    }

    // Intent-based follow-ups
    switch (intent.name) {
      case 'check_compliance':
        suggestions.push('Generate detailed compliance report');
        suggestions.push('View all compliance issues');
        suggestions.push('Schedule automated compliance checks');
        break;

      case 'upload_document':
        suggestions.push('Run compliance analysis');
        suggestions.push('Upload another document');
        suggestions.push('View processing status');
        break;

      case 'generate_report':
        suggestions.push('Schedule recurring reports');
        suggestions.push('Share report with team');
        suggestions.push('Export in different format');
        break;

      case 'find_issues':
        suggestions.push('Assign issues to team members');
        suggestions.push('Generate remediation plan');
        suggestions.push('Export issue list');
        break;
    }

    // Time-based suggestions
    const hour = new Date().getHours();
    if (hour >= 9 && hour < 10) {
      suggestions.push('Review daily compliance summary');
    }

    // Return top 3-5 most relevant suggestions
    return suggestions.slice(0, Math.min(5, suggestions.length));
  }

  private async generateContextualSuggestions(context: any): Promise<any[]> {
    const suggestions = [];

    // Critical issues need immediate attention
    if (context.criticalIssues > 0) {
      suggestions.push({
        priority: 'high',
        type: 'action',
        message: `You have ${context.criticalIssues} critical compliance issues that need immediate attention`,
        actions: [
          { label: 'View Critical Issues', command: 'show critical issues' },
          { label: 'Assign to Team', command: 'assign critical issues' },
        ],
      });
    }

    // Low compliance score
    if (context.complianceScore < 70) {
      suggestions.push({
        priority: 'high',
        type: 'insight',
        message: `Your compliance score is ${context.complianceScore}%, which is below the recommended threshold`,
        actions: [
          { label: 'Get Improvement Plan', command: 'how to improve compliance score' },
          { label: 'Run Full Audit', command: 'run complete compliance audit' },
        ],
      });
    }

    // Documents pending processing
    if (context.pendingDocuments > 0) {
      suggestions.push({
        priority: 'medium',
        type: 'reminder',
        message: `${context.pendingDocuments} documents are waiting for compliance analysis`,
        actions: [
          { label: 'Analyze All', command: 'analyze all pending documents' },
          { label: 'View Documents', command: 'show pending documents' },
        ],
      });
    }

    // Upcoming deadlines
    if (context.upcomingDeadlines && context.upcomingDeadlines.length > 0) {
      const deadline = context.upcomingDeadlines[0];
      suggestions.push({
        priority: 'medium',
        type: 'deadline',
        message: `${deadline.framework} audit due in ${deadline.daysUntil} days`,
        actions: [
          { label: 'Prepare Report', command: `generate ${deadline.framework} report` },
          { label: 'Run Check', command: `check ${deadline.framework} compliance` },
        ],
      });
    }

    // Positive reinforcement
    if (context.complianceScore >= 85) {
      suggestions.push({
        priority: 'low',
        type: 'achievement',
        message: `Excellent compliance score of ${context.complianceScore}%! Keep up the great work`,
        actions: [
          { label: 'View Trends', command: 'show compliance trends' },
          { label: 'Share Report', command: 'generate executive summary' },
        ],
      });
    }

    return suggestions;
  }

  private buildSystemPrompt(context: any): string {
    return `You are AuditGuard AI, an intelligent compliance assistant specializing in:
- GDPR, SOC2, HIPAA, ISO 27001, and other regulatory frameworks
- Document analysis and compliance checking
- Issue identification and remediation recommendations
- Report generation and analytics

Current context:
- Workspace: ${context.workspaceName}
- Industry: ${context.industry}
- User role: ${context.userRole}
- Compliance score: ${context.complianceScore}%
- Active frameworks: ${context.activeFrameworks.join(', ')}

Provide helpful, accurate, and actionable responses. Be concise but thorough.
If you're unsure about something, say so and offer to find more information.`;
  }

  private buildConversationContext(history: any[]): string {
    if (history.length === 0) {
      return 'This is the start of our conversation.';
    }

    return history
      .slice(-5) // Last 5 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  private async callAIModel(params: any): Promise<string> {
    // Placeholder for actual LLM integration
    // In production, this would call Claude, GPT, or another LLM

    // For now, return a contextual response based on the input
    return `I understand you're asking about ${params.userMessage}.
Based on your workspace's current compliance score of ${params.context.complianceScore}%
and ${params.context.unresolvedIssues} unresolved issues, I recommend focusing on
the most critical compliance gaps first. Would you like me to help you identify
and address these priority items?`;
  }

  private async updateLearningPatterns(feedback: any, sessionId: string) {
    // Store learning pattern in SmartMemory
    await this.memory.store({
      timeline: 'adaptive_learning',
      data: {
        sessionId,
        pattern: feedback.context,
        feedback: feedback.rating,
        timestamp: new Date().toISOString(),
      },
    });

    // Update pattern recognition models
    // This would involve ML model updates in production
  }

  private async trackAnalytics(event: string, data: any) {
    // Track event in analytics
    // This would integrate with the analytics service
    console.log(`Analytics: ${event}`, data);
  }
}

export default EnhancedAssistantService;