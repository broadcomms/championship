/**
 * Optimized Embedding Service - Phase 6
 * Integrates caching and monitoring for improved performance
 * Implements parallel processing and adaptive batch sizing
 */

import { EmbeddingService, EmbeddingConfig, BatchEmbeddingResult } from './index';
import { CacheService } from '../cache-service';
import { PerformanceMonitoringService } from '../performance-monitoring-service';
import type { Chunk } from '../chunking-service';

export interface OptimizedEmbeddingConfig extends EmbeddingConfig {
  useCache?: boolean;               // Enable caching (default: true)
  enableMonitoring?: boolean;       // Enable performance monitoring (default: true)
  parallelBatches?: number;         // Number of parallel batches (default: 2)
  adaptiveBatchSize?: boolean;      // Dynamically adjust batch size (default: true)
  minBatchSize?: number;            // Minimum batch size (default: 10)
  maxBatchSize?: number;            // Maximum batch size (default: 50)
}

export class OptimizedEmbeddingService {
  private baseService: EmbeddingService;
  private cacheService: CacheService;
  private monitoringService: PerformanceMonitoringService;
  private env: any;

  private readonly DEFAULT_CONFIG: OptimizedEmbeddingConfig = {
    batchSize: 30,                  // Optimized default (up from 20)
    maxRetries: 3,
    retryDelayMs: 1000,
    useCache: true,
    enableMonitoring: true,
    parallelBatches: 2,             // Process 2 batches in parallel
    adaptiveBatchSize: true,
    minBatchSize: 10,
    maxBatchSize: 50,
  };

  private performanceHistory: number[] = [];

  constructor(env: any) {
    this.env = env;
    this.baseService = new EmbeddingService(env);
    this.cacheService = new CacheService(env);
    this.monitoringService = new PerformanceMonitoringService(env);
  }

  /**
   * Generate embeddings with caching and monitoring
   */
  async generateAndStoreEmbeddings(
    documentId: string,
    workspaceId: string,
    chunks: Chunk[],
    chunkIds: string[],
    frameworkId?: number,
    config: Partial<OptimizedEmbeddingConfig> = {}
  ): Promise<BatchEmbeddingResult> {
    const fullConfig: OptimizedEmbeddingConfig = { ...this.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();

    this.env.logger.info('Starting optimized embedding generation', {
      documentId,
      workspaceId,
      totalChunks: chunks.length,
      batchSize: fullConfig.batchSize,
      cacheEnabled: fullConfig.useCache,
      parallelBatches: fullConfig.parallelBatches,
    });

    // Start performance monitoring
    const endMetric = fullConfig.enableMonitoring
      ? this.monitoringService.startMetric('embedding_batch_optimized', {
          documentId,
          workspaceId,
          totalChunks: chunks.length,
          batchSize: fullConfig.batchSize,
        })
      : null;

    try {
      // Phase 1: Check cache for existing embeddings
      const { cachedResults, uncachedChunks, uncachedIds, uncachedIndices } = fullConfig.useCache
        ? await this.checkCache(chunks, chunkIds)
        : { cachedResults: [], uncachedChunks: chunks, uncachedIds: chunkIds, uncachedIndices: chunks.map((_, i) => i) };

      this.env.logger.info('Cache check complete', {
        totalChunks: chunks.length,
        cachedCount: cachedResults.length,
        uncachedCount: uncachedChunks.length,
        cacheHitRate: `${((cachedResults.length / chunks.length) * 100).toFixed(1)}%`,
      });

      // Phase 2: Generate embeddings for uncached chunks
      let newResults: any[] = [];
      let apiCalls = 0;

      if (uncachedChunks.length > 0) {
        if (fullConfig.parallelBatches && fullConfig.parallelBatches > 1) {
          // Parallel batch processing
          const batchResults = await this.processParallelBatches(
            documentId,
            workspaceId,
            uncachedChunks,
            uncachedIds,
            uncachedIndices,
            frameworkId,
            fullConfig
          );
          newResults = batchResults.results;
          apiCalls = batchResults.apiCalls;
        } else {
          // Sequential batch processing (original method)
          const batchResult = await this.baseService.generateAndStoreEmbeddings(
            documentId,
            workspaceId,
            uncachedChunks,
            uncachedIds,
            frameworkId,
            fullConfig
          );
          newResults = batchResult.results;
          apiCalls = Math.ceil(uncachedChunks.length / fullConfig.batchSize!);
        }

        // Cache newly generated embeddings
        if (fullConfig.useCache) {
          await this.cacheNewEmbeddings(uncachedChunks, newResults);
        }
      }

      // Phase 3: Combine cached and new results
      const allResults = [...cachedResults, ...newResults];
      const successCount = allResults.filter(r => r.success).length;
      const failureCount = allResults.filter(r => !r.success).length;
      const duration = Date.now() - startTime;

      // Adaptive batch size adjustment
      if (fullConfig.adaptiveBatchSize) {
        this.adjustBatchSize(duration, chunks.length, fullConfig);
      }

      const result: BatchEmbeddingResult = {
        documentId,
        totalChunks: chunks.length,
        successCount,
        failureCount,
        results: allResults,
        duration,
      };

      // Record metrics
      if (fullConfig.enableMonitoring && endMetric) {
        endMetric(failureCount === 0);

        await this.monitoringService.recordEmbeddingMetrics({
          documentId,
          workspaceId,
          totalChunks: chunks.length,
          batchSize: fullConfig.batchSize!,
          totalBatches: Math.ceil(uncachedChunks.length / fullConfig.batchSize!),
          successfulEmbeddings: successCount,
          failedEmbeddings: failureCount,
          totalDuration: duration,
          averageBatchDuration: duration / Math.max(Math.ceil(uncachedChunks.length / fullConfig.batchSize!), 1),
          embeddingsPerSecond: (chunks.length / duration) * 1000,
          apiCalls,
          estimatedCost: apiCalls * 0.0001, // Approximate cost
        });
      }

      this.env.logger.info('Optimized embedding generation complete', {
        documentId,
        totalChunks: chunks.length,
        successCount,
        failureCount,
        duration,
        embeddingsPerSecond: ((chunks.length / duration) * 1000).toFixed(2),
        cacheHitRate: `${((cachedResults.length / chunks.length) * 100).toFixed(1)}%`,
        estimatedCost: `$${(apiCalls * 0.0001).toFixed(4)}`,
      });

      return result;

    } catch (error) {
      if (endMetric) {
        endMetric(false, error instanceof Error ? error.message : String(error));
      }

      this.env.logger.error('Optimized embedding generation failed', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Check cache for existing embeddings
   */
  private async checkCache(
    chunks: Chunk[],
    chunkIds: string[]
  ): Promise<{
    cachedResults: any[];
    uncachedChunks: Chunk[];
    uncachedIds: string[];
    uncachedIndices: number[];
  }> {
    const cachedResults: any[] = [];
    const uncachedChunks: Chunk[] = [];
    const uncachedIds: string[] = [];
    const uncachedIndices: number[] = [];

    const { embeddings, cacheHits } = await this.cacheService.getBatchEmbeddings(
      chunks.map(c => c.text)
    );

    for (let i = 0; i < chunks.length; i++) {
      const cachedEmbedding = embeddings[i];

      if (cachedEmbedding) {
        // Use cached embedding
        cachedResults.push({
          chunkId: chunkIds[i],
          vectorId: `cached_${chunkIds[i]}`,
          embedding: cachedEmbedding,
          success: true,
        });
      } else {
        // Need to generate embedding
        uncachedChunks.push(chunks[i]);
        uncachedIds.push(chunkIds[i]);
        uncachedIndices.push(i);
      }
    }

    return { cachedResults, uncachedChunks, uncachedIds, uncachedIndices };
  }

  /**
   * Process batches in parallel for improved performance
   */
  private async processParallelBatches(
    documentId: string,
    workspaceId: string,
    chunks: Chunk[],
    chunkIds: string[],
    chunkIndices: number[],
    frameworkId: number | undefined,
    config: OptimizedEmbeddingConfig
  ): Promise<{ results: any[]; apiCalls: number }> {
    const batchSize = config.batchSize!;
    const parallelBatches = config.parallelBatches!;

    // Split into batches
    const batches: Array<{ chunks: Chunk[]; ids: string[]; indices: number[] }> = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push({
        chunks: chunks.slice(i, i + batchSize),
        ids: chunkIds.slice(i, i + batchSize),
        indices: chunkIndices.slice(i, i + batchSize),
      });
    }

    this.env.logger.info('Processing batches in parallel', {
      totalBatches: batches.length,
      parallelBatches,
      batchSize,
    });

    // Process batches in parallel groups
    const allResults: any[] = [];
    let apiCalls = 0;

    for (let i = 0; i < batches.length; i += parallelBatches) {
      const batchGroup = batches.slice(i, i + parallelBatches);

      // Process this group in parallel
      const groupPromises = batchGroup.map(batch =>
        this.baseService.generateAndStoreEmbeddings(
          documentId,
          workspaceId,
          batch.chunks,
          batch.ids,
          frameworkId,
          config
        )
      );

      const groupResults = await Promise.all(groupPromises);

      // Combine results
      for (const result of groupResults) {
        allResults.push(...result.results);
        apiCalls += Math.ceil(result.totalChunks / batchSize);
      }

      this.env.logger.info('Parallel batch group completed', {
        groupNumber: Math.floor(i / parallelBatches) + 1,
        totalGroups: Math.ceil(batches.length / parallelBatches),
        processedBatches: Math.min(i + parallelBatches, batches.length),
        totalBatches: batches.length,
      });
    }

    return { results: allResults, apiCalls };
  }

  /**
   * Cache newly generated embeddings
   */
  private async cacheNewEmbeddings(chunks: Chunk[], results: any[]): Promise<void> {
    const texts: string[] = [];
    const embeddings: number[][] = [];

    for (let i = 0; i < results.length; i++) {
      if (results[i].success && results[i].embedding.length > 0) {
        texts.push(chunks[i].text);
        embeddings.push(results[i].embedding);
      }
    }

    if (texts.length > 0) {
      await this.cacheService.setBatchEmbeddings(texts, embeddings);
    }
  }

  /**
   * Adjust batch size based on performance
   */
  private adjustBatchSize(duration: number, chunkCount: number, config: OptimizedEmbeddingConfig): void {
    const timePerChunk = duration / chunkCount;
    this.performanceHistory.push(timePerChunk);

    // Keep only last 10 measurements
    if (this.performanceHistory.length > 10) {
      this.performanceHistory.shift();
    }

    // Calculate average performance
    const avgTimePerChunk = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length;

    // Adjust batch size if we have enough history
    if (this.performanceHistory.length >= 3) {
      if (avgTimePerChunk < 100 && config.batchSize! < config.maxBatchSize!) {
        // Fast performance - increase batch size
        config.batchSize = Math.min(config.batchSize! + 5, config.maxBatchSize!);
        this.env.logger.info('Increased batch size', {
          newBatchSize: config.batchSize,
          avgTimePerChunk: avgTimePerChunk.toFixed(2),
        });
      } else if (avgTimePerChunk > 300 && config.batchSize! > config.minBatchSize!) {
        // Slow performance - decrease batch size
        config.batchSize = Math.max(config.batchSize! - 5, config.minBatchSize!);
        this.env.logger.info('Decreased batch size', {
          newBatchSize: config.batchSize,
          avgTimePerChunk: avgTimePerChunk.toFixed(2),
        });
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getStats();
  }

  /**
   * Clear embedding cache
   */
  clearCache() {
    this.cacheService.clearCache('embedding');
  }
}
