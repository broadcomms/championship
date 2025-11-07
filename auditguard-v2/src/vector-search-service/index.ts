/**
 * Vector Search Service
 * Fast semantic search using vector embeddings
 * Supports filtering, ranking, pagination, and hybrid search
 */

import { EmbeddingService } from '../embedding-service';

export interface VectorSearchRequest {
  query: string;                    // Search query text
  workspaceId: string;              // Workspace to search in
  frameworkId?: number;             // Optional compliance framework filter
  topK?: number;                    // Number of results (default: 10)
  minScore?: number;                // Minimum similarity score (default: 0.7 - PHASE 2.3: adjusted for bge-small-en)
  includeChunks?: boolean;          // Include chunk text in results (default: true)
  page?: number;                    // Page number for pagination (default: 1)
  pageSize?: number;                // Results per page (default: 10)
  retryForIndexing?: boolean;       // PHASE 2.3: Retry for recently uploaded vectors (default: false)
}

export interface VectorSearchResult {
  documentId: string;
  chunkId: number;
  chunkIndex: number;
  score: number;                    // Similarity score (0-1)
  text: string;                     // Chunk text
  highlight?: string;               // Highlighted snippet
  metadata: {
    documentTitle?: string;
    filename: string;
    contentType: string;
    hasHeader: boolean;
    sectionTitle?: string;
    tokenCount: number;
    startChar: number;
    endChar: number;
    frameworkId?: number;
  };
}

export interface VectorSearchResponse {
  results: VectorSearchResult[];
  totalResults: number;
  page: number;
  pageSize: number;
  totalPages: number;
  searchTime: number;               // Search duration in ms
  source: 'vector' | 'smartbucket' | 'hybrid';
}

export interface HybridSearchOptions {
  useSmartBucket: boolean;          // Enable SmartBucket fallback
  smartBucketThreshold: number;     // Min results before fallback (default: 3)
  combineResults: boolean;          // Merge vector + SmartBucket (default: true)
}

export class VectorSearchService {
  private env: any;
  private embeddingService: EmbeddingService;

  constructor(env: any) {
    this.env = env;
    this.embeddingService = new EmbeddingService(env);
  }

  /**
   * PHASE 2.3: Perform vector similarity search with adjusted thresholds for bge-small-en
   * @param request Search parameters
   * @param hybridOptions Optional hybrid search configuration
   */
  async search(
    request: VectorSearchRequest,
    hybridOptions?: HybridSearchOptions
  ): Promise<VectorSearchResponse> {
    const startTime = Date.now();

    // PHASE 2.3: Adjusted defaults for bge-small-en model
    // High similarity: ≥0.70 (same topic)
    // Medium similarity: 0.50-0.80 (related content)
    // Low similarity: <0.60 (different topics)
    const topK = request.topK || 10;
    const minScore = request.minScore || 0.7; // Default high threshold unchanged
    const page = request.page || 1;
    const pageSize = request.pageSize || 10;
    const retryForIndexing = request.retryForIndexing || false;

    this.env.logger.info('🔍 Vector search started (PHASE 2.3: bge-small-en thresholds)', {
      query: request.query.substring(0, 100),
      workspaceId: request.workspaceId,
      frameworkId: request.frameworkId,
      topK,
      minScore,
      retryForIndexing,
    });

    try {
      // PHASE 2.3: Perform vector search with retry logic if requested
      const vectorResults = await this.vectorSearch(request, topK, minScore, retryForIndexing);

      this.env.logger.info('Vector search completed', {
        resultCount: vectorResults.length,
        query: request.query.substring(0, 50),
      });

      // Check if hybrid search is needed
      const shouldUseHybrid = hybridOptions?.useSmartBucket &&
        vectorResults.length < (hybridOptions.smartBucketThreshold || 3);

      let finalResults = vectorResults;
      let source: 'vector' | 'smartbucket' | 'hybrid' = 'vector';

      if (shouldUseHybrid) {
        this.env.logger.info('Insufficient vector results, using hybrid search', {
          vectorCount: vectorResults.length,
          threshold: hybridOptions?.smartBucketThreshold || 3,
        });

        const smartBucketResults = await this.smartBucketSearch(request);

        if (hybridOptions?.combineResults) {
          finalResults = this.combineResults(vectorResults, smartBucketResults);
          source = 'hybrid';
        } else {
          finalResults = smartBucketResults.length > 0 ? smartBucketResults : vectorResults;
          source = smartBucketResults.length > 0 ? 'smartbucket' : 'vector';
        }

        this.env.logger.info('Hybrid search completed', {
          vectorCount: vectorResults.length,
          smartBucketCount: smartBucketResults.length,
          finalCount: finalResults.length,
          source,
        });
      }

      // Apply pagination
      const totalResults = finalResults.length;
      const totalPages = Math.ceil(totalResults / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = finalResults.slice(startIndex, endIndex);

      const searchTime = Date.now() - startTime;

      this.env.logger.info('Search completed', {
        totalResults,
        returnedResults: paginatedResults.length,
        searchTime,
        source,
      });

      return {
        results: paginatedResults,
        totalResults,
        page,
        pageSize,
        totalPages,
        searchTime,
        source,
      };

    } catch (error) {
      this.env.logger.error('Vector search failed', {
        query: request.query.substring(0, 100),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * PHASE 2.3: Perform vector similarity search using embeddings with retry logic
   * Adjusted for bge-small-en similarity score ranges:
   * - High similarity: ≥0.70 (same topic)
   * - Medium similarity: 0.50-0.80 (related content)
   * - Low similarity: <0.60 (different topics)
   */
  private async vectorSearch(
    request: VectorSearchRequest,
    topK: number,
    minScore: number,
    retryForIndexing: boolean = false
  ): Promise<VectorSearchResult[]> {
    // PHASE 2.3: Query vector index with retry logic for indexing delays
    const vectorResults = await this.embeddingService.querySimilarChunks(
      request.query,
      topK * 2, // Get extra results for filtering
      request.workspaceId,
      request.frameworkId,
      retryForIndexing // Pass retry flag to embedding service
    );

    // PHASE 2.3: Filter by minimum score (adjusted thresholds for bge-small-en)
    const filteredResults = vectorResults.filter(r => r.score >= minScore);

    this.env.logger.info('📊 Vector index query completed (PHASE 2.3)', {
      rawResults: vectorResults.length,
      filteredResults: filteredResults.length,
      minScore,
      thresholdInfo: minScore >= 0.70 ? 'HIGH (≥0.70)' : 
                     minScore >= 0.50 ? 'MEDIUM (0.50-0.80)' : 
                     'LOW (<0.60)',
    });

    // Enrich results with document metadata
    const enrichedResults: VectorSearchResult[] = [];

    for (const result of filteredResults) {
      try {
        // Get document metadata
        const document = await this.getDocumentMetadata(result.metadata.documentId);

        // Get chunk from database for full text
        const chunk = await this.getChunkData(result.metadata.chunkId);

        if (document && chunk) {
          enrichedResults.push({
            documentId: result.metadata.documentId,
            chunkId: result.metadata.chunkId,
            chunkIndex: result.metadata.chunkIndex,
            score: result.score,
            text: request.includeChunks !== false ? chunk.text : '',
            highlight: this.generateHighlight(chunk.text, request.query),
            metadata: {
              documentTitle: document.title,
              filename: document.filename,
              contentType: document.contentType,
              hasHeader: result.metadata.hasHeader,
              sectionTitle: result.metadata.sectionTitle,
              tokenCount: result.metadata.tokenCount,
              startChar: chunk.startChar,
              endChar: chunk.endChar,
              frameworkId: result.metadata.frameworkId,
            },
          });
        }
      } catch (error) {
        this.env.logger.warn('Failed to enrich search result', {
          documentId: result.metadata.documentId,
          chunkId: result.metadata.chunkId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return enrichedResults;
  }

  /**
   * Fallback to SmartBucket search
   */
  private async smartBucketSearch(request: VectorSearchRequest): Promise<VectorSearchResult[]> {
    try {
      this.env.logger.info('SmartBucket fallback search started', {
        query: request.query.substring(0, 100),
        workspaceId: request.workspaceId,
      });

      // Query SmartBucket for similar documents
      const searchResults = await this.env.DOCUMENTS_BUCKET.search({
        query: request.query,
        limit: request.topK || 10,
        filter: {
          workspaceId: request.workspaceId,
        },
      });

      this.env.logger.info('SmartBucket search completed', {
        resultCount: searchResults.length,
      });

      // Convert SmartBucket results to our format
      const results: VectorSearchResult[] = [];

      for (const result of searchResults) {
        try {
          const metadata = result.metadata || {};
          const documentId = metadata.documentId;

          if (documentId) {
            const document = await this.getDocumentMetadata(documentId);

            if (document) {
              results.push({
                documentId,
                chunkId: 0, // SmartBucket doesn't have chunk IDs
                chunkIndex: 0,
                score: result.score || 0.8, // SmartBucket score
                text: result.text || '',
                highlight: this.generateHighlight(result.text || '', request.query),
                metadata: {
                  documentTitle: document.title,
                  filename: document.filename,
                  contentType: document.contentType,
                  hasHeader: false,
                  sectionTitle: undefined,
                  tokenCount: 0,
                  startChar: 0,
                  endChar: 0,
                  frameworkId: document.complianceFrameworkId,
                },
              });
            }
          }
        } catch (error) {
          this.env.logger.warn('Failed to process SmartBucket result', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return results;

    } catch (error) {
      this.env.logger.error('SmartBucket search failed', {
        query: request.query.substring(0, 100),
        error: error instanceof Error ? error.message : String(error),
      });
      return []; // Return empty on SmartBucket failure
    }
  }

  /**
   * Combine and deduplicate vector and SmartBucket results
   */
  private combineResults(
    vectorResults: VectorSearchResult[],
    smartBucketResults: VectorSearchResult[]
  ): VectorSearchResult[] {
    // Create a map of documentId+chunkId to avoid duplicates
    const resultMap = new Map<string, VectorSearchResult>();

    // Add vector results first (higher priority)
    for (const result of vectorResults) {
      const key = `${result.documentId}_${result.chunkId}`;
      resultMap.set(key, result);
    }

    // Add SmartBucket results if not already present
    for (const result of smartBucketResults) {
      const key = `${result.documentId}_${result.chunkId}`;
      if (!resultMap.has(key)) {
        resultMap.set(key, result);
      }
    }

    // Convert back to array and sort by score
    const combined = Array.from(resultMap.values());
    combined.sort((a, b) => b.score - a.score);

    this.env.logger.info('Results combined and deduplicated', {
      vectorCount: vectorResults.length,
      smartBucketCount: smartBucketResults.length,
      combinedCount: combined.length,
    });

    return combined;
  }

  /**
   * Get document metadata from database
   */
  private async getDocumentMetadata(documentId: string): Promise<any> {
    try {
      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT id, title, filename, content_type, compliance_framework_id
         FROM documents
         WHERE id = ?`
      ).bind(documentId).first();

      return result ? {
        id: result.id,
        title: result.title,
        filename: result.filename,
        contentType: result.content_type,
        complianceFrameworkId: result.compliance_framework_id,
      } : null;

    } catch (error) {
      this.env.logger.error('Failed to get document metadata', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get chunk data from database
   */
  private async getChunkData(chunkId: number): Promise<any> {
    try {
      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT id, content, start_char, end_char, token_count
         FROM document_chunks
         WHERE id = ?`
      ).bind(chunkId).first();

      return result ? {
        id: result.id,
        text: result.content,
        startChar: result.start_char,
        endChar: result.end_char,
        tokenCount: result.token_count,
      } : null;

    } catch (error) {
      this.env.logger.error('Failed to get chunk data', {
        chunkId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Generate highlighted snippet from text
   */
  private generateHighlight(text: string, query: string, maxLength: number = 200): string {
    if (!text || !query) {
      return text?.substring(0, maxLength) || '';
    }

    // Simple highlight: find query terms and show surrounding context
    const queryTerms = query.toLowerCase().split(/\s+/);
    const lowerText = text.toLowerCase();

    // Find first occurrence of any query term
    let bestIndex = -1;
    for (const term of queryTerms) {
      const index = lowerText.indexOf(term);
      if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
        bestIndex = index;
      }
    }

    if (bestIndex === -1) {
      // No match found, return beginning
      return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    // Calculate snippet boundaries
    const contextBefore = 50;
    const contextAfter = maxLength - contextBefore;
    const start = Math.max(0, bestIndex - contextBefore);
    const end = Math.min(text.length, bestIndex + contextAfter);

    let snippet = text.substring(start, end);

    // Add ellipsis
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(
    partialQuery: string,
    workspaceId: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      // Query for common terms in chunks
      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT DISTINCT section_title
         FROM document_chunks dc
         JOIN documents d ON dc.document_id = d.id
         WHERE d.workspace_id = ?
           AND dc.section_title IS NOT NULL
           AND LOWER(dc.section_title) LIKE ?
         LIMIT ?`
      ).bind(workspaceId, `%${partialQuery.toLowerCase()}%`, limit).all();

      return result.results?.map((r: any) => r.section_title).filter(Boolean) || [];

    } catch (error) {
      this.env.logger.error('Failed to get search suggestions', {
        partialQuery,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get search statistics for a workspace
   */
  async getSearchStats(workspaceId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    indexedChunks: number;
    averageChunkSize: number;
  }> {
    try {
      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT
           COUNT(DISTINCT d.id) as total_documents,
           COUNT(dc.id) as total_chunks,
           SUM(CASE WHEN dc.embedding_status = 'completed' THEN 1 ELSE 0 END) as indexed_chunks,
           AVG(dc.token_count) as avg_chunk_size
         FROM documents d
         LEFT JOIN document_chunks dc ON d.id = dc.document_id
         WHERE d.workspace_id = ?`
      ).bind(workspaceId).first();

      return {
        totalDocuments: result?.total_documents || 0,
        totalChunks: result?.total_chunks || 0,
        indexedChunks: result?.indexed_chunks || 0,
        averageChunkSize: Math.round(result?.avg_chunk_size || 0),
      };

    } catch (error) {
      this.env.logger.error('Failed to get search stats', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
