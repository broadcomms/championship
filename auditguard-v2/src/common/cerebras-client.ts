/**
 * Cerebras Fast Inference API Client
 * 
 * Simplified OpenAI-compatible client for ultra-low latency AI inference
 * Non-streaming only for maximum compatibility with Cloudflare Workers
 */

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
   * Non-streaming chat completion (only supported mode)
   * @param config - Configuration for the chat completion request
   * @returns Promise resolving to the complete response
   */
  async chatCompletion(config: {
    model: string;
    messages: CerebrasMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
    timeout?: number; // Timeout in milliseconds (default: 60000ms = 60s)
  }): Promise<CerebrasResponse> {
    const timeoutMs = config.timeout ?? 60000; // Default 60 second timeout

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
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
        }),
        signal: controller.signal // Add abort signal for timeout
      });

      clearTimeout(timeoutId); // Clear timeout if request completes

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cerebras API error: ${response.status} - ${error}`);
      }

      return response.json() as Promise<CerebrasResponse>;
    } catch (error) {
      clearTimeout(timeoutId); // Always clear timeout

      // Check if error is due to abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Cerebras API timeout after ${timeoutMs}ms`);
      }

      throw error; // Re-throw other errors
    }
  }
}
