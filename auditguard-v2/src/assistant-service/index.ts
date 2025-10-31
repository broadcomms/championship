import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  sessionId?: string;
}

interface ChatResponse {
  sessionId: string;
  message: string;
  suggestions?: string[];
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

    // Build system prompt with workspace context
    const systemPrompt = `You are AuditGuard AI, an expert compliance assistant helping users with regulatory compliance management.

Current Workspace Context:
${workspaceContext}

Your capabilities:
- Answer questions about compliance frameworks (GDPR, SOC2, HIPAA, PCI DSS, ISO 27001, NIST CSF, etc.)
- Provide compliance score insights and recommendations
- Explain compliance issues and suggest remediation
- Guide users through compliance workflows
- Search and reference uploaded compliance documents

Guidelines:
- Be professional, accurate, and helpful
- Cite specific compliance requirements when relevant
- Provide actionable recommendations
- If uncertain, acknowledge limitations
- Keep responses concise but comprehensive`;

    // Get recent conversation history from SmartMemory
    let conversationHistory: ChatMessage[] = [];
    try {
      // Get the working memory session
      const workingMemory = await this.env.ASSISTANT_MEMORY.getWorkingMemorySession(memorySessionId);

      // Retrieve recent memories
      const memories = await workingMemory.getMemory({
        nMostRecent: 10,
      });

      if (memories && Array.isArray(memories)) {
        conversationHistory = memories.map((mem) => ({
          role: (mem.key === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: mem.content,
        }));
      }
    } catch (error) {
      this.env.logger.warn(`Failed to retrieve memory: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Store user message in SmartMemory
    try {
      const workingMemory = await this.env.ASSISTANT_MEMORY.getWorkingMemorySession(memorySessionId);
      await workingMemory.putMemory({
        content: request.message,
        key: 'user',
      });
    } catch (error) {
      this.env.logger.error(`Failed to store user message in memory: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Build messages for AI
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: request.message },
    ];

    // Generate AI response using SmartInference
    let assistantMessage: string;
    try {
      const aiResponse = await this.env.AI.run('llama-3.1-70b-instruct', {
        messages: messages.slice(-6), // Use last 6 messages for context window
      });

      const result = aiResponse as { response?: string };
      assistantMessage = result.response || 'I apologize, but I encountered an issue generating a response. Please try again.';
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
        key: 'assistant',
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
}
