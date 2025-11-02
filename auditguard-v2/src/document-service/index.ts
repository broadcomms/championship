import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { detectContentType } from './content-type-detector';

interface UploadDocumentInput {
  workspaceId: string;
  userId: string;
  file: ArrayBuffer;
  filename: string;
  contentType: string;
  category?: 'policy' | 'procedure' | 'evidence' | 'other';
}

interface UpdateMetadataInput {
  filename?: string;
  category?: 'policy' | 'procedure' | 'evidence' | 'other';
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Document Service - Private', { status: 501 });
  }

  async uploadDocument(input: UploadDocumentInput): Promise<{
    id: string;
    workspaceId: string;
    filename: string;
    fileSize: number;
    contentType: string;
    category: string | null;
    storageKey: string;
    uploadedBy: string;
    uploadedAt: number;
    updatedAt: number;
  }> {
    const db = this.getDb();

    // Check workspace membership (requires member role or above)
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', input.workspaceId)
      .where('user_id', '=', input.userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Check role hierarchy - member or above can upload
    const roleHierarchy: Record<string, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    const userRoleLevel = roleHierarchy[membership.role] ?? 0;
    const memberRoleLevel = roleHierarchy['member'] ?? 2;

    if (userRoleLevel < memberRoleLevel) {
      throw new Error('Access denied: Requires member role or above');
    }

    // Validate file size (max 100MB)
    const fileSize = input.file.byteLength;
    if (fileSize > 100 * 1024 * 1024) {
      throw new Error('File size exceeds 100MB limit');
    }

    // Validate filename
    if (!input.filename || input.filename.length === 0 || input.filename.length > 255) {
      throw new Error('Filename must be between 1 and 255 characters');
    }

    // Generate document ID
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const storageKey = `${input.workspaceId}/${documentId}`;
    const now = Date.now();

    // Detect proper content type from filename if needed
    // This fixes cases where browsers send "application/octet-stream" for text files
    const actualContentType = detectContentType(input.filename, input.contentType);

    // Upload to SmartBucket - SmartBucket automatically indexes files uploaded via .put()
    // The indexing happens in the background and takes 20-60+ minutes for PDFs
    await this.env.DOCUMENTS_BUCKET.put(storageKey, input.file, {
      httpMetadata: {
        contentType: actualContentType,
      },
      customMetadata: {
        workspaceId: input.workspaceId,
        documentId: documentId,
        uploadedBy: input.userId,
        filename: input.filename,
      },
    } as any);

    // Store metadata in database
    await db
      .insertInto('documents')
      .values({
        id: documentId,
        workspace_id: input.workspaceId,
        filename: input.filename,
        file_size: fileSize,
        content_type: actualContentType,
        category: input.category || null,
        storage_key: storageKey,
        uploaded_by: input.userId,
        uploaded_at: now,
        updated_at: now,
        processing_status: 'pending',
        text_extracted: 0,
        chunk_count: 0,
      })
      .execute();

    // ✅ AUTO-TRIGGER PROCESSING: Automatically start processing after upload
    this.env.logger.info('Auto-triggering document processing after upload', {
      documentId,
      workspaceId: input.workspaceId,
      storageKey,
    });

    try {
      // Send to processing queue asynchronously (don't wait for completion)
      await this.env.DOCUMENT_PROCESSING_QUEUE.send({
        documentId: documentId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        storageKey: storageKey,
      });

      this.env.logger.info('Document queued for automatic processing', {
        documentId,
        workspaceId: input.workspaceId,
      });
    } catch (error) {
      this.env.logger.error('Failed to auto-queue document for processing', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the upload - user can manually trigger processing
    }

    return {
      id: documentId,
      workspaceId: input.workspaceId,
      filename: input.filename,
      fileSize: fileSize,
      contentType: input.contentType,
      category: input.category || null,
      storageKey: storageKey,
      uploadedBy: input.userId,
      uploadedAt: now,
      updatedAt: now,
    };
  }

  async listDocuments(workspaceId: string, userId: string): Promise<{
    documents: Array<{
      id: string;
      filename: string;
      title: string | null;
      description: string | null;
      fileSize: number;
      contentType: string;
      category: string | null;
      uploadedBy: string;
      uploaderEmail: string;
      uploadedAt: number;
      updatedAt: number;
      processingStatus: string;
      textExtracted: boolean;
      chunkCount: number;
    }>;
  }> {
    const db = this.getDb();

    // Check workspace membership
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Get all documents for workspace with uploader info
    const documents = await db
      .selectFrom('documents')
      .innerJoin('users', 'users.id', 'documents.uploaded_by')
      .select([
        'documents.id',
        'documents.filename',
        'documents.title',
        'documents.description',
        'documents.file_size',
        'documents.content_type',
        'documents.category',
        'documents.uploaded_by',
        'users.email as uploader_email',
        'documents.uploaded_at',
        'documents.updated_at',
        'documents.processing_status',
        'documents.text_extracted',
        'documents.chunk_count',
      ])
      .where('documents.workspace_id', '=', workspaceId)
      .orderBy('documents.uploaded_at', 'desc')
      .execute();

    return {
      documents: documents.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        title: doc.title,
        description: doc.description,
        fileSize: doc.file_size,
        contentType: doc.content_type,
        category: doc.category,
        uploadedBy: doc.uploaded_by,
        uploaderEmail: doc.uploader_email,
        uploadedAt: doc.uploaded_at,
        updatedAt: doc.updated_at,
        processingStatus: doc.processing_status,
        textExtracted: doc.text_extracted === 1,
        chunkCount: doc.chunk_count,
      })),
    };
  }

  async getDocument(documentId: string, workspaceId: string, userId: string): Promise<{
    id: string;
    workspaceId: string;
    filename: string;
    title: string | null;
    description: string | null;
    fileSize: number;
    contentType: string;
    category: string | null;
    storageKey: string;
    uploadedBy: string;
    uploaderEmail: string;
    uploadedAt: number;
    updatedAt: number;
    processingStatus: string;
    textExtracted: boolean;
    chunkCount: number;
  }> {
    const db = this.getDb();

    // Check workspace membership
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Get document with uploader info
    const document = await db
      .selectFrom('documents')
      .innerJoin('users', 'users.id', 'documents.uploaded_by')
      .select([
        'documents.id',
        'documents.workspace_id',
        'documents.filename',
        'documents.title',
        'documents.description',
        'documents.file_size',
        'documents.content_type',
        'documents.category',
        'documents.storage_key',
        'documents.uploaded_by',
        'users.email as uploader_email',
        'documents.uploaded_at',
        'documents.updated_at',
        'documents.processing_status',
        'documents.text_extracted',
        'documents.chunk_count',
      ])
      .where('documents.id', '=', documentId)
      .where('documents.workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    return {
      id: document.id,
      workspaceId: document.workspace_id,
      filename: document.filename,
      title: document.title,
      description: document.description,
      fileSize: document.file_size,
      contentType: document.content_type,
      category: document.category,
      storageKey: document.storage_key,
      uploadedBy: document.uploaded_by,
      uploaderEmail: document.uploader_email,
      uploadedAt: document.uploaded_at,
      updatedAt: document.updated_at,
      processingStatus: document.processing_status,
      textExtracted: document.text_extracted === 1,
      chunkCount: document.chunk_count,
    };
  }

  async downloadDocument(
    documentId: string,
    workspaceId: string,
    userId: string
  ): Promise<{
    file: ArrayBuffer;
    filename: string;
    contentType: string;
  }> {
    const db = this.getDb();

    // Check workspace membership (viewer or above can download)
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Get document metadata
    const document = await db
      .selectFrom('documents')
      .select(['storage_key', 'filename', 'content_type'])
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    // Download from SmartBucket
    const file = await this.env.DOCUMENTS_BUCKET.get(document.storage_key);

    if (!file) {
      throw new Error('File not found in storage');
    }

    const arrayBuffer = await file.arrayBuffer();

    return {
      file: arrayBuffer,
      filename: document.filename,
      contentType: document.content_type,
    };
  }

  async updateMetadata(
    documentId: string,
    workspaceId: string,
    userId: string,
    updates: UpdateMetadataInput
  ): Promise<{
    id: string;
    filename: string;
    category: string | null;
    updatedAt: number;
  }> {
    const db = this.getDb();

    // Get document and check permissions
    const document = await db
      .selectFrom('documents')
      .select(['uploaded_by'])
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user is uploader or has admin role
    const isUploader = document.uploaded_by === userId;

    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    const roleHierarchy: Record<string, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    const userRoleLevel = roleHierarchy[membership.role] ?? 0;
    const adminRoleLevel = roleHierarchy['admin'] ?? 3;
    const isAdmin = userRoleLevel >= adminRoleLevel;

    if (!isUploader && !isAdmin) {
      throw new Error('Access denied: Requires document uploader or admin role');
    }

    // Validate updates
    if (updates.filename !== undefined && (updates.filename.length === 0 || updates.filename.length > 255)) {
      throw new Error('Filename must be between 1 and 255 characters');
    }

    if (updates.category !== undefined && !['policy', 'procedure', 'evidence', 'other', null].includes(updates.category)) {
      throw new Error('Invalid category. Must be policy, procedure, evidence, or other');
    }

    const now = Date.now();

    // Update metadata
    const updateData: any = { updated_at: now };
    if (updates.filename !== undefined) updateData.filename = updates.filename;
    if (updates.category !== undefined) updateData.category = updates.category;

    await db
      .updateTable('documents')
      .set(updateData)
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .execute();

    // Get updated document
    const updated = await db
      .selectFrom('documents')
      .select(['id', 'filename', 'category', 'updated_at'])
      .where('id', '=', documentId)
      .executeTakeFirst();

    if (!updated) {
      throw new Error('Document not found');
    }

    return {
      id: updated.id,
      filename: updated.filename,
      category: updated.category,
      updatedAt: updated.updated_at,
    };
  }

  async deleteDocument(documentId: string, workspaceId: string, userId: string): Promise<{ success: boolean }> {
    const db = this.getDb();

    // Get document and check permissions
    const document = await db
      .selectFrom('documents')
      .select(['uploaded_by', 'storage_key'])
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user is uploader or has admin role
    const isUploader = document.uploaded_by === userId;

    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    const roleHierarchy: Record<string, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    const userRoleLevel = roleHierarchy[membership.role] ?? 0;
    const adminRoleLevel = roleHierarchy['admin'] ?? 3;
    const isAdminOrOwner = userRoleLevel >= adminRoleLevel;

    if (!isUploader && !isAdminOrOwner) {
      throw new Error('Access denied: Requires document uploader, admin, or owner role');
    }

    // Delete from SmartBucket
    await this.env.DOCUMENTS_BUCKET.delete(document.storage_key);

    // Delete from database
    await db
      .deleteFrom('documents')
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .execute();

    return { success: true };
  }

  // Helper methods for document processor
  async getDocumentMetadata(documentId: string): Promise<{
    id: string;
    workspaceId: string;
    filename: string;
    contentType: string;
    storageKey: string;
  }> {
    const db = this.getDb();

    const document = await db
      .selectFrom('documents')
      .select(['id', 'workspace_id', 'filename', 'content_type', 'storage_key'])
      .where('id', '=', documentId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    return {
      id: document.id,
      workspaceId: document.workspace_id,
      filename: document.filename,
      contentType: document.content_type,
      storageKey: document.storage_key,
    };
  }

  async updateProcessingStatus(documentId: string, status: string): Promise<void> {
    const db = this.getDb();
    const now = Date.now();

    await db
      .updateTable('documents')
      .set({
        processing_status: status,
        updated_at: now,
      })
      .where('id', '=', documentId)
      .execute();
  }

  /**
   * Verify if SmartBucket has finished indexing a document
   * Tests by attempting to retrieve chunks from the document
   * @returns Object with isComplete flag and estimated progress percentage
   */
  async verifyIndexingComplete(
    storageKey: string,
    workspaceId: string
  ): Promise<{ isComplete: boolean; progress: number; chunkCount: number }> {
    try {
      // Test if we can retrieve chunks from SmartBucket
      // If chunks exist, indexing is complete
      const testSearch = await this.env.DOCUMENTS_BUCKET.chunkSearch({
        input: 'test',  // Any query will work
        limit: 1000,  // Get all chunks to count them
        requestId: `verify-${storageKey}-${Date.now()}`,
      } as any);

      // If we get chunks back, indexing is complete
      if (testSearch.results && testSearch.results.length > 0) {
        // Filter chunks to only those from this specific document
        const documentChunks = testSearch.results.filter(
          (chunk: any) => chunk.objectId === storageKey || chunk.source === storageKey
        );

        if (documentChunks.length > 0) {
          this.env.logger.info('Indexing verification: Complete', {
            storageKey,
            chunkCount: documentChunks.length,
          });

          return { 
            isComplete: true, 
            progress: 100,
            chunkCount: documentChunks.length
          };
        }
      }

      // No chunks found yet = still indexing
      this.env.logger.info('Indexing verification: In progress', {
        storageKey,
        note: 'No chunks found yet, SmartBucket still indexing',
      });

      return { isComplete: false, progress: 50, chunkCount: 0 };
    } catch (error) {
      // Error might mean indexing hasn't started yet or document not found
      this.env.logger.warn('Indexing verification: Not ready', {
        storageKey,
        error: error instanceof Error ? error.message : String(error),
      });

      return { isComplete: false, progress: 0, chunkCount: 0 };
    }
  }

  async updateDocumentProcessing(
    documentId: string,
    data: {
      textExtracted: boolean;
      chunkCount: number;
      processingStatus: string;
      processedAt: number;
    }
  ): Promise<void> {
    const db = this.getDb();

    await db
      .updateTable('documents')
      .set({
        text_extracted: data.textExtracted ? 1 : 0,
        chunk_count: data.chunkCount,
        processing_status: data.processingStatus,
        updated_at: data.processedAt,
      })
      .where('id', '=', documentId)
      .execute();
  }

  /**
   * Process a document: verify indexing is complete and mark as ready
   * NEW: Waits for SmartBucket indexing to complete before marking as "completed"
   */
  async processDocument(
    documentId: string,
    workspaceId: string,
    _userId: string
  ): Promise<{
    success: boolean;
    title: string;
    description: string;
    chunkCount: number;
  }> {
    const db = this.getDb();

    // Get document from database
    const document = await db
      .selectFrom('documents')
      .selectAll()
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    this.env.logger.info('Processing document with indexing verification', {
      documentId,
      workspaceId,
      storageKey: document.storage_key,
      contentType: document.content_type,
    });

    // Update status to processing
    await this.updateProcessingStatus(documentId, 'processing');

    try {
      // ✅ Verify SmartBucket has finished indexing
      const indexStatus = await this.verifyIndexingComplete(
        document.storage_key,
        workspaceId
      );

      if (!indexStatus.isComplete) {
        // Indexing not complete - throw error to trigger retry
        const errorMsg = `Indexing in progress: ${indexStatus.progress}% (${indexStatus.chunkCount} chunks found)`;
        this.env.logger.info('Document indexing not complete, will retry', {
          documentId,
          progress: indexStatus.progress,
          chunkCount: indexStatus.chunkCount,
        });
        throw new Error(errorMsg);
      }

      // ✅ Indexing is complete! Get actual chunk count
      const actualChunkCount = indexStatus.chunkCount;

      this.env.logger.info('Document indexing verified complete', {
        documentId,
        actualChunkCount,
        storageKey: document.storage_key,
      });

      // ✅ Extract title and description using AI
      this.env.logger.info('Extracting title and description using AI', {
        documentId,
        storageKey: document.storage_key,
      });

      let extractedTitle = document.filename;  // Fallback to filename
      let extractedDescription = '';           // Default empty

      try {
        // Extract title using documentChat
        const titleResponse = await this.env.DOCUMENTS_BUCKET.documentChat({
          objectId: document.storage_key,
          input: 'What is the title of this document? Respond with ONLY the title, no additional text or explanation.',
          requestId: `title-${documentId}-${Date.now()}`,
        } as any);

        if (titleResponse.answer && titleResponse.answer.trim()) {
          extractedTitle = titleResponse.answer.trim();
          this.env.logger.info('AI title extraction successful', {
            documentId,
            extractedTitle,
          });
        }

        // Extract description using documentChat
        const descResponse = await this.env.DOCUMENTS_BUCKET.documentChat({
          objectId: document.storage_key,
          input: 'Provide a brief 1-2 sentence summary of this document. Focus on the main topic and key points.',
          requestId: `desc-${documentId}-${Date.now()}`,
        } as any);

        if (descResponse.answer && descResponse.answer.trim()) {
          extractedDescription = descResponse.answer.trim();
          this.env.logger.info('AI description extraction successful', {
            documentId,
            extractedDescription: extractedDescription.substring(0, 100) + '...',
          });
        }
      } catch (aiError) {
        // AI extraction failed - log but continue with filename as title
        this.env.logger.warn('AI extraction failed, using filename as title', {
          documentId,
          error: aiError instanceof Error ? aiError.message : String(aiError),
        });
      }

      // Update document with real chunk count and AI-extracted metadata
      const now = Date.now();
      await db
        .updateTable('documents')
        .set({
          title: extractedTitle,
          description: extractedDescription,
          text_extracted: 1,  // Indexing confirmed complete
          chunk_count: actualChunkCount,  // Real count, not estimated!
          processing_status: 'completed',
          updated_at: now,
        })
        .where('id', '=', documentId)
        .execute();

      this.env.logger.info('Document processing completed successfully', {
        documentId,
        title: extractedTitle,
        chunkCount: actualChunkCount,
        processingStatus: 'completed',
      });

      return {
        success: true,
        title: extractedTitle,
        description: extractedDescription,
        chunkCount: actualChunkCount,
      };
    } catch (error) {
      // Check if this is an "indexing in progress" error
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Indexing in progress')) {
        // This is expected - indexing just isn't done yet
        // The observer will retry this method
        this.env.logger.info('Document processing deferred (indexing incomplete)', {
          documentId,
          error: errorMessage,
        });
        throw error;  // Re-throw to trigger observer retry
      }

      // This is an unexpected error - mark as failed
      this.env.logger.error('Document processing failed with unexpected error', {
        documentId,
        error: errorMessage,
      });

      await this.updateProcessingStatus(documentId, 'failed');
      throw error;
    }
  }

  /**
   * Get document content - retrieves chunks and extracted text from SmartBucket
   */
  async getDocumentContent(
    documentId: string,
    workspaceId: string,
    userId: string
  ): Promise<{
    chunks: Array<{ text: string; score?: number }>;
    fullText: string;
    summary: string;
    isPartial: boolean; // NEW: Indicates if this is partial data (still processing)
    processingStatus: string; // NEW: Current processing status
  }> {
    const db = this.getDb();

    // Check workspace membership
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Get document from database
    const document = await db
      .selectFrom('documents')
      .selectAll()
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    const processingStatus = document.processing_status;
    const isStillProcessing = processingStatus === 'pending' || processingStatus === 'processing';

    this.env.logger.info('Retrieving document content from SmartBucket (progressive mode)', {
      documentId,
      workspaceId,
      storageKey: document.storage_key,
      processingStatus,
      isPartial: isStillProcessing,
    });

    // ✅ PROGRESSIVE LOADING: Try to get whatever is available, even if still processing
    let fullText = '';
    let summary = '';
    let chunks: Array<{ text: string; score?: number }> = [];

    try {
      // Use documentChat to extract the full text content
      // This works even during processing as SmartBucket has already extracted text
      this.env.logger.info('Requesting fullText from SmartBucket documentChat', {
        documentId,
        objectId: document.storage_key,
        filename: document.filename,
        requestId: `fulltext-${documentId}-${Date.now()}`,
      });

      const fullTextResponse = await this.env.DOCUMENTS_BUCKET.documentChat({
        objectId: document.storage_key,
        input: 'Please extract and return the complete text content of this document verbatim, preserving all formatting and structure.',
        requestId: `fulltext-${documentId}-${Date.now()}`,
      } as any);

      fullText = fullTextResponse.answer || '';

      this.env.logger.info('Retrieved full text from SmartBucket', {
        documentId,
        objectId: document.storage_key,
        textLength: fullText.length,
        textPreview: fullText.substring(0, 150),
        isPartial: isStillProcessing,
      });
    } catch (error) {
      this.env.logger.warn('Failed to retrieve full text (may still be processing)', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        isPartial: isStillProcessing,
      });
      fullText = isStillProcessing 
        ? 'Text extraction in progress... Refresh to see updated content.'
        : 'Text extraction failed';
    }

    // Get summary using documentChat
    try {
      this.env.logger.info('Requesting summary from SmartBucket documentChat', {
        documentId,
        objectId: document.storage_key,
        filename: document.filename,
        requestId: `summary-${documentId}-${Date.now()}`,
      });

      const summaryResponse = await this.env.DOCUMENTS_BUCKET.documentChat({
        objectId: document.storage_key,
        input: 'Provide a brief 2-3 sentence summary of this document.',
        requestId: `summary-${documentId}-${Date.now()}`,
      } as any);
      summary = summaryResponse.answer || 'Summary not available';
      
      this.env.logger.info('Retrieved summary from SmartBucket', {
        documentId,
        objectId: document.storage_key,
        summaryLength: summary.length,
        summaryPreview: summary.substring(0, 100),
        isPartial: isStillProcessing,
      });
    } catch (error) {
      this.env.logger.warn('Failed to generate summary (may still be processing)', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        isPartial: isStillProcessing,
      });
      summary = isStillProcessing
        ? 'Summary generation in progress... Refresh to see updated content.'
        : 'Summary not available';
    }

    // Get relevant chunks using chunkSearch with a broad query
    try {
      // ⚠️ CRITICAL: SmartBucket stores chunks for ALL documents together
      // We MUST filter by objectId (storage_key) to get only THIS document's chunks
      const chunkResults = await this.env.DOCUMENTS_BUCKET.chunkSearch({
        input: document.filename.replace(/\.(pdf|docx|txt|md)$/i, ''),
        requestId: `chunks-${documentId}-${Date.now()}`,
      } as any);

      // ✅ FILTER: Only include chunks that belong to THIS specific document
      const documentStorageKey = document.storage_key;
      chunks = (chunkResults.results || [])
        .filter((result: any) => {
          // Each chunk has an objectId that identifies which document it belongs to
          const chunkObjectId = result.objectId || result.source || '';
          const belongsToThisDocument = chunkObjectId === documentStorageKey;
          
          if (!belongsToThisDocument) {
            this.env.logger.debug('Filtered out chunk from different document', {
              thisDocumentId: documentId,
              thisStorageKey: documentStorageKey,
              chunkObjectId,
            });
          }
          
          return belongsToThisDocument;
        })
        .map((result: any) => ({
          text: result.text || '',
          score: result.score,
        }));

      this.env.logger.info('Retrieved chunks from SmartBucket', {
        documentId,
        storageKey: documentStorageKey,
        chunkCount: chunks.length,
        totalResultsBeforeFilter: chunkResults.results?.length || 0,
        isPartial: isStillProcessing,
      });
    } catch (error) {
      this.env.logger.warn('Failed to retrieve chunks (may still be processing)', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        isPartial: isStillProcessing,
      });
      // Chunks are optional, continue without them
      chunks = [];
    }

    // ✅ PROGRESSIVE RESULT: Return whatever we have, mark as partial if still processing
    return {
      chunks,
      fullText,
      summary,
      isPartial: isStillProcessing,
      processingStatus,
    };
  }
}
