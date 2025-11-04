import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';
import { VultrStorageService } from '../storage-service';
import { TextExtractionService } from '../text-extraction-service';
import { ChunkingService } from '../chunking-service';
import { ComplianceTaggingService } from '../compliance-tagging-service';

export interface Body {
  documentId: string;
  workspaceId: string;
  userId?: string;  // Optional: not needed for embedding generation
  vultrKey?: string;  // NEW: Vultr S3 key for new documents
  storageKey?: string;  // OLD: SmartBucket key for legacy documents
  action?: string;  // NEW: 'extract_and_index' or undefined (legacy)
  frameworkId?: number;  // Phase 4: Compliance framework for auto-tagging

  // Embedding generation fields
  type?: string;  // 'generate_embedding' for individual chunk processing
  chunkId?: number;
  chunkText?: string;
  chunkIndex?: number;
}

export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    // CRITICAL DEBUG LOG - First thing that runs
    this.env.logger.info('⚡ DOCUMENT PROCESSOR OBSERVER TRIGGERED ⚡', {
      messageBody: message.body,
      attempt: message.attempts,
      timestamp: Date.now(),
    });

    const { documentId, workspaceId, userId, vultrKey, storageKey, action, type } = message.body;

    this.env.logger.info('Observer: Processing message from queue', {
      documentId,
      workspaceId,
      vultrKey,
      storageKey,
      action,
      type,
      attempt: message.attempts,
    });

    try {
      // EMBEDDING GENERATION: Process individual chunk embedding
      if (type === 'generate_embedding') {
        await this.processEmbeddingGeneration(message);
        return;
      }

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

      // STEP 3B: Store chunks in database (check for existing chunks first to handle retries)
      this.env.logger.info('Storing chunks in database', {
        documentId,
        chunkCount: chunkingResult.totalChunks,
      });

      // Check if chunks already exist for this document (retry scenario)
      const existingChunksResult = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT id, chunk_index FROM document_chunks WHERE document_id = ? ORDER BY chunk_index`
      ).bind(documentId).all();

      const existingChunks = existingChunksResult.results || [];
      const chunkIds: number[] = [];

      if (existingChunks.length > 0) {
        this.env.logger.info('Found existing chunks for document (retry scenario)', {
          documentId,
          existingCount: existingChunks.length,
          expectedCount: chunkingResult.totalChunks,
        });

        // Reuse existing chunk IDs
        for (const existingChunk of existingChunks) {
          chunkIds.push(existingChunk.id);
        }
      } else {
        // First time - insert new chunks
        for (const chunk of chunkingResult.chunks) {
          try {
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

            this.env.logger.info('Chunk insert result', {
              documentId,
              chunkIndex: chunk.index,
              hasResult: !!result,
              resultKeys: result ? Object.keys(result) : [],
              resultId: result?.id,
              resultIdType: result?.id ? typeof result.id : 'undefined',
            });

            // Get the inserted chunk ID from RETURNING clause
            if (result && result.id) {
              chunkIds.push(result.id);
            } else {
              this.env.logger.error('Chunk insert did not return ID', {
                documentId,
                chunkIndex: chunk.index,
                result,
              });
            }
          } catch (error) {
            this.env.logger.error('Failed to insert chunk', {
              documentId,
              chunkIndex: chunk.index,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
          }
        }
      }

      this.env.logger.info('Chunks stored in database', {
        documentId,
        storedCount: chunkIds.length,
      });

      // STEP 3C: Queue embedding generation messages
      // IMPORTANT: Must await to ensure messages are sent before worker context cleanup
      this.env.logger.info('Queuing chunks for embedding generation', {
        documentId,
        chunkCount: chunkingResult.chunks.length,
        chunkIdCount: chunkIds.length,
      });

      try {
        await this.queueEmbeddingGeneration(
          documentId,
          workspaceId,
          chunkingResult.chunks,
          chunkIds
        );

        this.env.logger.info('Successfully queued all chunks for embedding', {
          documentId,
          chunkCount: chunkingResult.totalChunks,
        });
      } catch (error) {
        this.env.logger.error('Failed to queue embedding messages', {
          documentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Continue - embeddings can be triggered manually later
      }

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
   * Process individual chunk embedding generation from queue
   * Called for each 'generate_embedding' message
   */
  private async processEmbeddingGeneration(message: Message<Body>): Promise<void> {
    const { documentId, workspaceId, chunkId, chunkText, chunkIndex } = message.body;

    this.env.logger.info('Processing embedding generation for chunk', {
      documentId,
      chunkId,
      chunkIndex,
      attempt: message.attempts,
    });

    if (!documentId || !workspaceId || !chunkId || !chunkText || chunkIndex === undefined) {
      this.env.logger.error('Missing required fields for embedding generation', {
        documentId,
        workspaceId,
        chunkId,
        chunkIndex,
        hasChunkText: !!chunkText,
      });
      message.ack(); // Ack to prevent infinite retries
      return;
    }

    try {
      // Import embedding service dynamically
      const { EmbeddingService } = await import('../embedding-service');
      const embeddingService = new EmbeddingService(this.env);

      // Generate embedding for single chunk
      const chunk = {
        text: chunkText,
        index: chunkIndex,
        metadata: {
          chunkIndex: chunkIndex,
          startChar: 0,  // Not used for embedding generation
          endChar: chunkText.length,
          hasHeader: false,
          sectionTitle: undefined,
          tokenCount: chunkText.split(/\s+/).length,
        },
      };

      this.env.logger.info('Calling embedding service for chunk', {
        documentId,
        chunkId,
        chunkIndex,
        textLength: chunkText.length,
      });

      const result = await embeddingService.generateAndStoreEmbeddings(
        documentId,
        workspaceId,
        [chunk],
        [chunkId]
      );

      this.env.logger.info('Embedding generation completed for chunk', {
        documentId,
        chunkId,
        chunkIndex,
        success: result.successCount > 0,
      });

      // Recalculate embeddings_generated from actual chunk statuses (avoid double-counting on retries)
      const countResult = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT COUNT(*) as count FROM document_chunks
         WHERE document_id = ? AND embedding_status = 'completed'`
      ).bind(documentId).first();

      const completedCount = countResult?.count || 0;

      await (this.env.AUDITGUARD_DB as any).prepare(
        `UPDATE documents
         SET embeddings_generated = ?
         WHERE id = ?`
      ).bind(completedCount, documentId).run();

      this.env.logger.info('Updated embeddings_generated counter from database', {
        documentId,
        chunkId,
        completedCount,
      });

      // Check if all embeddings are complete
      const doc = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT chunks_created, embeddings_generated
         FROM documents
         WHERE id = ?`
      ).bind(documentId).first();

      if (doc && doc.embeddings_generated >= doc.chunks_created) {
        // All embeddings complete!
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET vector_indexing_status = 'completed'
           WHERE id = ?`
        ).bind(documentId).run();

        this.env.logger.info('🎉 All embeddings completed for document', {
          documentId,
          totalEmbeddings: doc.embeddings_generated,
          totalChunks: doc.chunks_created,
        });
      } else {
        this.env.logger.info('Embedding progress updated', {
          documentId,
          embeddingsGenerated: doc?.embeddings_generated || 0,
          totalChunks: doc?.chunks_created || 0,
        });
      }

      message.ack();

    } catch (error) {
      this.env.logger.error('Embedding generation failed for chunk', {
        documentId,
        chunkId,
        chunkIndex,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        attempt: message.attempts,
      });

      // Retry with backoff
      if (message.attempts < 3) {
        const delaySeconds = 10 * message.attempts;
        this.env.logger.info('Retrying embedding generation', {
          documentId,
          chunkId,
          nextAttempt: message.attempts + 1,
          delaySeconds,
        });
        message.retry({ delaySeconds });
      } else {
        // Mark chunk as failed after max retries
        this.env.logger.error('Max retries exceeded for chunk embedding', {
          documentId,
          chunkId,
          chunkIndex,
        });

        try {
          await (this.env.AUDITGUARD_DB as any).prepare(
            `UPDATE document_chunks
             SET embedding_status = 'failed'
             WHERE id = ?`
          ).bind(chunkId).run();

          this.env.logger.info('Marked chunk embedding as failed', {
            documentId,
            chunkId,
          });
        } catch (updateError) {
          this.env.logger.error('Failed to update chunk status', {
            chunkId,
            error: updateError instanceof Error ? updateError.message : String(updateError),
          });
        }

        message.ack(); // Prevent infinite retries
      }
    }
  }

  /**
   * Queue embedding generation messages for all chunks
   * Messages are sent to DOCUMENT_PROCESSING_QUEUE and processed by the observer
   */
  private async queueEmbeddingGeneration(
    documentId: string,
    workspaceId: string,
    chunks: any[],
    chunkIds: number[]
  ): Promise<void> {
    this.env.logger.info('generateEmbeddingsAsync called', {
      documentId,
      workspaceId,
      chunkCount: chunks.length,
      chunkIdCount: chunkIds.length,
    });

    try {
      this.env.logger.info('Async embedding generation started - inside try block', {
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

      // Queue each chunk for embedding generation via message queue
      // This is the correct way to process embeddings in distributed architecture
      let queuedCount = 0;

      for (let i = 0; i < chunks.length; i++) {
        try {
          await (this.env as any).DOCUMENT_PROCESSING_QUEUE.send({
            type: 'generate_embedding',
            chunkId: chunkIds[i],
            documentId: documentId,
            workspaceId: workspaceId,
            chunkText: chunks[i].text,
            chunkIndex: chunks[i].metadata.chunkIndex,
          });

          queuedCount++;

          this.env.logger.info('Queued chunk for embedding generation', {
            documentId,
            chunkId: chunkIds[i],
            chunkIndex: chunks[i].metadata.chunkIndex,
            queuedSoFar: queuedCount,
            totalChunks: chunks.length,
          });
        } catch (queueError) {
          this.env.logger.error('Failed to queue chunk for embedding', {
            documentId,
            chunkId: chunkIds[i],
            chunkIndex: chunks[i].metadata.chunkIndex,
            error: queueError instanceof Error ? queueError.message : String(queueError),
          });
        }
      }

      this.env.logger.info('Successfully queued all chunks for embedding generation', {
        documentId,
        totalChunks: chunks.length,
        queuedCount: queuedCount,
      });

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

  /**
   * Manually trigger embeddings for pending chunks
   * Useful for recovering from stuck/failed embedding generation
   */
  async triggerPendingEmbeddings(): Promise<{
    success: boolean;
    message: string;
    totalPending: number;
    chunksQueued: number;
    errors?: number;
  }> {
    this.env.logger.info('Manually triggering embeddings for pending chunks');

    try {
      // Find all pending chunks
      const pendingChunks = await (this.env.AUDITGUARD_DB as any).prepare(`
        SELECT
          dc.id as chunk_id,
          dc.document_id,
          dc.chunk_index,
          dc.content as chunk_text,
          d.workspace_id
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.embedding_status = 'pending'
        ORDER BY dc.created_at DESC
      `).all();

      const chunks = pendingChunks.results || [];

      if (chunks.length === 0) {
        this.env.logger.info('No pending chunks found');
        return {
          success: true,
          message: 'No pending chunks found',
          totalPending: 0,
          chunksQueued: 0,
        };
      }

      this.env.logger.info(`Found ${chunks.length} pending chunks, queuing for embedding generation`);

      // Queue each chunk via EMBEDDING_QUEUE
      let queuedCount = 0;
      let errors = 0;

      for (const chunk of chunks) {
        try {
          // Update status to processing
          await (this.env.AUDITGUARD_DB as any).prepare(
            `UPDATE document_chunks SET embedding_status = 'processing' WHERE id = ?`
          ).bind(chunk.chunk_id).run();

          // Queue the embedding job
          await (this.env as any).DOCUMENT_PROCESSING_QUEUE.send({
            type: 'generate_embedding',
            chunkId: chunk.chunk_id,
            documentId: chunk.document_id,
            workspaceId: chunk.workspace_id,
            chunkText: chunk.chunk_text,
            chunkIndex: chunk.chunk_index,
          });

          queuedCount++;
          this.env.logger.info(`Queued chunk ${chunk.chunk_index} from document ${chunk.document_id}`, {
            chunkId: chunk.chunk_id,
          });

        } catch (error) {
          errors++;
          this.env.logger.error(`Failed to queue chunk ${chunk.chunk_id}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.env.logger.info(`Successfully queued ${queuedCount} chunks for embedding generation`, {
        totalPending: chunks.length,
        queuedCount,
        errors,
      });

      return {
        success: true,
        message: `Queued ${queuedCount} chunks for embedding generation`,
        totalPending: chunks.length,
        chunksQueued: queuedCount,
        errors: errors > 0 ? errors : undefined,
      };

    } catch (error) {
      this.env.logger.error('Failed to trigger embeddings', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        totalPending: 0,
        chunksQueued: 0,
      };
    }
  }
}
