/**
 * Optimized Vector Search Service - Phase 6
 * Integrates caching and monitoring for improved search performance
 */

import { VectorSearchService, VectorSearchRequest, VectorSearchResponse, HybridSearchOptions } from './index';
import { CacheService } from '../cache-service';
import { PerformanceMonitoringService } from '../performance-monitoring-service';

export class OptimizedVectorSearchService {
  private baseService: VectorSearchService;
  private cacheService: CacheService;
  private monitoringService: PerformanceMonitoringService;
  private env: any;

  constructor(env: any) {
    this.env = env;
    this.baseService = new VectorSearchService(env);
    this.cacheService = new CacheService(env);
    this.monitoringService = new PerformanceMonitoringService(env);
  }

  /**
   * Perform optimized vector search with caching
   */
  async search(
    request: VectorSearchRequest,
    hybridOptions?: HybridSearchOptions,
    useCache: boolean = true
  ): Promise<VectorSearchResponse> {
    const startTime = Date.now();

    // Start performance monitoring
    const endMetric = this.monitoringService.startMetric('search', {
      workspaceId: request.workspaceId,
      frameworkId: request.frameworkId,
      queryLength: request.query.length,
    });

    try {
      // Check cache first
      let cachedResult: VectorSearchResponse | null = null;

      if (useCache) {
        cachedResult = await this.cacheService.getSearch(
          request.query,
          request.workspaceId,
          request.frameworkId
        );

        if (cachedResult) {
          const duration = Date.now() - startTime;

          this.env.logger.info('Search cache hit', {
            query: request.query.substring(0, 50),
            workspaceId: request.workspaceId,
            resultsCount: cachedResult.results.length,
            duration,
          });

          // Record metrics
          await this.monitoringService.recordSearchMetrics({
            query: request.query,
            workspaceId: request.workspaceId,
            queryEmbeddingTime: 0,
            vectorSearchTime: 0,
            resultEnrichmentTime: 0,
            totalDuration: duration,
            resultsCount: cachedResult.results.length,
            cachedResult: true,
          });

          endMetric(true);

          // Update cache statistics
          cachedResult.searchTime = duration;
          return cachedResult;
        }
      }

      // Cache miss - perform actual search
      this.env.logger.info('Search cache miss - performing vector search', {
        query: request.query.substring(0, 50),
        workspaceId: request.workspaceId,
      });

      // Track different phases
      const queryEmbeddingStart = Date.now();

      // Perform search using base service
      const result = await this.baseService.search(request, hybridOptions);

      const queryEmbeddingTime = Date.now() - queryEmbeddingStart;
      const vectorSearchTime = result.searchTime;
      const resultEnrichmentTime = 0; // Included in vectorSearchTime
      const totalDuration = Date.now() - startTime;

      // Cache the results
      if (useCache && result.results.length > 0) {
        await this.cacheService.setSearch(
          request.query,
          request.workspaceId,
          result,
          request.frameworkId
        );

        this.env.logger.info('Search results cached', {
          query: request.query.substring(0, 50),
          resultsCount: result.results.length,
        });
      }

      // Record metrics
      await this.monitoringService.recordSearchMetrics({
        query: request.query,
        workspaceId: request.workspaceId,
        queryEmbeddingTime,
        vectorSearchTime,
        resultEnrichmentTime,
        totalDuration,
        resultsCount: result.results.length,
        cachedResult: false,
      });

      endMetric(true);

      this.env.logger.info('Optimized search completed', {
        query: request.query.substring(0, 50),
        workspaceId: request.workspaceId,
        resultsCount: result.results.length,
        totalDuration,
        cached: false,
      });

      return result;

    } catch (error) {
      endMetric(false, error instanceof Error ? error.message : String(error));

      this.env.logger.error('Optimized search failed', {
        query: request.query.substring(0, 50),
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Warmup cache with common queries
   */
  async warmupSearchCache(workspaceId: string, commonQueries: string[]): Promise<void> {
    this.env.logger.info('Warming up search cache', {
      workspaceId,
      queryCount: commonQueries.length,
    });

    for (const query of commonQueries) {
      try {
        await this.search({ query, workspaceId }, undefined, true);
      } catch (error) {
        this.env.logger.warn('Failed to warmup query', {
          query: query.substring(0, 50),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.env.logger.info('Search cache warmup completed', {
      workspaceId,
      queryCount: commonQueries.length,
    });
  }

  /**
   * Get search statistics
   */
  async getSearchStats(workspaceId: string) {
    return this.baseService.getSearchStats(workspaceId);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getStats();
  }

  /**
   * Clear search cache
   */
  clearCache() {
    this.cacheService.clearCache('search');
  }

  /**
   * Pre-cache frameworks list
   */
  async cacheFrameworks(workspaceId: string): Promise<void> {
    // This would typically load frameworks from the database
    // and cache them for fast access
    this.env.logger.info('Caching frameworks', { workspaceId });

    // Placeholder for framework caching logic
    // In a real implementation, this would:
    // 1. Query frameworks from database
    // 2. Store in cache using cacheService.setFrameworks()
  }
}
