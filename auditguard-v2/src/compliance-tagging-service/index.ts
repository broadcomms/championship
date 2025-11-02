/**
 * Compliance Tagging Service
 * Auto-tags document chunks with relevant compliance frameworks
 * Calculates relevance scores using AI-based analysis
 */

export interface ComplianceFramework {
  id: number;
  name: string;
  displayName: string;
  description: string;
  keywords: string[];
}

export interface ChunkTag {
  chunkId: number;
  frameworkId: number;
  relevanceScore: number;
  autoTagged: boolean;
}

export interface TaggingResult {
  chunkId: number;
  totalTags: number;
  tags: ChunkTag[];
  processingTime: number;
}

export interface BatchTaggingResult {
  documentId: string;
  totalChunks: number;
  successCount: number;
  failureCount: number;
  tags: ChunkTag[];
  duration: number;
}

export class ComplianceTaggingService {
  private env: any;

  // Framework keywords for quick filtering (before AI analysis)
  private readonly FRAMEWORK_KEYWORDS: Record<string, string[]> = {
    'sox': [
      'financial', 'audit', 'internal control', 'sox', 'sarbanes', 'oxley',
      'financial reporting', 'accounting', 'disclosure', 'cfo', 'ceo',
      'material weakness', 'deficiency', 'icfr', 'pcaob'
    ],
    'gdpr': [
      'gdpr', 'personal data', 'data subject', 'consent', 'privacy',
      'right to be forgotten', 'data protection', 'dpo', 'data processing',
      'privacy policy', 'cookie', 'eu', 'european', 'lawful basis'
    ],
    'hipaa': [
      'hipaa', 'phi', 'protected health', 'medical', 'healthcare',
      'patient', 'hitech', 'privacy rule', 'security rule',
      'covered entity', 'business associate', 'ephi', 'health information'
    ],
    'pci_dss': [
      'pci', 'payment card', 'cardholder', 'credit card', 'debit card',
      'card data', 'pan', 'cvv', 'payment', 'merchant', 'acquirer',
      'pci dss', 'card processing', 'tokenization'
    ],
    'iso27001': [
      'iso 27001', 'iso27001', 'information security', 'isms',
      'security controls', 'risk assessment', 'asset management',
      'access control', 'cryptography', 'incident management',
      'business continuity', 'compliance', 'certification'
    ],
    'nist': [
      'nist', 'cybersecurity framework', 'csf', 'identify', 'protect',
      'detect', 'respond', 'recover', 'nist 800', 'sp 800',
      'risk management', 'security controls', 'federal'
    ]
  };

  constructor(env: any) {
    this.env = env;
  }

  /**
   * Auto-tag a single chunk with relevant compliance frameworks
   * Uses keyword matching + AI-based relevance scoring
   */
  async tagChunk(
    chunkId: number,
    chunkText: string,
    documentId: string
  ): Promise<TaggingResult> {
    const startTime = Date.now();

    this.env.logger.info('Auto-tagging chunk', {
      chunkId,
      documentId,
      textLength: chunkText.length,
    });

    try {
      // Get all active frameworks
      const frameworks = await this.getActiveFrameworks();

      // Step 1: Quick keyword filtering
      const candidateFrameworks = this.filterByKeywords(chunkText, frameworks);

      if (candidateFrameworks.length === 0) {
        this.env.logger.info('No candidate frameworks for chunk', {
          chunkId,
          chunkTextPreview: chunkText.substring(0, 100),
        });

        return {
          chunkId,
          totalTags: 0,
          tags: [],
          processingTime: Date.now() - startTime,
        };
      }

      this.env.logger.info('Candidate frameworks identified', {
        chunkId,
        candidateCount: candidateFrameworks.length,
        candidates: candidateFrameworks.map(f => f.name),
      });

      // Step 2: AI-based relevance scoring for candidates
      const tags: ChunkTag[] = [];

      for (const framework of candidateFrameworks) {
        const relevanceScore = await this.calculateRelevanceScore(
          chunkText,
          framework
        );

        // Only tag if relevance score is above threshold (0.6)
        if (relevanceScore >= 0.6) {
          tags.push({
            chunkId,
            frameworkId: framework.id,
            relevanceScore,
            autoTagged: true,
          });

          // Store in database
          await this.storeTag(chunkId, framework.id, relevanceScore, true);
        }
      }

      const duration = Date.now() - startTime;

      this.env.logger.info('Chunk tagging completed', {
        chunkId,
        totalTags: tags.length,
        tags: tags.map(t => ({
          framework: candidateFrameworks.find(f => f.id === t.frameworkId)?.name,
          score: t.relevanceScore,
        })),
        duration,
      });

      return {
        chunkId,
        totalTags: tags.length,
        tags,
        processingTime: duration,
      };

    } catch (error) {
      this.env.logger.error('Chunk tagging failed', {
        chunkId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Batch tag all chunks for a document
   */
  async tagDocumentChunks(
    documentId: string,
    chunks: Array<{ id: number; text: string }>
  ): Promise<BatchTaggingResult> {
    const startTime = Date.now();

    this.env.logger.info('Batch tagging document chunks', {
      documentId,
      chunkCount: chunks.length,
    });

    const allTags: ChunkTag[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const chunk of chunks) {
      try {
        const result = await this.tagChunk(chunk.id, chunk.text, documentId);
        allTags.push(...result.tags);
        successCount++;
      } catch (error) {
        this.env.logger.error('Failed to tag chunk', {
          documentId,
          chunkId: chunk.id,
          error: error instanceof Error ? error.message : String(error),
        });
        failureCount++;
      }
    }

    const duration = Date.now() - startTime;

    this.env.logger.info('Batch tagging completed', {
      documentId,
      totalChunks: chunks.length,
      successCount,
      failureCount,
      totalTags: allTags.length,
      duration,
    });

    return {
      documentId,
      totalChunks: chunks.length,
      successCount,
      failureCount,
      tags: allTags,
      duration,
    };
  }

  /**
   * Manually tag a chunk with a framework
   */
  async manualTagChunk(
    chunkId: number,
    frameworkId: number,
    relevanceScore: number = 1.0
  ): Promise<void> {
    this.env.logger.info('Manual tagging chunk', {
      chunkId,
      frameworkId,
      relevanceScore,
    });

    await this.storeTag(chunkId, frameworkId, relevanceScore, false);
  }

  /**
   * Remove a tag from a chunk
   */
  async untagChunk(chunkId: number, frameworkId: number): Promise<void> {
    try {
      await (this.env.AUDITGUARD_DB as any).prepare(
        `DELETE FROM document_chunk_frameworks
         WHERE chunk_id = ? AND framework_id = ?`
      ).bind(chunkId, frameworkId).run();

      this.env.logger.info('Tag removed from chunk', {
        chunkId,
        frameworkId,
      });

    } catch (error) {
      this.env.logger.error('Failed to remove tag', {
        chunkId,
        frameworkId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get all tags for a chunk
   */
  async getChunkTags(chunkId: number): Promise<ChunkTag[]> {
    try {
      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT framework_id, relevance_score, auto_tagged
         FROM document_chunk_frameworks
         WHERE chunk_id = ?
         ORDER BY relevance_score DESC`
      ).bind(chunkId).all();

      return result.results?.map((row: any) => ({
        chunkId,
        frameworkId: row.framework_id,
        relevanceScore: row.relevance_score,
        autoTagged: row.auto_tagged === 1,
      })) || [];

    } catch (error) {
      this.env.logger.error('Failed to get chunk tags', {
        chunkId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get all chunks tagged with a specific framework
   */
  async getFrameworkChunks(
    frameworkId: number,
    workspaceId: string,
    minRelevance: number = 0.6
  ): Promise<Array<{ chunkId: number; documentId: string; relevanceScore: number }>> {
    try {
      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT dcf.chunk_id, dc.document_id, dcf.relevance_score
         FROM document_chunk_frameworks dcf
         JOIN document_chunks dc ON dcf.chunk_id = dc.id
         JOIN documents d ON dc.document_id = d.id
         WHERE dcf.framework_id = ?
           AND d.workspace_id = ?
           AND dcf.relevance_score >= ?
         ORDER BY dcf.relevance_score DESC`
      ).bind(frameworkId, workspaceId, minRelevance).all();

      return result.results?.map((row: any) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        relevanceScore: row.relevance_score,
      })) || [];

    } catch (error) {
      this.env.logger.error('Failed to get framework chunks', {
        frameworkId,
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Filter frameworks by keyword matching
   */
  private filterByKeywords(
    text: string,
    frameworks: ComplianceFramework[]
  ): ComplianceFramework[] {
    const lowerText = text.toLowerCase();
    const candidates: ComplianceFramework[] = [];

    for (const framework of frameworks) {
      const keywords = this.FRAMEWORK_KEYWORDS[framework.name] || [];

      // Check if any keyword appears in text
      const hasMatch = keywords.some(keyword =>
        lowerText.includes(keyword.toLowerCase())
      );

      if (hasMatch) {
        candidates.push(framework);
      }
    }

    return candidates;
  }

  /**
   * Calculate relevance score using AI
   */
  private async calculateRelevanceScore(
    chunkText: string,
    framework: ComplianceFramework
  ): Promise<number> {
    try {
      // Use AI to determine relevance
      const prompt = `You are a compliance expert. Analyze the following text and determine how relevant it is to ${framework.displayName} (${framework.description}).

Text to analyze:
"""
${chunkText.substring(0, 1000)}
"""

Rate the relevance on a scale of 0.0 to 1.0, where:
- 0.0-0.3: Not relevant
- 0.3-0.6: Somewhat relevant
- 0.6-0.8: Relevant
- 0.8-1.0: Highly relevant

Respond with ONLY a number between 0.0 and 1.0. No explanation needed.`;

      const response = await this.env.AI.run('text-generation', {
        prompt,
        max_tokens: 10,
        temperature: 0.1,
      });

      // Parse AI response
      const responseText = response?.response || response || '0';
      const score = parseFloat(responseText.trim());

      // Validate score
      if (isNaN(score) || score < 0 || score > 1) {
        this.env.logger.warn('Invalid AI relevance score, using keyword fallback', {
          framework: framework.name,
          aiResponse: responseText,
        });

        // Fallback to keyword density
        return this.calculateKeywordDensity(chunkText, framework);
      }

      return score;

    } catch (error) {
      this.env.logger.error('AI relevance scoring failed, using keyword fallback', {
        framework: framework.name,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to keyword density
      return this.calculateKeywordDensity(chunkText, framework);
    }
  }

  /**
   * Fallback: Calculate relevance based on keyword density
   */
  private calculateKeywordDensity(
    text: string,
    framework: ComplianceFramework
  ): number {
    const lowerText = text.toLowerCase();
    const keywords = this.FRAMEWORK_KEYWORDS[framework.name] || [];
    const words = text.split(/\s+/).length;

    let matchCount = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = lowerText.match(regex);
      matchCount += matches ? matches.length : 0;
    }

    // Calculate density (matches per 100 words)
    const density = (matchCount / words) * 100;

    // Convert density to score (0-1 range)
    // Density of 2% = score 0.6, 5% = 0.8, 10%+ = 1.0
    let score = Math.min(0.5 + (density * 0.05), 1.0);

    return Math.round(score * 100) / 100; // Round to 2 decimals
  }

  /**
   * Store a tag in the database
   */
  private async storeTag(
    chunkId: number,
    frameworkId: number,
    relevanceScore: number,
    autoTagged: boolean
  ): Promise<void> {
    try {
      await (this.env.AUDITGUARD_DB as any).prepare(
        `INSERT INTO document_chunk_frameworks
         (chunk_id, framework_id, relevance_score, auto_tagged, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (chunk_id, framework_id)
         DO UPDATE SET relevance_score = ?, auto_tagged = ?`
      ).bind(
        chunkId,
        frameworkId,
        relevanceScore,
        autoTagged ? 1 : 0,
        Date.now(),
        relevanceScore,
        autoTagged ? 1 : 0
      ).run();

      this.env.logger.info('Tag stored', {
        chunkId,
        frameworkId,
        relevanceScore,
        autoTagged,
      });

    } catch (error) {
      this.env.logger.error('Failed to store tag', {
        chunkId,
        frameworkId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get all active compliance frameworks
   */
  private async getActiveFrameworks(): Promise<ComplianceFramework[]> {
    try {
      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT id, name, display_name, description
         FROM compliance_frameworks
         WHERE is_active = 1
         ORDER BY name`
      ).all();

      return result.results?.map((row: any) => ({
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        keywords: this.FRAMEWORK_KEYWORDS[row.name] || [],
      })) || [];

    } catch (error) {
      this.env.logger.error('Failed to get active frameworks', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
