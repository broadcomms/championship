import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';
import { VultrStorageService } from '../storage-service';
import { TextExtractionService } from '../text-extraction-service';
import { ChunkingService } from '../chunking-service';
import { EmbeddingService } from '../embedding-service';
import { ComplianceTaggingService } from '../compliance-tagging-service';

export interface Body {
  documentId: string;
  workspaceId: string;
  userId: string;
  vultrKey?: string;  // NEW: Vultr S3 key for new documents
  storageKey?: string;  // OLD: SmartBucket key for legacy documents
  action?: string;  // NEW: 'extract_and_index' or undefined (legacy)
  frameworkId?: number;  // Phase 4: Compliance framework for auto-tagging
}

export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    const { documentId, workspaceId, userId, vultrKey, storageKey, action } = message.body;

    this.env.logger.info('Observer: Processing document from queue', {
      documentId,
      workspaceId,
      vultrKey,
      storageKey,
      action,
      attempt: message.attempts,
    });

    try {
      // NEW FLOW: Text extraction + SmartBucket indexing
      if (action === 'extract_and_index' && vultrKey) {
        await this.processNewDocument(documentId, workspaceId, userId, vultrKey, message);
      }
      // LEGACY FLOW: SmartBucket already has the file
      else {
        await this.processLegacyDocument(documentId, workspaceId, userId, message);
      }
    } catch (error) {
      this.env.logger.error('Observer: Document processing failed', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        attempt: message.attempts,
      });

      // Retry on failure (up to 5 attempts with increasing delays)
      if (message.attempts < 5) {
        // Exponential backoff: 30s, 60s, 90s, 120s
        const delaySeconds = Math.min(30 * message.attempts, 120);
        this.env.logger.info('Retrying document processing', {
          documentId,
          nextAttempt: message.attempts + 1,
          delaySeconds,
        });
        message.retry({ delaySeconds }); // Wait with exponential backoff
      } else {
        this.env.logger.error('Max retries exceeded for document processing', {
          documentId,
        });

        // Mark as failed in database
        try {
          await this.env.DOCUMENT_SERVICE.updateProcessingStatus(documentId, 'failed');
        } catch (updateError) {
          this.env.logger.error('Failed to update document status to failed', {
            documentId,
            error: updateError instanceof Error ? updateError.message : 'Unknown error',
          });
        }

        message.ack(); // Prevent infinite retries
      }
    }
  }

  /**
   * NEW FLOW: Download from Vultr → Extract text → Upload to SmartBucket
   */
  private async processNewDocument(
    documentId: string,
    workspaceId: string,
    userId: string,
    vultrKey: string,
    message: Message<Body>
  ): Promise<void> {
    this.env.logger.info('Processing new document with text extraction', {
      documentId,
      vultrKey,
    });

    // Get document metadata from database
    const document = await this.env.DOCUMENT_SERVICE.getDocumentMetadata(documentId);

    try {
      // STEP 1: Download original file from Vultr S3
      await this.env.DOCUMENT_SERVICE.updateProcessingStatus(documentId, 'processing');

      this.env.logger.info('Downloading original file from Vultr S3', {
        documentId,
        vultrKey,
      });

      const vultrStorage = new VultrStorageService(this.env);
      const originalFile = await vultrStorage.getDocument(vultrKey);

      this.env.logger.info('Original file downloaded from Vultr S3', {
        documentId,
        vultrKey,
        fileSize: originalFile.length,
      });

      // STEP 2: Extract clean text
      this.env.logger.info('Extracting text from document', {
        documentId,
        contentType: document.contentType,
        filename: document.filename,
      });

      const textExtractor = new TextExtractionService(this.env);
      const { text, pageCount, wordCount, metadata } = await textExtractor.extractText(
        originalFile,
        document.contentType,
        document.filename
      );

      // Validate extraction quality
      const validation = textExtractor.validateExtraction({ text, pageCount, wordCount, metadata });
      if (!validation.isValid) {
        this.env.logger.warn('Text extraction quality warnings', {
          documentId,
          warnings: validation.warnings,
        });
      }

      this.env.logger.info('Text extraction completed', {
        documentId,
        textLength: text.length,
        textPreview: text.substring(0, 200) + '...',  // First 200 chars for debugging
        wordCount,
        pageCount,
        warnings: validation.warnings,
      });

      // STEP 3A: Chunk the text for vector embeddings
      this.env.logger.info('Starting text chunking for vector embeddings', {
        documentId,
        textLength: text.length,
        contentType: document.contentType,
      });

      const chunkingService = new ChunkingService(this.env);
      const optimalConfig = chunkingService.getOptimalConfig(document.contentType);
      const chunkingResult = await chunkingService.chunkText(
        text,
        document.contentType,
        optimalConfig
      );

      // Validate chunking quality
      const chunkValidation = chunkingService.validateChunking(chunkingResult);
      if (!chunkValidation.isValid) {
        this.env.logger.warn('Chunking quality warnings', {
          documentId,
          warnings: chunkValidation.warnings,
        });
      }

      this.env.logger.info('Text chunking completed', {
        documentId,
        totalChunks: chunkingResult.totalChunks,
        averageChunkSize: chunkingResult.averageChunkSize,
        warnings: chunkValidation.warnings,
      });

      // STEP 3B: Store chunks in database
      this.env.logger.info('Storing chunks in database', {
        documentId,
        chunkCount: chunkingResult.totalChunks,
      });

      const chunkIds: number[] = [];
      for (const chunk of chunkingResult.chunks) {
        const result = await (this.env.AUDITGUARD_DB as any).prepare(
          `INSERT INTO document_chunks (
            document_id, workspace_id, chunk_index, content, chunk_size,
            start_char, end_char, token_count, has_header, section_title,
            embedding_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
          RETURNING id`
        ).bind(
          documentId,
          workspaceId,
          chunk.index,
          chunk.text,
          chunk.text.length,
          chunk.metadata.startChar,
          chunk.metadata.endChar,
          chunk.metadata.tokenCount,
          chunk.metadata.hasHeader ? 1 : 0,
          chunk.metadata.sectionTitle || null,
          Date.now()
        ).first();

        // Get the inserted chunk ID from RETURNING clause
        if (result && result.id) {
          chunkIds.push(result.id);
        }
      }

      this.env.logger.info('Chunks stored in database', {
        documentId,
        storedCount: chunkIds.length,
      });

      // STEP 3C: Generate and store embeddings (parallel with SmartBucket)
      // This runs asynchronously - we don't wait for completion
      this.generateEmbeddingsAsync(
        documentId,
        workspaceId,
        chunkingResult.chunks,
        chunkIds
      ).catch(error => {
        this.env.logger.error('Async embedding generation failed', {
          documentId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      this.env.logger.info('Started async embedding generation', {
        documentId,
        chunkCount: chunkingResult.totalChunks,
      });

      // STEP 3D: Auto-tag chunks with compliance frameworks (Phase 4)
      // This runs asynchronously in parallel with embeddings
      if (message.body.frameworkId || chunkingResult.totalChunks > 0) {
        this.autoTagChunksAsync(
          documentId,
          workspaceId,
          chunkingResult.chunks,
          chunkIds,
          message.body.frameworkId
        ).catch(error => {
          this.env.logger.error('Async auto-tagging failed', {
            documentId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        this.env.logger.info('Started async auto-tagging', {
          documentId,
          chunkCount: chunkingResult.totalChunks,
          frameworkId: message.body.frameworkId,
        });
      }

      // STEP 4: Upload ONLY clean text to SmartBucket (for all file types including PDF)
      const smartBucketKey = `${workspaceId}/${documentId}/extracted.txt`;

      this.env.logger.info('Uploading clean text to SmartBucket', {
        documentId,
        smartBucketKey,
        textLength: text.length,
        wordCount,
        pageCount,
      });

      await this.env.DOCUMENTS_BUCKET.put(smartBucketKey, text, {
        httpMetadata: { contentType: 'text/plain' },
        customMetadata: {
          workspaceId,
          documentId,
          uploadedBy: userId,
          originalFilename: document.filename,
          extractedFrom: document.contentType,
          wordCount: String(wordCount),
          pageCount: pageCount ? String(pageCount) : undefined,
        },
      } as any);

      this.env.logger.info('Clean text uploaded to SmartBucket', {
        documentId,
        smartBucketKey,
      });

      // STEP 5: Update database with extraction results (including full text and chunks)
      await this.env.DOCUMENT_SERVICE.updateDocumentProcessing(documentId, {
        textExtracted: true,
        chunkCount: chunkingResult.totalChunks,  // Custom chunks created
        processingStatus: 'processing',  // SmartBucket now indexing in parallel
        processedAt: Date.now(),
        extractedTextKey: smartBucketKey,
        extractedText: text,  // Store full text in database for immediate access
        pageCount: pageCount,
        wordCount: wordCount,
      });

      this.env.logger.info('Document text extraction completed, SmartBucket indexing', {
        documentId,
        wordCount,
        pageCount,
        smartBucketKey,
      });

      // Acknowledge success - SmartBucket will continue indexing in background
      message.ack();

    } catch (error) {
      this.env.logger.error('Text extraction failed', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.env.DOCUMENT_SERVICE.updateProcessingStatus(documentId, 'failed');
      throw error;
    }
  }

  /**
   * LEGACY FLOW: Process documents that were uploaded directly to SmartBucket
   */
  private async processLegacyDocument(
    documentId: string,
    workspaceId: string,
    userId: string,
    message: Message<Body>
  ): Promise<void> {
    this.env.logger.info('Processing legacy document (SmartBucket direct upload)', {
      documentId,
    });

    // Call the document service to process the document
    // SmartBucket has already indexed it, we just need to verify and update status
    await this.env.DOCUMENT_SERVICE.processDocument(documentId, workspaceId, userId);

    this.env.logger.info('Legacy document processing completed successfully', {
      documentId,
    });

    // Acknowledge successful processing
    message.ack();
  }

  /**
   * Generate embeddings asynchronously in parallel with SmartBucket indexing
   * This allows immediate search capability while SmartBucket processes in background
   */
  private async generateEmbeddingsAsync(
    documentId: string,
    workspaceId: string,
    chunks: any[],
    chunkIds: number[]
  ): Promise<void> {
    try {
      this.env.logger.info('Async embedding generation started', {
        documentId,
        workspaceId,
        chunkCount: chunks.length,
      });

      // Update document status to indicate vector indexing is in progress
      await (this.env.AUDITGUARD_DB as any).prepare(
        `UPDATE documents
         SET vector_indexing_status = 'processing',
             chunks_created = ?
         WHERE id = ?`
      ).bind(chunks.length, documentId).run();

      // Initialize embedding service
      const embeddingService = new EmbeddingService(this.env);

      // Generate and store embeddings (batch processing with retries)
      const result = await embeddingService.generateAndStoreEmbeddings(
        documentId,
        workspaceId,
        chunks,
        chunkIds
      );

      this.env.logger.info('Async embedding generation completed', {
        documentId,
        totalChunks: result.totalChunks,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duration: result.duration,
      });

      // Update document with final embedding stats
      await (this.env.AUDITGUARD_DB as any).prepare(
        `UPDATE documents
         SET embeddings_generated = ?,
             vector_indexing_status = ?
         WHERE id = ?`
      ).bind(
        result.successCount,
        result.failureCount === 0 ? 'completed' : 'partial',
        documentId
      ).run();

    } catch (error) {
      this.env.logger.error('Async embedding generation failed critically', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Mark as failed in database
      try {
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET vector_indexing_status = 'failed'
           WHERE id = ?`
        ).bind(documentId).run();
      } catch (updateError) {
        this.env.logger.error('Failed to update vector indexing status', {
          documentId,
          error: updateError instanceof Error ? updateError.message : String(updateError),
        });
      }

      throw error;
    }
  }

  /**
   * Auto-tag chunks with compliance frameworks asynchronously (Phase 4)
   * Runs in parallel with embedding generation
   */
  private async autoTagChunksAsync(
    documentId: string,
    workspaceId: string,
    chunks: any[],
    chunkIds: number[],
    frameworkId?: number
  ): Promise<void> {
    try {
      this.env.logger.info('Async auto-tagging started', {
        documentId,
        workspaceId,
        chunkCount: chunks.length,
        frameworkId,
      });

      // Initialize tagging service
      const taggingService = new ComplianceTaggingService(this.env);

      // Prepare chunks with IDs for batch tagging
      const chunksWithIds = chunks.map((chunk, index) => ({
        id: chunkIds[index],
        text: chunk.text,
      }));

      // Perform batch auto-tagging
      const result = await taggingService.tagDocumentChunks(documentId, chunksWithIds);

      this.env.logger.info('Async auto-tagging completed', {
        documentId,
        totalChunks: result.totalChunks,
        successCount: result.successCount,
        failureCount: result.failureCount,
        totalTags: result.tags.length,
        duration: result.duration,
      });

      // Update document with tagging stats (optional)
      try {
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET updated_at = ?
           WHERE id = ?`
        ).bind(Date.now(), documentId).run();
      } catch (updateError) {
        this.env.logger.warn('Failed to update document after auto-tagging', {
          documentId,
          error: updateError instanceof Error ? updateError.message : String(updateError),
        });
      }

    } catch (error) {
      this.env.logger.error('Async auto-tagging failed critically', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - auto-tagging is optional, don't fail the entire process
    }
  }
}
