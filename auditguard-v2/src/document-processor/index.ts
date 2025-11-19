import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';
import { VultrStorageService } from '../storage-service';
import { TextExtractionService } from '../text-extraction-service';
import { ChunkingService } from '../chunking-service';
import { ComplianceTaggingService } from '../compliance-tagging-service';
import { EmbeddingService } from '../embedding-service';
import { enrichDocument, type EnrichmentInput } from '../common/ai-enrichment';
import { ProcessingStepTracker } from '../common/processing-step-tracker';

export interface Body {
  documentId: string;
  workspaceId: string;
  userId?: string;  // Optional: not needed for embedding generation
  vultrKey?: string;  // NEW: Vultr S3 key for new documents
  storageKey?: string;  // OLD: SmartBucket key for legacy documents
  action?: string;  // NEW: 'extract_and_index' or undefined (legacy)
  frameworkId?: number;  // Phase 4: Compliance framework for auto-tagging
  runComplianceCheck?: boolean;  // NEW: Optional flag to run compliance check after indexing
  framework?: string;  // NEW: Optional framework name (e.g., 'SOC2', 'HIPAA', 'auto')

  // Embedding generation fields
  type?: string;  // 'generate_embedding' for individual chunk processing
  chunkId?: string;
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

      // REPROCESS FLOW: Full pipeline reprocessing (delete old data first)
      if (action === 'reprocess' && vultrKey) {
        await this.processReprocessing(documentId, workspaceId, userId, vultrKey, message);
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

    // Initialize step tracker
    const stepTracker = new ProcessingStepTracker(this.env.AUDITGUARD_DB, this.env.logger);
    await stepTracker.initializeSteps(documentId);

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
      await stepTracker.startStep(documentId, 'extraction');

      this.env.logger.info('Extracting text from document', {
        documentId,
        contentType: document.contentType,
        filename: document.filename,
      });

      const textExtractor = new TextExtractionService(this.env);
      const { text, pageCount, wordCount, characterCount, metadata } = await textExtractor.extractText(
        originalFile,
        document.contentType,
        document.filename
      );

      // Validate extraction quality
      const validation = textExtractor.validateExtraction({ text, pageCount, wordCount, characterCount, metadata });
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

      await stepTracker.completeStep(documentId, 'extraction', { wordCount, pageCount, characterCount });

      // STEP 3A: Chunk the text for vector embeddings
      await stepTracker.startStep(documentId, 'chunking');

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

      await stepTracker.completeStep(documentId, 'chunking', { chunkCount: chunkingResult.totalChunks });

      // ============================================================================
      // PHASE 2.2: DIRECT RAINDROP AI EMBEDDING GENERATION (NO EXTERNAL API)
      // ============================================================================
      
      this.env.logger.info('� Phase 2.2: Starting embedding generation with Raindrop AI', {
        documentId,
        workspaceId,
        totalChunks: chunkingResult.chunks.length,
        model: 'bge-small-en',
        dimensions: 384
      });

      let embeddingResult: any = null;

      try {
        // Update status to indicate vector indexing started
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET vector_indexing_status = 'processing',
               chunks_created = ?,
               chunk_count = ?
           WHERE id = ?`
        ).bind(
          chunkingResult.chunks.length,
          chunkingResult.chunks.length,
          documentId
        ).run();

        this.env.logger.info('📊 Phase 2.2: Document status set to processing', {
          documentId,
          totalChunks: chunkingResult.chunks.length
        });

        // STEP 3B: Store chunks in D1 database (NEW Phase 2.2)
        const chunkIds: string[] = [];
        for (let i = 0; i < chunkingResult.chunks.length; i++) {
          const chunk = chunkingResult.chunks[i];
          const chunkIdStr = `chunk_${documentId}_${i}`; // String ID for D1
          chunkIds.push(chunkIdStr);

          // Calculate word count and character count from text
          const wordCount = chunk.text.split(/\s+/).filter(w => w.length > 0).length;
          const characterCount = chunk.text.length;

          // Insert chunk into D1 (will create table via migration)
          try {
            await (this.env.AUDITGUARD_DB as any).prepare(
              `INSERT INTO document_chunks
               (id, document_id, workspace_id, chunk_index, chunk_text, word_count, character_count, embedding_status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
            ).bind(
              chunkIdStr,
              documentId,
              workspaceId,
              i,
              chunk.text,
              wordCount,
              characterCount,
              Date.now()
            ).run();
          } catch (chunkError: any) {
            // If table doesn't exist yet, log warning but continue
            // Migration will create table on next deployment
            if (chunkError.message?.includes('no such table')) {
              this.env.logger.warn('📊 Phase 2.2: document_chunks table not found (migration pending)', {
                documentId,
                chunkIndex: i,
                note: 'Chunks will be stored in Vector Index metadata only'
              });
            } else {
              throw chunkError;
            }
          }
        }

        this.env.logger.info('📊 Phase 2.2: Chunks stored in D1', {
          documentId,
          chunksStored: chunkingResult.chunks.length
        });

        // STEP 3C: Generate embeddings using Raindrop AI (Phase 2.1 code)
        await stepTracker.startStep(documentId, 'embedding');

        const embeddingService = new EmbeddingService(this.env);
        const startTime = Date.now();
        let embeddingsGenerated = 0;

        // Process chunks in batches for progress tracking
        const PROGRESS_BATCH_SIZE = 10; // Report progress every 10 chunks
        for (let i = 0; i < chunkingResult.chunks.length; i += PROGRESS_BATCH_SIZE) {
          const batchEnd = Math.min(i + PROGRESS_BATCH_SIZE, chunkingResult.chunks.length);
          const batchChunks = chunkingResult.chunks.slice(i, batchEnd);
          const batchChunkIds = chunkIds.slice(i, batchEnd);

          // Generate and store embeddings for this batch
          await embeddingService.generateAndStoreEmbeddings(
            documentId,
            workspaceId,
            batchChunks, // Pass full Chunk objects
            batchChunkIds
          );

          embeddingsGenerated = batchEnd;
          const percentage = Math.round((embeddingsGenerated / chunkingResult.chunks.length) * 100);

          this.env.logger.info('📊 Phase 2.2: Embedding generation progress', {
            documentId,
            embeddingsGenerated,
            totalChunks: chunkingResult.chunks.length,
            percentage: `${percentage}%`,
            batchStart: i,
            batchEnd
          });

          // Update progress in database
          await (this.env.AUDITGUARD_DB as any).prepare(
            `UPDATE documents
             SET embeddings_generated = ?
             WHERE id = ?`
          ).bind(embeddingsGenerated, documentId).run();

          // Update step tracker progress
          await stepTracker.updateStepProgress(documentId, 'embedding', embeddingsGenerated, chunkingResult.chunks.length);
        }

        const duration = Date.now() - startTime;

        this.env.logger.info('✅ Phase 2.2: All embeddings generated', {
          documentId,
          totalChunks: chunkingResult.chunks.length,
          embeddingsGenerated,
          duration: `${duration}ms`,
          throughput: `${(embeddingsGenerated / (duration / 1000)).toFixed(2)} chunks/sec`
        });

        await stepTracker.completeStep(documentId, 'embedding', { embeddingsGenerated });

        // STEP 3D: Wait for Raindrop Vector Index to complete indexing (3-5 seconds)
        await stepTracker.startStep(documentId, 'indexing');

        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET vector_indexing_status = 'indexing'
           WHERE id = ?`
        ).bind(documentId).run();

        this.env.logger.info('⏳ Phase 2.2: Waiting 5 seconds for vector indexing', {
          documentId,
          totalChunks: chunkingResult.chunks.length,
          note: 'Raindrop Vector Index needs 3-5 seconds to complete indexing'
        });

        await new Promise(resolve => setTimeout(resolve, 5000));

        // STEP 3E: Mark as completed
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET vector_indexing_status = 'completed'
           WHERE id = ?`
        ).bind(documentId).run();

        await stepTracker.completeStep(documentId, 'indexing');

        embeddingResult = {
          successCount: embeddingsGenerated,
          failureCount: 0,
          duration
        };

        this.env.logger.info('🎉 Phase 2.2: Document fully indexed and searchable', {
          documentId,
          totalChunks: chunkingResult.chunks.length,
          embeddingsGenerated,
          status: 'completed',
          duration: `${duration}ms`
        });

      } catch (error) {
        this.env.logger.error('❌ Phase 2.2: Embedding generation failed', {
          documentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Mark as failed
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET vector_indexing_status = 'failed'
           WHERE id = ?`
        ).bind(documentId).run();

        throw error; // Re-throw to trigger retry logic
      }

      // STEP 3F: Auto-tagging with compliance frameworks (Phase 2.2)
      // TODO: Implement compliance tagging in a separate service
      // For now, skip auto-tagging (can be added in Phase 3)

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

      // CRITICAL FIX: Update storage_key in database IMMEDIATELY after SmartBucket upload
      // This ensures compliance checks can access the document content
      await (this.env.AUDITGUARD_DB as any).prepare(
        `UPDATE documents
         SET storage_key = ?,
             extracted_text_key = ?,
             extraction_status = 'completed',
             word_count = ?,
             page_count = ?,
             character_count = ?,
             updated_at = ?
         WHERE id = ?`
      ).bind(
        smartBucketKey,
        smartBucketKey,
        wordCount,
        pageCount,
        characterCount,
        Date.now(),
        documentId
      ).run();

      this.env.logger.info('✅ storage_key updated in database', {
        documentId,
        smartBucketKey,
        note: 'Document is now accessible for compliance checks',
      });

      // STEP 5: AI ENRICHMENT - Generate title, description, category, and detect compliance framework
      // ⚠️ CRITICAL FIX: This MUST run BEFORE marking status as 'completed'
      // Otherwise UI polling stops before enrichment data is available
      await stepTracker.startStep(documentId, 'enrichment');

      this.env.logger.info('🤖 Starting AI enrichment for document metadata', {
        documentId,
        wordCount,
        pageCount,
      });

      try {
        // Prepare enrichment input
        const enrichmentInput: EnrichmentInput = {
          filename: document.filename,
          contentType: document.contentType,
          text,
          wordCount,
          pageCount: pageCount || undefined,
        };

        // Call AI enrichment utility
        const enrichmentResult = await enrichDocument(enrichmentInput, {
          AI: this.env.AI,
          AUDITGUARD_DB: this.env.AUDITGUARD_DB,
          logger: this.env.logger,
        });

        this.env.logger.info('✅ AI enrichment successful', {
          documentId,
          title: enrichmentResult.title,
          category: enrichmentResult.category,
          hasFramework: enrichmentResult.complianceFrameworkId !== null,
          frameworkId: enrichmentResult.complianceFrameworkId,
        });

        // CRITICAL FIX: Update database with enriched metadata AND fully_completed flag
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET title = ?,
               description = ?,
               category = ?,
               compliance_framework_id = ?,
               word_count = ?,
               page_count = ?,
               character_count = ?,
               fully_completed = 1,
               updated_at = ?
           WHERE id = ?`
        ).bind(
          enrichmentResult.title,
          enrichmentResult.description,
          enrichmentResult.category,
          enrichmentResult.complianceFrameworkId,
          wordCount,
          pageCount,
          characterCount,
          Date.now(),
          documentId
        ).run();

        this.env.logger.info('✅ Enriched metadata saved and document marked as fully completed', {
          documentId,
          title: enrichmentResult.title,
          category: enrichmentResult.category,
          framework: enrichmentResult.complianceFrameworkId,
        });

        await stepTracker.completeStep(documentId, 'enrichment', {
          title: enrichmentResult.title,
          category: enrichmentResult.category,
          frameworkId: enrichmentResult.complianceFrameworkId,
        });

        // PHASE 2.2: CONDITIONAL compliance analysis - Only run if explicitly requested
        const shouldRunComplianceCheck = message.body.runComplianceCheck === true;
        
        if (shouldRunComplianceCheck) {
          // User explicitly requested compliance check at upload time
          const requestedFramework = message.body.framework;
          const detectedFrameworkId = enrichmentResult.complianceFrameworkId;
          
          this.env.logger.info('🔍 User requested compliance check at upload', {
            documentId,
            requestedFramework,
            detectedFrameworkId,
          });

          let frameworkToUse: string | null = null;
          let frameworkIdToUse: number | null = null;

          // Determine which framework to use
          if (requestedFramework && requestedFramework !== 'auto') {
            // User specified a framework - use it
            frameworkToUse = requestedFramework;
            
            // Get framework ID from database
            const frameworkResult = await (this.env.AUDITGUARD_DB as any).prepare(
              `SELECT id, name FROM compliance_frameworks WHERE name = ?`
            ).bind(requestedFramework).first();

            if (frameworkResult) {
              frameworkIdToUse = frameworkResult.id;
              this.env.logger.info('📋 Using user-specified framework', {
                documentId,
                framework: requestedFramework,
                frameworkId: frameworkIdToUse,
              });
            } else {
              this.env.logger.warn('⚠️ User-specified framework not found, falling back to auto-detect', {
                documentId,
                requestedFramework,
              });
              // Fall back to auto-detected framework
              if (detectedFrameworkId) {
                const detectedFrameworkResult = await (this.env.AUDITGUARD_DB as any).prepare(
                  `SELECT name FROM compliance_frameworks WHERE id = ?`
                ).bind(detectedFrameworkId).first();
                if (detectedFrameworkResult) {
                  frameworkToUse = detectedFrameworkResult.name;
                  frameworkIdToUse = detectedFrameworkId;
                }
              }
            }
          } else {
            // User selected 'auto' or didn't specify - use AI-detected framework
            if (detectedFrameworkId) {
              const frameworkResult = await (this.env.AUDITGUARD_DB as any).prepare(
                `SELECT name FROM compliance_frameworks WHERE id = ?`
              ).bind(detectedFrameworkId).first();

              if (frameworkResult) {
                frameworkToUse = frameworkResult.name;
                frameworkIdToUse = detectedFrameworkId;
                this.env.logger.info('🤖 Using AI-detected framework', {
                  documentId,
                  framework: frameworkToUse,
                  frameworkId: frameworkIdToUse,
                });
              }
            } else {
              this.env.logger.warn('⚠️ Auto-detect failed: No framework detected by AI', {
                documentId,
              });
            }
          }

          // Run compliance check if we have a framework
          if (frameworkToUse && frameworkIdToUse) {
            try {
              await stepTracker.startStep(documentId, 'compliance_analysis');

              this.env.logger.info('🔍 Starting compliance analysis', {
                documentId,
                framework: frameworkToUse,
                frameworkId: frameworkIdToUse,
                source: requestedFramework && requestedFramework !== 'auto' ? 'user-specified' : 'auto-detected',
              });

              // Trigger compliance analysis
              const complianceResult = await this.env.COMPLIANCE_SERVICE.runComplianceCheck({
                documentId,
                workspaceId,
                userId,
                framework: frameworkToUse as any,
              });

              await stepTracker.completeStep(documentId, 'compliance_analysis', {
                framework: frameworkToUse,
                checkId: complianceResult.checkId,
                status: complianceResult.status,
              });

              this.env.logger.info('✅ Compliance analysis completed', {
                documentId,
                framework: frameworkToUse,
                checkId: complianceResult.checkId,
                status: complianceResult.status,
              });
            } catch (complianceError) {
              this.env.logger.error('❌ Compliance analysis failed', {
                documentId,
                framework: frameworkToUse,
                error: complianceError instanceof Error ? complianceError.message : String(complianceError),
                stack: complianceError instanceof Error ? complianceError.stack : undefined,
              });

              await stepTracker.failStep(
                documentId,
                'compliance_analysis',
                complianceError instanceof Error ? complianceError.message : String(complianceError)
              );

              // Don't fail the entire pipeline - compliance is non-critical
              // Continue processing normally
            }
          } else {
            this.env.logger.warn('⚠️ Cannot run compliance check: No framework available', {
              documentId,
              requestedFramework,
              detectedFrameworkId,
            });
          }
        } else {
          // User did NOT request compliance check - skip it entirely
          this.env.logger.info('ℹ️ Compliance check not requested by user, skipping', {
            documentId,
            runComplianceCheck: message.body.runComplianceCheck,
          });
        }

      } catch (enrichmentError) {
        this.env.logger.error('❌ AI enrichment failed', {
          documentId,
          error: enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError),
          stack: enrichmentError instanceof Error ? enrichmentError.stack : undefined,
        });

        // CRITICAL FIX: Still mark as fully_completed even if enrichment fails
        // This prevents infinite polling
        try {
          await (this.env.AUDITGUARD_DB as any).prepare(
            `UPDATE documents
             SET fully_completed = 1,
                 updated_at = ?
             WHERE id = ?`
          ).bind(Date.now(), documentId).run();

          this.env.logger.info('⚠️ Document marked as fully completed despite enrichment failure', {
            documentId,
          });
        } catch (updateError) {
          this.env.logger.error('❌ Failed to set fully_completed flag', {
            documentId,
            error: updateError instanceof Error ? updateError.message : String(updateError),
          });
        }
      }

      // STEP 6: Update database with final processing results
      // ⚠️ CRITICAL: This is done AFTER enrichment so UI sees enrichment data
      await this.env.DOCUMENT_SERVICE.updateDocumentProcessing(documentId, {
        textExtracted: true,
        chunkCount: chunkingResult.totalChunks,  // Custom chunks created
        processingStatus: 'completed',  // All processing complete (extraction, chunking, embeddings)
        processedAt: Date.now(),
        extractedTextKey: smartBucketKey,
        extractedText: text,  // Store full text in database for immediate access
        pageCount: pageCount,
        wordCount: wordCount,
      });

      this.env.logger.info('✅ Document processing COMPLETED successfully', {
        documentId,
        wordCount,
        pageCount,
        chunkCount: chunkingResult.totalChunks,
        embeddingsGenerated: embeddingResult?.successCount || 0,
        smartBucketKey,
        status: 'completed',
      });

      // Send document processed email notification
      try {
        await this.sendDocumentProcessedEmail(documentId, workspaceId, userId);
      } catch (emailError) {
        this.env.logger.error('Failed to send document processed email', {
          documentId,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
        // Don't fail the processing if email fails
      }

      // Acknowledge success - SmartBucket will continue indexing in background
      message.ack();

    } catch (error) {
      this.env.logger.error('Text extraction failed', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.env.DOCUMENT_SERVICE.updateProcessingStatus(documentId, 'failed');

      // Send document processing failed email notification
      try {
        await this.sendDocumentProcessingFailedEmail(
          documentId,
          workspaceId,
          userId,
          error instanceof Error ? error.message : String(error)
        );
      } catch (emailError) {
        this.env.logger.error('Failed to send document processing failed email', {
          documentId,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
        // Don't fail further if email fails
      }

      throw error;
    }
  }

  /**
   * REPROCESS FLOW: Full pipeline reprocessing
   * Deletes old chunks/embeddings, then runs complete extraction → chunking → embedding → indexing flow
   */
  private async processReprocessing(
    documentId: string,
    workspaceId: string,
    userId: string,
    vultrKey: string,
    message: Message<Body>
  ): Promise<void> {
    this.env.logger.info('🔄 Starting FULL document reprocessing', {
      documentId,
      workspaceId,
      vultrKey,
      note: 'Will delete old data and run complete pipeline',
    });

    // Reset processing steps for reprocessing
    const stepTracker = new ProcessingStepTracker(this.env.AUDITGUARD_DB, this.env.logger);
    await stepTracker.resetSteps(documentId);

    try {
      // STEP 0: Clean up old data before reprocessing
      this.env.logger.info('Cleaning up old document data', {
        documentId,
      });

      // Delete old chunks from D1
      try {
        const deleteResult = await (this.env.AUDITGUARD_DB as any).prepare(
          `DELETE FROM document_chunks WHERE document_id = ?`
        ).bind(documentId).run();

        this.env.logger.info('Deleted old chunks from D1', {
          documentId,
          deletedCount: deleteResult.changes || 0,
        });
      } catch (deleteError) {
        this.env.logger.warn('Failed to delete old chunks (may not exist)', {
          documentId,
          error: deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      }

      // Delete old vectors from Vector Index
      try {
        // Get all vector IDs for this document
        const chunks = await (this.env.AUDITGUARD_DB as any).prepare(
          `SELECT vector_id FROM document_chunks WHERE document_id = ? AND vector_id IS NOT NULL`
        ).bind(documentId).all();

        const vectorIds = chunks.results?.map((c: any) => c.vector_id).filter(Boolean) || [];

        if (vectorIds.length > 0) {
          // Delete from Vector Index in batches of 50
          for (let i = 0; i < vectorIds.length; i += 50) {
            const batch = vectorIds.slice(i, Math.min(i + 50, vectorIds.length));
            await this.env.DOCUMENT_EMBEDDINGS.deleteByIds(batch);
          }

          this.env.logger.info('Deleted old vectors from Vector Index', {
            documentId,
            deletedCount: vectorIds.length,
          });
        }
      } catch (vectorDeleteError) {
        this.env.logger.warn('Failed to delete old vectors', {
          documentId,
          error: vectorDeleteError instanceof Error ? vectorDeleteError.message : String(vectorDeleteError),
        });
      }

      // Reset document metadata for reprocessing
      await (this.env.AUDITGUARD_DB as any).prepare(
        `UPDATE documents
         SET processing_status = 'processing',
             text_extracted = 0,
             chunk_count = 0,
             chunks_created = 0,
             embeddings_generated = 0,
             vector_indexing_status = 'pending',
             extraction_status = 'pending',
             fully_completed = 0,
             updated_at = ?
         WHERE id = ?`
      ).bind(Date.now(), documentId).run();

      this.env.logger.info('✅ Old data cleaned up, starting fresh processing', {
        documentId,
      });

      // STEP 1-9: Run the exact same flow as processNewDocument
      // This ensures consistency between upload and reprocess flows
      await this.processNewDocument(documentId, workspaceId, userId, vultrKey, message);

      this.env.logger.info('🎉 Document reprocessing completed successfully', {
        documentId,
      });

    } catch (error) {
      this.env.logger.error('Document reprocessing failed', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
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
   * PHASE 2.2: Enhanced embedding generation with progress tracking and status updates
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
      // PHASE 2.2: Update status to "processing" with progress tracking
      this.env.logger.info('📊 Starting embedding generation for chunk', {
        documentId,
        chunkId,
        chunkIndex,
      });

      // Use embedding service (static import to avoid worker environment issues)
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

      // CRITICAL RACE CONDITION FIX: Use compare-and-swap pattern
      // This ensures only ONE worker transitions to 'indexing' status
      const updateResult = await (this.env.AUDITGUARD_DB as any).prepare(
        `UPDATE documents
         SET
           embeddings_generated = embeddings_generated + 1,
           vector_indexing_status = CASE
             WHEN embeddings_generated + 1 >= chunks_created AND vector_indexing_status = 'processing'
             THEN 'indexing'
             ELSE vector_indexing_status
           END,
           updated_at = ?
         WHERE id = ?
         RETURNING embeddings_generated, chunks_created, vector_indexing_status`
      ).bind(Date.now(), documentId).first();

      const completedCount = updateResult?.embeddings_generated || 0;
      const totalChunks = updateResult?.chunks_created || 0;
      const newStatus = updateResult?.vector_indexing_status;

      this.env.logger.info('📈 Atomically incremented embeddings_generated counter', {
        documentId,
        chunkId,
        newCount: completedCount,
        totalChunks,
        newStatus,
        percentage: totalChunks > 0 ? Math.round((completedCount / totalChunks) * 100) : 0,
      });

      // CRITICAL FIX: Only the UPDATE that transitioned to 'indexing' will execute this block
      // All other concurrent workers will skip it (idempotent)
      if (newStatus === 'indexing' && completedCount >= totalChunks) {
        this.env.logger.info('⏳ This worker won the race - handling indexing completion', {
          documentId,
          totalEmbeddings: completedCount,
          totalChunks,
          status: 'indexing',
        });

        // Wait for vector indexing to complete (3-5 seconds as per Phase 1 tests)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Mark as completed after indexing delay
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET vector_indexing_status = 'completed',
               updated_at = ?
           WHERE id = ? AND vector_indexing_status = 'indexing'`
        ).bind(Date.now(), documentId).run();

        this.env.logger.info('🎉 Vector indexing completed - document is now searchable', {
          documentId,
          totalEmbeddings: completedCount,
          totalChunks,
          status: 'completed',
        });
      } else if (newStatus === 'processing') {
        // Still processing - this is expected for most chunks
        this.env.logger.info('📊 Embedding progress updated', {
          documentId,
          embeddingsGenerated: completedCount,
          totalChunks,
          percentage: totalChunks > 0
            ? Math.round((completedCount / totalChunks) * 100)
            : 0,
          status: 'processing',
        });
      } else {
        // Status is 'indexing' or 'completed' - another worker is/has handled it
        this.env.logger.info('📊 Embedding counter updated, another worker handling completion', {
          documentId,
          embeddingsGenerated: completedCount,
          totalChunks,
          status: newStatus,
        });
      }

      message.ack();

    } catch (error) {
      this.env.logger.error('❌ Embedding generation failed for chunk', {
        documentId,
        chunkId,
        chunkIndex,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        attempt: message.attempts,
      });

      // PHASE 2.2: Check for batch size error (50 vector limit)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Too many vectors') || errorMessage.includes('Max is 50')) {
        this.env.logger.error('⚠️ BATCH SIZE LIMIT EXCEEDED - Max 50 vectors per upsert', {
          documentId,
          chunkId,
          chunkIndex,
          error: errorMessage,
        });

        // Mark chunk as failed - batch size issue requires manual intervention
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE document_chunks
           SET embedding_status = 'failed'
           WHERE id = ?`
        ).bind(chunkId).run();

        message.ack(); // Don't retry - this is a code bug, not transient failure
        return;
      }

      // Retry with backoff for transient failures
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
   * PHASE 2.2: Enhanced queue embedding generation with progress initialization
   * Queue embedding generation messages for all chunks
   * Messages are sent to DOCUMENT_PROCESSING_QUEUE and processed by the observer
   */
  private async queueEmbeddingGeneration(
    documentId: string,
    workspaceId: string,
    chunks: any[],
    chunkIds: number[]
  ): Promise<void> {
    this.env.logger.info('🚀 Starting async embedding generation with progress tracking', {
      documentId,
      workspaceId,
      chunkCount: chunks.length,
      chunkIdCount: chunkIds.length,
    });

    try {
      // PHASE 2.2: Update document status to "processing" with initial progress (0%)
      await (this.env.AUDITGUARD_DB as any).prepare(
        `UPDATE documents
         SET vector_indexing_status = 'processing',
             chunks_created = ?,
             embeddings_generated = 0,
             updated_at = ?
         WHERE id = ?`
      ).bind(chunks.length, Date.now(), documentId).run();

      this.env.logger.info('📊 Initialized embedding progress tracking', {
        documentId,
        totalChunks: chunks.length,
        initialProgress: 0,
        status: 'processing',
      });

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

          // Log progress every 10 chunks
          if (queuedCount % 10 === 0 || queuedCount === chunks.length) {
            this.env.logger.info('📤 Queuing progress', {
              documentId,
              queuedCount,
              totalChunks: chunks.length,
              percentage: Math.round((queuedCount / chunks.length) * 100),
            });
          }
        } catch (queueError) {
          this.env.logger.error('❌ Failed to queue chunk for embedding', {
            documentId,
            chunkId: chunkIds[i],
            chunkIndex: chunks[i].metadata.chunkIndex,
            error: queueError instanceof Error ? queueError.message : String(queueError),
          });
        }
      }

      this.env.logger.info('✅ Successfully queued all chunks for embedding generation', {
        documentId,
        totalChunks: chunks.length,
        queuedCount: queuedCount,
        failedToQueue: chunks.length - queuedCount,
      });

    } catch (error) {
      this.env.logger.error('❌ Async embedding generation failed critically', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Mark as failed in database
      try {
        await (this.env.AUDITGUARD_DB as any).prepare(
          `UPDATE documents
           SET vector_indexing_status = 'failed',
               updated_at = ?
           WHERE id = ?`
        ).bind(Date.now(), documentId).run();
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

  /**
   * Send document processed email notification
   */
  private async sendDocumentProcessedEmail(
    documentId: string,
    workspaceId: string,
    userId: string
  ): Promise<void> {
    try {
      // Get document, workspace, and user information
      const db = new (await import('kysely')).Kysely<any>({
        dialect: new (await import('../common/kysely-d1')).D1Dialect({ database: this.env.AUDITGUARD_DB }),
      });

      const result = await db
        .selectFrom('documents')
        .innerJoin('workspaces', 'workspaces.id', 'documents.workspace_id')
        .innerJoin('users', 'users.id', 'documents.uploaded_by')
        .leftJoin('compliance_checks', 'compliance_checks.document_id', 'documents.id')
        .select([
          'documents.filename',
          'workspaces.name as workspace_name',
          'users.email as user_email',
          db.fn.count('compliance_checks.id').as('issues_count'),
        ])
        .where('documents.id', '=', documentId)
        .where('documents.uploaded_by', '=', userId)
        .groupBy(['documents.id', 'documents.filename', 'workspaces.name', 'users.email'])
        .executeTakeFirst();

      if (!result) {
        this.env.logger.warn('Could not find document information for email', { documentId });
        return;
      }

      const userName = result.user_email.split('@')[0];
      const issuesFound = Number(result.issues_count) || 0;

      // Queue email notification
      await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
        type: 'document_processed',
        to: result.user_email,
        data: {
          userName,
          documentName: result.filename,
          workspaceName: result.workspace_name,
          issuesFound,
          documentUrl: `https://auditguard.com/workspaces/${workspaceId}/documents/${documentId}`,
        },
      });

      this.env.logger.info('Document processed email queued', {
        documentId,
        userEmail: result.user_email,
      });
    } catch (error) {
      this.env.logger.error('Failed to send document processed email', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Send document processing failed email notification
   */
  private async sendDocumentProcessingFailedEmail(
    documentId: string,
    workspaceId: string,
    userId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      // Get document, workspace, and user information
      const db = new (await import('kysely')).Kysely<any>({
        dialect: new (await import('../common/kysely-d1')).D1Dialect({ database: this.env.AUDITGUARD_DB }),
      });

      const result = await db
        .selectFrom('documents')
        .innerJoin('workspaces', 'workspaces.id', 'documents.workspace_id')
        .innerJoin('users', 'users.id', 'documents.uploaded_by')
        .select([
          'documents.filename',
          'workspaces.name as workspace_name',
          'users.email as user_email',
        ])
        .where('documents.id', '=', documentId)
        .where('documents.uploaded_by', '=', userId)
        .executeTakeFirst();

      if (!result) {
        this.env.logger.warn('Could not find document information for failed email', { documentId });
        return;
      }

      const userName = result.user_email.split('@')[0];

      // Queue email notification
      await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
        type: 'document_processing_failed',
        to: result.user_email,
        data: {
          userName,
          documentName: result.filename,
          workspaceName: result.workspace_name,
          errorMessage,
        },
      });

      this.env.logger.info('Document processing failed email queued', {
        documentId,
        userEmail: result.user_email,
      });
    } catch (error) {
      this.env.logger.error('Failed to send document processing failed email', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
