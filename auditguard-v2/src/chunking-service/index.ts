/**
 * Chunking Service
 * Intelligently chunks document text for vector embeddings
 * Token-based splitting with sliding window overlap and structure preservation
 */

export interface ChunkConfig {
  maxChunkSize: number;       // Maximum tokens per chunk (default: 512)
  overlapSize: number;         // Token overlap between chunks (default: 128)
  preserveStructure: boolean;  // Keep headers with content (default: true)
  respectBoundaries: boolean;  // Don't split mid-sentence (default: true)
}

export interface ChunkMetadata {
  startChar: number;
  endChar: number;
  tokenCount: number;
  hasHeader: boolean;
  sectionTitle?: string;
}

export interface Chunk {
  text: string;
  index: number;
  metadata: ChunkMetadata;
}

export interface ChunkingResult {
  chunks: Chunk[];
  totalChunks: number;
  totalTokens: number;
  averageChunkSize: number;
}

export class ChunkingService {
  private env: any;
  private readonly DEFAULT_CONFIG: ChunkConfig = {
    maxChunkSize: 512,
    overlapSize: 128,
    preserveStructure: true,
    respectBoundaries: true,
  };

  constructor(env: any) {
    this.env = env;
  }

  /**
   * Main entry point - chunk text into overlapping segments
   * @param text Clean text to chunk
   * @param contentType Document content type for optimization
   * @param config Optional chunking configuration
   */
  async chunkText(
    text: string,
    contentType: string = 'text/plain',
    config: Partial<ChunkConfig> = {}
  ): Promise<ChunkingResult> {
    const fullConfig: ChunkConfig = { ...this.DEFAULT_CONFIG, ...config };

    this.env.logger.info('Starting text chunking', {
      textLength: text.length,
      contentType,
      config: fullConfig,
    });

    // Normalize text: collapse whitespace, normalize line breaks
    const normalizedText = this.normalizeText(text);

    // Tokenize text
    const tokens = this.tokenize(normalizedText);
    const totalTokens = tokens.length;

    this.env.logger.info('Text tokenization complete', {
      totalTokens,
      approximateChunks: Math.ceil(
        (totalTokens - fullConfig.overlapSize) / (fullConfig.maxChunkSize - fullConfig.overlapSize)
      ),
    });

    // Create chunks with sliding window
    const chunks = this.createChunks(normalizedText, tokens, fullConfig);

    // Calculate statistics
    const averageChunkSize = chunks.reduce((sum, c) => sum + c.metadata.tokenCount, 0) / chunks.length;

    const result: ChunkingResult = {
      chunks,
      totalChunks: chunks.length,
      totalTokens,
      averageChunkSize: Math.round(averageChunkSize),
    };

    this.env.logger.info('Chunking complete', {
      totalChunks: result.totalChunks,
      averageChunkSize: result.averageChunkSize,
      totalTokens: result.totalTokens,
    });

    return result;
  }

  /**
   * Normalize text for consistent chunking
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line breaks
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')    // Convert tabs to spaces
      .replace(/ +/g, ' ')    // Collapse multiple spaces
      .trim();
  }

  /**
   * Simple whitespace tokenization (Worker-compatible, no external deps)
   * Approximate token count: split on whitespace
   */
  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter(token => token.length > 0);
  }

  /**
   * Create chunks with sliding window overlap
   */
  private createChunks(text: string, tokens: string[], config: ChunkConfig): Chunk[] {
    const chunks: Chunk[] = [];
    const { maxChunkSize, overlapSize } = config;

    // Calculate stride (step size between chunks)
    const stride = maxChunkSize - overlapSize;

    let chunkIndex = 0;
    let startTokenIndex = 0;

    while (startTokenIndex < tokens.length) {
      // Determine end token index for this chunk
      const endTokenIndex = Math.min(startTokenIndex + maxChunkSize, tokens.length);

      // Extract chunk tokens
      const chunkTokens = tokens.slice(startTokenIndex, endTokenIndex);

      // Reconstruct text from tokens (approximate - preserves words but not exact spacing)
      const chunkText = chunkTokens.join(' ');

      // Find character positions in original text
      const charPositions = this.findCharacterPositions(text, chunkText, startTokenIndex, tokens);

      // Respect sentence boundaries if enabled
      let finalChunkText = chunkText;
      let finalEndChar = charPositions.endChar;

      if (config.respectBoundaries && endTokenIndex < tokens.length) {
        const adjusted = this.adjustToSentenceBoundary(text, charPositions.startChar, charPositions.endChar);
        finalChunkText = adjusted.text;
        finalEndChar = adjusted.endChar;
      }

      // Detect headers and extract section title
      const headerInfo = this.detectHeader(finalChunkText);

      // Create chunk
      const chunk: Chunk = {
        text: finalChunkText,
        index: chunkIndex,
        metadata: {
          startChar: charPositions.startChar,
          endChar: finalEndChar,
          tokenCount: chunkTokens.length,
          hasHeader: headerInfo.hasHeader,
          sectionTitle: headerInfo.sectionTitle,
        },
      };

      chunks.push(chunk);

      // Move to next chunk position
      startTokenIndex += stride;
      chunkIndex++;

      // Prevent infinite loop for very small documents
      if (endTokenIndex >= tokens.length) {
        break;
      }
    }

    return chunks;
  }

  /**
   * Find approximate character positions for chunk tokens in original text
   * Uses fuzzy matching since tokenization may not preserve exact spacing
   */
  private findCharacterPositions(
    fullText: string,
    chunkText: string,
    tokenIndex: number,
    allTokens: string[]
  ): { startChar: number; endChar: number } {
    // Simple approach: search for first few tokens to find start position
    const searchTokens = allTokens.slice(tokenIndex, tokenIndex + 3).join(' ');
    const startChar = fullText.indexOf(searchTokens);

    if (startChar === -1) {
      // Fallback: estimate based on token index
      const avgCharsPerToken = fullText.length / allTokens.length;
      const estimatedStart = Math.floor(tokenIndex * avgCharsPerToken);
      const estimatedEnd = Math.min(estimatedStart + chunkText.length, fullText.length);
      return { startChar: estimatedStart, endChar: estimatedEnd };
    }

    const endChar = Math.min(startChar + chunkText.length, fullText.length);
    return { startChar, endChar };
  }

  /**
   * Adjust chunk boundaries to avoid splitting sentences
   */
  private adjustToSentenceBoundary(
    fullText: string,
    startChar: number,
    endChar: number
  ): { text: string; endChar: number } {
    // Look for sentence-ending punctuation within last 100 chars of chunk
    const lookbackDistance = Math.min(100, endChar - startChar);
    const searchStart = Math.max(startChar, endChar - lookbackDistance);
    const searchText = fullText.substring(searchStart, endChar);

    // Find last sentence boundary (. ! ? followed by space or newline)
    const sentenceBoundaryRegex = /[.!?][\s\n]/g;
    let lastBoundary = -1;
    let match;

    while ((match = sentenceBoundaryRegex.exec(searchText)) !== null) {
      lastBoundary = match.index + 1; // Include the punctuation
    }

    if (lastBoundary > 0) {
      // Adjust to sentence boundary
      const adjustedEndChar = searchStart + lastBoundary + 1; // +1 for the space/newline
      const adjustedText = fullText.substring(startChar, adjustedEndChar).trim();
      return { text: adjustedText, endChar: adjustedEndChar };
    }

    // No sentence boundary found, return original
    return { text: fullText.substring(startChar, endChar).trim(), endChar };
  }

  /**
   * Detect if chunk starts with a header
   * Supports Markdown headers (# ##) and all-caps lines
   */
  private detectHeader(text: string): { hasHeader: boolean; sectionTitle?: string } {
    const lines = text.split('\n');
    if (lines.length === 0) {
      return { hasHeader: false };
    }

    const firstLine = lines[0].trim();

    // Markdown header detection (# ## ### etc)
    const markdownHeaderMatch = firstLine.match(/^(#{1,6})\s+(.+)$/);
    if (markdownHeaderMatch) {
      return {
        hasHeader: true,
        sectionTitle: markdownHeaderMatch[2].trim(),
      };
    }

    // All-caps header detection (at least 3 words, all uppercase)
    const words = firstLine.split(/\s+/);
    const isAllCaps = words.length >= 3 &&
      words.every(word => word === word.toUpperCase() && /[A-Z]/.test(word));

    if (isAllCaps) {
      return {
        hasHeader: true,
        sectionTitle: firstLine,
      };
    }

    // Check if first line is short and ends with colon (common section pattern)
    if (firstLine.length < 60 && firstLine.endsWith(':')) {
      return {
        hasHeader: true,
        sectionTitle: firstLine.slice(0, -1), // Remove colon
      };
    }

    return { hasHeader: false };
  }

  /**
   * Validate chunking result quality
   */
  validateChunking(result: ChunkingResult): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check for empty chunks
    const emptyChunks = result.chunks.filter(c => c.text.trim().length === 0);
    if (emptyChunks.length > 0) {
      warnings.push(`Found ${emptyChunks.length} empty chunks`);
    }

    // Check for very small chunks (< 50 tokens)
    const smallChunks = result.chunks.filter(c => c.metadata.tokenCount < 50);
    if (smallChunks.length > 0) {
      warnings.push(`Found ${smallChunks.length} very small chunks (< 50 tokens)`);
    }

    // Check for very large chunks (> 600 tokens)
    const largeChunks = result.chunks.filter(c => c.metadata.tokenCount > 600);
    if (largeChunks.length > 0) {
      warnings.push(`Found ${largeChunks.length} very large chunks (> 600 tokens)`);
    }

    // Check average chunk size deviation
    const avgSize = result.averageChunkSize;
    const sizesDeviation = result.chunks.map(c =>
      Math.abs(c.metadata.tokenCount - avgSize) / avgSize
    );
    const highDeviation = sizesDeviation.filter(d => d > 0.5).length;
    if (highDeviation > result.totalChunks * 0.3) {
      warnings.push(`High chunk size variation detected (${highDeviation} chunks deviate >50% from average)`);
    }

    const isValid = warnings.length === 0;

    return { isValid, warnings };
  }

  /**
   * Get optimal chunk config for document type
   */
  getOptimalConfig(contentType: string): ChunkConfig {
    const baseConfig = { ...this.DEFAULT_CONFIG };

    // Document type optimizations
    if (contentType.includes('pdf')) {
      // PDFs: Larger chunks for section-based content
      return {
        ...baseConfig,
        maxChunkSize: 600,
        overlapSize: 150,
      };
    } else if (contentType.includes('word') || contentType.includes('docx')) {
      // DOCX: Medium chunks for paragraph-based content
      return {
        ...baseConfig,
        maxChunkSize: 512,
        overlapSize: 128,
      };
    } else if (contentType.includes('markdown') || contentType.includes('text')) {
      // Markdown/Text: Standard chunks with strong structure preservation
      return {
        ...baseConfig,
        maxChunkSize: 512,
        overlapSize: 128,
        preserveStructure: true,
      };
    }

    return baseConfig;
  }
}
