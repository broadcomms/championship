/**
 * Cerebras Fast Inference API Client - STUB VERSION FOR TESTING
 * 
 * This is a minimal stub to test if the issue is with the actual API calls
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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * STUB: Always throws to trigger fallback to Raindrop AI
   */
  async chatCompletion(config: {
    model: string;
    messages: CerebrasMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
  }): Promise<CerebrasResponse> {
    throw new Error('Cerebras stub - always falls back to Raindrop AI');
  }
}
