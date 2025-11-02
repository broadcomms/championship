/**
 * Performance Monitoring Service - Phase 6
 * Tracks metrics for embeddings, search, chunking, and cost analysis
 * Provides observability into the vector embedding system
 */

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
  error?: string;
}

export interface EmbeddingMetrics {
  documentId: string;
  workspaceId: string;
  totalChunks: number;
  batchSize: number;
  totalBatches: number;
  successfulEmbeddings: number;
  failedEmbeddings: number;
  totalDuration: number;
  averageBatchDuration: number;
  embeddingsPerSecond: number;
  apiCalls: number;
  estimatedCost: number;
}

export interface SearchMetrics {
  query: string;
  workspaceId: string;
  queryEmbeddingTime: number;
  vectorSearchTime: number;
  resultEnrichmentTime: number;
  totalDuration: number;
  resultsCount: number;
  cachedResult: boolean;
}

export interface ChunkingMetrics {
  documentId: string;
  textLength: number;
  totalChunks: number;
  averageChunkSize: number;
  chunkingDuration: number;
  chunksPerSecond: number;
}

export interface SystemMetrics {
  period: string;
  totalDocumentsProcessed: number;
  totalChunksCreated: number;
  totalEmbeddingsGenerated: number;
  totalSearches: number;
  averageProcessingTime: number;
  averageSearchTime: number;
  errorRate: number;
  cacheHitRate: number;
  estimatedTotalCost: number;
}

export interface PerformanceAlert {
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  threshold: number;
  actual: number;
  message: string;
  timestamp: number;
}

export class PerformanceMonitoringService {
  private env: any;
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS_IN_MEMORY = 1000;

  // Performance thresholds (Phase 6 success criteria)
  private readonly THRESHOLDS = {
    P95_LATENCY_MS: 2000,          // P95 latency < 2s
    CHUNKING_TIME_MS: 30000,       // Chunking < 30s
    SEARCH_TIME_MS: 1000,          // Search < 1s
    ERROR_RATE_PERCENT: 1,         // Error rate < 1%
    EMBEDDING_TIME_PER_CHUNK_MS: 500, // Target: 500ms per chunk
  };

  // Cost estimates (approximate)
  private readonly COST_PER_EMBEDDING = 0.0001; // $0.0001 per embedding
  private readonly COST_PER_SEARCH = 0.00005;   // $0.00005 per search

  constructor(env: any) {
    this.env = env;
  }

  /**
   * Start tracking a performance metric
   */
  startMetric(operation: string, metadata?: Record<string, any>): (success?: boolean, error?: string) => void {
    const startTime = Date.now();

    return (success: boolean = true, error?: string) => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const metric: PerformanceMetric = {
        operation,
        startTime,
        endTime,
        duration,
        success,
        metadata,
        error,
      };

      this.recordMetric(metric);

      // Check for performance alerts
      this.checkThresholds(metric);

      return metric;
    };
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    // Keep in-memory for recent analysis
    this.metrics.push(metric);

    // Limit memory usage
    if (this.metrics.length > this.MAX_METRICS_IN_MEMORY) {
      this.metrics.shift();
    }

    // Log to env logger
    this.env.logger.info('Performance metric recorded', {
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
      metadata: metric.metadata,
    });

    // Store in database for long-term analytics (async, don't block)
    this.storeMetricInDatabase(metric).catch(error => {
      this.env.logger.warn('Failed to store performance metric in database', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Store metric in database for analytics
   */
  private async storeMetricInDatabase(metric: PerformanceMetric): Promise<void> {
    try {
      await (this.env.AUDITGUARD_DB as any).prepare(
        `INSERT INTO performance_metrics (
          operation, start_time, end_time, duration, success, metadata, error, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        metric.operation,
        metric.startTime,
        metric.endTime,
        metric.duration,
        metric.success ? 1 : 0,
        JSON.stringify(metric.metadata || {}),
        metric.error || null,
        Date.now()
      ).run();
    } catch (error) {
      // Silently fail - metrics shouldn't block main operations
      this.env.logger.warn('Failed to store metric', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if metrics exceed thresholds and create alerts
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const alerts: PerformanceAlert[] = [];

    // Check latency thresholds
    if (metric.operation === 'search' && metric.duration > this.THRESHOLDS.SEARCH_TIME_MS) {
      alerts.push({
        severity: 'warning',
        metric: 'search_latency',
        threshold: this.THRESHOLDS.SEARCH_TIME_MS,
        actual: metric.duration,
        message: `Search latency (${metric.duration}ms) exceeds threshold (${this.THRESHOLDS.SEARCH_TIME_MS}ms)`,
        timestamp: Date.now(),
      });
    }

    if (metric.operation === 'chunking' && metric.duration > this.THRESHOLDS.CHUNKING_TIME_MS) {
      alerts.push({
        severity: 'warning',
        metric: 'chunking_time',
        threshold: this.THRESHOLDS.CHUNKING_TIME_MS,
        actual: metric.duration,
        message: `Chunking time (${metric.duration}ms) exceeds threshold (${this.THRESHOLDS.CHUNKING_TIME_MS}ms)`,
        timestamp: Date.now(),
      });
    }

    // Log alerts
    alerts.forEach(alert => {
      this.env.logger.warn('Performance alert', alert);
    });
  }

  /**
   * Record embedding generation metrics
   */
  async recordEmbeddingMetrics(metrics: EmbeddingMetrics): Promise<void> {
    this.env.logger.info('Embedding metrics recorded', {
      documentId: metrics.documentId,
      embeddingsPerSecond: metrics.embeddingsPerSecond.toFixed(2),
      estimatedCost: `$${metrics.estimatedCost.toFixed(4)}`,
      successRate: `${((metrics.successfulEmbeddings / metrics.totalChunks) * 100).toFixed(1)}%`,
    });
  }

  /**
   * Record search metrics
   */
  async recordSearchMetrics(metrics: SearchMetrics): Promise<void> {
    this.env.logger.info('Search metrics recorded', {
      totalDuration: metrics.totalDuration,
      cachedResult: metrics.cachedResult,
      resultsCount: metrics.resultsCount,
    });
  }

  /**
   * Record chunking metrics
   */
  async recordChunkingMetrics(metrics: ChunkingMetrics): Promise<void> {
    this.env.logger.info('Chunking metrics recorded', {
      documentId: metrics.documentId,
      chunksPerSecond: metrics.chunksPerSecond.toFixed(2),
      averageChunkSize: metrics.averageChunkSize,
    });
  }

  /**
   * Get system-wide metrics for a time period
   */
  async getSystemMetrics(workspaceId?: string, hours: number = 24): Promise<SystemMetrics> {
    try {
      const since = Date.now() - (hours * 60 * 60 * 1000);

      const query = workspaceId
        ? `SELECT
             operation,
             COUNT(*) as count,
             AVG(duration) as avg_duration,
             SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors
           FROM performance_metrics
           WHERE created_at >= ?
             AND JSON_EXTRACT(metadata, '$.workspaceId') = ?
           GROUP BY operation`
        : `SELECT
             operation,
             COUNT(*) as count,
             AVG(duration) as avg_duration,
             SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors
           FROM performance_metrics
           WHERE created_at >= ?
           GROUP BY operation`;

      const bindings = workspaceId ? [since, workspaceId] : [since];
      const result = await (this.env.AUDITGUARD_DB as any).prepare(query).bind(...bindings).all();

      const metrics = result.results || [];

      // Calculate aggregates
      let totalDocuments = 0;
      let totalChunks = 0;
      let totalEmbeddings = 0;
      let totalSearches = 0;
      let totalProcessingTime = 0;
      let totalSearchTime = 0;
      let totalErrors = 0;
      let totalOperations = 0;

      for (const row of metrics) {
        const count = row.count || 0;
        const errors = row.errors || 0;
        const avgDuration = row.avg_duration || 0;

        totalOperations += count;
        totalErrors += errors;

        if (row.operation === 'embedding_batch') {
          totalDocuments += count;
          totalProcessingTime += avgDuration * count;
        } else if (row.operation === 'chunking') {
          totalChunks += count;
        } else if (row.operation === 'search') {
          totalSearches += count;
          totalSearchTime += avgDuration * count;
        }
      }

      const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

      return {
        period: `last_${hours}_hours`,
        totalDocumentsProcessed: totalDocuments,
        totalChunksCreated: totalChunks,
        totalEmbeddingsGenerated: totalEmbeddings,
        totalSearches,
        averageProcessingTime: totalDocuments > 0 ? totalProcessingTime / totalDocuments : 0,
        averageSearchTime: totalSearches > 0 ? totalSearchTime / totalSearches : 0,
        errorRate,
        cacheHitRate: 0, // Will be calculated from cache service
        estimatedTotalCost: (totalEmbeddings * this.COST_PER_EMBEDDING) + (totalSearches * this.COST_PER_SEARCH),
      };

    } catch (error) {
      this.env.logger.error('Failed to get system metrics', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty metrics on failure
      return {
        period: `last_${hours}_hours`,
        totalDocumentsProcessed: 0,
        totalChunksCreated: 0,
        totalEmbeddingsGenerated: 0,
        totalSearches: 0,
        averageProcessingTime: 0,
        averageSearchTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        estimatedTotalCost: 0,
      };
    }
  }

  /**
   * Get P95 latency for an operation
   */
  async getP95Latency(operation: string, hours: number = 24): Promise<number> {
    try {
      const since = Date.now() - (hours * 60 * 60 * 1000);

      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT duration
         FROM performance_metrics
         WHERE operation = ?
           AND created_at >= ?
         ORDER BY duration DESC
         LIMIT 1 OFFSET (
           SELECT CAST(COUNT(*) * 0.05 AS INTEGER)
           FROM performance_metrics
           WHERE operation = ?
             AND created_at >= ?
         )`
      ).bind(operation, since, operation, since).first();

      return result?.duration || 0;

    } catch (error) {
      this.env.logger.error('Failed to get P95 latency', {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get cost analysis for a workspace
   */
  async getCostAnalysis(workspaceId: string, days: number = 30): Promise<{
    period: string;
    totalEmbeddings: number;
    totalSearches: number;
    embeddingCost: number;
    searchCost: number;
    totalCost: number;
    averageDailyCost: number;
    projectedMonthlyCost: number;
    costPerDocument: number;
  }> {
    try {
      const since = Date.now() - (days * 24 * 60 * 60 * 1000);

      // Get embedding count
      const embeddingResult = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT COUNT(*) as count
         FROM document_chunks dc
         JOIN documents d ON dc.document_id = d.id
         WHERE d.workspace_id = ?
           AND dc.embedding_status = 'completed'
           AND dc.created_at >= ?`
      ).bind(workspaceId, since).first();

      // Get search count
      const searchResult = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT COUNT(*) as count
         FROM performance_metrics
         WHERE operation = 'search'
           AND JSON_EXTRACT(metadata, '$.workspaceId') = ?
           AND created_at >= ?`
      ).bind(workspaceId, since).first();

      // Get document count
      const documentResult = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT COUNT(*) as count
         FROM documents
         WHERE workspace_id = ?
           AND uploaded_at >= ?`
      ).bind(workspaceId, since).first();

      const totalEmbeddings = embeddingResult?.count || 0;
      const totalSearches = searchResult?.count || 0;
      const totalDocuments = documentResult?.count || 0;

      const embeddingCost = totalEmbeddings * this.COST_PER_EMBEDDING;
      const searchCost = totalSearches * this.COST_PER_SEARCH;
      const totalCost = embeddingCost + searchCost;
      const averageDailyCost = totalCost / days;
      const projectedMonthlyCost = averageDailyCost * 30;
      const costPerDocument = totalDocuments > 0 ? totalCost / totalDocuments : 0;

      return {
        period: `last_${days}_days`,
        totalEmbeddings,
        totalSearches,
        embeddingCost,
        searchCost,
        totalCost,
        averageDailyCost,
        projectedMonthlyCost,
        costPerDocument,
      };

    } catch (error) {
      this.env.logger.error('Failed to get cost analysis', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        period: `last_${days}_days`,
        totalEmbeddings: 0,
        totalSearches: 0,
        embeddingCost: 0,
        searchCost: 0,
        totalCost: 0,
        averageDailyCost: 0,
        projectedMonthlyCost: 0,
        costPerDocument: 0,
      };
    }
  }

  /**
   * Get performance comparison: Before vs After optimization
   */
  async getOptimizationImpact(beforeDate: number): Promise<{
    before: SystemMetrics;
    after: SystemMetrics;
    improvements: {
      processingTimeReduction: number;
      searchTimeReduction: number;
      errorRateReduction: number;
      costReduction: number;
    };
  }> {
    const before = await this.getSystemMetrics(undefined, Math.floor((Date.now() - beforeDate) / (1000 * 60 * 60)));
    const after = await this.getSystemMetrics(undefined, 24);

    return {
      before,
      after,
      improvements: {
        processingTimeReduction: before.averageProcessingTime > 0
          ? ((before.averageProcessingTime - after.averageProcessingTime) / before.averageProcessingTime) * 100
          : 0,
        searchTimeReduction: before.averageSearchTime > 0
          ? ((before.averageSearchTime - after.averageSearchTime) / before.averageSearchTime) * 100
          : 0,
        errorRateReduction: before.errorRate > 0
          ? ((before.errorRate - after.errorRate) / before.errorRate) * 100
          : 0,
        costReduction: before.estimatedTotalCost > 0
          ? ((before.estimatedTotalCost - after.estimatedTotalCost) / before.estimatedTotalCost) * 100
          : 0,
      },
    };
  }
}
