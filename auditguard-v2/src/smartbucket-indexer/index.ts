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
 * SmartBucket Observer - Triggers ON UPLOAD, retries until indexing completes
 *
 * This is the primary processing path for newly uploaded documents.
 * When a document is uploaded to the documents-bucket:
 * 1. This observer triggers IMMEDIATELY on PutObject
 * 2. SmartBucket indexes the document in the background (5-10+ minutes)
 * 3. We retry with increasing delays until indexing completes
 * 4. Once indexing is done, we verify chunks exist and mark as completed
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

      // Retry on failure - SmartBucket indexing takes 5-10 minutes
      // Use exponential backoff to wait for indexing to complete
      // Max 60 attempts over ~15 minutes to ensure indexing completes
      if (message.attempts < 60) {
        // Progressive delay: 10s -> 20s -> 30s -> 60s (max)
        const delaySeconds = Math.min(10 + (message.attempts * 2), 60);
        this.env.logger.info('SmartBucket Observer: Retrying document processing (waiting for indexing)', {
          documentId,
          nextAttempt: message.attempts + 1,
          delaySeconds,
          totalAttemptsAllowed: 60,
        });
        message.retry({ delaySeconds });
      } else {
        this.env.logger.error('SmartBucket Observer: Max retries exceeded - indexing did not complete', {
          documentId,
          workspaceId,
          totalAttempts: message.attempts,
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
