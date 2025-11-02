import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';
import { VultrStorageService } from '../storage-service';
import { TextExtractionService } from '../text-extraction-service';

export interface Body {
  documentId: string;
  workspaceId: string;
  userId: string;
  vultrKey?: string;  // NEW: Vultr S3 key for new documents
  storageKey?: string;  // OLD: SmartBucket key for legacy documents
  action?: string;  // NEW: 'extract_and_index' or undefined (legacy)
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

      // STEP 3: Upload ONLY clean text to SmartBucket (for all file types including PDF)
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

      // STEP 4: Update database with extraction results (including full text)
      await this.env.DOCUMENT_SERVICE.updateDocumentProcessing(documentId, {
        textExtracted: true,
        chunkCount: 0,  // Will be updated after SmartBucket indexing completes
        processingStatus: 'processing',  // SmartBucket now indexing
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
}
