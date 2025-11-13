import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely, sql } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

// ============================================================================
// Error Handling
// ============================================================================

class AssistantError extends Error {
  constructor(
    message: string,
    public userMessage: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

function createUserFriendlyError(
  technicalMessage: string,
  code: string
): AssistantError {
  const errorMap: Record<string, { userMessage: string; retryable: boolean }> = {
    'ACCESS_DENIED': {
      userMessage: "You don't have access to this workspace. Please check your permissions or contact your workspace administrator.",
      retryable: false
    },
    'SESSION_NOT_FOUND': {
      userMessage: "Your conversation session has expired. Please start a new conversation.",
      retryable: false
    },
    'AI_UNAVAILABLE': {
      userMessage: "The AI assistant is temporarily unavailable. Please try again in a moment.",
      retryable: true
    },
    'TOOL_FAILED': {
      userMessage: "I encountered an issue accessing the requested information. Let me try a different approach.",
      retryable: true
    },
    'MEMORY_ERROR': {
      userMessage: "I'm having trouble accessing conversation history. Your message was received but context may be limited.",
      retryable: true
    },
    'RATE_LIMIT': {
      userMessage: "You're sending messages too quickly. Please wait a moment before trying again.",
      retryable: true
    }
  };

  const errorInfo = errorMap[code] || {
    userMessage: "Something went wrong. Please try again or contact support if the issue persists.",
    retryable: true
  };

  return new AssistantError(
    technicalMessage,
    errorInfo.userMessage,
    code,
    errorInfo.retryable
  );
}

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
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
  label?: string;
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
    
    this.env.logger.info('🚀 CHAT REQUEST STARTED', {
      workspaceId,
      userId,
      message: request.message.substring(0, 100)
    });

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw createUserFriendlyError(
        'Access denied: Not a workspace member',
        'ACCESS_DENIED'
      );
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

    // Search episodic memory for relevant past conversations
    let relevantPastSessions: string[] = [];
    try {
      const episodicResults = await this.env.ASSISTANT_MEMORY.searchEpisodicMemory(
        request.message,
        { nMostRecent: 3 }
      );
      
      if (episodicResults && episodicResults.results && episodicResults.results.length > 0) {
        relevantPastSessions = episodicResults.results.map(result => 
          `Past conversation (${new Date(result.createdAt).toLocaleDateString()}): ${result.summary}`
        );
        this.env.logger.info(`📚 Found ${episodicResults.results.length} relevant past conversations`);
      }
    } catch (error) {
      this.env.logger.warn(`Failed to search episodic memory: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

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

    // Build complete system prompt with workspace context and past conversation context
    let episodicContext = '';
    if (relevantPastSessions.length > 0) {
      episodicContext = `\n\nRELEVANT PAST CONVERSATIONS:\n${relevantPastSessions.join('\n')}`;
    }

    const systemPrompt = `${baseSystemPrompt}

CURRENT WORKSPACE CONTEXT:
${workspaceContext}${episodicContext}

KNOWLEDGE BASE ACCESS:
- Use the 'search_knowledge' tool to look up compliance requirements, best practices, and regulatory details
- Knowledge base includes: GDPR, SOC2, HIPAA, ISO27001, NIST CSF, PCI DSS
- Always cite knowledge base articles when providing compliance guidance`;

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

    this.env.logger.info('📝 Messages built', { messageCount: messages.length });

    // Generate AI response
    let assistantMessage: string;
    let decision: any = { needsTools: false, tools: [], reasoning: '' };
    let toolResults: any = { messages: [], rawData: [] };

    this.env.logger.info('🤖 Starting 4-stage AI pipeline');

    try {
      // Workaround for Raindrop Zod validation: Ensure content is never null
      // Instruct AI to always provide text alongside tool calls to satisfy validator
      const systemMessage = {
        role: 'system',
        content: `You are a helpful compliance assistant for AuditGuardX.

CRITICAL INSTRUCTIONS:
1. You have access to these tools - USE THEM whenever relevant:
   - get_compliance_status: For ANY question about scores, status, or compliance
   - search_documents: When user asks about specific documents or topics
   - get_compliance_issues: For questions about problems, gaps, or issues
   - get_document_info: For details about a specific document
   - search_knowledge: For questions about compliance frameworks, regulations, requirements, or best practices

2. When calling tools, provide a brief explanation like:
   - "Let me check your compliance status..." (while calling get_compliance_status)
   - "I'll search for those documents..." (while calling search_documents)
   - "Let me look that up in our knowledge base..." (while calling search_knowledge)

3. ALWAYS call tools for data-driven questions. Don't make up answers.

Context: ${workspaceContext}`
      };

      // TWO-STAGE APPROACH: First decide what to do, then execute tools if needed
      // Stage 1: Decision phase - analyze user request and decide on tool usage
      this.env.logger.info('Stage 1: Analyzing user request', {
        messageCount: messages.length,
        model: 'llama-3.3-70b'
      });
      
      const decisionPrompt = {
        role: 'system',
        content: `You are an AI decision maker for a compliance assistant. Analyze the user's request and respond ONLY with a JSON object indicating what tools to use WITH their arguments.

Available tools:
- get_compliance_status: For questions about scores, status, overall compliance (no args needed)
- search_documents: For finding specific documents or searching by topic
  Args: { "query": "search terms" }
- get_compliance_issues: For questions about problems, gaps, or specific issues (no args needed)
- get_document_info: For details about a specific document (requires document ID)
  Args: { "documentId": "doc_xxxxx" }
- search_knowledge: For questions about compliance frameworks, regulations, requirements, or best practices
  Args: { "query": "what user is asking about", "framework": "gdpr|soc2|hipaa|iso27001|nist_csf|pci_dss|all" }

Respond with this exact JSON structure:
{
  "needsTools": true/false,
  "toolCalls": [
    {
      "name": "tool_name",
      "arguments": { "arg": "value" }
    }
  ],
  "reasoning": "Why these tools are needed",
  "userFacingMessage": "Brief message to show user while processing"
}

Examples:
User: "What is my compliance score?"
{
  "needsTools": true,
  "toolCalls": [
    {
      "name": "get_compliance_status",
      "arguments": {}
    }
  ],
  "reasoning": "User asking for current compliance score",
  "userFacingMessage": "Let me check your current compliance status..."
}

User: "Find documents about GDPR"
{
  "needsTools": true,
  "toolCalls": [
    {
      "name": "search_documents",
      "arguments": { "query": "GDPR" }
    }
  ],
  "reasoning": "User wants to search for specific documents",
  "userFacingMessage": "Searching for GDPR-related documents..."
}

User: "What are GDPR data breach notification requirements?"
{
  "needsTools": true,
  "toolCalls": [
    {
      "name": "search_knowledge",
      "arguments": { "query": "breach notification requirements", "framework": "gdpr" }
    }
  ],
  "reasoning": "User asking about specific GDPR regulatory requirements",
  "userFacingMessage": "Let me look that up in our compliance knowledge base..."
}

User: "What are the requirements for incident response?"
{
  "needsTools": true,
  "toolCalls": [
    {
      "name": "search_knowledge",
      "arguments": { "query": "incident response requirements", "framework": "all" }
    }
  ],
  "reasoning": "User asking about general incident response across frameworks",
  "userFacingMessage": "Searching our knowledge base for incident response guidance..."
}

User: "thank you"
{
  "needsTools": false,
  "toolCalls": [],
  "reasoning": "Simple acknowledgment, no data needed",
  "userFacingMessage": "You're welcome! Let me know if you need anything else."
}`
      };
      
      let decisionResponse: any;
      try {
        decisionResponse = await this.env.AI.run('llama-3.3-70b', {
          model: 'llama-3.3-70b',
          messages: [
            decisionPrompt,
            ...messages.slice(-3) // Last 3 messages for context
          ] as any,
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 500,
        });
        
        this.env.logger.info('Decision stage completed', {
          hasResponse: !!decisionResponse
        });
      } catch (decisionError: any) {
        this.env.logger.error('Decision stage failed', {
          error: decisionError?.message || String(decisionError)
        });
        throw decisionError;
      }
      
      const decision = JSON.parse(decisionResponse.choices[0].message.content);
      
      this.env.logger.info('AI Decision', {
        needsTools: decision.needsTools,
        toolCalls: decision.toolCalls,
        reasoning: decision.reasoning
      });
      
      // Stage 2: Execute tools if needed
      if (decision.needsTools && decision.toolCalls && decision.toolCalls.length > 0) {
        this.env.logger.info('Stage 2: Executing tools', {
          toolCount: decision.toolCalls.length,
          tools: decision.toolCalls.map((tc: any) => tc.name)
        });
        
        // Convert decision tool calls to execution format
        const toolCalls = decision.toolCalls.map((tc: any, index: number) => ({
          id: `call_${Date.now()}_${index}`,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments || {})
          }
        }));
        
        // Execute the tools
        const toolResults = await this.executeTools(toolCalls, workspaceId, userId);
        
        this.env.logger.info('Tools executed', {
          toolCount: toolCalls.length,
          rawDataCount: toolResults.rawData.length
        });
        
        // Stage 3: Generate final response with tool results
        this.env.logger.info('Stage 3: Generating final response with tool results');
        
        const finalResponse = await this.env.AI.run('llama-3.3-70b', {
          model: 'llama-3.3-70b',
          messages: [
            systemMessage,
            ...messages.slice(-5),
            {
              role: 'assistant',
              content: decision.userFacingMessage
            },
            ...toolResults.messages,
            {
              role: 'user',
              content: 'Based on the tool results above, provide a comprehensive, helpful answer to my original question.'
            }
          ] as any,
          temperature: 0.7,
          max_tokens: 1500,
        });
        
        assistantMessage = finalResponse.choices[0].message.content;
        
        this.env.logger.info('Final response with tool results generated', {
          toolsExecuted: toolCalls.length,
          responseLength: assistantMessage.length
        });
      } else {
        // No tools needed - use decision's message or generate response
        if (decision.userFacingMessage) {
          assistantMessage = decision.userFacingMessage;
        } else {
          // Fallback: generate conversational response
          const simpleResponse = await this.env.AI.run('llama-3.3-70b', {
            model: 'llama-3.3-70b',
            messages: [systemMessage, ...messages.slice(-5)] as any,
            temperature: 0.7,
            max_tokens: 1000,
          });
          assistantMessage = simpleResponse.choices[0].message.content;
        }
        
        this.env.logger.info('Direct response (no tools needed)', {
          responseLength: assistantMessage.length
        });
      }
    } catch (error) {
      this.env.logger.error('AI inference failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Re-throw - no fallbacks, no heuristics, genuine AI responses only
      throw createUserFriendlyError(
        `AI error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'AI_UNAVAILABLE'
      );
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

    // Post-process: Generate suggestions and actions using AI
    this.env.logger.info('🔄 Starting post-processing for suggestions and actions');
    const postProcessing = await this.postProcessResponse({
      userMessage: request.message,
      assistantResponse: assistantMessage,
      toolsUsed: decision.needsTools ? decision.tools : [],
      toolResults: decision.needsTools ? toolResults.rawData : [],
      workspaceId: workspaceId,
      workspaceContext: workspaceContext
    });

    const response = {
      sessionId: session.id,
      message: assistantMessage,
      suggestions: postProcessing.suggestions,
      actions: postProcessing.actions,
    };

    // Debug logging
    this.env.logger.info(`📤 Chat Response Complete:`, {
      messagePreview: assistantMessage.substring(0, 100),
      actionsCount: postProcessing.actions.length,
      suggestionsCount: postProcessing.suggestions.length,
      actions: postProcessing.actions.map(a => ({ type: a.type, label: a.label })),
      suggestions: postProcessing.suggestions
    });
    
    return response;
  }

  /**
   * Streaming chat endpoint using Server-Sent Events
   * Returns a ReadableStream that emits chunks as they're generated
   */
  async streamChat(workspaceId: string, userId: string, request: ChatRequest): Promise<ReadableStream> {
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

    // Get or create session (reuse logic from chat method)
    let session;
    let memorySessionId: string;

    if (request.sessionId) {
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
      const sessionId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = Date.now();

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

    // Get workspace context
    const workspaceContext = await this.getWorkspaceContext(workspaceId);

    // Build messages
    const workingMemory = await this.env.ASSISTANT_MEMORY.getWorkingMemorySession(memorySessionId);
    const conversationHistory = await workingMemory.getMemory({
      timeline: 'conversation',
      nMostRecent: 10,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful AI compliance assistant for AuditGuardX.' },
      { role: 'system', content: `Context:\n${workspaceContext}` },
    ];

    if (conversationHistory) {
      for (const entry of conversationHistory) {
        messages.push({
          role: entry.agent === 'user' ? 'user' : 'assistant',
          content: entry.content,
        });
      }
    }

    messages.push({ role: 'user', content: request.message });

    const self = this;

    // Create a ReadableStream for Server-Sent Events
    // Variables to capture for post-processing
    let capturedUserMessage = request.message;
    let capturedToolsUsed: string[] = [];
    let capturedToolResults: any[] = [];
    let capturedWorkspaceContext = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send session ID first
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'session', sessionId: session.id })}\n\n`));

          // Call AI with streaming (if platform supports it, otherwise simulate)
          try {
            // Attempt streaming AI call
            const response = await self.env.AI.run('llama-3.3-70b', {
              model: 'llama-3.3-70b',
              messages: messages.slice(-6) as any,
              temperature: 0.7,
              max_tokens: 2000,
              stream: true, // Enable streaming
            });

            let fullMessage = '';

            // Stream chunks - expect real streaming response
            if (response && typeof response === 'object' && Symbol.asyncIterator in response) {
              // Real streaming: iterate over chunks
              for await (const chunk of response as AsyncIterable<any>) {
                // Extract content from OpenAI-compatible format
                const deltaContent = chunk.choices?.[0]?.delta?.content;
                const text = deltaContent || chunk.response || chunk.content || '';
                
                if (text) {
                  fullMessage += text;
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`));
                }
              }
            } else {
              // Not a stream - use direct response extraction (OpenAI format)
              const result = response as any;
              const primaryResponse = result.choices?.[0]?.message?.content;
              const fallbackResponse = result.response || result.content;
              fullMessage = primaryResponse || fallbackResponse || '';
              
              if (!fullMessage) {
                throw new Error('AI returned empty streaming response');
              }
              
              // Send as single chunk (no simulated streaming)
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'chunk', content: fullMessage })}\n\n`));
            }

            // Store complete message
            const assistantMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            await db
              .insertInto('conversation_messages')
              .values({
                id: assistantMsgId,
                session_id: session.id,
                role: 'assistant',
                content: fullMessage,
                created_at: Date.now(),
              })
              .execute();

            // Store in SmartMemory
            await workingMemory.putMemory({
              content: fullMessage,
              timeline: 'conversation',
              key: 'assistant',
              agent: 'assistant',
            });

            // Update session
            await db
              .updateTable('conversation_sessions')
              .set({
                last_activity_at: Date.now(),
                message_count: session.message_count + 2,
              })
              .where('id', '=', session.id)
              .execute();

            // Post-process: Generate suggestions and actions using AI
            // Note: streamChat doesn't use tools yet, so toolResults will be empty
            const postProcessing = await self.postProcessResponse({
              userMessage: request.message,
              assistantResponse: fullMessage,
              toolsUsed: [], // No tools in streaming yet
              toolResults: [],
              workspaceId: workspaceId,
              workspaceContext: workspaceContext
            });

            // Send completion event with post-processed suggestions and actions
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
              type: 'done', 
              suggestions: postProcessing.suggestions,
              actions: postProcessing.actions
            })}\n\n`));

          } catch (error) {
            self.env.logger.error(`Streaming AI error: ${error instanceof Error ? error.message : 'Unknown'}`);
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
              type: 'error', 
              message: 'AI generation failed' 
            })}\n\n`));
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return stream;
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

  private async generateSuggestions(
    userMessage: string, 
    assistantResponse: string,
    workspaceContext: string
  ): Promise<string[]> {
    // Generate AI-powered suggestions based on the conversation context
    // This ensures NO heuristics or fallbacks - genuine AI reasoning only
    
    try {
      const suggestionPrompt = {
        role: 'system',
        content: `You are a helpful compliance assistant. Based on the conversation context, suggest 2-3 relevant follow-up questions the user might want to ask.

Rules:
1. Suggestions must be natural, conversational questions
2. Base suggestions on the actual conversation and workspace data
3. Make suggestions actionable and specific
4. Return ONLY a JSON array of strings, nothing else

Example output:
["Show me detailed breakdown of my compliance issues", "How can I improve my compliance score?"]

Current conversation:
User: ${userMessage}
Assistant: ${assistantResponse}

Workspace context: ${workspaceContext}`
      };

      const response = await this.env.AI.run('llama-3.3-70b', {
        model: 'llama-3.3-70b',
        messages: [suggestionPrompt] as any,
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 200,
      });

      const result = response.choices[0].message.content;
      const parsed = JSON.parse(result);
      
      // Handle both array format and object with array property
      const suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
      
      return suggestions.slice(0, 3); // Limit to 3 suggestions
    } catch (error) {
      this.env.logger.error('Failed to generate AI suggestions', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return empty array instead of fallback suggestions
      // This ensures we NEVER use heuristics
      return [];
    }
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
      {
        type: 'function',
        function: {
          name: 'search_knowledge',
          description: 'Search the compliance knowledge base for regulations, requirements, and best practices. Use this for questions about specific frameworks (GDPR, SOC2, HIPAA, ISO27001, etc.)',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., "GDPR data retention requirements", "SOC2 access control best practices")',
              },
              framework: {
                type: 'string',
                enum: ['gdpr', 'soc2', 'hipaa', 'iso27001', 'nist_csf', 'pci_dss', 'all'],
                description: 'Specific framework to search, or "all" for all frameworks',
              },
            },
            required: ['query'],
          },
        },
      },
    ];
  }

  private async executeTools(
    toolCalls: any[],
    workspaceId: string,
    userId: string
  ): Promise<{ messages: ChatMessage[]; rawData: any[] }> {
    const messages: ChatMessage[] = [];
    const rawData: any[] = [];

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
          case 'search_knowledge':
            result = await this.toolSearchKnowledge(args);
            break;
          default:
            result = { error: `Unknown tool: ${toolCall.function.name}` };
        }

        // Store raw data for post-processing
        rawData.push({
          tool: toolCall.function.name,
          args: args,
          result: result,
          workspaceId: workspaceId
        });

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

    return { messages, rawData };
  }

  /**
   * Post-process conversation to generate contextual suggestions and actions
   * This runs AFTER the response is generated, analyzing the full conversation
   */
  private async postProcessResponse(input: {
    userMessage: string;
    assistantResponse: string;
    toolsUsed: string[];
    toolResults: any[];
    workspaceId: string;
    workspaceContext: string;
  }): Promise<{ suggestions: string[]; actions: Action[] }> {
    try {
      // Debug logging to see what we're working with
      this.env.logger.info('🔍 Post-processing input:', {
        toolsUsed: input.toolsUsed,
        toolResultsCount: input.toolResults.length,
        toolResultsSample: JSON.stringify(input.toolResults).substring(0, 1000)
      });
      
      this.env.logger.info('🔄 Post-processing: Generating suggestions and actions');

      const prompt = `You are a UX enhancement AI for a compliance management system. Analyze this conversation and generate:
1. 2-3 relevant follow-up questions (suggestions)
2. Action buttons for documents/pages mentioned

CONVERSATION:
User: ${input.userMessage}
Assistant: ${input.assistantResponse}

TOOLS USED: ${input.toolsUsed.length > 0 ? input.toolsUsed.join(', ') : 'none'}

TOOL RESULTS:
${JSON.stringify(input.toolResults, null, 2)}

WORKSPACE: ${input.workspaceId}
CONTEXT: ${input.workspaceContext}

OUTPUT FORMAT (JSON only, no markdown):
{
  "suggestions": [
    "Specific follow-up question 1",
    "Specific follow-up question 2"
  ],
  "actions": [
    {
      "type": "navigate",
      "target": "/workspaces/${input.workspaceId}/documents/{doc_id}",
      "label": "View Document Name"
    }
  ]
}

CRITICAL DOCUMENT ID EXTRACTION:
- Document IDs look like: "doc_1762918196621_ki679h" (NOT "1" or simple numbers)
- Search tool results for fields: "document_id", "id", "document.id"
- Use EXACT ID from tool results, never generate placeholder IDs
- If tool is "get_compliance_issues", look for issues[].document.id or issues[].document_id
- If tool is "get_compliance_status", check if documents are listed
- If tool is "search_documents", look for documents[].id

EXAMPLE TOOL RESULT:
{
  "tool": "get_compliance_issues",
  "result": {
    "issues": [{
      "document": {
        "id": "doc_1762918196621_ki679h",
        "filename": "Privacy_Policy.pdf"
      }
    }]
  }
}

CORRECT ACTION:
{
  "type": "navigate",
  "target": "/workspaces/wks_xxx/documents/doc_1762918196621_ki679h",
  "label": "View Privacy_Policy.pdf"
}

RULES:
- Suggestions must be natural questions users would actually ask next
- Make suggestions specific to the data discussed (scores, frameworks, documents)
- Actions must reference actual documents/pages from tool results
- Extract REAL document IDs (not "1" or placeholders)
- Only include actions if specific documents were mentioned
- Maximum 3 suggestions, maximum 3 actions
- If no relevant documents, return empty actions array
- Be specific and actionable`;

      const result = await this.env.AI.run('llama-3.3-70b', {
        model: 'llama-3.3-70b',
        messages: [{ role: 'system', content: prompt }] as any,
        response_format: { type: 'json_object' },
        temperature: 0.4, // Lower = more consistent
        max_tokens: 400,
      });

      const parsed = JSON.parse(result.choices[0].message.content);

      this.env.logger.info('✅ Post-processing complete', {
        suggestions: parsed.suggestions?.length || 0,
        actions: parsed.actions?.length || 0,
        actionsDetail: JSON.stringify(parsed.actions)
      });

      return {
        suggestions: parsed.suggestions || [],
        actions: parsed.actions || []
      };
    } catch (error) {
      this.env.logger.error('❌ Post-processing failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Return empty arrays on failure - don't break the response
      return {
        suggestions: [],
        actions: []
      };
    }
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

  // ============================================================================
  // Knowledge Base Tool
  // ============================================================================

  private async toolSearchKnowledge(
    args: { query: string; framework?: string }
  ): Promise<any> {
    try {
      this.env.logger.info('🔍 Knowledge search started', { query: args.query, framework: args.framework });
      
      const db = this.getDb();
      
      // Build query with basic filters
      let query = db
        .selectFrom('knowledge_base')
        .select(['id', 'title', 'content', 'category', 'framework', 'tags'])
        .where('is_active', '=', 1);
      
      // Add framework filter if specified
      if (args.framework && args.framework !== 'all') {
        query = query.where('framework', '=', args.framework as any);
      }
      
      const allResults = await query.execute();
      
      // Simple text matching in memory (will upgrade to full-text search after migration)
      const queryLower = args.query.toLowerCase();
      const matchedResults = allResults.filter(r => {
        const searchableText = `${r.title} ${r.content} ${r.tags || ''}`.toLowerCase();
        return searchableText.includes(queryLower);
      }).slice(0, 3);
      
      this.env.logger.info('📊 Search complete', { matchCount: matchedResults.length });
      
      if (matchedResults.length > 0) {
        this.env.logger.info('✅ Returning knowledge base results', { count: matchedResults.length });
        return {
          source: 'knowledge_base',
          count: matchedResults.length,
          results: matchedResults.map(r => ({
            title: r.title,
            content: r.content,
            framework: r.framework,
            category: r.category
          }))
        };
      }

      this.env.logger.warn('⚠️ No knowledge found', { query: args.query });
      return {
        message: 'No specific knowledge found in database.',
        query: args.query
      };
    } catch (error) {
      this.env.logger.error('❌ Knowledge search failed', {
        error: error instanceof Error ? error.message : String(error),
        query: args.query,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        error: 'Knowledge search temporarily unavailable',
        fallback: 'Using general model knowledge for this query'
      };
    }
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

      // HIPAA Guide
      const HIPAA_GUIDE = `HIPAA (Health Insurance Portability and Accountability Act) Quick Reference

KEY RULES:
1. Privacy Rule - Protected Health Information (PHI) protection
2. Security Rule - Electronic PHI (ePHI) safeguards
3. Breach Notification Rule - Breach reporting requirements

SAFEGUARDS REQUIRED:
- Administrative: Policies, procedures, training
- Physical: Facility access controls, workstation security
- Technical: Access controls, audit controls, encryption

KEY REQUIREMENTS:
- Business Associate Agreements (BAAs)
- Risk assessments
- Workforce training
- Breach notification (60 days)
- Minimum necessary standard`;

      // ISO 27001 Guide
      const ISO27001_GUIDE = `ISO 27001 (Information Security Management) Quick Reference

CORE COMPONENTS:
1. Information Security Management System (ISMS)
2. Risk assessment and treatment
3. Statement of Applicability (SoA)

CONTROL CATEGORIES (Annex A):
- Organizational controls (37)
- People controls (8)
- Physical controls (14)
- Technological controls (34)

CERTIFICATION PROCESS:
- Stage 1: Documentation review
- Stage 2: Implementation audit
- Surveillance audits (annual)
- Recertification (3 years)`;

      // Store in procedural memory
      await proceduralMemory.putProcedure('system_prompt', SYSTEM_PROMPT);
      await proceduralMemory.putProcedure('gdpr_guide', GDPR_GUIDE);
      await proceduralMemory.putProcedure('soc2_guide', SOC2_GUIDE);
      await proceduralMemory.putProcedure('hipaa_guide', HIPAA_GUIDE);
      await proceduralMemory.putProcedure('iso27001_guide', ISO27001_GUIDE);

      // Store detailed knowledge articles in procedural memory (globally accessible)
      const knowledgeArticles = [
        {
          key: 'kb_gdpr_data_minimization',
          content: 'GDPR Article 5 - Data Minimization Principle: Personal data must be adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed. Organizations should collect only data that is directly relevant and necessary to accomplish a specified purpose. Regularly review data collection practices and delete unnecessary data. Tags: GDPR, data_protection, privacy, data_minimization'
        },
        {
          key: 'kb_gdpr_breach_notification',
          content: 'GDPR Data Breach Notification Requirements: Organizations must notify the relevant supervisory authority within 72 hours of becoming aware of a personal data breach, unless the breach is unlikely to result in a risk to individuals. The notification must include: 1) Nature of the breach (categories and number of data subjects/records affected), 2) Name and contact details of the DPO or contact point, 3) Description of likely consequences, 4) Measures taken or proposed to address the breach. If high risk to individuals, affected persons must also be notified without undue delay. Tags: GDPR, data_breach, incident_response, notification, 72_hours'
        },
        {
          key: 'kb_soc2_evidence',
          content: 'SOC 2 Type II Evidence Requirements: For SOC 2 Type II audits, provide evidence of control operating effectiveness over 6-12 months. Required evidence includes: access logs, change management tickets, incident reports, security awareness training records, vulnerability scan results, penetration test reports, and board-level security reviews. Evidence must demonstrate consistent application of controls throughout the audit period. Tags: SOC2, audit, evidence, type_ii, compliance'
        },
        {
          key: 'kb_hipaa_baa',
          content: 'HIPAA Business Associate Agreement (BAA) Requirements: A BAA is required when a business associate will create, receive, maintain, or transmit PHI on behalf of a covered entity. Must include: permitted uses and disclosures, safeguard requirements, breach notification obligations, subcontractor provisions, termination clauses, and audit rights. Both parties must sign before any PHI is shared. Tags: HIPAA, BAA, business_associate, contracts, PHI'
        },
        {
          key: 'kb_iso27001_risk',
          content: 'ISO 27001 Risk Assessment Methodology: Risk assessment must identify assets, threats, vulnerabilities, and existing controls. Calculate inherent risk (likelihood × impact), then residual risk after controls. Document risk treatment decisions: modify (implement controls), retain (accept risk), avoid (eliminate activity), or share (transfer to third party). Update risk register at least annually or when significant changes occur. Tags: ISO27001, risk_assessment, ISMS, risk_management'
        },
        {
          key: 'kb_access_control',
          content: 'Cross-Framework Access Control Best Practices: Implement least privilege access (all frameworks). Use role-based access control (RBAC) with regular reviews. Enforce multi-factor authentication for privileged access. Log all access attempts and review logs regularly. Revoke access immediately upon termination. Document access procedures and conduct annual access recertification. Applies to GDPR, SOC2, HIPAA, and ISO 27001. Tags: access_control, RBAC, MFA, least_privilege, security'
        },
        {
          key: 'kb_data_retention',
          content: 'Data Retention Policy Guidelines: Define retention periods based on legal, regulatory, and business requirements. GDPR requires data not be kept longer than necessary for its purpose. HIPAA requires medical records for 6+ years (varies by state). SOC 2 requires audit evidence for 7 years. Implement automated deletion processes and document retention schedule. Include data classification, retention periods by category, destruction methods, and legal holds. Tags: data_retention, privacy, records_management, GDPR, HIPAA'
        },
        {
          key: 'kb_incident_response',
          content: 'Incident Response Plan Components: Essential components: 1) Preparation (tools, training, contact lists), 2) Detection and analysis (monitoring, triage), 3) Containment strategies (short-term and long-term), 4) Eradication and recovery (remove threat, restore systems), 5) Post-incident review (lessons learned). Designate incident response team, define escalation procedures, maintain communication templates, conduct regular drills (at least annually), and document all incidents. Tags: incident_response, security, breach, SOC2, ISO27001, GDPR'
        }
      ];

      // Store each knowledge article in procedural memory
      for (const article of knowledgeArticles) {
        try {
          await proceduralMemory.putProcedure(article.key, article.content);
        } catch (error) {
          this.env.logger.warn(`Failed to store knowledge article: ${article.key}`);
        }
      }

      return {
        success: true,
        message: `SmartMemory initialized successfully with system prompt, ${knowledgeArticles.length} knowledge articles, and 5 framework guides`,
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
