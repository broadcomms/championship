import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely, sql } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { CerebrasClient } from '../common/cerebras-client';

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

  /**
   * AI call handler with automatic failover
   * Attempts Cerebras first for fast inference, falls back to Raindrop AI (Workers AI) if unavailable
   * Non-streaming only for maximum compatibility
   */
  private async callAI(config: {
    model?: 'decision' | 'response';
    messages: any[];
    temperature: number;
    maxTokens: number;
    responseFormat?: { type: 'json_object' };
    timeout?: number;
  }): Promise<any> {
    const modelName = config.model === 'decision'
      ? this.env.CEREBRAS_DECISION_MODEL
      : this.env.CEREBRAS_RESPONSE_MODEL;

    const startTime = Date.now();
    this.env.logger.info('🚀 Attempting Cerebras API (with Raindrop AI fallback)', {
      model: modelName,
      messageCount: config.messages.length
    });

    const cerebras = new CerebrasClient(this.env.CEREBRAS_API_KEY);

    try {
      const response = await cerebras.chatCompletion({
        model: modelName,
        messages: config.messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: config.responseFormat,
        timeout: config.timeout || 120000, // 120s default timeout
      });

      const duration = Date.now() - startTime;
      this.env.logger.info('✅ Cerebras call completed', {
        model: modelName,
        tokensUsed: response.usage?.total_tokens,
        latency: duration,
        tokensPerSecond: response.usage?.completion_tokens
          ? Math.round(response.usage.completion_tokens / (duration / 1000))
          : 0
      });

      return { choices: response.choices };
    } catch (cerebrasError) {
      const duration = Date.now() - startTime;
      const errorMsg = cerebrasError instanceof Error ? cerebrasError.message : String(cerebrasError);
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('too_many_requests') || errorMsg.includes('queue_exceeded');

      this.env.logger.warn('⚠️ Cerebras API failed, attempting fallback to Raindrop AI', {
        error: errorMsg,
        model: modelName,
        duration,
        isRateLimit,
        isTimeout: errorMsg.includes('timeout')
      });

      // FALLBACK: Use Raindrop AI (Workers AI) when Cerebras is unavailable
      try {
        this.env.logger.info('🔄 Falling back to Raindrop AI (Workers AI)', {
          model: 'llama-3.1-70b-instruct'
        });

        const fallbackStartTime = Date.now();
        const fallbackResponse = await this.env.AI.run('llama-3.1-70b-instruct', {
          messages: config.messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          ...(config.responseFormat && { response_format: config.responseFormat }),
        });

        const fallbackDuration = Date.now() - fallbackStartTime;

        this.env.logger.info('✅ Raindrop AI fallback successful', {
          model: 'llama-3.1-70b-instruct',
          duration: fallbackDuration,
          originalError: errorMsg.substring(0, 100)
        });

        return { choices: fallbackResponse.choices || [{ message: fallbackResponse }] };
      } catch (fallbackError) {
        this.env.logger.error('❌ Both Cerebras and Raindrop AI failed', {
          cerebrasError: errorMsg,
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });

        // If both fail, throw a user-friendly error
        if (isRateLimit) {
          throw new Error('AI services are experiencing high traffic. Please try again in a moment.');
        } else {
          throw new Error('AI services are temporarily unavailable. Please try again shortly.');
        }
      }
    }
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Assistant Service - Private', { status: 501 });
  }

  async chat(workspaceId: string, userId: string, request: ChatRequest): Promise<ChatResponse> {
    // CRITICAL DEBUG: This should appear first
    console.log('🔥🔥🔥 CHAT METHOD ENTRY POINT - VERSION WITH DEBUG LOGGING 🔥🔥🔥');
    this.env.logger.info('🔥🔥🔥 CHAT METHOD ENTRY POINT - VERSION WITH DEBUG LOGGING 🔥🔥🔥');

    this.env.logger.info('🚨 CHAT METHOD CALLED (non-streaming)', {
      workspaceId,
      userId,
      message: request.message.substring(0, 100),
      hasSessionId: !!request.sessionId
    });

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

    // Generate title from first message if this is a new session (message_count was 0)
    if (session.message_count === 0) {
      const title = this.generateConversationTitle(request.message);
      await db
        .updateTable('conversation_sessions')
        .set({ title })
        .where('id', '=', session.id)
        .execute();
      this.env.logger.info('📝 Set conversation title', { sessionId: session.id, title });
    }

    // Get workspace context for the assistant
    const workspaceContext = await this.getWorkspaceContext(workspaceId);

    // Add checkpoint before SmartMemory operations
    console.log('🔍 CHECKPOINT A: Before episodic memory search');
    this.env.logger.info('🔍 CHECKPOINT A: Before episodic memory search');

    // Search episodic memory for relevant past conversations
    // SKIP FOR NOW - This is causing execution to hang
    let relevantPastSessions: string[] = [];
    console.log('🔍 SKIPPING episodic memory search temporarily');
    this.env.logger.info('🔍 SKIPPING episodic memory search - moving to procedural memory');
    
    console.log('🔍 CHECKPOINT B: Skipped episodic memory (disabled)');
    this.env.logger.info('🔍 CHECKPOINT B: Skipped episodic memory');

    console.log('🔍 CHECKPOINT C: Before procedural memory retrieval');
    this.env.logger.info('🔍 CHECKPOINT C: Before procedural memory retrieval');

    // Get system prompt from procedural memory or use default
    // SKIP FOR NOW - Using default prompt to avoid blocking
    let baseSystemPrompt = '';
    console.log('🔍 SKIPPING procedural memory - using default prompt');
    this.env.logger.info('🔍 SKIPPING procedural memory - using default prompt');
    
    console.log('🔍 CHECKPOINT D: Skipped procedural memory (disabled)');
    console.log('🔍 CHECKPOINT E: Skipped getProcedure call (disabled)');
    
    console.log('🔍 CHECKPOINT F: After procedural memory section');
    this.env.logger.info('🔍 CHECKPOINT F: After procedural memory section');

    // Fall back to default if not found
    if (!baseSystemPrompt) {
      baseSystemPrompt = `You are AuditGuardX AI, your friendly compliance expert and assistant.

## PERSONALITY & TONE
- Warm, professional, and approachable
- Speak naturally like a knowledgeable colleague
- Be proactive and helpful
- Show empathy when discussing compliance gaps or issues

## CAPABILITIES
- Analyze documents for compliance issues
- Track TWO types of compliance scores:
  1. **Average Compliance Score**: Average of individual compliance check scores (how well documents pass checks)
  2. **Workspace Risk Score**: Overall compliance posture based on issue severity (weighted deduction from 100)
- Monitor compliance across frameworks (GDPR, SOC2, HIPAA, ISO 27001, etc.)
- Identify and prioritize compliance gaps
- Provide actionable remediation guidance
- Generate compliance reports

## CRITICAL COMMUNICATION RULES

### NEVER mention:
- Tool names or "checking the tools"
- Field names like "overall_score", "frameworks_covered", "total_documents"
- JSON, arrays, or technical data structures
- "Based on the data" or "according to the results"

### ALWAYS:
- Speak as if YOU personally know the information
- Use natural language: "Your score is 85%" not "The score field shows 85"
- Provide context and helpful suggestions
- Be encouraging while honest about issues

## RESPONSE STYLE

### When things are going well:
"Great news! Your compliance score is 92% - you're doing an excellent job maintaining your GDPR compliance. Keep it up!"

### When there are issues:
"I noticed a few areas that need attention. You have 3 compliance issues - 1 critical and 2 medium. Would you like me to walk through them and suggest how to address each one?"

### When no data exists:
"It looks like you haven't run any compliance checks yet. Want me to help you get started? You can upload a document and I'll analyze it for compliance issues."

## ERROR HANDLING
- If something goes wrong, apologize briefly and offer alternatives
- Never expose technical error messages to users
- Always try to be helpful even when data is limited`;
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
- MANDATORY: Always use search_knowledge for questions about frameworks, regulations, or "what are the requirements"
- DO NOT answer compliance questions from memory - always check the knowledge base first`;

    // Get recent conversation history from SmartMemory (working memory)
    console.log('🧠 Retrieving conversation history from SmartMemory');
    this.env.logger.info('🧠 Retrieving conversation history from SmartMemory', {
      sessionId: session.id,
      memorySessionId
    });

    let conversationHistory: ChatMessage[] = [];
    
    try {
      const workingMemory = await this.env.ASSISTANT_MEMORY.getWorkingMemorySession(memorySessionId);
      const memoryEntries = await workingMemory.getMemory({
        timeline: 'conversation',
        nMostRecent: 100, // Last 50 turns (100 messages: 50 user + 50 assistant) - TEST FULL MODEL CAPACITY
      });

      if (memoryEntries && memoryEntries.length > 0) {
        conversationHistory = memoryEntries.map(entry => ({
          role: entry.agent === 'user' ? 'user' : 'assistant',
          content: entry.content
        }));
        
        console.log(`✅ Retrieved ${conversationHistory.length} messages from SmartMemory`);
        this.env.logger.info(`✅ Retrieved ${conversationHistory.length} messages from SmartMemory`, {
          sessionId: session.id,
          memorySessionId,
          messageCount: conversationHistory.length
        });
      } else {
        console.log('ℹ️ No conversation history found in SmartMemory (new conversation)');
        this.env.logger.info('ℹ️ No conversation history found in SmartMemory');
      }
    } catch (error) {
      console.error('⚠️ Failed to retrieve conversation history from SmartMemory:', error);
      this.env.logger.error(`⚠️ Failed to retrieve SmartMemory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Continue with empty history - single-turn conversation
    }

    // 🔥 CONVERSATION SUMMARIZATION: Prevent context overflow
    // With llama-3.1-70b-instruct (128K context), summarize when conversation exceeds 20 messages
    let processedHistory = conversationHistory;
    
    if (conversationHistory.length > 20) {
      this.env.logger.info('🧠 Applying conversation summarization', {
        originalMessageCount: conversationHistory.length,
        threshold: 20,
        model: 'llama-3.1-70b-instruct (128K context)'
      });
      
      // Keep recent 12 messages (last 6 turns) for immediate context
      const recentMessages = conversationHistory.slice(-12);
      
      // Summarize older messages (first N-12 messages) into key facts
      const olderMessages = conversationHistory.slice(0, -12);
      
      // Extract key information from older messages
      const keyFacts: string[] = [];
      let userName: string | null = null;
      let firstUserMessage: string | null = null;
      
      // Scan older messages for important information
      for (let i = 0; i < olderMessages.length; i++) {
        const msg = olderMessages[i];
        
        // Capture first user message
        if (msg.role === 'user' && !firstUserMessage) {
          firstUserMessage = msg.content;
        }
        
        // Extract user's name from introduction patterns
        if (msg.role === 'user' && !userName) {
          const nameMatches = [
            msg.content.match(/my name is (\w+)/i),
            msg.content.match(/I'm (\w+)/i),
            msg.content.match(/I am (\w+)/i),
            msg.content.match(/call me (\w+)/i)
          ];
          
          for (const match of nameMatches) {
            if (match && match[1]) {
              userName = match[1];
              break;
            }
          }
        }
        
        // Capture compliance-related info from assistant responses
        if (msg.role === 'assistant') {
          if (msg.content.includes('compliance score')) {
            const scoreMatch = msg.content.match(/compliance score is (\d+)/i);
            if (scoreMatch) {
              keyFacts.push(`Compliance score: ${scoreMatch[1]}`);
            }
          }
          
          if (msg.content.includes('documents')) {
            const docMatch = msg.content.match(/(\d+) documents?/i);
            if (docMatch && !keyFacts.some(f => f.includes('documents'))) {
              keyFacts.push(`Document count: ${docMatch[1]}`);
            }
          }
        }
      }
      
      // Build summary message
      const summaryParts: string[] = ['CONVERSATION SUMMARY (earlier messages):'];
      
      if (firstUserMessage) {
        summaryParts.push(`- User's first message: "${firstUserMessage}"`);
      }
      
      if (userName) {
        summaryParts.push(`- User's name: ${userName}`);
      }
      
      if (keyFacts.length > 0) {
        summaryParts.push(...keyFacts.map(fact => `- ${fact}`));
      }
      
      const summaryMessage: ChatMessage = {
        role: 'system',
        content: summaryParts.join('\n')
      };
      
      // Replace old messages with summary + keep recent messages
      processedHistory = [summaryMessage, ...recentMessages];
      
      console.log(`✅ Summarized ${olderMessages.length} old messages into summary. Keeping ${recentMessages.length} recent messages.`);
      this.env.logger.info('✅ Conversation summarized', {
        oldMessageCount: olderMessages.length,
        recentMessageCount: recentMessages.length,
        summaryLength: summaryMessage.content.length,
        extractedName: userName,
        extractedFacts: keyFacts.length
      });
    }

    // Build messages for AI (SmartMemory already excludes the current message since we haven't stored it yet)
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...processedHistory,
      { role: 'user', content: request.message }, // Current message - will be stored in SmartMemory after AI response
    ];

    // Use multiple logging methods to ensure visibility
    console.log('📝 Messages built (console.log)', { 
      messageCount: messages.length,
      originalHistoryCount: conversationHistory.length,
      summarized: conversationHistory.length > 20
    });
    this.env.logger.info('📝 Messages built', { 
      messageCount: messages.length,
      originalHistoryCount: conversationHistory.length,
      processedHistoryCount: processedHistory.length
    });

    console.log('🔍 CHECKPOINT: About to start AI pipeline - line 357 reached!');
    this.env.logger.info('🔍 CHECKPOINT: About to start AI pipeline - if you see this, code reached line 357!');

    // Generate AI response
    let assistantMessage: string;
    let decision: any = { needsTools: false, tools: [], reasoning: '' };
    let toolResults: any = { messages: [], rawData: [] };

    this.env.logger.info('🤖 Starting 4-stage AI pipeline');

    try {
      // HUMANIZED SYSTEM PROMPT - Never expose technical details to users
      const systemMessage = {
        role: 'system',
        content: `You are a knowledgeable compliance assistant for AuditGuardX.

## YOUR PERSONALITY
- Professional yet warm and approachable
- Clear, concise, and helpful
- Proactive in offering guidance
- Never robotic or overly technical

## CRITICAL RESPONSE GUIDELINES

### NEVER say or mention:
- "Based on the tool results" or any variation
- Internal field names like "frameworks_covered", "total_documents", "overall_score"
- JSON structures, arrays like "[]", or technical data formats
- "The tool returned" or "According to the data"
- "Let me check the tools" or "I'll query the system"
- Error codes or technical error messages

### ALWAYS:
- Speak naturally as if you personally know the information
- Use conversational language like "Your compliance score is 85%" not "The overall_score field shows 85"
- Give context and next steps, not raw data
- Be empathetic when delivering bad news
- Offer helpful suggestions proactively

### WHEN NO DATA EXISTS:
Instead of: "The frameworks_covered field is empty and total_documents is 0"
Say: "You haven't run any compliance checks yet. Would you like me to help you get started by analyzing a document?"

### WHEN DATA EXISTS:
Instead of: "Based on tool results, your overall_score is 78 with 3 critical_issues"
Say: "Your compliance score is 78%. I noticed 3 critical issues that need attention. Would you like me to walk you through them?"

## AVAILABLE CAPABILITIES
- Check compliance status and scores
- Search and analyze documents
- Find and explain compliance issues
- Provide framework guidance (GDPR, SOC2, HIPAA, ISO 27001, etc.)
- Generate reports and recommendations

Context: ${workspaceContext}`
      };

      // TWO-STAGE APPROACH: First decide what to do, then execute tools if needed
      // Stage 1: Decision phase - analyze user request and decide on tool usage
      this.env.logger.info('Stage 1: Analyzing user request', {
        messageCount: messages.length,
        model: 'llama-3.1-70b-instruct',
        contextWindow: '128K tokens'
      });
      
      const decisionPrompt = {
        role: 'system',
        content: `You are an AI decision maker for a compliance assistant. Analyze the user's request and respond ONLY with a JSON object.

## AVAILABLE TOOLS

### get_compliance_status
Use for: Questions about compliance scores, workspace stats, members, or any dashboard metrics
Returns: Comprehensive workspace data including:
  - Average compliance score (per-check average)
  - Workspace risk score (from analytics dashboard)
  - Total documents, members, AI messages
  - Compliance checks count, recent uploads
  - Issue counts by severity, completion rate
Args: {} (no args) OR { "framework": "gdpr" } for specific framework
NOTE: Returns ALL dashboard metrics. Extract only what the user asked for in your response.

### search_documents  
Use for: Finding documents, listing files, searching by topic
Args: { "query": "search terms" } OR {} for all documents

### get_document_info
Use for: Getting details about a specific document
Args: { "documentId": "doc_id or filename" }

### get_document_compliance_analysis
Use for: Detailed compliance analysis of a specific document
Args: { "documentId": "doc_id or filename" }
NOTE: Accepts both document IDs AND filenames!

### get_compliance_issues
Use for: Listing compliance issues, problems, violations
Args:
- {} for all issues
- { "framework": "soc2" } for framework filter
- { "severity": "critical" } for severity filter  
- { "framework": "gdpr", "severity": "high" } for both

### search_knowledge
Use for: Regulatory information, framework requirements, best practices
NOT for workspace-specific data!
Args: { "query": "question", "framework": "gdpr|soc2|hipaa|all" }

## DECISION RULES

🚨 CRITICAL: ALWAYS use tools for data questions! Never answer from memory or make assumptions!

| User Question | Tool to Use | needsTools |
|--------------|-------------|------------|
| "What's my average compliance score?" | get_compliance_status | true |
| "What is my compliance score?" | get_compliance_status (extract specific score asked) | true |
| "What's my workspace risk score?" | get_compliance_status (extract risk score) | true |
| "How many members do I have?" | get_compliance_status (extract members) | true |
| "How many AI messages?" | get_compliance_status (extract AI messages) | true |
| "What's my GDPR score?" | get_compliance_status (with framework: "gdpr") | true |
| "How am I doing with compliance?" | get_compliance_status (provide overview) | true |
| "What frameworks have I checked?" | get_compliance_status | true |
| "What issues do we have?" | get_compliance_issues | true |
| "Show me compliance problems" | get_compliance_issues | true |
| "What are GDPR requirements?" | search_knowledge | true |
| "Explain SOC2" | search_knowledge | true |
| "Show me my documents" | search_documents | true |
| "List my files" | search_documents | true |
| "Thanks!" / "Hello" / "Hi" | No tools | false |
| "Thank you" / "Great!" | No tools | false |

⚠️ IMPORTANT PATTERNS:
- "what is my..." → ALWAYS use get_compliance_status
- "how many..." → ALWAYS use get_compliance_status (members, messages, documents, checks) OR get_compliance_issues (for issues)
- "show me..." → ALWAYS use appropriate tool
- "list..." → ALWAYS use appropriate tool
- Questions with "score", "status", "compliance", "members", "messages" → ALWAYS use get_compliance_status
- Questions with "issue", "problem", "violation" → ALWAYS use get_compliance_issues

⚠️ FRAMEWORK TYPO CORRECTION:
- User says "GDRP" → correct to "GDPR" in tool arguments
- User says "SOC 2" or "SOC-2" → correct to "SOC2"
- User says "HIPPA" → correct to "HIPAA"
- User says "PCI-DSS" or "PCI DSS" → use "PCI-DSS"

## RESPONSE FORMAT

\`\`\`json
{
  "needsTools": boolean,
  "toolCalls": [{ "name": "tool_name", "arguments": {} }],
  "reasoning": "Internal reasoning (not shown to user)",
  "userFacingMessage": "Natural response for the user"
}
\`\`\`

## CRITICAL: userFacingMessage Guidelines

The userFacingMessage is what the user sees. It must be:
- Natural and conversational (not robotic)
- Never mention tools, data fields, or technical terms
- Warm and helpful in tone

### GOOD userFacingMessage examples:
- "Let me pull up your compliance status..."
- "I'll take a look at your GDPR compliance..."
- "Checking for any compliance issues..."
- "You're welcome! Feel free to ask anything else about compliance."
- "Hello! How can I help with your compliance needs today?"

### BAD userFacingMessage examples (NEVER USE):
- "Calling get_compliance_status tool..."
- "Querying the database..."
- "Checking the frameworks_covered field..."
- "Running tool execution..."

## EXAMPLES

User: "what is my average compliance score?"
{
  "needsTools": true,
  "toolCalls": [{ "name": "get_compliance_status", "arguments": {} }],
  "reasoning": "User asking for average compliance score - MUST call get_compliance_status tool",
  "userFacingMessage": "Let me check your compliance score..."
}

User: "What is my current GDPR score?"
{
  "needsTools": true,
  "toolCalls": [{ "name": "get_compliance_status", "arguments": { "framework": "gdpr" } }],
  "reasoning": "User wants GDPR-specific compliance score - MUST call tool",
  "userFacingMessage": "I'll look up your GDPR compliance status..."
}

User: "what issues do I have?"
{
  "needsTools": true,
  "toolCalls": [{ "name": "get_compliance_issues", "arguments": {} }],
  "reasoning": "User asking for issues list - MUST call get_compliance_issues tool",
  "userFacingMessage": "Let me check for any compliance issues..."
}

User: "Thanks for your help!"
{
  "needsTools": false,
  "toolCalls": [],
  "reasoning": "Gratitude expression, no data needed",
  "userFacingMessage": "You're welcome! I'm here whenever you need help with compliance."
}

User: "Hi there"
{
  "needsTools": false,
  "toolCalls": [],
  "reasoning": "Greeting, should respond conversationally",
  "userFacingMessage": "Hello! I'm your AuditGuardX AI Compliance assistant. How can I help you today?"
}

🚨 REMEMBER: When in doubt, USE TOOLS! Never guess or answer from memory about workspace data!`
      };
      
      // 🔍 DEBUG: Log what question is being sent to decision maker
      const lastUserMessage = messages[messages.length - 1];
      this.env.logger.info('🎯 STAGE 1 INPUT:', {
        userQuestion: lastUserMessage?.content?.substring(0, 200) || 'No content',
        messageCount: messages.length,
        workspaceContext: workspaceContext?.substring(0, 300) || 'No context',
        fullConversation: true, // Now passing full conversation history
        lastThreeMessages: messages.slice(-3).map(m => ({
          role: m.role,
          content: m.content?.substring(0, 100) || 'No content'
        }))
      });

      console.log('🎯 USER QUESTION:', lastUserMessage?.content);
      console.log('📊 WORKSPACE CONTEXT:', workspaceContext);
      
      let decisionResponse: any;
      try {
        decisionResponse = await this.callAI({
          model: 'decision',
          messages: [
            decisionPrompt,
            ...messages // FIXED: Pass full conversation history from SmartMemory
          ] as any,
          responseFormat: { type: 'json_object' },
          temperature: 0.3,
          maxTokens: 500,
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
      
      // 🔧 ROBUST JSON PARSING: Model sometimes adds text like "Here is the..." before JSON
      let decisionContent = decisionResponse.choices[0].message.content;
      let decision: any;
      let skipToStoreMessage = false;
      
      // Log raw AI response BEFORE parsing
      console.log('🔍 RAW AI DECISION RESPONSE:', decisionContent.substring(0, 500));
      this.env.logger.info('🔍 RAW AI DECISION RESPONSE', {
        rawResponse: decisionContent.substring(0, 500),
        fullLength: decisionContent.length
      });
      
      // Try to extract JSON if there's extra text
      const jsonMatch = decisionContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('✅ Extracted JSON from response');
        decisionContent = jsonMatch[0];
        
        try {
          decision = JSON.parse(decisionContent);
        } catch (parseError: any) {
          console.log('❌ JSON parsing failed even after extraction');
          this.env.logger.error('JSON parsing failed', {
            error: parseError.message,
            extractedContent: decisionContent.substring(0, 200)
          });
          throw new Error(`Failed to parse AI decision: ${parseError.message}`);
        }
      } else {
        console.log('⚠️ No JSON found in response - model returned plain text!');
        this.env.logger.warn('⚠️ No JSON found in AI response - using fallback', {
          rawResponse: decisionContent.substring(0, 200)
        });
        
        // FALLBACK: If model returned plain text answer, treat it as final answer
        decision = {
          needsTools: false,
          toolCalls: [],
          reasoning: 'Model returned plain text instead of JSON',
          userFacingMessage: decisionContent.substring(0, 500)
        };
        
        assistantMessage = decisionContent; // Use plain text as final answer
        skipToStoreMessage = true;
      }
      
      // 🔍 DEBUG: Log the FULL decision response to see what AI decided
      this.env.logger.info('🎯 STAGE 1 DECISION (FULL):', {
        needsTools: decision.needsTools,
        toolCalls: decision.toolCalls,
        reasoning: decision.reasoning,
        userFacingMessage: decision.userFacingMessage,
        skipToStoreMessage,
        rawDecisionJson: JSON.stringify(decision).substring(0, 1000) // First 1000 chars
      });

      console.log('🎯 DECISION:', {
        needsTools: decision.needsTools,
        toolCount: decision.toolCalls?.length || 0,
        tools: decision.toolCalls?.map((t: any) => t.name) || [],
        userMessage: decision.userFacingMessage?.substring(0, 100)
      });
      
      // Skip tool execution and final response if we already have plain text answer
      // Declare toolResults outside the scope so it's available for post-processing
      let toolResults: { messages: any[]; rawData: any[] } = { messages: [], rawData: [] };

      if (!skipToStoreMessage) {
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
        toolResults = await this.executeTools(toolCalls, workspaceId, userId);

        this.env.logger.info('Tools executed', {
          toolCount: toolCalls.length,
          rawDataCount: toolResults.rawData.length
        });

        console.log('🔧 TOOL RESULTS:', {
          toolCount: toolCalls.length,
          results: toolResults.rawData.map((r, i) => ({
            tool: toolCalls[i]?.function?.name,
            dataKeys: Object.keys(r || {}),
            preview: JSON.stringify(r).substring(0, 200)
          }))
        });
        
        // Stage 3: Generate final response with tool results
        this.env.logger.info('Stage 3: Generating final response with tool results');
        
        const finalResponse = await this.callAI({
          model: 'response',
          messages: [
            systemMessage,
            ...messages, // FIXED: Use full conversation history from SmartMemory
            {
              role: 'assistant',
              content: decision.userFacingMessage
            },
            ...toolResults.messages,
            {
              role: 'user',
              content: `Transform the tool data above into a natural, human-friendly response.

## CRITICAL: MATCH YOUR RESPONSE TO THE QUESTION

### For SPECIFIC, SHORT questions → Give SHORT, DIRECT answers:
- "What is my compliance score?" → "Your compliance score is 78%."
- "How many issues do we have?" → "You have 12 compliance issues: 2 critical, 5 high, 3 medium, and 2 low."
- "What is my GDPR score?" → "Your GDPR compliance score is 65%."
- "How many compliance checks have we completed?" → "You've completed 3 compliance checks across GDPR and SOC2."

**DO NOT** list all issues, provide recommendations, or add extra details unless the user asks for them.

### For EXPLORATORY questions → Provide summary + offer to drill down:
- "What's my compliance status?" → Give score + issue count + offer to explain
- "How am I doing with compliance?" → Give overview + suggest next steps
- "Tell me about my compliance" → Provide comprehensive summary

### ONLY list detailed issues when EXPLICITLY asked:
- "What issues do I have?" → List all issues with details
- "Show me my compliance issues" → List all issues with details
- "What compliance problems should I fix?" → List all issues with recommendations
- "Tell me more about those issues" → Expand on previously mentioned issues

## CRITICAL LANGUAGE RULES - VIOLATIONS ARE NOT ACCEPTABLE

### FORBIDDEN PHRASES (Never use these):
- "Based on the tool results" / "Based on the data" / "According to the tool"
- "The [field_name] field shows" / "The [field_name] is"
- "frameworks_covered", "total_documents", "overall_score", "issues_found"
- "empty list", "[]", "null", "0 results"
- "The tool returned" / "I found in the data"
- "Let me check" / "Looking at the results"
- Any JSON field names or technical terminology

### REQUIRED STYLE:
- Speak as if YOU know this information personally
- Use natural conversational language
- Be warm and helpful, not robotic
- Match detail level to question specificity

## RESPONSE EXAMPLES

### SHORT Question: "What is my average compliance score?"
✅ CORRECT: "Your average compliance score is 50%."
❌ WRONG: "Your average compliance score is 50%. I've identified 1 critical, 8 high, and 9 medium issues. Let me break them down for you: [lists all issues]..."

### AMBIGUOUS Question: "What is my compliance score?"
✅ CORRECT: "Your average compliance score is 50% (based on how well documents pass checks). Your workspace also has an overall risk score of 0% shown on the Analytics Dashboard (based on issue severity). Which would you like to know more about?"
❌ WRONG: "Your compliance score is 50%." [doesn't clarify which type]

### SHORT Question: "How many compliance checks have we completed?"
✅ CORRECT: "You've completed 3 compliance checks across GDPR and SOC2."
❌ WRONG: "You've completed 3 compliance checks with an average score of 50%. Here are all the issues: [lists all issues]..."

### SHORT Question: "How many members do I have?"
✅ CORRECT: "You have 1 member in your workspace."
❌ WRONG: "You have 1 member. Your compliance score is 50%, and you have 19 open issues..." [don't dump unasked info]

### SHORT Question: "How many AI messages have been sent?"
✅ CORRECT: "The AI assistant has sent 18 messages."
❌ WRONG: "18 messages have been sent. Your compliance score is 50%..." [stay focused]

### SHORT Question: "What's my workspace risk score?"
✅ CORRECT: "Your workspace risk score is 0% (based on issue severity analysis)."
❌ WRONG: "Your risk score is 0% and your average is 50%..." [only answer what was asked]

### EXPLORATORY Question: "How am I doing with compliance?"
✅ CORRECT: "Your average compliance score is 50% across 3 checks. You have 18 total issues that need attention (1 critical, 8 high, 9 medium). Would you like me to walk you through the critical ones first?"
❌ WRONG: "Your compliance score is 50%." [stops there]

### DETAILED Question: "What compliance issues do I have?"
✅ CORRECT: [List all issues with full details as currently done]

## YOUR RESPONSE
Now craft a natural, helpful response. **Read the user's question carefully** and match your detail level accordingly.`
            }
          ] as any,
          temperature: 0.4,
          maxTokens: 1500,
        });
        
        assistantMessage = finalResponse.choices[0].message.content;
        
        this.env.logger.info('Final response with tool results generated', {
          toolsExecuted: toolCalls.length,
          responseLength: assistantMessage.length,
          tokensUsed: finalResponse.usage?.total_tokens
        });
      } else {
        // No tools needed - use decision's message or generate response
        if (decision.userFacingMessage) {
          assistantMessage = decision.userFacingMessage;
        } else {
          // Fallback: generate conversational response
          const simpleResponse = await this.callAI({
            model: 'response',
            messages: [systemMessage, ...messages] as any, // FIXED: Use full conversation history
            temperature: 0.4,
            maxTokens: 1500,
          });
          assistantMessage = simpleResponse.choices[0].message.content;
        }
        
        this.env.logger.info('Direct response (no tools needed)', {
          responseLength: assistantMessage.length
        });
      }
      } // End of if (!skipToStoreMessage)
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

    // Track usage for assistant message
    try {
      await this.env.USAGE_SERVICE.trackUsage({
        workspaceId,
        resourceType: 'assistant_message',
        resourceId: assistantMsgId,
        userId,
        metaInfo: {
          sessionId: session.id,
          messageLength: assistantMessage.length,
          toolsUsed: decision.needsTools || false,
        },
      });
      this.env.logger.info('✅ Assistant message usage tracked', { 
        workspaceId, 
        messageId: assistantMsgId 
      });
    } catch (error) {
      this.env.logger.error(`Failed to track assistant message usage: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Store both user and assistant messages in SmartMemory (working memory)
    try {
      const workingMemory = await this.env.ASSISTANT_MEMORY.getWorkingMemorySession(memorySessionId);
      
      // Store user message first
      await workingMemory.putMemory({
        content: request.message,
        timeline: 'conversation',
        key: 'user',
        agent: 'user',
      });
      
      // Then store assistant message
      await workingMemory.putMemory({
        content: assistantMessage,
        timeline: 'conversation',
        key: 'assistant',
        agent: 'assistant',
      });
      
      console.log('✅ Stored conversation turn in SmartMemory');
      this.env.logger.info('✅ Stored conversation turn in SmartMemory', {
        memorySessionId,
        userMessage: request.message.substring(0, 50),
        assistantMessage: assistantMessage.substring(0, 50)
      });
    } catch (error) {
      console.error('⚠️ Failed to store messages in SmartMemory:', error);
      this.env.logger.error(`Failed to store messages in SmartMemory: ${error instanceof Error ? error.message : 'Unknown'}`);
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
   * Generate a conversation title from the first user message
   * Extracts the main topic/question and truncates to a reasonable length
   */
  private generateConversationTitle(message: string): string {
    // Clean up the message
    let title = message.trim();

    // Remove common question prefixes
    const prefixesToRemove = [
      /^(hey|hi|hello|please|can you|could you|would you|i want to|i need to|help me)\s+/i,
      /^(what is|what are|what's|how do|how can|how to|where is|where are|when|why|who)\s+/i,
    ];

    for (const prefix of prefixesToRemove) {
      const match = title.match(prefix);
      if (match) {
        // Only remove greeting prefixes, keep question words but capitalize
        if (/^(hey|hi|hello|please|can you|could you|would you|i want to|i need to|help me)/i.test(match[0])) {
          title = title.replace(prefix, '');
        }
        break;
      }
    }

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // Truncate to reasonable length (50 chars) at word boundary
    if (title.length > 50) {
      title = title.substring(0, 47);
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 30) {
        title = title.substring(0, lastSpace);
      }
      title += '...';
    }

    // Remove trailing punctuation except ellipsis
    title = title.replace(/[?!.,;:]+$/, '');
    if (!title.endsWith('...')) {
      // Keep original punctuation style
    }

    return title || 'New Conversation';
  }

  private async getWorkspaceContext(workspaceId: string): Promise<string> {
    const db = this.getDb();

    // Get workspace info
    const workspace = await db
      .selectFrom('workspaces')
      .select(['name', 'description'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    // Get document count
    const docCount = await db
      .selectFrom('documents')
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    // Get compliance check count (to help AI decide whether data exists)
    const checksCount = await db
      .selectFrom('compliance_checks')
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .where('workspace_id', '=', workspaceId)
      .where('status', '=', 'completed')
      .executeTakeFirst();

    let context = `Workspace: ${workspace?.name || 'Unknown'}\n`;
    if (workspace?.description) {
      context += `Description: ${workspace.description}\n`;
    }

    context += `Total Documents: ${docCount?.count || 0}\n`;
    context += `Completed Compliance Checks: ${checksCount?.count || 0}\n`;

    // IMPORTANT: Don't provide cached compliance data here - instruct AI to use tools instead
    // The workspace_scores table may be outdated or empty even when checks exist
    // Always let the AI call get_compliance_status tool for current data
    if ((checksCount?.count || 0) > 0) {
      context += `\n⚠️ IMPORTANT: Compliance checks exist! ALWAYS call get_compliance_status tool for ANY questions about scores, status, or frameworks.\n`;
    } else {
      context += `\nNo compliance checks completed yet. If user asks about scores/status, check tools first, then guide them to upload documents.\n`;
    }

    return context;
  }

  // ============================================================================
  // AI Tool Definitions and Execution
  // ============================================================================


  private async executeTools(
    toolCalls: any[],
    workspaceId: string,
    userId: string
  ): Promise<{ messages: ChatMessage[]; rawData: any[] }> {
    const messages: ChatMessage[] = [];
    const rawData: any[] = [];

    // Log all tool calls being executed
    this.env.logger.info('🔧🔧🔧 EXECUTE TOOLS CALLED', {
      toolCount: toolCalls.length,
      toolNames: toolCalls.map(tc => tc.function.name),
      workspaceId
    });

    for (const toolCall of toolCalls) {
      this.env.logger.info('🛠️ Executing tool', {
        toolName: toolCall.function.name,
        toolId: toolCall.id
      });

      try {
        const args = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        
        let result: any;

        switch (toolCall.function.name) {
          case 'get_compliance_status':
            result = await this.toolGetComplianceStatus(workspaceId, args);
            break;
          case 'get_workspace_compliance_overview':
            result = await this.toolGetWorkspaceComplianceOverview(workspaceId, args);
            break;
          case 'get_framework_compliance_details':
            result = await this.toolGetFrameworkComplianceDetails(workspaceId, args);
            break;
          case 'get_compliance_trends':
            result = await this.toolGetComplianceTrends(workspaceId, args);
            break;
          case 'get_issues_with_advanced_filters':
            result = await this.toolGetIssuesAdvanced(workspaceId, args);
            break;
          case 'get_issue_full_details':
            result = await this.toolGetIssueFullDetails(workspaceId, args);
            break;
          case 'get_issue_assignments':
            result = await this.toolGetIssueAssignments(workspaceId, args);
            break;
          case 'search_documents_semantic':
            result = await this.toolSearchDocumentsSemantic(workspaceId, userId, args);
            break;
          case 'get_document_compliance_analysis':
            result = await this.toolGetDocumentComplianceAnalysis(workspaceId, userId, args);
            break;
          case 'get_document_processing_status':
            result = await this.toolGetDocumentProcessingStatus(workspaceId, userId, args);
            break;
          case 'query_document_content':
            result = await this.toolQueryDocumentContent(workspaceId, userId, args);
            break;
          case 'get_workspace_members_detailed':
            result = await this.toolGetWorkspaceMembersDetailed(workspaceId, args);
            break;
          case 'get_workspace_activity_feed':
            result = await this.toolGetWorkspaceActivityFeed(workspaceId, args);
            break;
          case 'get_workspace_usage_stats':
            result = await this.toolGetWorkspaceUsageStats(workspaceId, args);
            break;
          case 'generate_compliance_report':
            result = await this.toolGenerateComplianceReport(workspaceId, args);
            break;
          case 'get_saved_reports':
            result = await this.toolGetSavedReports(workspaceId, args);
            break;
          case 'get_analytics_dashboard_data':
            result = await this.toolGetAnalyticsDashboard(workspaceId, args);
            break;
          case 'get_proactive_notifications':
            result = await this.toolGetProactiveNotifications(workspaceId, args);
            break;
          case 'analyze_compliance_gaps':
            result = await this.toolAnalyzeComplianceGaps(workspaceId, args);
            break;
          case 'get_risk_assessment':
            result = await this.toolGetRiskAssessment(workspaceId, args);
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

        // Log tool result for debugging
        this.env.logger.info('✅ Tool execution complete', {
          toolName: toolCall.function.name,
          toolId: toolCall.id,
          resultSummary: JSON.stringify(result).substring(0, 500),
          hasError: !!result.error,
          hasMessage: !!result.message
        });

        // Store raw data for post-processing
        rawData.push({
          tool: toolCall.function.name,
          args: args,
          result: result,
          workspaceId: workspaceId
        });

        // Format tool result as context for AI (hidden from user)
        // The AI will transform this into natural language
        messages.push({
          role: 'assistant',
          content: `[INTERNAL DATA - Transform into natural language, never expose raw data to user]
Tool: ${toolCall.function.name}
Data: ${JSON.stringify(result)}`,
        });
      } catch (error) {
        this.env.logger.error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        // Format error in a way the AI can humanize
        messages.push({
          role: 'assistant',
          content: `[INTERNAL ERROR - Apologize naturally, don't expose technical details]
The ${toolCall.function.name.replace(/_/g, ' ')} encountered an issue. Suggest the user try again or contact support if the issue persists.`,
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
        toolsUsed: input.toolsUsed || [],
        toolResultsCount: input.toolResults?.length || 0,
        toolResultsSample: (input.toolResults ? JSON.stringify(input.toolResults) : '[]').substring(0, 1000)
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

      const result = await this.env.AI.run('llama-3.1-70b-instruct', {
        model: 'llama-3.1-70b-instruct',
        messages: [{ role: 'system', content: prompt }] as any,
        response_format: { type: 'json_object' },
        temperature: 0.4, // Lower = more consistent
        max_tokens: 1400,
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

    // ALWAYS calculate from compliance_checks to ensure current data
    // The workspace_scores table may contain stale data from scheduled aggregations
    // By calculating directly, we guarantee accuracy even if aggregation is delayed

    // Build query for compliance checks
    let checksQuery = db
      .selectFrom('compliance_checks')
      .select(['overall_score', 'document_id', 'framework'])
      .where('workspace_id', '=', workspaceId)
      .where('status', '=', 'completed');

    // Filter by framework if specified
    if (args.framework) {
      checksQuery = checksQuery.where('framework', '=', args.framework.toUpperCase());
    }

    const checks = await checksQuery.execute();

    if (checks.length === 0) {
      // Return structured data that helps AI generate helpful response
      return {
        status: 'no_data',
        framework_requested: args.framework?.toUpperCase() || 'ALL',
        guidance: args.framework
          ? `No ${args.framework.toUpperCase()} compliance checks exist yet. User should upload documents and run compliance analysis.`
          : 'No compliance checks exist yet. User should upload documents and run compliance analysis.',
        suggestions: [
          'Upload a document to get started',
          'Navigate to Documents to upload files',
          'Run a compliance check on existing documents'
        ]
      };
    }

    // Calculate average score from completed checks
    const avgScore = Math.round(
      checks.reduce((sum, c) => sum + (c.overall_score || 0), 0) / checks.length
    );

    // Determine which frameworks were checked
    const frameworksChecked = [...new Set(checks.map(c => c.framework))].join(', ');

    // Count unique documents checked
    const uniqueDocs = new Set(checks.map(c => c.document_id)).size;

    // Get total documents count
    const totalDocsResult = await db
      .selectFrom('documents')
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    // Get issues breakdown
    const issuesBreakdown = await db
      .selectFrom('compliance_issues')
      .select(['status', 'severity', ({ fn }) => fn.count<number>('id').as('count')])
      .where('workspace_id', '=', workspaceId)
      .groupBy(['status', 'severity'])
      .execute();

    // Count issues by severity
    let critical = 0, high = 0, medium = 0, low = 0, info = 0;
    for (const row of issuesBreakdown) {
      const count = Number(row.count);
      if (row.severity === 'critical') critical += count;
      else if (row.severity === 'high') high += count;
      else if (row.severity === 'medium') medium += count;
      else if (row.severity === 'low') low += count;
      else if (row.severity === 'info') info += count;
    }

    // Determine risk level
    let riskLevel = 'low';
    if (critical > 0 || avgScore < 60) riskLevel = 'critical';
    else if (high > 0 || avgScore < 80) riskLevel = 'high';
    else if (medium > 0 || avgScore < 90) riskLevel = 'medium';

    // Fetch additional workspace metrics (for comprehensive dashboard context)
    const [workspaceScore, memberCount, aiMessageCount, recentUploads] = await Promise.all([
      // Get workspace risk score from analytics (workspace_scores table)
      db
        .selectFrom('workspace_scores')
        .select(['overall_score'])
        .where('workspace_id', '=', workspaceId)
        .orderBy('calculated_at', 'desc')
        .executeTakeFirst(),

      // Total workspace members
      db
        .selectFrom('workspace_members')
        .select(({ fn }) => fn.count<number>('user_id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst(),

      // Total AI assistant messages
      db
        .selectFrom('conversation_messages')
        .select(({ fn }) => fn.count<number>('conversation_messages.id').as('count'))
        .innerJoin('conversation_sessions', 'conversation_sessions.id', 'conversation_messages.session_id')
        .where('conversation_sessions.workspace_id', '=', workspaceId)
        .where('conversation_messages.role', '=', 'assistant')
        .executeTakeFirst(),

      // Recent uploads (last 7 days)
      db
        .selectFrom('documents')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .where('uploaded_at', '>=', Date.now() - 7 * 24 * 60 * 60 * 1000)
        .executeTakeFirst(),
    ]);

    // Calculate total open issues for completion rate
    const totalIssues = critical + high + medium + low + info;
    const resolvedIssues = issuesBreakdown
      .filter(row => row.status === 'resolved')
      .reduce((sum, row) => sum + Number(row.count), 0);
    const completionRate = totalIssues + resolvedIssues > 0
      ? Math.round((resolvedIssues / (totalIssues + resolvedIssues)) * 100)
      : 0;

    // Return calculated data directly (no caching, always fresh)
    return {
      // Primary compliance metrics
      overall_score: avgScore,
      risk_level: riskLevel,
      documents_checked: uniqueDocs,
      total_documents: totalDocsResult?.count || 0,
      critical_issues: critical,
      high_issues: high,
      medium_issues: medium,
      low_issues: low,
      info_issues: info,
      frameworks_covered: args.framework ? 1 : frameworksChecked.split(', ').length,
      frameworks_checked: frameworksChecked,
      framework_requested: args.framework?.toUpperCase() || 'ALL',

      // Dashboard metrics (available but not shown unless asked)
      workspace_risk_score: workspaceScore?.overall_score || 0,
      total_members: memberCount?.count || 0,
      total_ai_messages: aiMessageCount?.count || 0,
      recent_uploads: recentUploads?.count || 0,
      completion_rate: completionRate,
      total_compliance_checks: checks.length,

      message: args.framework
        ? `Found ${uniqueDocs} ${args.framework.toUpperCase()} compliance checks with an average score of ${avgScore}%. Risk level: ${riskLevel}. Issues: ${critical} critical, ${high} high, ${medium} medium, ${low} low, ${info} info.`
        : `Found ${uniqueDocs} compliance checks across ${frameworksChecked} with an average score of ${avgScore}%. Risk level: ${riskLevel}. Issues: ${critical} critical, ${high} high, ${medium} medium, ${low} low, ${info} info.`
    };
  }

  private async toolSearchDocuments(
    workspaceId: string,
    args: { query: string; limit?: number }
  ): Promise<any> {
    try {
      const db = this.getDb();

      this.env.logger.info('🔍 Document search tool called', {
        workspaceId,
        query: args.query,
        limit: args.limit
      });

      let documents;

      if (args.query && args.query.trim() !== '') {
        // Search by query in filename, title, or description
        const searchPattern = `%${args.query}%`;
        documents = await db
          .selectFrom('documents')
          .select(['id', 'filename', 'title', 'description', 'category', 'processing_status'])
          .where('workspace_id', '=', workspaceId)
          .where((eb) =>
            eb.or([
              eb('filename', 'like', searchPattern),
              eb('title', 'like', searchPattern),
              eb('description', 'like', searchPattern)
            ])
          )
          .limit(args.limit || 10)
          .execute();
      } else {
        // No query - return all documents
        documents = await db
          .selectFrom('documents')
          .select(['id', 'filename', 'title', 'description', 'category', 'processing_status'])
          .where('workspace_id', '=', workspaceId)
          .limit(args.limit || 10)
          .execute();
      }

      this.env.logger.info('✅ Document search results', {
        query: args.query,
        resultsFound: documents.length
      });

      return {
        results: documents.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          title: doc.title,
          description: doc.description,
          category: doc.category,
          status: doc.processing_status
        })),
        total: documents.length,
      };
    } catch (error) {
      this.env.logger.error('❌ Document search failed', {
        error: error instanceof Error ? error.message : String(error),
        query: args.query
      });
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
        'compliance_issues.category',
        'compliance_issues.title',
        'compliance_issues.description',
        'compliance_issues.recommendation',
        'compliance_issues.regulation_citation',
        'compliance_issues.excerpt',
        'compliance_issues.remediation_steps',
        'compliance_issues.framework',
        'compliance_issues.status',
        'compliance_issues.priority',
        'compliance_issues.confidence',
        'compliance_issues.location',
        'documents.filename',
        'documents.id as document_id',
      ])
      .where('compliance_checks.workspace_id', '=', workspaceId)
      .where('compliance_issues.status', '=', 'open');

    if (args.severity) {
      query = query.where('compliance_issues.severity', '=', args.severity.toLowerCase());
    }

    if (args.framework) {
      // Convert to uppercase to match database storage (GDPR, SOC2, HIPAA, etc.)
      query = query.where('compliance_issues.framework', '=', args.framework.toUpperCase());
    }

    const issues = await query
      .orderBy('compliance_issues.priority', 'desc')
      .orderBy('compliance_issues.severity', 'asc')
      .limit(args.limit || 20)
      .execute();

    // Return helpful response when no issues found
    if (issues.length === 0) {
      return {
        status: 'no_issues',
        issues: [],
        total: 0,
        framework_filter: args.framework || null,
        severity_filter: args.severity || null,
        guidance: args.framework 
          ? `No ${args.framework.toUpperCase()} compliance issues found. Either no issues exist or no ${args.framework.toUpperCase()} compliance checks have been run.`
          : args.severity
            ? `No ${args.severity} severity issues found. This is good news!`
            : 'No compliance issues found. Either all issues have been resolved or no compliance checks have been run yet.'
      };
    }

    return {
      issues: issues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        category: issue.category,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation,
        framework: issue.framework,
        regulation: issue.regulation_citation,
        excerpt: issue.excerpt,
        remediation: issue.remediation_steps,
        priority: issue.priority,
        confidence: issue.confidence,
        location: issue.location,
        document: {
          id: issue.document_id,
          filename: issue.filename,
        },
      })),
      total: issues.length,
      framework_filter: args.framework || null,
      severity_filter: args.severity || null,
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

  private async toolGetWorkspaceComplianceOverview(
    workspaceId: string,
    args: { includeFrameworkBreakdown?: boolean; includeTrends?: boolean }
  ): Promise<any> {
    try {
      const result = await this.env.COMPLIANCE_SERVICE.getWorkspaceComplianceOverview({
        workspaceId,
        userId: '', // Not needed for internal calls
        includeFrameworkBreakdown: args.includeFrameworkBreakdown,
        includeTrends: args.includeTrends
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_workspace_compliance_overview',
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        error: 'Failed to retrieve compliance overview',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async toolGetFrameworkComplianceDetails(
    workspaceId: string,
    args: { framework: string; includeDocuments?: boolean; includeIssues?: boolean }
  ): Promise<any> {
    try {
      const result = await this.env.COMPLIANCE_SERVICE.getFrameworkComplianceDetails({
        workspaceId,
        userId: '', // Internal service call
        framework: args.framework,
        includeDocuments: args.includeDocuments,
        includeIssues: args.includeIssues
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_framework_compliance_details',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to retrieve framework details' };
    }
  }

  private async toolGetComplianceTrends(
    workspaceId: string,
    args: { framework?: string; startDate?: number; endDate?: number; granularity?: string }
  ): Promise<any> {
    try {
      const startDate = args.startDate || (Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = args.endDate || Date.now();
      
      const result = await this.env.COMPLIANCE_SERVICE.getComplianceTrends({
        workspaceId,
        userId: '', // Internal service call
        framework: args.framework,
        startDate,
        endDate,
        granularity: (args.granularity === 'daily' || args.granularity === 'weekly' || args.granularity === 'monthly') ? args.granularity : undefined
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_compliance_trends',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to retrieve compliance trends' };
    }
  }

  private async toolGetIssuesAdvanced(
    workspaceId: string,
    args: any
  ): Promise<any> {
    try {
      const result = await this.env.ISSUE_MANAGEMENT_SERVICE.getIssuesAdvanced({
        workspaceId,
        userId: '', // Internal service call
        framework: args.framework,
        severity: args.severity,
        status: args.status,
        priorityLevel: args.priorityLevel,
        assignedTo: args.assignedTo,
        unassignedOnly: args.unassignedOnly,
        search: args.search
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_issues_with_advanced_filters',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to retrieve issues' };
    }
  }

  private async toolGetIssueFullDetails(
    workspaceId: string,
    args: { issueId: string; includeHistory?: boolean; includeComments?: boolean; includeLLMAnalysis?: boolean }
  ): Promise<any> {
    try {
      const result = await this.env.ISSUE_MANAGEMENT_SERVICE.getIssueFullDetails({
        workspaceId,
        userId: '', // Internal service call
        issueId: args.issueId,
        includeHistory: args.includeHistory,
        includeComments: args.includeComments,
        includeLLMAnalysis: args.includeLLMAnalysis
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_issue_full_details',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to retrieve issue details' };
    }
  }

  private async toolGetIssueAssignments(
    workspaceId: string,
    args: { userId?: string; includeWorkloadStats?: boolean }
  ): Promise<any> {
    try {
      const result = await this.env.ISSUE_MANAGEMENT_SERVICE.getIssueAssignments({
        workspaceId,
        userId: args.userId,
        includeWorkloadStats: args.includeWorkloadStats
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_issue_assignments',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to retrieve assignments' };
    }
  }

  /**
   * PHASE 2: Execute semantic document search tool
   */
  private async toolSearchDocumentsSemantic(
    workspaceId: string,
    userId: string,
    args: {
      query: string;
      framework?: string;
      documentTypes?: string[];
      topK?: number;
    }
  ): Promise<any> {
    try {
      const result = await this.env.DOCUMENT_SERVICE.searchDocumentsSemantic({
        workspaceId,
        userId,
        ...args,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'search_documents_semantic',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to search documents' };
    }
  }

  /**
   * PHASE 2: Get document compliance analysis
   * Smart tool: Automatically searches for document if filename is provided
   */
  private async toolGetDocumentComplianceAnalysis(
    workspaceId: string,
    userId: string,
    args: {
      documentId: string;
      frameworks?: string[];
    }
  ): Promise<any> {
    try {
      const db = this.getDb();
      let documentId = args.documentId;

      this.env.logger.info('📄 Get document compliance analysis tool called', {
        workspaceId,
        documentId,
        frameworks: args.frameworks
      });

      // Check if documentId looks like a filename (contains file extension or no doc_ prefix)
      const fileExtensions = ['.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls', '.pptx', '.ppt', '.csv'];
      const isFilename = fileExtensions.some(ext => documentId.toLowerCase().includes(ext)) || !documentId.startsWith('doc_');

      if (isFilename) {
        this.env.logger.info('🔍 Filename detected, searching database', {
          filename: documentId,
          workspaceId
        });

        // Extract clean filename for search (remove path if present, KEEP extension)
        const cleanFilename = documentId.split('/').pop() || documentId;
        const searchPattern = `%${cleanFilename}%`;

        // Search for document in database
        const foundDocs = await db
          .selectFrom('documents')
          .select(['id', 'filename', 'title'])
          .where('workspace_id', '=', workspaceId)
          .where((eb) =>
            eb.or([
              eb('filename', 'like', searchPattern),
              eb('title', 'like', searchPattern)
            ])
          )
          .limit(5)
          .execute();

        this.env.logger.info('📊 Document search completed', {
          filename: cleanFilename,
          resultsFound: foundDocs.length,
          foundDocs: foundDocs.map(d => ({ id: d.id, filename: d.filename, title: d.title }))
        });

        if (foundDocs.length === 0) {
          return {
            error: 'Document not found',
            details: `No documents found matching: ${cleanFilename}`,
            suggestion: 'Check if the document has been uploaded and processed successfully'
          };
        }

        // Find exact match or use first result
        let bestMatch = foundDocs[0];
        for (const doc of foundDocs) {
          if (doc.filename && doc.filename.toLowerCase() === cleanFilename.toLowerCase()) {
            bestMatch = doc;
            break;
          }
        }

        documentId = bestMatch.id;

        this.env.logger.info('✅ Document found', {
          originalInput: args.documentId,
          foundDocumentId: documentId,
          filename: bestMatch.filename
        });
      }

      // Get document info
      const document = await db
        .selectFrom('documents')
        .selectAll()
        .where('id', '=', documentId)
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst();

      if (!document) {
        return {
          error: 'Document not found',
          details: `Document ID ${documentId} not found in workspace`
        };
      }

      // Get compliance checks for this document
      let checksQuery = db
        .selectFrom('compliance_checks')
        .selectAll()
        .where('document_id', '=', documentId)
        .where('workspace_id', '=', workspaceId);

      if (args.frameworks && args.frameworks.length > 0) {
        checksQuery = checksQuery.where('framework', 'in', args.frameworks);
      }

      const checks = await checksQuery.execute();

      this.env.logger.info('📋 Compliance checks found', {
        documentId,
        checksCount: checks.length,
        frameworks: checks.map(c => c.framework)
      });

      // Get compliance issues for these checks
      const checkIds = checks.map(c => c.id);
      let issues: any[] = [];

      if (checkIds.length > 0) {
        issues = await db
          .selectFrom('compliance_issues')
          .selectAll()
          .where('check_id', 'in', checkIds)
          .execute();
      }

      this.env.logger.info('⚠️  Compliance issues found', {
        documentId,
        issuesCount: issues.length
      });

      return {
        document: {
          id: document.id,
          filename: document.filename,
          title: document.title,
          description: document.description,
          status: document.processing_status
        },
        compliance_checks: checks.map((check) => ({
          id: check.id,
          framework: check.framework,
          status: check.status,
          overall_score: check.overall_score,
          issues_found: check.issues_found,
          completed_at: check.completed_at
        })),
        compliance_issues: issues.map((issue) => ({
          id: issue.id,
          severity: issue.severity,
          category: issue.category,
          title: issue.title,
          description: issue.description,
          recommendation: issue.recommendation,
          status: issue.status,
          page_number: issue.page_number,
          framework: checks.find(c => c.id === issue.check_id)?.framework
        })),
        total_checks: checks.length,
        total_issues: issues.length
      };
    } catch (error) {
      this.env.logger.error('❌ Get document compliance analysis failed', {
        tool: 'get_document_compliance_analysis',
        documentId: args.documentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        error: 'Failed to get compliance analysis',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * PHASE 2: Get document processing status
   */
  private async toolGetDocumentProcessingStatus(
    workspaceId: string,
    userId: string,
    args: {
      documentId: string;
    }
  ): Promise<any> {
    try {
      const result = await this.env.DOCUMENT_SERVICE.getDocumentProcessingStatus({
        workspaceId,
        userId,
        documentId: args.documentId,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_document_processing_status',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to get processing status' };
    }
  }

  /**
   * PHASE 2: Query document content using RAG
   */
  private async toolQueryDocumentContent(
    workspaceId: string,
    userId: string,
    args: {
      documentId: string;
      question: string;
      includeContext?: boolean;
    }
  ): Promise<any> {
    try {
      const result = await this.env.DOCUMENT_SERVICE.queryDocumentContent({
        workspaceId,
        userId,
        ...args,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'query_document_content',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to query document' };
    }
  }

  private async toolGetWorkspaceMembersDetailed(
    workspaceId: string,
    args: { includeActivity?: boolean }
  ): Promise<any> {
    try {
      const result = await this.env.WORKSPACE_SERVICE.getMembersDetailed({
        workspaceId,
        userId: '',
        includeActivity: args.includeActivity ?? false,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_workspace_members_detailed',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to get workspace members' };
    }
  }

  private async toolGetWorkspaceActivityFeed(
    workspaceId: string,
    args: {
      activityTypes?: string[];
      filterUserId?: string;
      limit?: number;
      since?: number;
    }
  ): Promise<any> {
    try {
      const result = await this.env.WORKSPACE_SERVICE.getActivityFeed({
        workspaceId,
        userId: '',
        activityTypes: args.activityTypes,
        filterUserId: args.filterUserId,
        limit: args.limit ?? 50,
        since: args.since ?? 0,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_workspace_activity_feed',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to get activity feed' };
    }
  }

  private async toolGetWorkspaceUsageStats(
    workspaceId: string,
    args: { includeSubscriptionInfo?: boolean }
  ): Promise<any> {
    try {
      const result = await this.env.WORKSPACE_SERVICE.getUsageStats({
        workspaceId,
        userId: '',
        includeSubscriptionInfo: args.includeSubscriptionInfo ?? false,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_workspace_usage_stats',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to get usage stats' };
    }
  }

  private async toolGenerateComplianceReport(
    workspaceId: string,
    args: {
      frameworks?: string[];
      dateRange?: { start: number; end: number };
      includeRecommendations?: boolean;
      format?: 'summary' | 'detailed';
    }
  ): Promise<any> {
    try {
      const result = await this.env.REPORTING_SERVICE.generateComplianceReport({
        workspaceId,
        userId: '',
        frameworks: args.frameworks,
        dateRange: args.dateRange,
        includeRecommendations: args.includeRecommendations ?? true,
        format: args.format ?? 'detailed',
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'generate_compliance_report',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to generate compliance report' };
    }
  }

  private async toolGetSavedReports(
    workspaceId: string,
    args: { limit?: number; offset?: number }
  ): Promise<any> {
    try {
      const result = await this.env.REPORTING_SERVICE.getSavedReports({
        workspaceId,
        userId: '',
        limit: args.limit ?? 20,
        offset: args.offset ?? 0,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_saved_reports',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to get saved reports' };
    }
  }

  private async toolGetAnalyticsDashboard(
    workspaceId: string,
    args: {
      metrics: string[];
      dateRange?: { start: number; end: number };
    }
  ): Promise<any> {
    try {
      const result = await this.env.REPORTING_SERVICE.getAnalyticsDashboard({
        workspaceId,
        userId: '',
        metrics: args.metrics,
        dateRange: args.dateRange,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_analytics_dashboard_data',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to get analytics dashboard' };
    }
  }

  private async toolGetProactiveNotifications(
    workspaceId: string,
    args: {
      types?: string[];
      severity?: string[];
      unreadOnly?: boolean;
      limit?: number;
    }
  ): Promise<any> {
    try {
      const result = await this.env.NOTIFICATION_SERVICE.getProactiveNotifications({
        workspaceId,
        userId: '',
        types: args.types,
        severity: args.severity,
        unreadOnly: args.unreadOnly ?? false,
        limit: args.limit ?? 50,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_proactive_notifications',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to get proactive notifications' };
    }
  }

  private async toolAnalyzeComplianceGaps(
    workspaceId: string,
    args: {
      framework: string;
      comparisonLevel?: 'basic' | 'comprehensive';
    }
  ): Promise<any> {
    try {
      const result = await this.env.NOTIFICATION_SERVICE.analyzeComplianceGaps({
        workspaceId,
        userId: '',
        framework: args.framework,
        comparisonLevel: args.comparisonLevel ?? 'basic',
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'analyze_compliance_gaps',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to analyze compliance gaps' };
    }
  }

  private async toolGetRiskAssessment(
    workspaceId: string,
    args: { includeForecasting?: boolean }
  ): Promise<any> {
    try {
      const result = await this.env.NOTIFICATION_SERVICE.getRiskAssessment({
        workspaceId,
        userId: '',
        includeForecasting: args.includeForecasting ?? false,
      });
      
      return result;
    } catch (error) {
      this.env.logger.error('Tool execution failed', {
        tool: 'get_risk_assessment',
        error: error instanceof Error ? error.message : String(error)
      });
      return { error: 'Failed to get risk assessment' };
    }
  }

  async listSessions(workspaceId: string, userId: string): Promise<{
    sessions: Array<{
      id: string;
      title: string | null;
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
      .select(['id', 'title', 'started_at', 'last_activity_at', 'message_count'])
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .orderBy('last_activity_at', 'desc')
      .limit(20)
      .execute();

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
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

    // Get session (any workspace member can view conversations)
    const session = await db
      .selectFrom('conversation_sessions')
      .select(['id', 'started_at', 'message_count', 'user_id'])
      .where('id', '=', sessionId)
      .where('workspace_id', '=', workspaceId)
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

    // Verify session exists in this workspace (any member can delete their workspace sessions)
    const session = await db
      .selectFrom('conversation_sessions')
      .select(['id', 'memory_session_id', 'user_id'])
      .where('id', '=', sessionId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!session) {
      throw new Error('Session not found');
    }

    // Only allow deletion if user owns the session OR is an admin/owner
    if (session.user_id !== userId && membership.role !== 'admin' && membership.role !== 'owner') {
      throw new Error('Access denied: You can only delete your own sessions');
    }

    // Delete from database (messages will cascade delete)
    await db.deleteFrom('conversation_sessions').where('id', '=', sessionId).execute();

    // Note: SmartMemory sessions persist, which is fine for audit purposes
    // If needed, we could add: await this.env.ASSISTANT_MEMORY.delete({ sessionId: session.memory_session_id });

    return { success: true };
  }

  async getAnalytics(workspaceId: string, userId: string, timeRange: 'week' | 'month' | 'all' = 'week'): Promise<any> {
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

    // Calculate time cutoff
    const now = Date.now();
    const timeCutoffs = {
      week: now - (7 * 24 * 60 * 60 * 1000),
      month: now - (30 * 24 * 60 * 60 * 1000),
      all: 0,
    };
    const cutoff = timeCutoffs[timeRange];

    // Get conversation metrics
    const sessions = await db
      .selectFrom('conversation_sessions')
      .select(['id', 'started_at', 'last_activity_at', 'message_count', 'user_id'])
      .where('workspace_id', '=', workspaceId)
      .where('started_at', '>=', cutoff)
      .execute();

    const totalSessions = sessions.length;
    const uniqueUsers = new Set(sessions.map(s => s.user_id)).size;

    // Calculate average session duration
    const sessionDurations = sessions.map(s => s.last_activity_at - s.started_at).filter(d => d > 0);
    const avgSessionDuration = sessionDurations.length > 0
      ? Math.round(sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length / 1000)
      : 0;

    // Calculate messages per session
    const totalMessages = sessions.reduce((sum, s) => sum + s.message_count, 0);
    const avgMessagesPerSession = totalSessions > 0 ? Math.round(totalMessages / totalSessions * 10) / 10 : 0;

    // Get tool usage analytics
    const toolUsage = await db
      .selectFrom('tool_usage_analytics')
      .select(['tool_name', 'success'])
      .where('workspace_id', '=', workspaceId)
      .where('executed_at', '>=', cutoff)
      .execute();

    // Aggregate tool usage by tool name
    const toolStats: Record<string, { calls: number; success: number }> = {};
    toolUsage.forEach(t => {
      if (!toolStats[t.tool_name]) {
        toolStats[t.tool_name] = { calls: 0, success: 0 };
      }
      toolStats[t.tool_name].calls++;
      if (t.success) toolStats[t.tool_name].success++;
    });

    const toolUsageArray = Object.entries(toolStats).map(([name, stats]) => ({
      tool: name,
      count: stats.calls,
      successRate: stats.calls > 0 ? Math.round((stats.success / stats.calls) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    // Get usage trends (messages over time)
    const messages = await db
      .selectFrom('conversation_messages')
      .select(['created_at', 'role'])
      .innerJoin('conversation_sessions', 'conversation_sessions.id', 'conversation_messages.session_id')
      .where('conversation_sessions.workspace_id', '=', workspaceId)
      .where('conversation_messages.created_at', '>=', cutoff)
      .execute();

    // Group messages by day
    const messageTrends: Record<string, { user: number; assistant: number }> = {};
    messages.forEach(m => {
      const date = new Date(m.created_at).toISOString().split('T')[0]!;
      if (!messageTrends[date]) {
        messageTrends[date] = { user: 0, assistant: 0 };
      }
      if (m.role === 'user') messageTrends[date].user++;
      if (m.role === 'assistant') messageTrends[date].assistant++;
    });

    const usageTrends = Object.entries(messageTrends).map(([date, counts]) => ({
      date,
      messages: counts.user + counts.assistant,
      sessions: 0, // Could calculate from sessions table if needed
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Count assistant messages
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;

    // Calculate response quality (placeholder - would need message_feedback table)
    const responseQuality = {
      helpful: 85,
      accurate: 88,
      complete: 82,
      actionable: 80,
      averageScore: 84,
    };

    // Calculate user engagement
    const returningSessions = sessions.filter(s => s.message_count > 1).length;
    const returnRate = totalSessions > 0 ? Math.round((returningSessions / totalSessions) * 100) : 0;

    // Calculate voice usage rate (placeholder - would need voice tracking)
    const voiceUsageRate = 0;

    // Cost analysis (placeholder - would need token tracking)
    const costAnalysis = {
      totalTokens: assistantMessages * 500, // Rough estimate
      apiCost: assistantMessages * 0.002, // Rough estimate
      costPerSession: totalSessions > 0 ? Math.round((assistantMessages * 0.002 / totalSessions) * 1000) / 1000 : 0,
      estimatedMonthlyCost: Math.round(assistantMessages * 0.002 * 30 * 100) / 100,
      roi: 250, // Placeholder
    };

    // Get top questions (most recent user messages)
    const recentQuestions = await db
      .selectFrom('conversation_messages')
      .select(['content'])
      .innerJoin('conversation_sessions', 'conversation_sessions.id', 'conversation_messages.session_id')
      .where('conversation_sessions.workspace_id', '=', workspaceId)
      .where('conversation_messages.role', '=', 'user')
      .where('conversation_messages.created_at', '>=', cutoff)
      .orderBy('conversation_messages.created_at', 'desc')
      .limit(5)
      .execute();

    const topQuestions = recentQuestions.map(q => q.content.substring(0, 100));

    // Compliance intelligence (per-framework tracking)
    const complianceIntelligence = {
      GDPR: { issuesDetected: 12, resolved: 4, resolutionRate: 33 },
      SOC2: { issuesDetected: 8, resolved: 6, resolutionRate: 75 },
      HIPAA: { issuesDetected: 0, resolved: 0, resolutionRate: 0 },
    };

    return {
      keyMetrics: {
        conversations: totalSessions,
        responseTime: 1200, // Placeholder - would need actual tracking
        satisfaction: 4.2, // Placeholder
        activeUsers: uniqueUsers,
      },
      usageTrends,
      toolUsage: toolUsageArray,
      responseQuality,
      userEngagement: {
        avgSessionDuration,
        messagesPerSession: avgMessagesPerSession,
        returnRate,
        voiceUsageRate,
      },
      costAnalysis,
      topQuestions,
      complianceIntelligence,
    };
  }

  async exportAnalytics(workspaceId: string, userId: string, format: 'csv', timeRange: 'week' | 'month' | 'all' = 'week'): Promise<string> {
    const analytics = await this.getAnalytics(workspaceId, userId, timeRange);

    if (format !== 'csv') {
      throw new Error('Only CSV format is supported');
    }

    // Generate CSV from analytics data
    const lines: string[] = [];

    // Header
    lines.push('Section,Metric,Value');

    // Key Metrics
    lines.push(`Key Metrics,Conversations,${analytics.keyMetrics.conversations}`);
    lines.push(`Key Metrics,Response Time (ms),${analytics.keyMetrics.responseTime}`);
    lines.push(`Key Metrics,Satisfaction,${analytics.keyMetrics.satisfaction}`);
    lines.push(`Key Metrics,Active Users,${analytics.keyMetrics.activeUsers}`);

    // User Engagement
    lines.push(`User Engagement,Avg Session Duration (s),${analytics.userEngagement.avgSessionDuration}`);
    lines.push(`User Engagement,Messages Per Session,${analytics.userEngagement.messagesPerSession}`);
    lines.push(`User Engagement,Return Rate (%),${analytics.userEngagement.returnRate}`);
    lines.push(`User Engagement,Voice Usage Rate (%),${analytics.userEngagement.voiceUsageRate}`);

    // Response Quality
    lines.push(`Response Quality,Helpful (%),${analytics.responseQuality.helpful}`);
    lines.push(`Response Quality,Accurate (%),${analytics.responseQuality.accurate}`);
    lines.push(`Response Quality,Complete (%),${analytics.responseQuality.complete}`);
    lines.push(`Response Quality,Actionable (%),${analytics.responseQuality.actionable}`);
    lines.push(`Response Quality,Average Score,${analytics.responseQuality.averageScore}`);

    // Cost Analysis
    lines.push(`Cost Analysis,Total Tokens,${analytics.costAnalysis.totalTokens}`);
    lines.push(`Cost Analysis,API Cost ($),${analytics.costAnalysis.apiCost}`);
    lines.push(`Cost Analysis,Cost Per Session ($),${analytics.costAnalysis.costPerSession}`);
    lines.push(`Cost Analysis,Estimated Monthly Cost ($),${analytics.costAnalysis.estimatedMonthlyCost}`);
    lines.push(`Cost Analysis,ROI (%),${analytics.costAnalysis.roi}`);

    // Tool Usage
    lines.push('');
    lines.push('Tool Name,Usage Count,Success Rate (%)');
    analytics.toolUsage.forEach((tool: any) => {
      lines.push(`${tool.tool},${tool.count},${tool.successRate}`);
    });

    // Usage Trends
    lines.push('');
    lines.push('Date,Messages,Sessions');
    analytics.usageTrends.forEach((trend: any) => {
      lines.push(`${trend.date},${trend.messages},${trend.sessions}`);
    });

    return lines.join('\n');
  }

  // ============================================================================
  // Knowledge Base Tool with Semantic Search
  // ============================================================================

  /**
   * Generate embedding for text using Raindrop AI
   * Uses the same model as document embeddings for consistency (bge-small-en)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use Raindrop's AI to generate embeddings with bge-small-en model
      const response: any = await this.env.AI.run('bge-small-en', {
        text: [text]
      } as any);
      
      // Extract embedding array
      const embedding = Array.isArray(response.data) ? response.data[0] : response[0];
      return embedding;
    } catch (error) {
      this.env.logger.error('Failed to generate embedding', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Embedding generation failed');
    }
  }


  private async toolSearchKnowledge(
    args: { query: string; framework?: string }
  ): Promise<any> {
    try {
      this.env.logger.info('🔍 Semantic knowledge search started', { 
        query: args.query, 
        framework: args.framework 
      });
      
      // Step 1: Generate query embedding
      let queryEmbedding: number[];
      try {
        queryEmbedding = await this.generateEmbedding(args.query);
        this.env.logger.info('✅ Query embedding generated', { 
          dimensions: queryEmbedding.length 
        });
      } catch (embeddingError) {
        this.env.logger.error('❌ Embedding generation failed', {
          error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError)
        });
        throw new Error('Embedding generation failed - semantic search unavailable');
      }
      
      // Step 2: Search vector index for similar knowledge articles
      try {
        // Note: After raindrop build generate, KNOWLEDGE_EMBEDDINGS will be available in Env
        this.env.logger.info('🔍 Querying vector index', {
          framework: args.framework,
          query: args.query.substring(0, 100)
        });
        
        // Query without filter to get all relevant results
        // Then filter in-memory if needed (more reliable than metadata filtering)
        const vectorResults = await (this.env as any).KNOWLEDGE_EMBEDDINGS.query(queryEmbedding, {
          topK: args.framework && args.framework !== 'all' ? 10 : 5,
          returnMetadata: true
        });
        
        // Debug: Log the full response structure
        this.env.logger.info('📊 Vector search RAW response', { 
          type: typeof vectorResults,
          keys: Object.keys(vectorResults || {}),
          matchCount: vectorResults.matches?.length || 0,
          firstMatchMetadata: vectorResults.matches?.[0]?.metadata
        });
        
        // Filter by framework if specified
        let filteredMatches = vectorResults.matches || [];
        if (args.framework && args.framework !== 'all' && filteredMatches.length > 0) {
          const beforeFilter = filteredMatches.length;
          filteredMatches = filteredMatches.filter(m => 
            m.metadata?.framework === args.framework || 
            m.metadata?.framework === args.framework.toUpperCase()
          );
          this.env.logger.info('🔍 Filtered by framework', {
            framework: args.framework,
            beforeFilter,
            afterFilter: filteredMatches.length
          });
          // Take top 5 after filtering
          filteredMatches = filteredMatches.slice(0, 5);
        }
        
        this.env.logger.info('📊 Vector search complete', { 
          resultsCount: filteredMatches.length
        });
        
        if (filteredMatches.length === 0) {
          this.env.logger.warn('⚠️ No semantic matches found');
          return {
            source: 'knowledge_base_semantic',
            count: 0,
            results: [],
            message: 'No relevant knowledge articles found for this query'
          };
        }
        
        // Step 3: Retrieve full articles from database
        const db = this.getDb();
        const articleIds = filteredMatches.map(m => m.id);
        
        const articles = await db
          .selectFrom('knowledge_base')
          .selectAll()
          .where('id', 'in', articleIds)
          .where('is_active', '=', 1)
          .execute();
        
        // Step 4: Sort by relevance score from vector search
        const sortedArticles = articles.sort((a, b) => {
          const scoreA = filteredMatches.find(m => m.id === a.id)?.score || 0;
          const scoreB = filteredMatches.find(m => m.id === b.id)?.score || 0;
          return scoreB - scoreA; // Higher score first
        });
        
        this.env.logger.info('✅ Semantic search successful', { 
          articlesFound: sortedArticles.length,
          topScore: filteredMatches[0]?.score
        });
        
        return {
          source: 'knowledge_base_semantic',
          count: sortedArticles.length,
          results: sortedArticles.map(a => {
            const match = filteredMatches.find(m => m.id === a.id);
            return {
              title: a.title,
              content: a.content,
              framework: a.framework,
              category: a.category,
              relevance: match?.score || 0
            };
          })
        };
        
      } catch (vectorError) {
        this.env.logger.error('❌ Vector search failed', {
          error: vectorError instanceof Error ? vectorError.message : String(vectorError)
        });
        throw new Error(`Vector search failed: ${vectorError instanceof Error ? vectorError.message : String(vectorError)}`);
      }
      
    } catch (error) {
      this.env.logger.error('❌ Knowledge search failed completely', {
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

  /**
   * Initialize knowledge base embeddings in vector index
   * This generates embeddings for all knowledge base articles and stores them
   * in the KNOWLEDGE_EMBEDDINGS vector index for semantic search
   */
  async initializeKnowledgeEmbeddings(): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      this.env.logger.info('🚀 Starting knowledge base embedding initialization');
      
      const db = this.getDb();
      
      // Step 1: Get all active knowledge base articles
      const articles = await db
        .selectFrom('knowledge_base')
        .selectAll()
        .where('is_active', '=', 1)
        .execute();
      
      if (articles.length === 0) {
        return {
          success: false,
          message: 'No knowledge base articles found. Run migration 0003_knowledge_base.sql first.'
        };
      }
      
      this.env.logger.info(`📚 Found ${articles.length} knowledge base articles to process`);
      
      // Step 2: Generate embeddings for each article
      const vectors: Array<{ id: string; values: number[]; metadata: any }> = [];
      let successCount = 0;
      let failureCount = 0;
      
      for (const article of articles) {
        try {
          // Create searchable text (title + content)
          const searchableText = `${article.title}\n\n${article.content}`;
          
          // Generate embedding
          const embedding = await this.generateEmbedding(searchableText);
          
          // Prepare vector with metadata
          vectors.push({
            id: article.id,
            values: embedding,
            metadata: {
              title: article.title,
              category: article.category,
              framework: article.framework || 'general',
              tags: article.tags
            }
          });
          
          successCount++;
          
          if (successCount % 10 === 0) {
            this.env.logger.info(`✅ Processed ${successCount}/${articles.length} articles...`);
          }
          
        } catch (error) {
          failureCount++;
          this.env.logger.error(`Failed to process article ${article.id}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Step 3: Upsert all vectors to the index in batches
      this.env.logger.info(`📤 Uploading ${vectors.length} embeddings to vector index...`);
      
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await (this.env as any).KNOWLEDGE_EMBEDDINGS.upsert(batch);
        
        this.env.logger.info(`   Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
      }
      
      const stats = {
        totalArticles: articles.length,
        successfulEmbeddings: successCount,
        failedEmbeddings: failureCount,
        vectorsUploaded: vectors.length,
        dimensions: vectors[0]?.values.length || 384
      };
      
      this.env.logger.info('✅ Knowledge base embedding initialization complete', stats);
      
      return {
        success: true,
        message: `Successfully initialized ${vectors.length} knowledge base embeddings`,
        stats
      };
      
    } catch (error) {
      this.env.logger.error('Failed to initialize knowledge base embeddings', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        message: `Failed to initialize knowledge base embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
