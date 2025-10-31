import { Service } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';

interface DocumentEvent {
  key: string;
  action: 'put' | 'delete';
  metadata?: Record<string, string>;
}

export default class extends Service<Env> {
  async fetch(_request: Request): Promise<Response> {
    return new Response('Document Processor - Observer', { status: 501 });
  }

  async onPut(key: string, metadata: Record<string, string>): Promise<void> {
    this.env.logger.info('Document uploaded', { key, metadata });

    try {
      // Extract document ID from key
      const documentId = metadata.documentId || key.split('/').pop();
      if (!documentId) {
        throw new Error('No document ID found');
      }

      // Get document metadata from database
      const document = await this.env.DOCUMENT_SERVICE.getDocumentMetadata(documentId);

      // Update status to processing
      await this.env.DOCUMENT_SERVICE.updateProcessingStatus(documentId, 'processing');

      // Get document content from SmartBucket
      const content = await this.env.DOCUMENTS_BUCKET.get(key);
      if (!content) {
        throw new Error('Document content not found');
      }

      // Extract text based on content type
      let extractedText = '';
      const contentType = document.contentType || metadata.contentType || 'text/plain';

      if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
        // Plain text or markdown
        extractedText = await content.text();
      } else if (contentType.includes('application/pdf')) {
        // PDF - for now, store as-is and let SmartBucket handle it
        extractedText = await content.text();
      } else if (contentType.includes('application/vnd.openxmlformats-officedocument')) {
        // DOCX - store as-is for SmartBucket
        extractedText = await content.text();
      } else {
        // Other formats - try to convert to text
        extractedText = await content.text();
      }

      // Chunk the text for better retrieval
      const chunks = this.chunkText(extractedText, 1000, 200);

      // Index each chunk in SmartBucket
      for (let i = 0; i < chunks.length; i++) {
        const chunkKey = `${documentId}/chunk-${i}`;
        const chunkContent = chunks[i] || '';
        // Store chunk with metadata in the content prefix
        const chunkWithMeta = `[Document: ${document.filename}, Workspace: ${document.workspaceId}, Chunk ${i + 1}/${chunks.length}]\n\n${chunkContent}`;
        await this.env.DOCUMENTS_BUCKET.put(chunkKey, chunkWithMeta);
      }

      // Update document metadata
      await this.env.DOCUMENT_SERVICE.updateDocumentProcessing(documentId, {
        textExtracted: true,
        chunkCount: chunks.length,
        processingStatus: 'completed',
        processedAt: Date.now(),
      });

      this.env.logger.info('Document processed successfully', {
        documentId,
        chunks: chunks.length,
      });
    } catch (error) {
      this.env.logger.error('Document processing failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update status to failed
      const documentId = metadata.documentId || key.split('/').pop();
      if (documentId) {
        await this.env.DOCUMENT_SERVICE.updateProcessingStatus(documentId, 'failed');
      }
    }
  }

  async onDelete(key: string): Promise<void> {
    this.env.logger.info('Document deleted', { key });

    // Clean up chunks if needed
    const documentId = key.split('/').pop();
    if (documentId) {
      // Delete all chunks associated with this document
      // SmartBucket will handle cleanup
      this.env.logger.info('Cleaning up document chunks', { documentId });
    }
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk.trim());
      start += chunkSize - overlap;
    }

    return chunks.filter(chunk => chunk.length > 0);
  }
}
