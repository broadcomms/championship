/**
 * Cerebras Fast Inference API Client
 * 
 * OpenAI-compatible client for ultra-low latency AI inference
 * Supports both streaming and non-streaming chat completions
 */

export interface CerebrasConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface CerebrasMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface CerebrasResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class CerebrasClient {
  private apiKey: string;
  private baseUrl = 'https://api.cerebras.ai/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Non-streaming chat completion
   * @param config - Configuration for the chat completion request
   * @returns Promise resolving to the complete response
   */
  async chatCompletion(config: {
    model: string;
    messages: CerebrasMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
  }): Promise<CerebrasResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.max_tokens ?? 1000,
        ...(config.response_format && { response_format: config.response_format })
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cerebras API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<CerebrasResponse>;
  }

  /**
   * Streaming chat completion
   * @param config - Configuration for the streaming chat completion request
   * @returns Promise resolving to a ReadableStream of SSE events
   */
  async chatCompletionStream(config: {
    model: string;
    messages: CerebrasMessage[];
    temperature?: number;
    max_tokens?: number;
  }): Promise<ReadableStream> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.max_tokens ?? 1000,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cerebras API error: ${response.status} - ${error}`);
    }

    return response.body!;
  }

  /**
   * Parse SSE stream from Cerebras
   * Format: "data: {json}\n\n"
   * 
   * @param stream - ReadableStream from Cerebras API
   * @yields Parsed JSON chunks from the stream
   */
  async *parseStream(stream: ReadableStream): AsyncGenerator<any> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              yield parsed;
            } catch (e) {
              // Skip malformed JSON
              console.warn('Failed to parse SSE chunk:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
