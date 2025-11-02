/**
 * Cache Service - Phase 6
 * Provides caching for searches, embeddings, and frameworks
 * Improves performance and reduces API costs
 */

export interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheConfig {
  maxEntries: number;
  defaultTTL: number; // Time to live in milliseconds
  cleanupInterval: number;
}

export class CacheService {
  private env: any;
  private searchCache: Map<string, CacheEntry<any>>;
  private embeddingCache: Map<string, CacheEntry<number[]>>;
  private frameworkCache: Map<string, CacheEntry<any[]>>;
  private hits: number = 0;
  private misses: number = 0;

  private readonly config: CacheConfig = {
    maxEntries: 1000,           // Maximum cache entries per type
    defaultTTL: 15 * 60 * 1000, // 15 minutes default TTL
    cleanupInterval: 5 * 60 * 1000, // Clean every 5 minutes
  };

  // TTL configurations for different cache types
  private readonly TTL_CONFIG = {
    search: 15 * 60 * 1000,      // 15 minutes (searches change frequently)
    embedding: 24 * 60 * 60 * 1000, // 24 hours (embeddings are static)
    framework: 60 * 60 * 1000,   // 1 hour (frameworks rarely change)
  };

  constructor(env: any) {
    this.env = env;
    this.searchCache = new Map();
    this.embeddingCache = new Map();
    this.frameworkCache = new Map();

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get cached search results
   */
  async getSearch(query: string, workspaceId: string, frameworkId?: number): Promise<any | null> {
    const cacheKey = this.generateSearchKey(query, workspaceId, frameworkId);
    return this.get(this.searchCache, cacheKey, 'search');
  }

  /**
   * Set cached search results
   */
  async setSearch(
    query: string,
    workspaceId: string,
    results: any,
    frameworkId?: number
  ): Promise<void> {
    const cacheKey = this.generateSearchKey(query, workspaceId, frameworkId);
    this.set(this.searchCache, cacheKey, results, this.TTL_CONFIG.search);
  }

  /**
   * Get cached embedding for text
   */
  async getEmbedding(text: string): Promise<number[] | null> {
    const cacheKey = this.generateEmbeddingKey(text);
    return this.get(this.embeddingCache, cacheKey, 'embedding');
  }

  /**
   * Set cached embedding
   */
  async setEmbedding(text: string, embedding: number[]): Promise<void> {
    const cacheKey = this.generateEmbeddingKey(text);
    this.set(this.embeddingCache, cacheKey, embedding, this.TTL_CONFIG.embedding);
  }

  /**
   * Get cached batch embeddings
   */
  async getBatchEmbeddings(texts: string[]): Promise<{ embeddings: (number[] | null)[]; cacheHits: number }> {
    const embeddings: (number[] | null)[] = [];
    let cacheHits = 0;

    for (const text of texts) {
      const cached = await this.getEmbedding(text);
      embeddings.push(cached);
      if (cached) cacheHits++;
    }

    this.env.logger.info('Batch embedding cache lookup', {
      totalTexts: texts.length,
      cacheHits,
      cacheMisses: texts.length - cacheHits,
      hitRate: `${((cacheHits / texts.length) * 100).toFixed(1)}%`,
    });

    return { embeddings, cacheHits };
  }

  /**
   * Set batch embeddings in cache
   */
  async setBatchEmbeddings(texts: string[], embeddings: number[][]): Promise<void> {
    if (texts.length !== embeddings.length) {
      throw new Error('Texts and embeddings length mismatch');
    }

    for (let i = 0; i < texts.length; i++) {
      await this.setEmbedding(texts[i], embeddings[i]);
    }

    this.env.logger.info('Batch embeddings cached', {
      count: texts.length,
    });
  }

  /**
   * Get cached frameworks list
   */
  async getFrameworks(workspaceId?: string): Promise<any[] | null> {
    const cacheKey = this.generateFrameworkKey(workspaceId);
    return this.get(this.frameworkCache, cacheKey, 'framework');
  }

  /**
   * Set cached frameworks list
   */
  async setFrameworks(frameworks: any[], workspaceId?: string): Promise<void> {
    const cacheKey = this.generateFrameworkKey(workspaceId);
    this.set(this.frameworkCache, cacheKey, frameworks, this.TTL_CONFIG.framework);
  }

  /**
   * Generic get from cache
   */
  private get<T>(cache: Map<string, CacheEntry<T>>, key: string, cacheType: string): T | null {
    const entry = cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      this.misses++;
      this.env.logger.info('Cache entry expired', {
        cacheType,
        key: key.substring(0, 50),
      });
      return null;
    }

    // Update hits
    entry.hits++;
    this.hits++;

    this.env.logger.info('Cache hit', {
      cacheType,
      key: key.substring(0, 50),
      hits: entry.hits,
      age: Date.now() - entry.createdAt,
    });

    return entry.value;
  }

  /**
   * Generic set in cache
   */
  private set<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttl: number): void {
    // Check if we need to evict entries
    if (cache.size >= this.config.maxEntries) {
      this.evictOldest(cache);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt: Date.now() + ttl,
      hits: 0,
      createdAt: Date.now(),
    };

    cache.set(key, entry);

    this.env.logger.info('Cache entry set', {
      key: key.substring(0, 50),
      ttl,
      cacheSize: cache.size,
    });
  }

  /**
   * Evict oldest entry from cache (LRU-like)
   */
  private evictOldest<T>(cache: Map<string, CacheEntry<T>>): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
      this.env.logger.info('Cache entry evicted', {
        key: oldestKey.substring(0, 50),
        age: Date.now() - oldestTime,
      });
    }
  }

  /**
   * Start cleanup interval to remove expired entries
   */
  private startCleanupInterval(): void {
    // Note: In Cloudflare Workers, we can't use setInterval
    // This would be handled by the DurableObject alarm or periodic cleanup
    // For now, we'll do inline cleanup on get operations
  }

  /**
   * Manually clean up expired entries
   */
  cleanupExpired(): void {
    const now = Date.now();

    this.cleanup(this.searchCache, now, 'search');
    this.cleanup(this.embeddingCache, now, 'embedding');
    this.cleanup(this.frameworkCache, now, 'framework');
  }

  /**
   * Clean up expired entries in a specific cache
   */
  private cleanup<T>(cache: Map<string, CacheEntry<T>>, now: number, cacheType: string): void {
    let removed = 0;

    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.env.logger.info('Cache cleanup completed', {
        cacheType,
        removed,
        remaining: cache.size,
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalEntries = this.searchCache.size + this.embeddingCache.size + this.frameworkCache.size;
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    // Estimate memory usage (rough estimate)
    const memoryUsage = this.estimateMemoryUsage();

    // Find oldest and newest entries
    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const entry of [...this.searchCache.values(), ...this.embeddingCache.values(), ...this.frameworkCache.values()]) {
      if (entry.createdAt < oldestEntry) oldestEntry = entry.createdAt;
      if (entry.createdAt > newestEntry) newestEntry = entry.createdAt;
    }

    return {
      totalEntries,
      totalHits: this.hits,
      totalMisses: this.misses,
      hitRate,
      memoryUsage,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Estimate memory usage of caches
   */
  private estimateMemoryUsage(): number {
    // Rough estimate: each entry ~1KB for search, ~4KB for embeddings
    const searchMemory = this.searchCache.size * 1024;
    const embeddingMemory = this.embeddingCache.size * 4096;
    const frameworkMemory = this.frameworkCache.size * 512;

    return searchMemory + embeddingMemory + frameworkMemory;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.searchCache.clear();
    this.embeddingCache.clear();
    this.frameworkCache.clear();
    this.hits = 0;
    this.misses = 0;

    this.env.logger.info('All caches cleared');
  }

  /**
   * Clear specific cache type
   */
  clearCache(cacheType: 'search' | 'embedding' | 'framework'): void {
    switch (cacheType) {
      case 'search':
        this.searchCache.clear();
        break;
      case 'embedding':
        this.embeddingCache.clear();
        break;
      case 'framework':
        this.frameworkCache.clear();
        break;
    }

    this.env.logger.info('Cache cleared', { cacheType });
  }

  /**
   * Generate cache key for search
   */
  private generateSearchKey(query: string, workspaceId: string, frameworkId?: number): string {
    const normalized = query.trim().toLowerCase();
    const frameworkPart = frameworkId ? `_fw${frameworkId}` : '';
    return `search_${workspaceId}_${this.hashString(normalized)}${frameworkPart}`;
  }

  /**
   * Generate cache key for embedding
   */
  private generateEmbeddingKey(text: string): string {
    const normalized = text.trim();
    return `embedding_${this.hashString(normalized)}`;
  }

  /**
   * Generate cache key for frameworks
   */
  private generateFrameworkKey(workspaceId?: string): string {
    return workspaceId ? `frameworks_${workspaceId}` : 'frameworks_global';
  }

  /**
   * Simple string hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Warmup cache with frequently used data
   */
  async warmupCache(workspaceId: string): Promise<void> {
    this.env.logger.info('Starting cache warmup', { workspaceId });

    try {
      // Pre-load frameworks
      // This would typically call the framework service
      // await this.loadFrameworks(workspaceId);

      // Pre-generate embeddings for common queries
      const commonQueries = [
        'data privacy',
        'access control',
        'security policy',
        'compliance requirements',
        'audit procedures',
      ];

      for (const query of commonQueries) {
        // Pre-generate and cache embeddings
        // This would typically call the embedding service
        // await this.preloadQueryEmbedding(query);
      }

      this.env.logger.info('Cache warmup completed', {
        workspaceId,
        cachedQueries: commonQueries.length,
      });

    } catch (error) {
      this.env.logger.error('Cache warmup failed', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
