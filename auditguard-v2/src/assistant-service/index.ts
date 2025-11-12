import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: {
    currentPage?: string;
    documentId?: string;
  };
}

interface ChatResponse {
  sessionId: string;
  message: string;
  suggestions?: string[];
  actions?: Action[];
}

interface Action {
  type: 'navigate' | 'api_call' | 'download';
  target?: string;
  method?: string;
  payload?: unknown;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Assistant Service - Private', { status: 501 });
  }

  async chat(workspaceId: string, userId: string, request: ChatRequest): Promise<ChatResponse> {
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

    // Get or create conversation session
    let session;
    let memorySessionId: string;

    if (request.sessionId) {
      // Get existing session
      session = await db
        .selectFrom('conversation_sessions')
        .selectAll()
        .where('id', '=', request.sessionId)
        .where('workspace_id', '=', workspaceId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!session) {
        throw new Error('Session not found');
      }

      memorySessionId = session.memory_session_id;
    } else {
      // Create new session with SmartMemory
      const sessionId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = Date.now();

      // Initialize SmartMemory working session
      const { sessionId: smartMemorySessionId } = await this.env.ASSISTANT_MEMORY.startWorkingMemorySession();
      memorySessionId = smartMemorySessionId;

      await db
        .insertInto('conversation_sessions')
        .values({
          id: sessionId,
          workspace_id: workspaceId,
          user_id: userId,
          memory_session_id: memorySessionId,
          started_at: now,
          last_activity_at: now,
          message_count: 0,
        })
        .execute();

      session = {
        id: sessionId,
        workspace_id: workspaceId,
        user_id: userId,
        memory_session_id: memorySessionId,
        started_at: now,
        last_activity_at: now,
        message_count: 0,
      };
    }

    // Store user message
    const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await db
      .insertInto('conversation_messages')
        .values({
          id: userMsgId,
          session_id: session.id,
          role: 'user',
          content: request.message,
          created_at: Date.now(),
        })
        .execute();

    // Get workspace context for the assistant
    const workspaceContext = await this.getWorkspaceContext(workspaceId);

    // Get system prompt from procedural memory or use default
    let baseSystemPrompt = '';
    try {
      const proceduralMemory = await this.env.ASSISTANT_MEMORY.getProceduralMemory();
      const storedPrompt = await proceduralMemory.getProcedure('system_prompt');
      if (storedPrompt) {
        baseSystemPrompt = storedPrompt;
      }
    } catch (error) {
      this.env.logger.warn(`Failed to retrieve system prompt from procedural memory: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Fall back to default if not found
    if (!baseSystemPrompt) {
      baseSystemPrompt = `You are AuditGuard AI, an expert compliance assistant helping users with regulatory compliance management.

CAPABILITIES:
- Document analysis and compliance checking
- Framework requirement matching (GDPR, SOC2, HIPAA, ISO 27001, NIST CSF, PCI DSS)
- Risk assessment and gap analysis
- Report generation and executive summaries

PERSONALITY:
- Professional but friendly
- Proactive in identifying issues
- Provide clear, actionable recommendations
- Acknowledge when you need more information

RESPONSE GUIDELINES:
1. Always use tools when appropriate rather than making up information
2. Cite specific document names and compliance scores when available
3. Provide actionable next steps
4. Keep responses concise but informative
5. Use a professional but approachable tone

ERROR HANDLING:
- If a tool fails, acknowledge it and provide alternative approaches
- Don't hallucinate data - if you don't have information, say so
- Guide users to relevant pages if you can't directly help`;
    }

    // Build complete system prompt with workspace context
    const systemPrompt = `${baseSystemPrompt}

CURRENT WORKSPACE CONTEXT:
${workspaceContext}`;

    // Get recent conversation history from SmartMemory
    let conversationHistory: ChatMessage[] = [];
    try {
      // Get the working memory session
      const workingMemory = await this.env.ASSISTANT_MEMORY.getWorkingMemorySession(memorySessionId);

      // Retrieve recent memories from conversation timeline
      const memories = await workingMemory.getMemory({
        timeline: 'conversation',
        nMostRecent: 10,
      });

      if (memories && Array.isArray(memories)) {
        // Parse role from agent field or key
        conversationHistory = memories.map((mem) => {
          // Use agent field to determine role, fallback to key
          const role = mem.agent === 'user' ? 'user' :
                      mem.agent === 'assistant' ? 'assistant' :
                      // Fallback to key field for role identification
                      (mem.key === 'user' ? 'user' : 'assistant');
          return {
            role: role as 'user' | 'assistant',
            content: mem.content,
          };
        });
      }
    } catch (error) {
      this.env.logger.warn(`Failed to retrieve memory: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Store user message in SmartMemory with proper structure
    try {
      const workingMemory = await this.env.ASSISTANT_MEMORY.getWorkingMemorySession(memorySessionId);
      await workingMemory.putMemory({
        content: request.message,
        timeline: 'conversation',
        key: 'user', // Use key to differentiate message types
        agent: 'user', // Use agent field for originator info
      });
    } catch (error) {
      this.env.logger.error(`Failed to store user message in memory: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Build messages for AI
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({ ...msg, role: msg.role as 'user' | 'assistant' })),
      { role: 'user', content: request.message },
    ];

    // Generate AI response
    let assistantMessage: string;
    const actions: Action[] = [];

    try {
      // Call AI (function calling to be enabled when platform supports it)
      const aiResponse = await this.env.AI.run('llama-3.3-70b', {
        model: 'llama-3.3-70b',
        messages: messages.slice(-6), // Use last 6 messages for context window
        temperature: 0.7,
        max_tokens: 2000,
      });

      // Type the response properly
      const result = aiResponse as any;
      assistantMessage = result.response || result.content || 'I apologize, but I encountered an issue generating a response. Please try again.';
      
      // TODO: Enable function calling when platform supports it
      // For now, if user asks about specific data, provide guidance
      const lowerMessage = request.message.toLowerCase();
      if (lowerMessage.includes('compliance score') || lowerMessage.includes('status')) {
        const statusData = await this.toolGetComplianceStatus(workspaceId, {});
        assistantMessage += `\n\n**Current Status:**\n- Overall Score: ${statusData.overall_score}/100\n- Risk Level: ${statusData.risk_level}\n- Documents Checked: ${statusData.documents_checked}/${statusData.total_documents}\n- Critical Issues: ${statusData.critical_issues}\n- High Issues: ${statusData.high_issues}`;
      }
    } catch (error) {
      this.env.logger.error(`AI response failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      assistantMessage = 'I apologize, but I encountered a technical issue. Please try again or contact support if the problem persists.';
    }

    // Store assistant message in database
    const assistantMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await db
      .insertInto('conversation_messages')
      .values({
        id: assistantMsgId,
        session_id: session.id,
        role: 'assistant',
        content: assistantMessage,
        created_at: Date.now(),
      })
      .execute();

    // Store assistant message in SmartMemory
    try {
      const workingMemory = await this.env.ASSISTANT_MEMORY.getWorkingMemorySession(memorySessionId);
      await workingMemory.putMemory({
        content: assistantMessage,
        timeline: 'conversation',
        key: 'assistant',
        agent: 'assistant',
      });
    } catch (error) {
      this.env.logger.error(`Failed to store assistant message in memory: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Update session activity
    await db
      .updateTable('conversation_sessions')
      .set({
        last_activity_at: Date.now(),
        message_count: session.message_count + 2, // User + assistant
      })
      .where('id', '=', session.id)
      .execute();

    // Generate contextual suggestions
    const suggestions = this.generateSuggestions(request.message, workspaceContext);

    return {
      sessionId: session.id,
      message: assistantMessage,
      suggestions,
      actions,
    };
  }

  private async getWorkspaceContext(workspaceId: string): Promise<string> {
    const db = this.getDb();

    // Get workspace info
    const workspace = await db
      .selectFrom('workspaces')
      .select(['name', 'description'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    // Get latest compliance score
    const latestScore = await db
      .selectFrom('workspace_scores')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .orderBy('calculated_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    // Get document count
    const docCount = await db
      .selectFrom('documents')
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    // Get open issues count
    const openIssuesCount = await db
      .selectFrom('compliance_issues')
      .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
      .select(({ fn }) => fn.count<number>('compliance_issues.id').as('count'))
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .where('compliance_issues.status', '=', 'open')
      .executeTakeFirst();

    let context = `Workspace: ${workspace?.name || 'Unknown'}\n`;
    if (workspace?.description) {
      context += `Description: ${workspace.description}\n`;
    }

    context += `Total Documents: ${docCount?.count || 0}\n`;

    if (latestScore) {
      context += `Overall Compliance Score: ${latestScore.overall_score}/100 (${latestScore.risk_level} risk)\n`;
      context += `Documents Checked: ${latestScore.documents_checked}/${latestScore.total_documents}\n`;
      context += `Open Issues: ${openIssuesCount?.count || 0} (Critical: ${latestScore.critical_issues}, High: ${latestScore.high_issues}, Medium: ${latestScore.medium_issues})\n`;
      context += `Frameworks Covered: ${latestScore.frameworks_covered}\n`;
    } else {
      context += `No compliance checks run yet.\n`;
    }

    return context;
  }

  private generateSuggestions(userMessage: string, context: string): string[] {
    const lowerMessage = userMessage.toLowerCase();
    const suggestions: string[] = [];

    if (lowerMessage.includes('score') || lowerMessage.includes('compliance')) {
      suggestions.push('Show me detailed breakdown of my compliance issues');
      suggestions.push('How can I improve my compliance score?');
    }

    if (lowerMessage.includes('gdpr') || lowerMessage.includes('privacy')) {
      suggestions.push('What are the key GDPR requirements?');
      suggestions.push('How do I handle data subject requests?');
    }

    if (lowerMessage.includes('soc') || lowerMessage.includes('soc2')) {
      suggestions.push('Explain SOC 2 Trust Service Criteria');
      suggestions.push('What controls do I need for SOC 2?');
    }

    if (lowerMessage.includes('issue') || lowerMessage.includes('problem')) {
      suggestions.push('Show me all critical issues');
      suggestions.push('What are the most common compliance gaps?');
    }

    if (suggestions.length === 0) {
      suggestions.push('What is my current compliance status?');
      suggestions.push('Show me compliance trends');
      suggestions.push('What frameworks should I focus on?');
    }

    return suggestions.slice(0, 3);
  }

  // ============================================================================
  // AI Tool Definitions and Execution
  // ============================================================================

  private getTools(): Tool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_compliance_status',
          description: 'Get current compliance status for the workspace including scores, issues, and framework coverage',
          parameters: {
            type: 'object',
            properties: {
              framework: {
                type: 'string',
                description: 'Optional: specific framework to check (gdpr, soc2, hipaa, iso27001)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_documents',
          description: 'Search for documents using semantic search in the workspace',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query to find relevant documents',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default 10)',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_compliance_issues',
          description: 'Get list of compliance issues, optionally filtered by severity or framework',
          parameters: {
            type: 'object',
            properties: {
              severity: {
                type: 'string',
                description: 'Filter by severity: critical, high, medium, or low',
              },
              framework: {
                type: 'string',
                description: 'Filter by framework: gdpr, soc2, hipaa, iso27001',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of issues to return (default 20)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_document_info',
          description: 'Get detailed information about a specific document',
          parameters: {
            type: 'object',
            properties: {
              documentId: {
                type: 'string',
                description: 'The document ID to retrieve information for',
              },
            },
            required: ['documentId'],
          },
        },
      },
    ];
  }

  private async executeTools(
    toolCalls: any[],
    workspaceId: string,
    userId: string
  ): Promise<{ messages: ChatMessage[]; actions: Action[] }> {
    const messages: ChatMessage[] = [];
    const actions: Action[] = [];

    for (const toolCall of toolCalls) {
      try {
        const args = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        
        let result: any;

        switch (toolCall.function.name) {
          case 'get_compliance_status':
            result = await this.toolGetComplianceStatus(workspaceId, args);
            break;
          case 'search_documents':
            result = await this.toolSearchDocuments(workspaceId, args);
            break;
          case 'get_compliance_issues':
            result = await this.toolGetComplianceIssues(workspaceId, args);
            break;
          case 'get_document_info':
            result = await this.toolGetDocumentInfo(workspaceId, args);
            break;
          default:
            result = { error: `Unknown tool: ${toolCall.function.name}` };
        }

        messages.push({
          role: 'assistant',
          content: `Tool result for ${toolCall.function.name}: ${JSON.stringify(result)}`,
        });
      } catch (error) {
        this.env.logger.error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        messages.push({
          role: 'assistant',
          content: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return { messages, actions };
  }

  // ============================================================================
  // Tool Implementations
  // ============================================================================

  private async toolGetComplianceStatus(
    workspaceId: string,
    args: { framework?: string }
  ): Promise<any> {
    const db = this.getDb();

    // Get latest workspace score
    const latestScore = await db
      .selectFrom('workspace_scores')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .orderBy('calculated_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!latestScore) {
      return {
        message: 'No compliance checks have been run yet for this workspace.',
        overall_score: null,
      };
    }

    // Get framework-specific scores if requested
    let frameworkScore = null;
    if (args.framework) {
      frameworkScore = await db
        .selectFrom('framework_scores')
        .selectAll()
        .where('workspace_id', '=', workspaceId)
        .where('framework', '=', args.framework.toLowerCase())
        .orderBy('last_check_at', 'desc')
        .limit(1)
        .executeTakeFirst();
    }

    return {
      overall_score: latestScore.overall_score,
      risk_level: latestScore.risk_level,
      documents_checked: latestScore.documents_checked,
      total_documents: latestScore.total_documents,
      critical_issues: latestScore.critical_issues,
      high_issues: latestScore.high_issues,
      medium_issues: latestScore.medium_issues,
      low_issues: latestScore.low_issues,
      info_issues: latestScore.info_issues,
      frameworks_covered: latestScore.frameworks_covered,
      last_analyzed: latestScore.calculated_at,
      framework_specific: frameworkScore
        ? {
            framework: frameworkScore.framework,
            score: frameworkScore.score,
            risk_level: frameworkScore.risk_level,
            documents_checked: frameworkScore.documents_checked,
            critical_issues: frameworkScore.critical_issues,
            high_issues: frameworkScore.high_issues,
            medium_issues: frameworkScore.medium_issues,
            low_issues: frameworkScore.low_issues,
          }
        : null,
    };
  }

  private async toolSearchDocuments(
    workspaceId: string,
    args: { query: string; limit?: number }
  ): Promise<any> {
    try {
      const db = this.getDb();
      
      // For now, do a simple SQL search until we verify SmartBucket API
      const documents = await db
        .selectFrom('documents')
        .select(['id', 'filename', 'title', 'description', 'category'])
        .where('workspace_id', '=', workspaceId)
        .where('processing_status', '=', 'completed')
        .limit(args.limit || 10)
        .execute();

      return {
        results: documents.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          title: doc.title,
          description: doc.description,
          category: doc.category,
        })),
        total: documents.length,
      };
    } catch (error) {
      this.env.logger.error(`Document search failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return {
        error: 'Failed to search documents',
        results: [],
        total: 0,
      };
    }
  }

  private async toolGetComplianceIssues(
    workspaceId: string,
    args: { severity?: string; framework?: string; limit?: number }
  ): Promise<any> {
    const db = this.getDb();

    let query = db
      .selectFrom('compliance_issues')
      .innerJoin('compliance_checks', 'compliance_issues.check_id', 'compliance_checks.id')
      .innerJoin('documents', 'compliance_issues.document_id', 'documents.id')
      .select([
        'compliance_issues.id',
        'compliance_issues.severity',
        'compliance_issues.regulation_citation',
        'compliance_issues.excerpt',
        'compliance_issues.remediation_steps',
        'compliance_issues.framework',
        'compliance_issues.status',
        'documents.filename',
        'documents.id as document_id',
      ])
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .where('compliance_issues.status', '=', 'open');

    if (args.severity) {
      query = query.where('compliance_issues.severity', '=', args.severity.toLowerCase());
    }

    if (args.framework) {
      query = query.where('compliance_issues.framework', '=', args.framework.toLowerCase());
    }

    const issues = await query
      .orderBy('compliance_issues.severity', 'asc')
      .limit(args.limit || 20)
      .execute();

    return {
      issues: issues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        framework: issue.framework,
        regulation: issue.regulation_citation,
        excerpt: issue.excerpt,
        remediation: issue.remediation_steps,
        document: {
          id: issue.document_id,
          filename: issue.filename,
        },
      })),
      total: issues.length,
    };
  }

  private async toolGetDocumentInfo(
    workspaceId: string,
    args: { documentId: string }
  ): Promise<any> {
    const db = this.getDb();

    const document = await db
      .selectFrom('documents')
      .selectAll()
      .where('id', '=', args.documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      return { error: 'Document not found' };
    }

    // Get compliance checks for this document
    const checks = await db
      .selectFrom('compliance_checks')
      .select(['framework', 'overall_score', 'issues_found', 'status', 'completed_at'])
      .where('document_id', '=', args.documentId)
      .execute();

    return {
      id: document.id,
      filename: document.filename,
      title: document.title,
      description: document.description,
      category: document.category,
      file_size: document.file_size,
      page_count: document.page_count,
      word_count: document.word_count,
      uploaded_at: document.uploaded_at,
      processing_status: document.processing_status,
      compliance_checks: checks.map((check) => ({
        framework: check.framework,
        score: check.overall_score,
        issues_found: check.issues_found,
        status: check.status,
        completed_at: check.completed_at,
      })),
    };
  }

  async listSessions(workspaceId: string, userId: string): Promise<{
    sessions: Array<{
      id: string;
      startedAt: number;
      lastActivityAt: number;
      messageCount: number;
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

    const sessions = await db
      .selectFrom('conversation_sessions')
      .select(['id', 'started_at', 'last_activity_at', 'message_count'])
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .orderBy('last_activity_at', 'desc')
      .limit(20)
      .execute();

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.started_at,
        lastActivityAt: s.last_activity_at,
        messageCount: s.message_count,
      })),
    };
  }

  async getSessionHistory(sessionId: string, workspaceId: string, userId: string): Promise<{
    session: {
      id: string;
      startedAt: number;
      messageCount: number;
    };
    messages: Array<{
      role: string;
      content: string;
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

    // Get session
    const session = await db
      .selectFrom('conversation_sessions')
      .select(['id', 'started_at', 'message_count'])
      .where('id', '=', sessionId)
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!session) {
      throw new Error('Session not found');
    }

    // Get messages
    const messages = await db
      .selectFrom('conversation_messages')
      .select(['role', 'content', 'created_at'])
      .where('session_id', '=', sessionId)
      .orderBy('created_at', 'asc')
      .execute();

    return {
      session: {
        id: session.id,
        startedAt: session.started_at,
        messageCount: session.message_count,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    };
  }

  async deleteSession(sessionId: string, workspaceId: string, userId: string): Promise<{ success: boolean }> {
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

    // Verify session ownership
    const session = await db
      .selectFrom('conversation_sessions')
      .select(['id', 'memory_session_id'])
      .where('id', '=', sessionId)
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!session) {
      throw new Error('Session not found');
    }

    // Delete from database (messages will cascade delete)
    await db.deleteFrom('conversation_sessions').where('id', '=', sessionId).execute();

    // Note: SmartMemory sessions persist, which is fine for audit purposes
    // If needed, we could add: await this.env.ASSISTANT_MEMORY.delete({ sessionId: session.memory_session_id });

    return { success: true };
  }

  /**
   * Initialize SmartMemory with system prompts and knowledge base
   * This should be run once after deployment
   */
  async initializeSmartMemory(): Promise<{ success: boolean; message: string }> {
    try {
      const proceduralMemory = await this.env.ASSISTANT_MEMORY.getProceduralMemory();

      // System prompt
      const SYSTEM_PROMPT = `You are an AI compliance assistant for AuditGuardX, helping users manage regulatory compliance.

CAPABILITIES:
- Document analysis and compliance checking
- Framework requirement matching (GDPR, SOC2, HIPAA, ISO 27001)
- Risk assessment and gap analysis
- Report generation and executive summaries

PERSONALITY:
- Professional but friendly
- Proactive in identifying issues
- Provide clear, actionable recommendations
- Acknowledge when you need more information

TOOLS AVAILABLE:
- analyze_document: Check document compliance against frameworks
- search_documents: Find relevant documents using semantic search
- get_compliance_status: Retrieve current compliance scores
- get_compliance_issues: Get list of unresolved compliance issues
- get_document_info: Get detailed information about a specific document

RESPONSE GUIDELINES:
1. Always use tools when appropriate rather than making up information
2. Cite specific document names and compliance scores when available
3. Provide actionable next steps
4. Keep responses concise but informative
5. Use a professional but approachable tone

ERROR HANDLING:
- If a tool fails, acknowledge it and provide alternative approaches
- Don't hallucinate data - if you don't have information, say so
- Guide users to relevant pages if you can't directly help`;

      // GDPR Guide
      const GDPR_GUIDE = `GDPR (General Data Protection Regulation) Quick Reference

KEY PRINCIPLES:
1. Lawfulness, fairness, and transparency
2. Purpose limitation
3. Data minimization
4. Accuracy
5. Storage limitation
6. Integrity and confidentiality
7. Accountability

COMMON REQUIREMENTS:
- Consent management
- Data subject rights (access, rectification, erasure, portability)
- Data breach notification (72 hours)
- Privacy by design and default
- Data Protection Impact Assessments (DPIA)
- Records of processing activities

PENALTIES:
- Up to €20 million or 4% of global annual turnover (whichever is higher)`;

      // SOC 2 Guide
      const SOC2_GUIDE = `SOC 2 (Service Organization Control 2) Quick Reference

TRUST SERVICE CRITERIA:
1. Security (required)
2. Availability (optional)
3. Processing Integrity (optional)
4. Confidentiality (optional)
5. Privacy (optional)

KEY FOCUS AREAS:
- Access controls
- Change management
- System operations
- Risk mitigation
- Incident response
- Monitoring and logging

AUDIT TYPES:
- Type I: Design effectiveness at a point in time
- Type II: Operating effectiveness over a period (6-12 months)`;

      // Store in procedural memory
      await proceduralMemory.putProcedure('system_prompt', SYSTEM_PROMPT);
      await proceduralMemory.putProcedure('gdpr_guide', GDPR_GUIDE);
      await proceduralMemory.putProcedure('soc2_guide', SOC2_GUIDE);

      return {
        success: true,
        message: 'SmartMemory initialized successfully with system prompt and compliance guides',
      };
    } catch (error) {
      console.error('Failed to initialize SmartMemory:', error);
      return {
        success: false,
        message: `Failed to initialize SmartMemory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
