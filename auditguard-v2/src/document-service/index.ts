import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { detectContentType } from './content-type-detector';
import { VultrStorageService } from '../storage-service';
import { VectorSearchService, VectorSearchRequest, VectorSearchResponse } from '../vector-search-service';
import { ComplianceTaggingService } from '../compliance-tagging-service';

interface UploadDocumentInput {
  workspaceId: string;
  userId: string;
  file: ArrayBuffer;
  filename: string;
  contentType: string;
  category?: 'policy' | 'procedure' | 'evidence' | 'other';
  frameworkId?: number;
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
    const now = Date.now();

    // Detect proper content type from filename if needed
    // This fixes cases where browsers send "application/octet-stream" for text files
    const actualContentType = detectContentType(input.filename, input.contentType);

    // PHASE 2: Upload to Vultr S3 (original file storage)
    const vultrKey = `${input.workspaceId}/${documentId}/${input.filename}`;
    
    this.env.logger.info('Uploading original file to Vultr S3', {
      documentId,
      filename: input.filename,
      size: fileSize,
      vultrKey,
      contentType: actualContentType,
    });

    const vultrStorage = new VultrStorageService(this.env);
    const fileBuffer = Buffer.from(input.file);
    await vultrStorage.uploadDocument(vultrKey, fileBuffer, actualContentType);

    this.env.logger.info('Original file uploaded to Vultr S3 successfully', {
      documentId,
      vultrKey,
    });

    // Store metadata in database (extraction status: pending)
    await db
      .insertInto('documents')
      .values({
        id: documentId,
        workspace_id: input.workspaceId,
        filename: input.filename,
        file_size: fileSize,
        content_type: actualContentType,
        category: input.category || null,
        compliance_framework_id: input.frameworkId || null,  // Phase 4: Framework support
        vultr_key: vultrKey,  // Vultr S3 key for original file
        storage_key: '',  // Will be set to extracted text key after processing
        extraction_status: 'pending',  // Text extraction pending
        uploaded_by: input.userId,
        uploaded_at: now,
        updated_at: now,
        processing_status: 'pending',
        text_extracted: 0,
        chunk_count: 0,
      } as any)
      .execute();

    // Queue for text extraction + SmartBucket indexing
    this.env.logger.info('Queueing document for text extraction and indexing', {
      documentId,
      workspaceId: input.workspaceId,
      vultrKey,
      action: 'extract_and_index',
    });

    try {
      // Send to processing queue with new action type
      await this.env.DOCUMENT_PROCESSING_QUEUE.send({
        documentId: documentId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        vultrKey: vultrKey,
        action: 'extract_and_index',  // NEW: Indicates full extraction flow
        frameworkId: input.frameworkId,  // Phase 4: Pass framework for auto-tagging
      });

      this.env.logger.info('Document queued for text extraction and indexing', {
        documentId,
        workspaceId: input.workspaceId,
        frameworkId: input.frameworkId,
      });
    } catch (error) {
      this.env.logger.error('Failed to queue document for processing', {
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
      contentType: actualContentType,
      category: input.category || null,
      storageKey: vultrKey,  // Return Vultr S3 key
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
    vultrKey?: string;
    uploadedBy: string;
    uploaderEmail: string;
    uploadedAt: number;
    updatedAt: number;
    processingStatus: string;
    textExtracted: boolean;
    chunkCount: number;
    wordCount?: number;
    pageCount?: number;
    chunksCreated?: number;
    embeddingsGenerated?: number;
    vectorIndexingStatus?: string;
    complianceFrameworkId?: number;
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
        'documents.vultr_key' as any,
        'documents.uploaded_by',
        'users.email as uploader_email',
        'documents.uploaded_at',
        'documents.updated_at',
        'documents.processing_status',
        'documents.text_extracted',
        'documents.chunk_count',
        'documents.word_count' as any,
        'documents.page_count' as any,
        'documents.chunks_created' as any,
        'documents.embeddings_generated' as any,
        'documents.vector_indexing_status' as any,
        'documents.compliance_framework_id' as any,
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
      vultrKey: document.vultr_key,
      uploadedBy: document.uploaded_by,
      uploaderEmail: document.uploader_email,
      uploadedAt: document.uploaded_at,
      updatedAt: document.updated_at,
      processingStatus: document.processing_status,
      textExtracted: document.text_extracted === 1,
      chunkCount: document.chunk_count,
      wordCount: document.word_count,
      pageCount: document.page_count,
      chunksCreated: document.chunks_created,
      embeddingsGenerated: document.embeddings_generated,
      vectorIndexingStatus: document.vector_indexing_status,
      complianceFrameworkId: document.compliance_framework_id,
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
      .select(['storage_key', 'filename', 'content_type', 'vultr_key' as any])
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst() as any;

    if (!document) {
      throw new Error('Document not found');
    }

    // NEW ARCHITECTURE: Download original from Vultr S3
    if (document.vultr_key) {
      this.env.logger?.info('Downloading original file from Vultr S3', {
        documentId,
        vultrKey: document.vultr_key,
      });

      const { VultrStorageService } = await import('../storage-service');
      const vultrStorage = new VultrStorageService(this.env);
      const fileBuffer = await vultrStorage.getDocument(document.vultr_key);

      // Convert Buffer to ArrayBuffer
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      ) as ArrayBuffer;

      return {
        file: arrayBuffer,
        filename: document.filename,
        contentType: document.content_type,
      };
    }

    // LEGACY: Download from SmartBucket (for old documents)
    this.env.logger?.info('Downloading legacy file from SmartBucket', {
      documentId,
      storageKey: document.storage_key,
    });

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
    _workspaceId: string
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
      extractedTextKey?: string;
      extractedText?: string;
      pageCount?: number;
      wordCount?: number;
    }
  ): Promise<void> {
    const db = this.getDb();

    const updateData: any = {
      text_extracted: data.textExtracted ? 1 : 0,
      chunk_count: data.chunkCount,
      processing_status: data.processingStatus,
      updated_at: data.processedAt,
    };

    // Add optional fields if provided
    if (data.extractedTextKey !== undefined) {
      updateData.extracted_text_key = data.extractedTextKey;
      updateData.storage_key = data.extractedTextKey;  // storage_key now points to SmartBucket extracted text
      updateData.extraction_status = 'completed';
    }
    if (data.extractedText !== undefined) {
      updateData.extracted_text = data.extractedText;  // Store full text in database
    }
    if (data.pageCount !== undefined) {
      updateData.page_count = data.pageCount;
    }
    if (data.wordCount !== undefined) {
      updateData.word_count = data.wordCount;
    }

    await db
      .updateTable('documents')
      .set(updateData)
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

      // WORKAROUND: Generate embeddings synchronously since queue observer isn't working
      this.env.logger.info('Starting embedding generation (synchronous workaround)', {
        documentId,
        workspaceId,
        chunkCount: actualChunkCount,
      });

      try {
        // Get all chunks for this document
        const chunksResult = await (this.env.AUDITGUARD_DB as any).prepare(
          `SELECT id, document_id, chunk_index, content, token_count, embedding_status
           FROM document_chunks
           WHERE document_id = ?
           ORDER BY chunk_index`
        ).bind(documentId).all();

        const chunks = chunksResult.results || [];
        const chunkIds = chunks.map((c: any) => c.id);

        if (chunks.length > 0) {
          // Import embedding service dynamically
          const { EmbeddingService } = await import('../embedding-service');
          const embeddingService = new EmbeddingService(this.env);

          // Generate embeddings for all chunks
          const embeddingResult = await embeddingService.generateAndStoreEmbeddings(
            documentId,
            workspaceId,
            chunks,
            chunkIds
          );

          this.env.logger.info('Embedding generation completed successfully', {
            documentId,
            successCount: embeddingResult.successCount,
            failureCount: embeddingResult.failureCount,
            totalChunks: embeddingResult.totalChunks,
          });
        } else {
          this.env.logger.warn('No chunks found for embedding generation', {
            documentId,
          });
        }
      } catch (embeddingError) {
        this.env.logger.error('⚠️ EMBEDDING GENERATION FAILED ⚠️', {
          documentId,
          error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
          errorStack: embeddingError instanceof Error ? embeddingError.stack : undefined,
          errorType: embeddingError?.constructor?.name,
          LOCAL_EMBEDDING_SERVICE_URL: this.env.LOCAL_EMBEDDING_SERVICE_URL || 'NOT SET',
        });
        // Don't throw - we still want to mark the document as processed
        // But log prominently so we can debug
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

    // Type assertion for new column (will be in schema after migration runs)
    const docWithText = document as typeof document & { extracted_text?: string };

    this.env.logger.info('Retrieving document content (database-first approach)', {
      documentId,
      workspaceId,
      storageKey: document.storage_key,
      processingStatus,
      hasExtractedText: !!docWithText.extracted_text,
      isPartial: isStillProcessing,
    });

    // ✅ NEW APPROACH: Use extracted_text from database (immediate, reliable)
    let fullText = '';
    let summary = '';
    let chunks: Array<{ text: string; score?: number }> = [];

    // STEP 1: Get fullText from database (NEW!)
    if (docWithText.extracted_text) {
      fullText = docWithText.extracted_text;
      this.env.logger.info('Retrieved full text from database', {
        documentId,
        textLength: fullText.length,
        textPreview: fullText.substring(0, 150),
        source: 'database',
      });
    } else {
      // FALLBACK: Try SmartBucket for legacy documents
      try {
        this.env.logger.info('No extracted_text in database, trying SmartBucket (legacy)', {
          documentId,
          objectId: document.storage_key,
        });

        const fullTextResponse = await this.env.DOCUMENTS_BUCKET.documentChat({
          objectId: document.storage_key,
          input: 'Please extract and return the complete text content of this document verbatim, preserving all formatting and structure.',
          requestId: `fulltext-${documentId}-${Date.now()}`,
        } as any);

        fullText = fullTextResponse.answer || '';

        this.env.logger.info('Retrieved full text from SmartBucket (legacy)', {
          documentId,
          textLength: fullText.length,
          source: 'smartbucket',
        });
      } catch (error) {
        this.env.logger.warn('Failed to retrieve full text', {
          documentId,
          error: error instanceof Error ? error.message : String(error),
          isPartial: isStillProcessing,
        });
        fullText = isStillProcessing
          ? 'Text extraction in progress... Refresh to see updated content.'
          : 'Text extraction failed';
      }
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

  /**
   * Vector search across workspace documents with hybrid SmartBucket fallback
   * @param workspaceId Workspace to search in
   * @param userId User making the request
   * @param request Search parameters
   */
  async vectorSearch(
    workspaceId: string,
    userId: string,
    request: VectorSearchRequest
  ): Promise<VectorSearchResponse> {
    const db = this.getDb();

    // Check workspace membership (any member can search, including viewer)
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Validate request parameters
    if (!request.query || request.query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    if (request.query.length > 1000) {
      throw new Error('Search query exceeds maximum length of 1000 characters');
    }

    // Validate and set reasonable limits
    const topK = Math.min(request.topK || 10, 100); // Max 100 results
    const pageSize = Math.min(request.pageSize || 10, 50); // Max 50 per page
    const page = Math.max(request.page || 1, 1); // Min page 1
    const minScore = Math.max(Math.min(request.minScore || 0.7, 1.0), 0.0); // 0.0-1.0 range

    this.env.logger.info('Vector search request', {
      workspaceId,
      userId,
      query: request.query.substring(0, 100),
      frameworkId: request.frameworkId,
      topK,
      pageSize,
      page,
      minScore,
    });

    // Create vector search service
    const vectorSearchService = new VectorSearchService(this.env);

    // Perform search with hybrid SmartBucket fallback
    const searchRequest: VectorSearchRequest = {
      query: request.query,
      workspaceId,
      frameworkId: request.frameworkId,
      topK,
      minScore,
      includeChunks: request.includeChunks !== false,
      page,
      pageSize,
    };

    // Enable hybrid search with SmartBucket fallback
    const hybridOptions = {
      useSmartBucket: true,          // Enable SmartBucket fallback
      smartBucketThreshold: 3,       // Fall back if < 3 vector results
      combineResults: true,          // Merge and deduplicate results
    };

    const results = await vectorSearchService.search(searchRequest, hybridOptions);

    this.env.logger.info('Vector search completed', {
      workspaceId,
      userId,
      query: request.query.substring(0, 50),
      totalResults: results.totalResults,
      returnedResults: results.results.length,
      source: results.source,
      searchTime: results.searchTime,
    });

    return results;
  }

  /**
   * List all compliance frameworks
   * @param workspaceId Workspace ID
   * @param userId User ID making the request
   */
  async listFrameworks(workspaceId: string, userId: string): Promise<Array<{
    id: number;
    name: string;
    displayName: string;
    description: string;
    isActive: boolean;
  }>> {
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

    // Get all frameworks
    const result = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT id, name, display_name, description, is_active
       FROM compliance_frameworks
       ORDER BY display_name`
    ).all();

    return result.results?.map((row: any) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      isActive: row.is_active === 1,
    })) || [];
  }

  /**
   * Assign a compliance framework to a document
   * @param documentId Document ID
   * @param workspaceId Workspace ID
   * @param userId User ID making the request
   * @param frameworkId Framework ID to assign
   */
  async assignFrameworkToDocument(
    documentId: string,
    workspaceId: string,
    userId: string,
    frameworkId: number
  ): Promise<void> {
    const db = this.getDb();

    // Check workspace membership (requires member role or above)
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
    const memberRoleLevel = roleHierarchy['member'] ?? 2;

    if (userRoleLevel < memberRoleLevel) {
      throw new Error('Access denied: Requires member role or above');
    }

    // Verify document exists and belongs to workspace
    const document = await db
      .selectFrom('documents')
      .select(['id', 'workspace_id'])
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    // Assign framework to document
    await (this.env.AUDITGUARD_DB as any).prepare(
      `UPDATE documents
       SET compliance_framework_id = ?
       WHERE id = ?`
    ).bind(frameworkId, documentId).run();

    this.env.logger.info('Framework assigned to document', {
      documentId,
      frameworkId,
      userId,
    });
  }

  /**
   * Get chunks tagged with a specific framework
   * @param workspaceId Workspace ID
   * @param userId User ID making the request
   * @param frameworkId Framework ID
   * @param minRelevance Minimum relevance score (default: 0.6)
   */
  async getFrameworkChunks(
    workspaceId: string,
    userId: string,
    frameworkId: number,
    minRelevance: number = 0.6
  ): Promise<Array<{
    chunkId: number;
    documentId: string;
    documentTitle: string;
    chunkText: string;
    relevanceScore: number;
    autoTagged: boolean;
  }>> {
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

    // Get tagged chunks
    const result = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT
         dcf.chunk_id,
         dc.document_id,
         dc.content AS chunk_text,
         d.title AS document_title,
         dcf.relevance_score,
         dcf.auto_tagged
       FROM document_chunk_frameworks dcf
       JOIN document_chunks dc ON dcf.chunk_id = dc.id
       JOIN documents d ON dc.document_id = d.id
       WHERE dcf.framework_id = ?
         AND d.workspace_id = ?
         AND dcf.relevance_score >= ?
       ORDER BY dcf.relevance_score DESC
       LIMIT 100`
    ).bind(frameworkId, workspaceId, minRelevance).all();

    return result.results?.map((row: any) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      chunkText: row.chunk_text,
      relevanceScore: row.relevance_score,
      autoTagged: row.auto_tagged === 1,
    })) || [];
  }

  /**
   * Manually tag a chunk with a framework
   * @param workspaceId Workspace ID
   * @param userId User ID making the request
   * @param chunkId Chunk ID
   * @param frameworkId Framework ID
   * @param relevanceScore Relevance score (default: 1.0)
   */
  async tagChunk(
    workspaceId: string,
    userId: string,
    chunkId: number,
    frameworkId: number,
    relevanceScore: number = 1.0
  ): Promise<void> {
    const db = this.getDb();

    // Check workspace membership (requires member role or above)
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
    const memberRoleLevel = roleHierarchy['member'] ?? 2;

    if (userRoleLevel < memberRoleLevel) {
      throw new Error('Access denied: Requires member role or above');
    }

    // Verify chunk belongs to workspace
    const chunk = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT dc.id, dc.workspace_id
       FROM document_chunks dc
       WHERE dc.id = ? AND dc.workspace_id = ?`
    ).bind(chunkId, workspaceId).first();

    if (!chunk) {
      throw new Error('Chunk not found');
    }

    // Tag the chunk
    const taggingService = new ComplianceTaggingService(this.env);
    await taggingService.manualTagChunk(chunkId, frameworkId, relevanceScore);

    this.env.logger.info('Chunk tagged manually', {
      chunkId,
      frameworkId,
      relevanceScore,
      userId,
    });
  }

  /**
   * Remove a tag from a chunk
   * @param workspaceId Workspace ID
   * @param userId User ID making the request
   * @param chunkId Chunk ID
   * @param frameworkId Framework ID
   */
  async untagChunk(
    workspaceId: string,
    userId: string,
    chunkId: number,
    frameworkId: number
  ): Promise<void> {
    const db = this.getDb();

    // Check workspace membership (requires member role or above)
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
    const memberRoleLevel = roleHierarchy['member'] ?? 2;

    if (userRoleLevel < memberRoleLevel) {
      throw new Error('Access denied: Requires member role or above');
    }

    // Verify chunk belongs to workspace
    const chunk = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT dc.id, dc.workspace_id
       FROM document_chunks dc
       WHERE dc.id = ? AND dc.workspace_id = ?`
    ).bind(chunkId, workspaceId).first();

    if (!chunk) {
      throw new Error('Chunk not found');
    }

    // Remove the tag
    const taggingService = new ComplianceTaggingService(this.env);
    await taggingService.untagChunk(chunkId, frameworkId);

    this.env.logger.info('Chunk tag removed', {
      chunkId,
      frameworkId,
      userId,
    });
  }

  /**
   * Phase 5: Get document chunks with framework tags for UI display
   */
  async getDocumentChunks(
    workspaceId: string,
    userId: string,
    documentId: string
  ): Promise<Array<{
    id: number;
    documentId: string;
    chunkIndex: number;
    content: string;
    chunkSize: number;
    startChar: number;
    endChar: number;
    tokenCount: number;
    hasHeader: boolean;
    sectionTitle: string | null;
    embeddingStatus: string;
    createdAt: number;
    tags: Array<{
      frameworkId: number;
      frameworkName: string;
      frameworkDisplayName: string;
      relevanceScore: number;
      autoTagged: boolean;
    }>;
  }>> {
    this.env.logger.info('Getting document chunks', {
      workspaceId,
      documentId,
      userId,
    });

    // Check workspace membership
    const membership = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
    ).bind(workspaceId, userId).first();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Verify document belongs to workspace
    const document = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT id FROM documents WHERE id = ? AND workspace_id = ?`
    ).bind(documentId, workspaceId).first();

    if (!document) {
      throw new Error('Document not found');
    }

    // Get chunks with their framework tags
    const result = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT
        dc.id,
        dc.document_id,
        dc.chunk_index,
        dc.content,
        dc.chunk_size,
        dc.start_char,
        dc.end_char,
        dc.token_count,
        dc.has_header,
        dc.section_title,
        dc.embedding_status,
        dc.created_at,
        dcf.framework_id,
        cf.name as framework_name,
        cf.display_name as framework_display_name,
        dcf.relevance_score,
        dcf.auto_tagged
      FROM document_chunks dc
      LEFT JOIN document_chunk_frameworks dcf ON dc.id = dcf.chunk_id
      LEFT JOIN compliance_frameworks cf ON dcf.framework_id = cf.id
      WHERE dc.document_id = ?
      ORDER BY dc.chunk_index ASC, dcf.relevance_score DESC`
    ).bind(documentId).all();

    this.env.logger.info('Raw SQL results for chunks', {
      documentId,
      rowCount: result.results?.length || 0,
      success: result.success,
    });

    // Group chunks with their tags
    const chunksMap = new Map<number, any>();

    for (const row of result.results || []) {
      if (!chunksMap.has(row.id)) {
        chunksMap.set(row.id, {
          id: row.id,
          documentId: row.document_id,
          chunkIndex: row.chunk_index,
          content: row.content,
          chunkSize: row.chunk_size,
          startChar: row.start_char,
          endChar: row.end_char,
          tokenCount: row.token_count,
          hasHeader: row.has_header === 1,
          sectionTitle: row.section_title,
          embeddingStatus: row.embedding_status,
          createdAt: row.created_at,
          tags: [],
        });
      }

      // Add framework tag if exists
      if (row.framework_id) {
        chunksMap.get(row.id).tags.push({
          frameworkId: row.framework_id,
          frameworkName: row.framework_name,
          frameworkDisplayName: row.framework_display_name,
          relevanceScore: row.relevance_score,
          autoTagged: row.auto_tagged === 1,
        });
      }
    }

    const chunks = Array.from(chunksMap.values());

    this.env.logger.info('Document chunks retrieved', {
      documentId,
      chunkCount: chunks.length,
    });

    return chunks;
  }

  /**
   * Get embedding statistics for a document (diagnostic endpoint)
   */
  async getEmbeddingStats(
    documentId: string,
    workspaceId: string,
    userId: string
  ): Promise<{
    documentId: string;
    totalChunks: number;
    completed: number;
    pending: number;
    failed: number;
    percentage: number;
    chunks: Array<{
      chunkId: number;
      chunkIndex: number;
      embeddingStatus: string;
      vectorId: string | null;
      hasEmbedding: boolean;
    }>;
  }> {
    this.env.logger.info('Getting embedding statistics', {
      documentId,
      workspaceId,
      userId,
    });

    // Check workspace membership
    const membership = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
    ).bind(workspaceId, userId).first();

    if (!membership) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    // Verify document belongs to workspace
    const document = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT id FROM documents WHERE id = ? AND workspace_id = ?`
    ).bind(documentId, workspaceId).first();

    if (!document) {
      throw new Error('Document not found');
    }

    // Get embedding statistics
    const statsResult = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN embedding_status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN embedding_status = 'pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN embedding_status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM document_chunks
       WHERE document_id = ?`
    ).bind(documentId).first();

    const stats = statsResult || { total: 0, completed: 0, pending: 0, failed: 0 };
    const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    // Get chunk details
    const chunksResult = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT
         id,
         chunk_index,
         embedding_status,
         vector_id,
         CASE WHEN vector_embedding IS NOT NULL THEN 1 ELSE 0 END as has_embedding
       FROM document_chunks
       WHERE document_id = ?
       ORDER BY chunk_index ASC`
    ).bind(documentId).all();

    const chunks = (chunksResult.results || []).map((row: any) => ({
      chunkId: row.id,
      chunkIndex: row.chunk_index,
      embeddingStatus: row.embedding_status,
      vectorId: row.vector_id,
      hasEmbedding: row.has_embedding === 1,
    }));

    this.env.logger.info('Embedding statistics retrieved', {
      documentId,
      totalChunks: stats.total,
      completed: stats.completed,
      pending: stats.pending,
      failed: stats.failed,
      percentage,
    });

    return {
      documentId,
      totalChunks: stats.total,
      completed: stats.completed,
      pending: stats.pending,
      failed: stats.failed,
      percentage,
      chunks,
    };
  }
}
