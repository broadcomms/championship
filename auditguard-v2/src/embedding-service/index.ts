/**
 * Embedding Service
 * Generates vector embeddings using local sentence-transformers service (all-MiniLM-L6-v2)
 * Calls Python FastAPI service via Cloudflare Tunnel
 * Supports batch processing, error handling, and progress tracking
 */

import type { Chunk } from '../chunking-service';

export interface EmbeddingConfig {
  batchSize: number;        // Number of chunks to process at once (default: 20)
  maxRetries: number;       // Maximum retry attempts (default: 3)
  retryDelayMs: number;     // Delay between retries (default: 1000)
  model?: string;           // Embedding model (default: Raindrop default)
}

export interface EmbeddingResult {
  chunkId: number;          // Database chunk ID
  vectorId: string;         // Vector index ID
  embedding: number[];      // 384-dimensional vector (all-MiniLM-L6-v2)
  success: boolean;
  error?: string;
}

export interface BatchEmbeddingResult {
  documentId: string;
  totalChunks: number;
  successCount: number;
  failureCount: number;
  results: EmbeddingResult[];
  duration: number;         // Processing time in ms
}

export interface VectorMetadata {
  documentId: string;
  chunkId: number;
  chunkIndex: number;
  workspaceId: string;
  frameworkId?: number;
  text: string;             // Store chunk text for retrieval
  hasHeader: boolean;
  sectionTitle?: string;
  tokenCount: number;
}

export class EmbeddingService {
  private env: any;
  private readonly DEFAULT_CONFIG: EmbeddingConfig = {
    batchSize: 20,
    maxRetries: 3,
    retryDelayMs: 1000,
  };

  constructor(env: any) {
    this.env = env;
  }

  /**
   * Generate embeddings for document chunks and store in Vector Index
   * @param documentId Document ID
   * @param workspaceId Workspace ID
   * @param chunks Chunks from chunking service
   * @param chunkIds Database IDs for the chunks
   * @param frameworkId Optional compliance framework ID
   * @param config Optional embedding configuration
   */
  async generateAndStoreEmbeddings(
    documentId: string,
    workspaceId: string,
    chunks: Chunk[],
    chunkIds: number[],
    frameworkId?: number,
    config: Partial<EmbeddingConfig> = {}
  ): Promise<BatchEmbeddingResult> {
    this.env.logger.info('generateAndStoreEmbeddings called', {
      documentId,
      workspaceId,
      chunkCount: chunks.length,
      chunkIdCount: chunkIds.length,
    });

    const fullConfig: EmbeddingConfig = { ...this.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();

    this.env.logger.info('Starting embedding generation with config', {
      documentId,
      workspaceId,
      totalChunks: chunks.length,
      batchSize: fullConfig.batchSize,
      hasAI: !!this.env.AI,
      hasVectorIndex: !!this.env.DOCUMENT_EMBEDDINGS,
    });

    if (chunks.length !== chunkIds.length) {
      throw new Error('Chunks and chunk IDs length mismatch');
    }

    const results: EmbeddingResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += fullConfig.batchSize) {
      const batchChunks = chunks.slice(i, i + fullConfig.batchSize);
      const batchIds = chunkIds.slice(i, i + fullConfig.batchSize);

      this.env.logger.info('Processing batch', {
        documentId,
        batchNumber: Math.floor(i / fullConfig.batchSize) + 1,
        batchSize: batchChunks.length,
        startIndex: i,
      });

      try {
        const batchResults = await this.processBatch(
          documentId,
          workspaceId,
          batchChunks,
          batchIds,
          i,
          frameworkId,
          fullConfig
        );

        results.push(...batchResults);
        successCount += batchResults.filter(r => r.success).length;
        failureCount += batchResults.filter(r => !r.success).length;

      } catch (error) {
        this.env.logger.error('Batch processing failed', {
          documentId,
          batchStartIndex: i,
          error: error instanceof Error ? error.message : String(error),
        });

        // Mark all chunks in failed batch
        for (let j = 0; j < batchChunks.length; j++) {
          results.push({
            chunkId: batchIds[j],
            vectorId: '',
            embedding: [],
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          failureCount++;
        }
      }
    }

    const duration = Date.now() - startTime;

    this.env.logger.info('Embedding generation complete', {
      documentId,
      totalChunks: chunks.length,
      successCount,
      failureCount,
      duration,
    });

    return {
      documentId,
      totalChunks: chunks.length,
      successCount,
      failureCount,
      results,
      duration,
    };
  }

  /**
   * Process a batch of chunks: generate embeddings and store in vector index
   */
  private async processBatch(
    documentId: string,
    workspaceId: string,
    chunks: Chunk[],
    chunkIds: number[],
    startIndex: number,
    frameworkId: number | undefined,
    config: EmbeddingConfig
  ): Promise<EmbeddingResult[]> {
    // Step 1: Generate embeddings using Raindrop AI
    const embeddings = await this.generateEmbeddings(
      chunks.map(c => c.text),
      config
    );

    // Step 2: Store embeddings in Vector Index + Database
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = chunkIds[i];
      const embedding = embeddings[i];
      const chunkIndex = startIndex + i;

      try {
        // Generate vector ID
        const vectorId = `${documentId}_chunk_${chunkIndex}`;

        // Prepare metadata
        const metadata: VectorMetadata = {
          documentId,
          chunkId,
          chunkIndex,
          workspaceId,
          frameworkId,
          text: chunk.text,
          hasHeader: chunk.metadata.hasHeader,
          sectionTitle: chunk.metadata.sectionTitle,
          tokenCount: chunk.metadata.tokenCount,
        };

        // Store in Vector Index
        await this.storeInVectorIndex(vectorId, embedding, metadata);

        // Store embedding in database
        await this.storeInDatabase(chunkId, embedding, vectorId);

        results.push({
          chunkId,
          vectorId,
          embedding,
          success: true,
        });

        this.env.logger.info('Chunk embedding stored', {
          documentId,
          chunkId,
          chunkIndex,
          vectorId,
        });

      } catch (error) {
        this.env.logger.error('Failed to store chunk embedding', {
          documentId,
          chunkId,
          chunkIndex: startIndex + i,
          error: error instanceof Error ? error.message : String(error),
        });

        results.push({
          chunkId,
          vectorId: '',
          embedding: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Generate embeddings using local Python service (384-dim)
   * Model: all-MiniLM-L6-v2 via FastAPI + Cloudflare Tunnel
   */
  private async generateEmbeddings(
    texts: string[],
    config: EmbeddingConfig
  ): Promise<number[][]> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const serviceUrl = this.env.LOCAL_EMBEDDING_SERVICE_URL || 'http://localhost:8080';

        this.env.logger.info('Generating embeddings via Python service', {
          textCount: texts.length,
          attempt,
          maxRetries: config.maxRetries,
          serviceUrl,
          model: 'all-MiniLM-L6-v2',
        });

        // Call Python embedding service
        const response = await fetch(`${serviceUrl}/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            texts: texts,
            batch_size: Math.min(texts.length, 32),
            normalize: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Embedding service error (${response.status}): ${errorText}`);
        }

        const data = await response.json() as {
          embeddings: number[][];
          dimensions: number;
          count: number;
          latency_ms: number;
        };

        // Validate response
        if (!data || !Array.isArray(data.embeddings)) {
          throw new Error('Invalid response from embedding service: missing embeddings array');
        }

        if (data.embeddings.length !== texts.length) {
          throw new Error(`Expected ${texts.length} embeddings, got ${data.embeddings.length}`);
        }

        // Validate dimensions (should be 384)
        const embeddings: number[][] = data.embeddings;
        for (let i = 0; i < embeddings.length; i++) {
          if (!Array.isArray(embeddings[i]) || embeddings[i].length !== 384) {
            throw new Error(`Invalid embedding at index ${i}: expected 384 dimensions, got ${embeddings[i]?.length}`);
          }
        }

        this.env.logger.info('Embeddings generated successfully via Python service', {
          count: embeddings.length,
          dimensions: embeddings[0]?.length,
          latency_ms: data.latency_ms,
          attempt,
        });

        return embeddings;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.env.logger.error('Embedding generation failed', {
          attempt,
          maxRetries: config.maxRetries,
          error: lastError.message,
          errorStack: lastError.stack,
          willRetry: attempt < config.maxRetries,
          model: 'Transformers.js',
        });

        if (attempt < config.maxRetries) {
          // Exponential backoff
          const delay = config.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Embedding generation failed after retries');
  }

  /**
   * Store embedding in Vector Index
   */
  private async storeInVectorIndex(
    vectorId: string,
    embedding: number[],
    metadata: VectorMetadata
  ): Promise<void> {
    try {
      // VectorIndex.upsert expects an array of vectors with 'values' property
      await this.env.DOCUMENT_EMBEDDINGS.upsert([{
        id: vectorId,
        values: embedding,
        metadata: metadata as any,
      }]);

      this.env.logger.info('Vector stored in index', {
        vectorId,
        documentId: metadata.documentId,
        chunkIndex: metadata.chunkIndex,
      });

    } catch (error) {
      this.env.logger.error('Failed to store vector in index', {
        vectorId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store embedding in database (as BLOB)
   */
  private async storeInDatabase(
    chunkId: number,
    embedding: number[],
    vectorId: string
  ): Promise<void> {
    try {
      // Convert embedding array to binary format for storage
      const embeddingBuffer = new Float32Array(embedding);
      const embeddingBlob = Buffer.from(embeddingBuffer.buffer);

      // Update chunk with embedding data using Raindrop D1 API
      await (this.env.AUDITGUARD_DB as any).prepare(
        `UPDATE document_chunks
         SET vector_embedding = ?,
             vector_id = ?,
             embedding_status = 'completed'
         WHERE id = ?`
      ).bind(embeddingBlob, vectorId, chunkId).run();

      this.env.logger.info('Embedding stored in database', {
        chunkId,
        vectorId,
        embeddingSize: embeddingBlob.length,
      });

    } catch (error) {
      this.env.logger.error('Failed to store embedding in database', {
        chunkId,
        vectorId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Query vector index for similar chunks
   * @param queryText Text to search for
   * @param topK Number of results to return
   * @param workspaceId Optional workspace filter
   * @param frameworkId Optional framework filter
   */
  async querySimilarChunks(
    queryText: string,
    topK: number = 10,
    workspaceId?: string,
    frameworkId?: number
  ): Promise<Array<{ id: string; score: number; metadata: VectorMetadata }>> {
    try {
      // Generate embedding for query text
      const queryEmbedding = await this.generateEmbeddings([queryText], this.DEFAULT_CONFIG);

      // Build metadata filter
      const filter: any = {};
      if (workspaceId) {
        filter.workspaceId = workspaceId;
      }
      if (frameworkId) {
        filter.frameworkId = frameworkId;
      }

      // Query vector index - query() expects vector as first param, options as second
      const results = await this.env.DOCUMENT_EMBEDDINGS.query(
        queryEmbedding[0],
        {
          topK,
          returnMetadata: 'all',
          // Note: Raindrop VectorIndex uses namespace filtering, not direct metadata filtering
          // You may need to adjust filtering strategy based on your use case
        }
      );

      this.env.logger.info('Vector search completed', {
        queryText: queryText.substring(0, 100),
        topK,
        resultsCount: results.matches?.length || 0,
        workspaceId,
        frameworkId,
      });

      // Filter by workspaceId and frameworkId in application layer
      const filteredMatches = (results.matches || []).filter((match: any) => {
        const meta = match.metadata || {};
        if (workspaceId && meta.workspaceId !== workspaceId) return false;
        if (frameworkId && meta.frameworkId !== frameworkId) return false;
        return true;
      });

      return filteredMatches.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata as VectorMetadata,
      }));

    } catch (error) {
      this.env.logger.error('Vector search failed', {
        queryText: queryText.substring(0, 100),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete embeddings for a document from vector index
   */
  async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    try {
      // Get all chunk IDs from database for this document
      const chunks = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT vector_id FROM document_chunks WHERE document_id = ? AND vector_id IS NOT NULL`
      ).bind(documentId).all();

      const vectorIds = chunks.results?.map((c: any) => c.vector_id).filter(Boolean) || [];

      if (vectorIds.length === 0) {
        this.env.logger.info('No vectors to delete for document', { documentId });
        return;
      }

      // Delete vectors by IDs
      await this.env.DOCUMENT_EMBEDDINGS.deleteByIds(vectorIds);

      this.env.logger.info('Document embeddings deleted', {
        documentId,
        deletedCount: vectorIds.length,
      });

    } catch (error) {
      this.env.logger.error('Failed to delete document embeddings', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get embedding generation progress for a document
   */
  async getEmbeddingProgress(documentId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
    percentage: number;
  }> {
    try {
      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN embedding_status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN embedding_status = 'pending' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN embedding_status = 'failed' THEN 1 ELSE 0 END) as failed
         FROM document_chunks
         WHERE document_id = ?`
      ).bind(documentId).all();

      const stats = result.results[0] || { total: 0, completed: 0, pending: 0, failed: 0 };
      const percentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

      return {
        total: stats.total,
        completed: stats.completed,
        pending: stats.pending,
        failed: stats.failed,
        percentage: Math.round(percentage),
      };

    } catch (error) {
      this.env.logger.error('Failed to get embedding progress', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
