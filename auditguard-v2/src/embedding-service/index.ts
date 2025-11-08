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
  chunkId: string;          // Database chunk ID
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
  chunkId: string;
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
   * PHASE 2 MIGRATION: Now uses Raindrop AI (bge-small-en) with 50-vector batch limit
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
    chunkIds: string[],
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

    this.env.logger.info('Starting embedding generation with Raindrop AI', {
      documentId,
      workspaceId,
      totalChunks: chunks.length,
      batchSize: fullConfig.batchSize,
      hasAI: !!this.env.AI,
      hasVectorIndex: !!this.env.DOCUMENT_EMBEDDINGS,
      model: 'bge-small-en',
      vectorBatchLimit: 50,
    });

    if (chunks.length !== chunkIds.length) {
      throw new Error('Chunks and chunk IDs length mismatch');
    }

    const results: EmbeddingResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // PHASE 2: Process in embedding batches first, then vector storage batches
    // Raindrop Vector Index has 50-vector limit per upsert
    const VECTOR_BATCH_SIZE = 50;

    // Process chunks in batches for embedding generation
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
      throughput: `${(chunks.length / (duration / 1000)).toFixed(2)} chunks/sec`,
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
   * PHASE 2: Implements 50-vector batch limit for Raindrop Vector Index
   */
  private async processBatch(
    documentId: string,
    workspaceId: string,
    chunks: Chunk[],
    chunkIds: string[],
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
    // PHASE 2: Split into 50-vector batches for Vector Index upsert limit
    const VECTOR_BATCH_SIZE = 50;
    const results: EmbeddingResult[] = [];

    for (let batchStart = 0; batchStart < chunks.length; batchStart += VECTOR_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + VECTOR_BATCH_SIZE, chunks.length);
      const vectorBatch: Array<{ id: string; values: number[]; metadata: any }> = [];

      // Prepare batch of vectors
      for (let i = batchStart; i < batchEnd; i++) {
        const chunk = chunks[i];
        const chunkId = chunkIds[i];
        const embedding = embeddings[i];
        const chunkIndex = startIndex + i;

        const vectorId = `${documentId}_chunk_${chunkIndex}`;

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

        vectorBatch.push({
          id: vectorId,
          values: embedding,
          metadata: metadata as any,
        });
      }

      try {
        // Store batch in Vector Index (max 50 vectors)
        await this.env.DOCUMENT_EMBEDDINGS.upsert(vectorBatch);

        this.env.logger.info('Vector batch stored successfully', {
          documentId,
          batchSize: vectorBatch.length,
          startIndex: startIndex + batchStart,
          endIndex: startIndex + batchEnd - 1,
        });

        // Update database for each chunk in the batch
        for (let i = batchStart; i < batchEnd; i++) {
          const chunk = chunks[i];
          const chunkId = chunkIds[i];
          const embedding = embeddings[i];
          const chunkIndex = startIndex + i;
          const vectorId = `${documentId}_chunk_${chunkIndex}`;

          try {
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

          } catch (dbError) {
            this.env.logger.error('Failed to store chunk in database', {
              documentId,
              chunkId,
              chunkIndex,
              error: dbError instanceof Error ? dbError.message : String(dbError),
            });

            results.push({
              chunkId,
              vectorId,
              embedding: [],
              success: false,
              error: dbError instanceof Error ? dbError.message : 'Database storage failed',
            });
          }
        }

      } catch (error) {
        this.env.logger.error('Failed to store vector batch', {
          documentId,
          batchSize: vectorBatch.length,
          error: error instanceof Error ? error.message : String(error),
        });

        // Mark all chunks in failed vector batch as failed
        for (let i = batchStart; i < batchEnd; i++) {
          results.push({
            chunkId: chunkIds[i],
            vectorId: '',
            embedding: [],
            success: false,
            error: error instanceof Error ? error.message : 'Vector storage failed',
          });
        }
      }
    }

    return results;
  }

  /**
   * Generate embeddings using Raindrop AI (bge-small-en, 384-dim)
   * PHASE 2 MIGRATION: Replaces external Python service with Raindrop native
   * CRITICAL: Must use { text: [] } format, NOT { input: [] }
   */
  private async generateEmbeddings(
    texts: string[],
    config: EmbeddingConfig
  ): Promise<number[][]> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        this.env.logger.info('Generating embeddings via Raindrop AI', {
          textCount: texts.length,
          attempt,
          maxRetries: config.maxRetries,
          model: 'bge-small-en',
          dimensions: 384,
        });

        // ⚠️ CRITICAL: Use { text: [] } format, NOT { input: [] }
        // Cloudflare AI requires this specific format
        // Phase 1 testing confirmed this requirement
        // ⚠️ CRITICAL: Use 'bge-small-en' NOT '@cf/baai/bge-small-en-v1.5'
        // Raindrop AI uses short model names, not Cloudflare's @cf/ paths
        const response = await this.env.AI.run('bge-small-en', {
          text: texts  // ✅ CORRECT format
        });

        // Extract embeddings from response
        const data = response as { data?: number[][] } | number[][];
        const embeddings = Array.isArray(data) ? data : (data.data || []);

        // Validate response
        if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
          throw new Error(
            `Expected ${texts.length} embeddings, got ${embeddings.length}`
          );
        }

        // Validate dimensions (should be 384 for bge-small-en)
        for (let i = 0; i < embeddings.length; i++) {
          if (!Array.isArray(embeddings[i]) || embeddings[i].length !== 384) {
            throw new Error(
              `Invalid embedding at index ${i}: expected 384 dimensions, got ${embeddings[i]?.length}`
            );
          }
        }

        this.env.logger.info('Embeddings generated successfully via Raindrop AI', {
          count: embeddings.length,
          dimensions: embeddings[0]?.length,
          model: 'bge-small-en',
          attempt,
        });

        return embeddings;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.env.logger.error('Raindrop AI embedding generation failed', {
          attempt,
          maxRetries: config.maxRetries,
          error: lastError.message,
          errorStack: lastError.stack,
          willRetry: attempt < config.maxRetries,
          model: 'bge-small-en',
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
   * Store embedding in database (as BLOB)
   * PHASE 2: Simplified - Vector Index already stores embeddings
   */
  private async storeInDatabase(
    chunkId: string,
    embedding: number[],
    vectorId: string
  ): Promise<void> {
    try {
      // PHASE 2.2: Store only metadata in D1, actual embedding is in Vector Index
      // Update chunk with vector_id and status using Raindrop D1 API
      await (this.env.AUDITGUARD_DB as any).prepare(
        `UPDATE document_chunks
         SET vector_id = ?,
             embedding_status = 'completed',
             updated_at = ?
         WHERE id = ?`
      ).bind(vectorId, Date.now(), chunkId).run();

      this.env.logger.info('Embedding metadata stored in database', {
        chunkId,
        vectorId,
        embeddingDimensions: embedding.length,
      });

    } catch (error) {
      this.env.logger.error('Failed to store embedding in database', {
        chunkId,
        vectorId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Query vector index for similar chunks
   * PHASE 2: Adds retry logic for indexing delays (3-5 seconds)
   * @param queryText Text to search for
   * @param topK Number of results to return
   * @param workspaceId Optional workspace filter
   * @param frameworkId Optional framework filter
   * @param retryForIndexing If true, will retry query to account for indexing delay
   */
  async querySimilarChunks(
    queryText: string,
    topK: number = 10,
    workspaceId?: string,
    frameworkId?: number,
    retryForIndexing: boolean = false
  ): Promise<Array<{ id: string; score: number; metadata: VectorMetadata }>> {
    try {
      // Generate embedding for query text using Raindrop AI
      const queryEmbedding = await this.generateEmbeddings([queryText], this.DEFAULT_CONFIG);

      // PHASE 2: Retry logic for indexing delays
      let results: any;
      let attempts = retryForIndexing ? 3 : 1;
      let delay = 2000; // Start with 2 seconds

      for (let attempt = 1; attempt <= attempts; attempt++) {
        // Query vector index
        results = await this.env.DOCUMENT_EMBEDDINGS.query(
          queryEmbedding[0],
          {
            topK: topK * 2, // Get more results for filtering
            returnMetadata: 'all',
          }
        );

        // If we got results or this is the last attempt, break
        if (results.matches && results.matches.length > 0) {
          break;
        }

        // Wait before retry (indexing delay)
        if (attempt < attempts) {
          this.env.logger.info('No results found, retrying after indexing delay', {
            queryText: queryText.substring(0, 100),
            attempt,
            maxAttempts: attempts,
            delay,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          delay += 1000; // Increase delay for next retry
        }
      }

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

      // Limit to requested topK after filtering
      const limitedMatches = filteredMatches.slice(0, topK);

      return limitedMatches.map((match: any) => ({
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
   * Get embedding generation progress for a document (DATABASE TRACKING)
   * PHASE 2: Now the single source of truth (no external PostgreSQL)
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

  /**
   * Verify if document is indexed in SmartBucket and ready for search
   * Returns true if document chunks are available via documentChat
   */
  async verifySmartBucketIndexing(documentId: string, workspaceId: string): Promise<{
    isIndexed: boolean;
    chunkCount: number;
    error?: string;
  }> {
    try {
      // Get document's SmartBucket key from database
      const docResult = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT extracted_text_key FROM documents WHERE id = ?`
      ).bind(documentId).first();

      if (!docResult?.extracted_text_key) {
        return {
          isIndexed: false,
          chunkCount: 0,
          error: 'No SmartBucket key found',
        };
      }

      const smartBucketKey = docResult.extracted_text_key;

      // Try to query SmartBucket document chunks
      try {
        const response = await this.env.DOCUMENTS_BUCKET.documentChat({
          key: smartBucketKey,
          message: 'test',
          n_chunks: 1,
        });

        // If we get a response, SmartBucket has indexed it
        this.env.logger.info('SmartBucket verification successful', {
          documentId,
          smartBucketKey,
          isIndexed: true,
        });

        // Get chunk count from database (more reliable than parsing response)
        const chunkCountResult = await (this.env.AUDITGUARD_DB as any).prepare(
          `SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ?`
        ).bind(documentId).first();

        return {
          isIndexed: true,
          chunkCount: chunkCountResult?.count || 0,
        };

      } catch (chatError) {
        // SmartBucket not ready yet
        this.env.logger.info('SmartBucket not indexed yet', {
          documentId,
          smartBucketKey,
          error: chatError instanceof Error ? chatError.message : String(chatError),
        });

        return {
          isIndexed: false,
          chunkCount: 0,
          error: chatError instanceof Error ? chatError.message : 'SmartBucket not ready',
        };
      }

    } catch (error) {
      this.env.logger.error('Failed to verify SmartBucket indexing', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isIndexed: false,
        chunkCount: 0,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }
}
