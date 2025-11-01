import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';

// SmartBucket event body structure
export interface Body {
  action: string;
  bucket: string;
  key: string;
  metadata?: {
    workspaceId?: string;
    documentId?: string;
    uploadedBy?: string;
  };
}

/**
 * SmartBucket Observer - Triggers automatically AFTER SmartBucket completes indexing
 *
 * This is the primary processing path for newly uploaded documents.
 * When a document is uploaded to the documents-bucket:
 * 1. SmartBucket automatically indexes the document (5-10+ minutes)
 * 2. This observer triggers AFTER indexing completes
 * 3. We extract AI-powered metadata (title, description) via documentChat
 * 4. Success is guaranteed because SmartBucket has finished indexing
 */
export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    const { action, key, metadata } = message.body;

    this.env.logger.info('SmartBucket Observer: Document indexed', {
      action,
      key,
      metadata,
      attempt: message.attempts,
    });

    // Extract document metadata from custom metadata
    const documentId = metadata?.documentId;
    const workspaceId = metadata?.workspaceId;
    const userId = metadata?.uploadedBy;

    // Validate required metadata
    if (!documentId || !workspaceId || !userId) {
      this.env.logger.error('SmartBucket Observer: Missing required metadata', {
        key,
        metadata,
        documentId,
        workspaceId,
        userId,
      });
      message.ack(); // Acknowledge to prevent retries - this is a permanent error
      return;
    }

    try {
      // Call the document service to process the document
      // SmartBucket has already indexed it, so documentChat will succeed
      await this.env.DOCUMENT_SERVICE.processDocument(documentId, workspaceId, userId);

      this.env.logger.info('SmartBucket Observer: Document processing completed successfully', {
        documentId,
        workspaceId,
        key,
      });

      // Acknowledge successful processing
      message.ack();
    } catch (error) {
      this.env.logger.error('SmartBucket Observer: Document processing failed', {
        documentId,
        workspaceId,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        attempt: message.attempts,
      });

      // Retry on failure (up to 3 attempts with short delays)
      // SmartBucket indexing is already complete, so retries are for transient errors only
      if (message.attempts < 3) {
        const delaySeconds = 10; // Short delay for transient errors
        this.env.logger.info('SmartBucket Observer: Retrying document processing', {
          documentId,
          nextAttempt: message.attempts + 1,
          delaySeconds,
        });
        message.retry({ delaySeconds });
      } else {
        this.env.logger.error('SmartBucket Observer: Max retries exceeded', {
          documentId,
          workspaceId,
        });

        // Mark as failed in database
        try {
          await this.env.DOCUMENT_SERVICE.updateProcessingStatus(documentId, 'failed');
        } catch (updateError) {
          this.env.logger.error('SmartBucket Observer: Failed to update document status to failed', {
            documentId,
            error: updateError instanceof Error ? updateError.message : 'Unknown error',
          });
        }

        message.ack(); // Prevent infinite retries
      }
    }
  }
}
