import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';

export interface Body {
  documentId: string;
  workspaceId: string;
  userId: string;
  storageKey: string;
}

export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    const { documentId, workspaceId, userId, storageKey } = message.body;

    this.env.logger.info('Observer: Processing document from queue', {
      documentId,
      workspaceId,
      storageKey,
      attempt: message.attempts,
    });

    try {
      // Call the document service to process the document
      // SmartBucket has already indexed it, we just need to verify and update status
      await this.env.DOCUMENT_SERVICE.processDocument(documentId, workspaceId, userId);

      this.env.logger.info('Observer: Document processing completed successfully', {
        documentId,
      });

      // Acknowledge successful processing
      message.ack();
    } catch (error) {
      this.env.logger.error('Observer: Document processing failed', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        attempt: message.attempts,
      });

      // Retry on failure (up to 3 attempts)
      if (message.attempts < 3) {
        this.env.logger.info('Retrying document processing', {
          documentId,
          nextAttempt: message.attempts + 1,
        });
        message.retry({ delaySeconds: 30 }); // Wait 30 seconds before retry
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
}
