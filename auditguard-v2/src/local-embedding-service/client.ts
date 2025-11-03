/**
 * Local Embedding Service Client
 * TypeScript client for the Python sentence-transformers service
 */

export interface LocalEmbeddingRequest {
  texts: string[];
  batch_size?: number;
  normalize?: boolean;
}

export interface LocalEmbeddingResponse {
  embeddings: number[][];
  dimensions: number;
  count: number;
  latency_ms: number;
}

export interface HealthResponse {
  status: string;
  model: string;
  dimensions: number;
  ready: boolean;
  metrics: {
    total_requests: number;
    total_embeddings: number;
    total_errors: number;
    avg_latency_ms: number;
  };
}

export interface MetricsResponse {
  total_requests: number;
  total_embeddings: number;
  total_errors: number;
  avg_latency_ms: number;
  model_loaded: boolean;
  model_name: string;
  dimensions: number;
}

export class LocalEmbeddingClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  /**
   * Generate embeddings for multiple texts
   * @param texts Array of text strings to embed
   * @param batchSize Number of texts to process at once (default: 32)
   * @param normalize Whether to normalize embeddings (default: true)
   * @returns 384-dimensional embeddings
   */
  async generateEmbeddings(
    texts: string[],
    batchSize: number = 32,
    normalize: boolean = true
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const request: LocalEmbeddingRequest = {
      texts,
      batch_size: batchSize,
      normalize,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Embedding service error (${response.status}): ${errorText}`
        );
      }

      const data = await response.json() as LocalEmbeddingResponse;

      // Validate response
      if (!Array.isArray(data.embeddings)) {
        throw new Error('Invalid response: embeddings is not an array');
      }

      if (data.count !== texts.length) {
        throw new Error(
          `Expected ${texts.length} embeddings, got ${data.count}`
        );
      }

      if (data.dimensions !== 384) {
        throw new Error(`Expected 384 dimensions, got ${data.dimensions}`);
      }

      // Validate each embedding
      for (let i = 0; i < data.embeddings.length; i++) {
        const embedding = data.embeddings[i];
        if (!Array.isArray(embedding) || embedding.length !== 384) {
          throw new Error(
            `Invalid embedding at index ${i}: expected 384 dimensions, got ${embedding?.length}`
          );
        }
      }

      return data.embeddings;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Embedding service timeout after ${this.timeout}ms`
        );
      }
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   * @param text Text string to embed
   * @returns 384-dimensional embedding
   */
  async generateSingleEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/embed/single?text=${encodeURIComponent(text)}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { embedding: number[]; dimensions: number; text_length: number };

      if (!Array.isArray(data.embedding) || data.embedding.length !== 384) {
        throw new Error('Invalid embedding response');
      }

      return data.embedding;
    } catch (error) {
      throw new Error(
        `Failed to generate single embedding: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Check if the service is healthy and ready
   * @returns true if healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as HealthResponse;
      return data.ready && data.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Get detailed health information
   * @returns Health response with metrics
   */
  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json() as HealthResponse;
  }

  /**
   * Get service metrics
   * @returns Service metrics
   */
  async getMetrics(): Promise<MetricsResponse> {
    const response = await fetch(`${this.baseUrl}/metrics`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json() as MetricsResponse;
  }

  /**
   * Test the connection to the service
   * @returns Connection test results
   */
  async testConnection(): Promise<{
    connected: boolean;
    latency_ms?: number;
    healthy?: boolean;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const healthy = await this.healthCheck();
      const latency = Date.now() - startTime;

      return {
        connected: true,
        latency_ms: latency,
        healthy,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
