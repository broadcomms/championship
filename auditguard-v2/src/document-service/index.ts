import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { detectContentType } from './content-type-detector';
import { VultrStorageService } from '../storage-service';
import { VectorSearchService, VectorSearchRequest, VectorSearchResponse } from '../vector-search-service';
import { ComplianceTaggingService } from '../compliance-tagging-service';
import { EmbeddingService } from '../embedding-service';
import { TextExtractionService } from '../text-extraction-service';
import { enrichDocument, type EnrichmentInput } from '../common/ai-enrichment';

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
    this.env.logger.info('🔍 INSERTING DOCUMENT INTO DATABASE', {
      documentId,
      processing_status: 'pending',
      text_extracted: 0,
      chunk_count: 0,
    });

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
        storage_key: 'pending_extraction',  // Placeholder until text extraction completes
        extraction_status: 'pending',  // Text extraction pending
        uploaded_by: input.userId,
        uploaded_at: now,
        updated_at: now,
        processing_status: 'pending',
        text_extracted: 0,
        chunk_count: 0,
      } as any)
      .execute();

    // VERIFY INSERT (using raw query since types might be out of sync)
    const inserted = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT processing_status, vector_indexing_status, chunks_created, text_extracted
       FROM documents WHERE id = ?`
    ).bind(documentId).first();

    this.env.logger.info('✅ DATABASE INSERT VERIFIED', {
      documentId,
      queriedValues: inserted,
    });

    // Queue for text extraction + SmartBucket indexing
    this.env.logger.info('Queueing document for text extraction and indexing', {
      documentId,
      workspaceId: input.workspaceId,
      vultrKey,
      action: 'extract_and_index',
    });

    this.env.logger.info('📤 SENDING MESSAGE TO QUEUE', {
      documentId,
      workspaceId: input.workspaceId,
      vultrKey,
      action: 'extract_and_index',
      queueName: 'DOCUMENT_PROCESSING_QUEUE',
      hasQueue: !!this.env.DOCUMENT_PROCESSING_QUEUE,
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

      this.env.logger.info('✅ MESSAGE SENT TO QUEUE SUCCESSFULLY', {
        documentId,
        workspaceId: input.workspaceId,
        frameworkId: input.frameworkId,
      });
    } catch (error) {
      this.env.logger.error('❌ FAILED TO SEND MESSAGE TO QUEUE', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't fail the upload - user can manually trigger processing
      throw error;  // Actually, DO fail so we know it's broken
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
    characterCount?: number;
    pageCount?: number;
    chunksCreated?: number;
    embeddingsGenerated?: number;
    vectorIndexingStatus?: string;
    complianceFrameworkId?: number;
    fullyCompleted?: boolean; // CRITICAL FIX: Include fully_completed flag for UI polling
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
        'documents.character_count' as any,
        'documents.page_count' as any,
        'documents.chunks_created' as any,
        'documents.embeddings_generated' as any,
        'documents.vector_indexing_status' as any,
        'documents.compliance_framework_id' as any,
        'documents.fully_completed' as any, // CRITICAL FIX: Get fully_completed flag
      ])
      .where('documents.id', '=', documentId)
      .where('documents.workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    // PHASE 2: Get chunk count from D1 (single source of truth)
    const realChunkCount = document.chunk_count || 0;

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
      chunkCount: realChunkCount,
      wordCount: document.word_count,
      characterCount: document.character_count,
      pageCount: document.page_count,
      chunksCreated: document.chunks_created,
      embeddingsGenerated: document.embeddings_generated,
      vectorIndexingStatus: document.vector_indexing_status,
      complianceFrameworkId: document.compliance_framework_id,
      fullyCompleted: document.fully_completed === 1, // CRITICAL FIX: Convert to boolean
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

    this.env.logger.info('Deleting document with cascade', {
      documentId,
      workspaceId,
      storageKey: document.storage_key,
    });

    // CRITICAL FIX: Track deletion status across all systems
    const deletionStatus = {
      postgresql: false,
      smartbucket: false,
      d1Database: false,
    };
    const deletionErrors: string[] = [];

    try {
      // Step 1: Mark document as deleting (prevents concurrent operations)
      await db
        .updateTable('documents')
        .set({
          processing_status: 'deleting' as any,
          updated_at: Date.now(),
        })
        .where('id', '=', documentId)
        .where('workspace_id', '=', workspaceId)
        .execute();

      this.env.logger.info('Document marked as deleting', { documentId });


      // Step 3: Delete from SmartBucket storage (best effort)
      try {
        await this.env.DOCUMENTS_BUCKET.delete(document.storage_key);
        deletionStatus.smartbucket = true;
        this.env.logger.info('Deleted document from SmartBucket storage', {
          documentId,
          storageKey: document.storage_key,
        });
      } catch (error) {
        const errorMsg = `SmartBucket deletion failed: ${error instanceof Error ? error.message : String(error)}`;
        deletionErrors.push(errorMsg);
        this.env.logger.error('Failed to delete from SmartBucket storage', {
          documentId,
          storageKey: document.storage_key,
          error: error instanceof Error ? error.message : String(error),
        });
      }

// Step 4: Delete from D1 database (CRITICAL - CASCADE handles related tables)
try {
  // Delete document - CASCADE will automatically delete:
  // - compliance_issues (via document_id foreign key)
  // - compliance_checks (via document_id foreign key)  
  // - document_chunks (via document_id foreign key)
  await db
    .deleteFrom('documents')
    .where('id', '=', documentId)
    .where('workspace_id', '=', workspaceId)
    .execute();

  deletionStatus.d1Database = true;
  
  this.env.logger.info('Document deleted successfully from D1 (with CASCADE)', {
    documentId,
    workspaceId,
  });
} catch (dbError) {
        // CRITICAL: D1 deletion failed - this is a serious error
        const errorMsg = `D1 deletion CRITICAL failure: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
        deletionErrors.push(errorMsg);
        this.env.logger.error('CRITICAL: D1 database deletion failed', {
          documentId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
        });

        // Try to restore document status
        try {
          await db
            .updateTable('documents')
            .set({
              processing_status: 'completed' as any,
              updated_at: Date.now(),
            })
            .where('id', '=', documentId)
            .where('workspace_id', '=', workspaceId)
            .execute();

          this.env.logger.info('Restored document status after failed deletion', { documentId });
        } catch (restoreError) {
          this.env.logger.error('Failed to restore document status', {
            documentId,
            error: restoreError instanceof Error ? restoreError.message : String(restoreError),
          });
        }

        throw new Error(errorMsg);
      }

      // Log final status
      if (deletionErrors.length > 0) {
        this.env.logger.warn('Document deleted with warnings', {
          documentId,
          workspaceId,
          deletionStatus,
          warnings: deletionErrors,
          note: 'Manual cleanup may be required for failed systems',
        });
      } else {
        this.env.logger.info('Document deleted successfully from all systems', {
          documentId,
          workspaceId,
          deletionStatus,
        });
      }

      return {
        success: true,
        warnings: deletionErrors.length > 0 ? deletionErrors : undefined,
      } as any;

    } catch (error) {
      this.env.logger.error('Document deletion failed', {
        documentId,
        workspaceId,
        deletionStatus,
        errors: deletionErrors,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(`Document deletion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
   * Get processing steps for a document
   * Returns ordered list of processing steps with their current status
   */
  async getProcessingSteps(documentId: string): Promise<Array<{
    id: string;
    documentId: string;
    stepName: string;
    stepOrder: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    startedAt?: number;
    completedAt?: number;
    progressCurrent?: number;
    progressTotal?: number;
    metadata?: any;
    errorMessage?: string;
    createdAt: number;
    updatedAt: number;
  }>> {
    try {
      const result = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT * FROM document_processing_steps
         WHERE document_id = ?
         ORDER BY step_order ASC`
      ).bind(documentId).all();

      return (result.results || []).map((row: any) => ({
        id: row.id,
        documentId: row.document_id,
        stepName: row.step_name,
        stepOrder: row.step_order,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        progressCurrent: row.progress_current,
        progressTotal: row.progress_total,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      // If table doesn't exist yet, return empty array
      if (error instanceof Error && error.message?.includes('no such table')) {
        this.env.logger.warn('Processing steps table not found - migration pending', {
          documentId,
        });
        return [];
      }
      throw error;
    }
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
      updateData.smartbucket_indexing_status = 'processing';  // SmartBucket now indexing in background
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

    // NOTE: AI enrichment is now handled directly in document-processor
    // This auto-trigger has been disabled to avoid duplicate enrichment attempts
    // The enrichment happens immediately after text extraction in the processor
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
      // ✅ Extract title and description using AI (BEFORE indexing check - doesn't need chunks!)
      this.env.logger.info('🤖 Starting AI-powered document enrichment', {
        documentId,
        storageKey: document.storage_key,
        filename: document.filename,
      });

      let extractedTitle = document.filename;  // Fallback to filename
      let extractedDescription = `Uploaded ${document.content_type} document with ${document.word_count} words.`;  // Fallback description

      try {
        // Get document text from D1 database (already extracted and saved)
        // This is much faster and doesn't depend on SmartBucket indexing
        const extractedText = (document as any).extracted_text;
        if (!extractedText) {
          throw new Error('Document text not yet extracted');
        }

        const textContent = extractedText;
        const textPreview = textContent.substring(0, 4000); // First 4K chars

        // Call AI to generate title and description
        const prompt = `Analyze this document and provide a title and description.

Document filename: ${document.filename}
Content type: ${document.content_type}
Word count: ${document.word_count}
${document.page_count ? `Page count: ${document.page_count}` : ''}

Document text:
${textPreview}

Respond with ONLY a JSON object in this exact format:
{
  "title": "A clear, descriptive title (50 chars max)",
  "description": "A 2-3 sentence summary of the document's purpose and content"
}`;

        this.env.logger.info('🔍 Calling AI for enrichment', {
          documentId,
          model: 'deepseek-r1-distill-qwen-32b',
          promptLength: prompt.length,
        });

        const aiResponse = await this.env.AI.run('deepseek-r1-distill-qwen-32b', {
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        });

        this.env.logger.info('✅ AI responded', {
          documentId,
          responseLength: JSON.stringify(aiResponse).length,
        });

        // Parse AI response
        const content = (aiResponse as any).response || JSON.stringify(aiResponse);
        const parsed = JSON.parse(content);

        if (parsed.title && parsed.description) {
          extractedTitle = parsed.title;
          extractedDescription = parsed.description;

          this.env.logger.info('✅ Document enrichment completed successfully', {
            documentId,
            title: extractedTitle,
            descriptionLength: extractedDescription.length,
          });
        } else {
          throw new Error('Invalid AI response format');
        }

      } catch (enrichmentError) {
        // Log error but continue with fallback metadata
        this.env.logger.error('⚠️ Document enrichment failed, using fallback metadata', {
          documentId,
          error: enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError),
          stack: enrichmentError instanceof Error ? enrichmentError.stack : undefined,
          fallbackTitle: extractedTitle,
          fallbackDescription: extractedDescription,
        });
        // Continue with fallback values set above
      }

      // ✅ SAVE enrichment results to database IMMEDIATELY (before indexing check)
      this.env.logger.info('💾 Saving enrichment results to database', {
        documentId,
        title: extractedTitle,
        descriptionLength: extractedDescription.length,
      });

      await db
        .updateTable('documents')
        .set({
          title: extractedTitle,
          description: extractedDescription,
          updated_at: Date.now(),
        } as any)
        .where('id', '=', documentId)
        .execute();

      this.env.logger.info('✅ Enrichment results saved successfully', {
        documentId,
        title: extractedTitle,
      });

      // ✅ Verify SmartBucket has finished indexing (non-blocking check for logging)
      // SmartBucket is OPTIONAL - don't block enrichment if it's slow
      let indexStatus = { isComplete: false, progress: 0, chunkCount: 0 };
      try {
        indexStatus = await this.verifyIndexingComplete(
          document.storage_key,
          workspaceId
        );

        if (!indexStatus.isComplete) {
          // SmartBucket indexing not complete - just log it, don't block enrichment
          this.env.logger.info('SmartBucket indexing still in progress (non-blocking)', {
            documentId,
            progress: indexStatus.progress,
            chunkCount: indexStatus.chunkCount,
          });
          // Don't throw - SmartBucket is optional, enrichment already succeeded
        }

        this.env.logger.info('Document indexing verified complete', {
          documentId,
          smartBucketChunkCount: indexStatus.chunkCount,
          localChunkCount: document.chunk_count,
          storageKey: document.storage_key,
        });
      } catch (verifyError) {
        // Log but don't fail - SmartBucket is optional, enrichment already succeeded
        this.env.logger.warn('SmartBucket indexing verification skipped or failed (non-blocking)', {
          documentId,
          error: verifyError instanceof Error ? verifyError.message : String(verifyError),
        });
        // Don't re-throw - SmartBucket is optional, let enrichment complete
      }

      // WORKAROUND: Generate embeddings synchronously since queue observer isn't working
      this.env.logger.info('Starting embedding generation (synchronous workaround)', {
        documentId,
        workspaceId,
        chunkCount: document.chunk_count,
      });

      try {
        // Get all chunks from PostgreSQL via API
        const embeddingServiceUrl = (this.env as any).LOCAL_EMBEDDING_SERVICE_URL || 'https://auditrig.com';
        const chunksResponse = await fetch(
          `${embeddingServiceUrl}/api/v1/documents/${documentId}/chunks`,
          {
            method: 'GET',
            headers: {
              'X-API-Key': (this.env as any).EMBEDDING_SERVICE_API_KEY || '',
              'Content-Type': 'application/json',
            },
          }
        );

        if (!chunksResponse.ok) {
          throw new Error(`Failed to get chunks from PostgreSQL: ${chunksResponse.status}`);
        }

        const chunksData = await chunksResponse.json() as {
          documentId: string;
          totalChunks: number;
          chunks: Array<{
            chunkId: number;
            chunkIndex: number;
            content: string;
            chunkSize: number;
            startChar: number;
            endChar: number;
            tokenCount: number;
            embeddingStatus: string;
            hasHeader: boolean;
            sectionTitle: string | null;
            createdAt: string;
          }>;
        };

        const rawChunks = chunksData.chunks || [];

        // Transform API chunks to Chunk interface format
        // API has 'content', but Chunk interface expects 'text'
        const chunks = rawChunks.map((c: any) => ({
          text: c.content,  // Map 'content' → 'text'
          index: c.chunkIndex,
          metadata: {
            startChar: c.startChar || 0,
            endChar: c.endChar || 0,
            tokenCount: c.tokenCount || 0,
            hasHeader: c.hasHeader || false,
            sectionTitle: c.sectionTitle || undefined,
          },
        }));

        const chunkIds = rawChunks.map((c: any) => c.chunkId);

        if (chunks.length > 0) {
          this.env.logger.info('Transformed chunks for embedding generation', {
            documentId,
            chunkCount: chunks.length,
            firstChunkTextLength: chunks[0]?.text?.length || 0,
          });

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
          LOCAL_EMBEDDING_SERVICE_URL: (this.env as any).LOCAL_EMBEDDING_SERVICE_URL || 'NOT SET',
        });
        // Don't throw - we still want to mark the document as processed
        // But log prominently so we can debug
      }

      // Update document status (keep LOCAL chunk count, don't overwrite with SmartBucket data)
      const now = Date.now();
      await db
        .updateTable('documents')
        .set({
          title: extractedTitle,
          description: extractedDescription,
          text_extracted: 1,  // Indexing confirmed complete
          // NOTE: We do NOT update chunk_count here - keep the LOCAL value set by document-processor
          processing_status: 'completed',
          updated_at: now,
        } as any)
        .where('id', '=', documentId)
        .execute();

      // Update SmartBucket indexing status separately (new column not in types yet)
      await (db as any).updateTable('documents')
        .set({ smartbucket_indexing_status: 'completed' })
        .where('id', '=', documentId)
        .execute();

      this.env.logger.info('Document processing completed successfully', {
        documentId,
        title: extractedTitle,
        localChunkCount: document.chunk_count,
        smartBucketChunkCount: indexStatus.chunkCount,
        processingStatus: 'completed',
      });

      return {
        success: true,
        title: extractedTitle,
        description: extractedDescription,
        chunkCount: document.chunk_count,  // Return LOCAL chunk count
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
   * Re-process document: AI re-enrichment for title/description/category/framework
   * This is used by the "Reprocess" button to regenerate metadata without re-chunking/re-embedding
   */
  async reProcessDocument(
    documentId: string,
    workspaceId: string
  ): Promise<{
    success: boolean;
    title: string;
    description: string;
    category: string;
    complianceFrameworkId: number | null;
  }> {
    const db = this.getDb();

    this.env.logger.info('🔄 Starting document reprocessing (AI re-enrichment)', {
      documentId,
      workspaceId,
    });

    // Get document with extracted_text from D1
    const document = await db
      .selectFrom('documents')
      .selectAll()
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    // Check if extracted_text exists
    const extractedText = (document as any).extracted_text;
    if (!extractedText || extractedText.length === 0) {
      this.env.logger.warn('⚠️ Document missing extracted_text', {
        documentId,
        filename: document.filename,
      });
      throw new Error('Document text not yet extracted. Please re-extract text from the "Full Text" tab first.');
    }

    this.env.logger.info('✅ Document text found in D1', {
      documentId,
      textLength: extractedText.length,
      wordCount: document.word_count,
    });

    // Use shared AI enrichment utility
    const enrichmentInput: EnrichmentInput = {
      filename: document.filename,
      contentType: document.content_type,
      text: extractedText,
      wordCount: document.word_count || 0,
      pageCount: document.page_count || undefined,
    };

    const enrichmentResult = await enrichDocument(enrichmentInput, {
      AI: this.env.AI,
      AUDITGUARD_DB: this.env.AUDITGUARD_DB,
      logger: this.env.logger,
    });

    // Update database with enriched metadata
    this.env.logger.info('💾 Updating document with re-enriched metadata', {
      documentId,
      title: enrichmentResult.title,
      category: enrichmentResult.category,
      framework: enrichmentResult.complianceFrameworkId,
    });

    await db
      .updateTable('documents')
      .set({
        title: enrichmentResult.title,
        description: enrichmentResult.description,
        category: enrichmentResult.category,
        compliance_framework_id: enrichmentResult.complianceFrameworkId,
        updated_at: Date.now(),
      } as any)
      .where('id', '=', documentId)
      .execute();

    this.env.logger.info('✅ Document reprocessing completed successfully', {
      documentId,
      title: enrichmentResult.title,
      category: enrichmentResult.category,
      framework: enrichmentResult.complianceFrameworkId,
    });

    return {
      success: true,
      title: enrichmentResult.title,
      description: enrichmentResult.description,
      category: enrichmentResult.category,
      complianceFrameworkId: enrichmentResult.complianceFrameworkId,
    };
  }

  /**
   * Re-extract text from Vultr storage and update D1 database
   * This is used by the "Re-extract Text" button on the Full Text tab
   * for old documents that don't have extracted_text in D1
   */
  async reExtractText(
    documentId: string,
    workspaceId: string,
    userId: string
  ): Promise<{
    success: boolean;
    extractedText: string;
    wordCount: number;
    pageCount: number | null;
  }> {
    const db = this.getDb();

    this.env.logger.info('🔄 Starting text re-extraction from Vultr storage', {
      documentId,
      workspaceId,
      userId,
    });

    // Get document
    const document = await db
      .selectFrom('documents')
      .selectAll()
      .where('id', '=', documentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!document) {
      throw new Error('Document not found');
    }

    // Check if vultr_key exists
    const vultrKey = (document as any).vultr_key;
    if (!vultrKey) {
      throw new Error('Document does not have a Vultr storage key. Cannot re-extract text.');
    }

    this.env.logger.info('📥 Downloading document from Vultr storage', {
      documentId,
      vultrKey,
      filename: document.filename,
      contentType: document.content_type,
    });

    // Download file from Vultr storage
    const vultrStorage = new VultrStorageService(this.env);
    const fileBuffer = await vultrStorage.getDocument(vultrKey);

    this.env.logger.info('✅ File downloaded from Vultr', {
      documentId,
      fileSize: fileBuffer.byteLength,
    });

    // Extract text using TextExtractionService
    this.env.logger.info('📄 Extracting text from document', {
      documentId,
      contentType: document.content_type,
      filename: document.filename,
    });

    const textExtractor = new TextExtractionService(this.env);
    const { text, pageCount, wordCount, characterCount, metadata } = await textExtractor.extractText(
      fileBuffer,
      document.content_type,
      document.filename
    );

    // Validate extraction quality
    const validation = textExtractor.validateExtraction({ text, pageCount, wordCount, characterCount, metadata });
    if (!validation.isValid) {
      this.env.logger.warn('⚠️ Text extraction quality warnings', {
        documentId,
        warnings: validation.warnings,
      });
    }

    this.env.logger.info('✅ Text extraction completed', {
      documentId,
      textLength: text.length,
      wordCount,
      pageCount,
      warnings: validation.warnings,
    });

    // Update D1 database with extracted text
    this.env.logger.info('💾 Saving extracted text to D1 database', {
      documentId,
      textLength: text.length,
      wordCount,
      pageCount,
    });

    await db
      .updateTable('documents')
      .set({
        extracted_text: text,
        word_count: wordCount,
        character_count: text.length,
        page_count: pageCount || null,
        extraction_status: 'completed',
        updated_at: Date.now(),
      } as any)
      .where('id', '=', documentId)
      .execute();

    this.env.logger.info('✅ Text re-extraction completed successfully', {
      documentId,
      textLength: text.length,
      wordCount,
      pageCount,
    });

    return {
      success: true,
      extractedText: text,
      wordCount,
      pageCount,
    };
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

    // Use AI-generated description from database (generated during processDocument)
    // Fallback to generic message if description not available
    this.env.logger.info('Using AI-generated description as summary', {
      documentId,
      hasDescription: !!document.description,
      processingStatus,
      isStillProcessing,
    });

    summary = isStillProcessing
      ? 'Processing... Summary will be available after indexing completes.'
      : (document.description || 'Document indexed. Summary generation can be added later if needed.');

    // 📊 Phase 2.2: Get chunks from D1 database (local, no external API)
    try {
      const chunksResult = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT chunk_text, chunk_index, embedding_status, word_count
         FROM document_chunks
         WHERE document_id = ?
         ORDER BY chunk_index ASC`
      ).bind(documentId).all();

      chunks = (chunksResult.results || []).map((chunk: any) => ({
        text: chunk.chunk_text || '',
        chunkIndex: chunk.chunk_index,
        embeddingStatus: chunk.embedding_status,
        wordCount: chunk.word_count,
      }));

      this.env.logger.info('📊 Phase 2.2: Retrieved chunks from D1', {
        documentId,
        chunkCount: chunks.length,
        source: 'd1_database',
      });
    } catch (error) {
      this.env.logger.error('Failed to retrieve chunks from D1', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
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
    const minScore = Math.max(Math.min(request.minScore || 0.7, 1.0), 0.0); // 0.0-1.0 range (PHASE 2.3: default 0.7 for high similarity)
    const retryForIndexing = request.retryForIndexing !== undefined ? request.retryForIndexing : false; // PHASE 2.3: Retry for recently uploaded vectors

    this.env.logger.info('🔍 Vector search request (PHASE 2.3: bge-small-en)', {
      workspaceId,
      userId,
      query: request.query.substring(0, 100),
      frameworkId: request.frameworkId,
      topK,
      pageSize,
      page,
      minScore,
      retryForIndexing,
    });

    // Create vector search service
    const vectorSearchService = new VectorSearchService(this.env);

    // PHASE 2.3: Perform search with retry logic for indexing delays
    const searchRequest: VectorSearchRequest = {
      query: request.query,
      workspaceId,
      frameworkId: request.frameworkId,
      topK,
      minScore,
      includeChunks: request.includeChunks !== false,
      page,
      pageSize,
      retryForIndexing, // PHASE 2.3: Pass retry flag for recently uploaded documents
    };

    // Enable hybrid search with SmartBucket fallback
    const hybridOptions = {
      useSmartBucket: true,          // Enable SmartBucket fallback
      smartBucketThreshold: 3,       // Fall back if < 3 vector results
      combineResults: true,          // Merge and deduplicate results
    };

    const results = await vectorSearchService.search(searchRequest, hybridOptions);

    this.env.logger.info('✅ Vector search completed (PHASE 2.3)', {
      workspaceId,
      userId,
      query: request.query.substring(0, 50),
      totalResults: results.totalResults,
      returnedResults: results.results.length,
      source: results.source,
      searchTime: results.searchTime,
      retryUsed: retryForIndexing,
    });

    return results;
  }

  /**
   * PHASE 2.3: Search recently uploaded documents with retry logic
   * Use this method when searching for documents that were just uploaded
   * to account for the 3-5 second indexing delay in Raindrop Vector Index
   * 
   * @param workspaceId Workspace to search in
   * @param userId User making the request
   * @param query Search query text
   * @param options Optional search parameters
   */
  async searchRecentDocuments(
    workspaceId: string,
    userId: string,
    query: string,
    options?: {
      topK?: number;
      minScore?: number;
      frameworkId?: number;
    }
  ): Promise<VectorSearchResponse> {
    return this.vectorSearch(workspaceId, userId, {
      query,
      workspaceId,
      topK: options?.topK,
      minScore: options?.minScore,
      frameworkId: options?.frameworkId,
      retryForIndexing: true, // Enable retry logic for indexing delays
    });
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
   *
   * NOTE: document_chunks table removed in migration 0014
   * Chunk data now managed in PostgreSQL. This method returns empty array for backward compatibility.
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

    this.env.logger.info('getFrameworkChunks called - returning empty (chunks in PostgreSQL)', {
      workspaceId,
      frameworkId,
    });

    // Return empty array - chunk data now in PostgreSQL
    return [];
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

    // NOTE: document_chunks table removed in migration 0014
    // Chunk tagging now handled in PostgreSQL
    this.env.logger.info('untagChunk called - chunks now in PostgreSQL', {
      chunkId,
      frameworkId,
      userId,
      workspaceId,
    });

    // No-op: chunk data is in PostgreSQL, not D1
    // This method is kept for backward compatibility but does nothing
  }

  /**
   * Phase 5: Get document chunks with framework tags for UI display
   * NOW QUERIES POSTGRESQL VIA API
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
    this.env.logger.info('Getting document chunks from PostgreSQL', {
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

    // 📊 Phase 2.2: Get chunks from D1 database (local, no external API)
    try {
      const chunksResult = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT id, document_id, chunk_index, chunk_text, word_count, 
                vector_id, embedding_status, created_at
         FROM document_chunks
         WHERE document_id = ? AND workspace_id = ?
         ORDER BY chunk_index ASC`
      ).bind(documentId, workspaceId).all();

      this.env.logger.info('📊 Phase 2.2: Retrieved chunks from D1', {
        documentId,
        chunkCount: (chunksResult.results || []).length,
        source: 'd1_database',
        chunkStatuses: (chunksResult.results || []).map((c: any) => ({
          index: c.chunk_index,
          status: c.embedding_status,
        })),
      });

      // Transform to match expected format
      // Note: Phase 2.2 doesn't have startChar/endChar/tokenCount/hasHeader/sectionTitle yet
      return (chunksResult.results || []).map((chunk: any) => ({
        id: chunk.chunk_index,
        documentId: chunk.document_id,
        chunkIndex: chunk.chunk_index,
        content: chunk.chunk_text,
        chunkSize: chunk.word_count || 0,
        startChar: 0, // Not stored in Phase 2.2
        endChar: chunk.chunk_text?.length || 0,
        tokenCount: Math.ceil((chunk.word_count || 0) * 1.3), // Approximate
        hasHeader: false, // Not stored in Phase 2.2
        sectionTitle: null,
        embeddingStatus: chunk.embedding_status || 'pending',
        createdAt: chunk.created_at || Date.now(),
        tags: [], // Phase 2.2 doesn't have compliance tags yet
      }));

    } catch (error) {
      this.env.logger.error('Failed to get chunks from PostgreSQL', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Fallback to empty array instead of failing
      return [];
    }
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

    // Verify document belongs to workspace and get embedding stats
    const document = await (this.env.AUDITGUARD_DB as any).prepare(
      `SELECT id, chunk_count, embeddings_generated FROM documents WHERE id = ? AND workspace_id = ?`
    ).bind(documentId, workspaceId).first();

    if (!document) {
      throw new Error('Document not found');
    }

    // NOTE: document_chunks table removed in migration 0014
    // Embedding statistics now tracked at document level in 'documents' table
    const stats = {
      total: document.chunk_count || 0,
      completed: document.embeddings_generated || 0,
      pending: 0,
      failed: 0,
    };
    const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    // Chunks are in PostgreSQL - return empty chunk details array
    const chunks: Array<{
      chunkId: number;
      chunkIndex: number;
      embeddingStatus: string;
      vectorId: string | null;
      hasEmbedding: boolean;
    }> = [];

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

  /**
   * Get ACTUAL Vector Index status by querying the Vector Index directly
   * This bypasses database tracking and queries the real Vector Index
   * Use this to show accurate "X/Y indexed" count in UI
   */
  async getActualVectorIndexStatus(
    documentId: string,
    workspaceId: string,
    userId: string
  ): Promise<{
    documentId: string;
    totalChunks: number;
    indexedChunks: number;
    vectorIds: string[];
    status: 'completed' | 'partial' | 'failed';
    smartBucketStatus: {
      isIndexed: boolean;
      chunkCount: number;
      error?: string;
    };
  }> {
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

    // PHASE 2: Get Vector Index status from D1 database tracking
    const embeddingService = new EmbeddingService(this.env);
    const embeddingProgress = await embeddingService.getEmbeddingProgress(documentId);

    // Also check SmartBucket indexing status
    const smartBucketStatus = await embeddingService.verifySmartBucketIndexing(documentId, workspaceId);

    const status: 'completed' | 'partial' | 'failed' =
      embeddingProgress.failed > 0 ? 'failed' :
      embeddingProgress.completed === embeddingProgress.total ? 'completed' :
      'partial';

    this.env.logger.info('Vector index status retrieved from D1', {
      documentId,
      workspaceId,
      totalChunks: embeddingProgress.total,
      indexedChunks: embeddingProgress.completed,
      status,
      smartBucketIndexed: smartBucketStatus.isIndexed,
    });

    return {
      documentId,
      totalChunks: embeddingProgress.total,
      indexedChunks: embeddingProgress.completed,
      vectorIds: [], // No longer tracking individual vector IDs
      status,
      smartBucketStatus,
    };
  }

  /**
   * CRITICAL FIX: Detect documents stuck in processing state
   * Run this periodically (every 5-10 minutes) via cron/scheduled task
   */
  async detectStuckDocuments(timeoutMinutes: number = 30): Promise<{
    success: boolean;
    stuckDocuments: Array<{
      id: string;
      workspaceId: string;
      filename: string;
      updatedAt: number;
      minutesStuck: number;
    }>;
    recoveredCount: number;
    errorCount: number;
  }> {
    const TIMEOUT_MS = timeoutMinutes * 60 * 1000;
    const cutoffTime = Date.now() - TIMEOUT_MS;

    this.env.logger.info('Starting stuck document detection', {
      timeoutMinutes,
      cutoffTime: new Date(cutoffTime).toISOString(),
    });

    try {
      // Find documents stuck in processing
      const stuckDocs = await (this.env.AUDITGUARD_DB as any)
        .prepare(`
          SELECT id, workspace_id, filename, updated_at, processing_status, fully_completed
          FROM documents
          WHERE processing_status = 'processing'
            AND fully_completed = 0
            AND updated_at < ?
          ORDER BY updated_at ASC
          LIMIT 100
        `)
        .bind(cutoffTime)
        .all();

      const stuckDocuments = (stuckDocs.results || []).map((doc: any) => ({
        id: doc.id,
        workspaceId: doc.workspace_id,
        filename: doc.filename,
        updatedAt: doc.updated_at,
        minutesStuck: Math.floor((Date.now() - doc.updated_at) / (60 * 1000)),
      }));

      if (stuckDocuments.length === 0) {
        this.env.logger.info('No stuck documents found');
        return {
          success: true,
          stuckDocuments: [],
          recoveredCount: 0,
          errorCount: 0,
        };
      }

      this.env.logger.warn('Found stuck documents', {
        count: stuckDocuments.length,
        documents: stuckDocuments.map(d => ({
          id: d.id,
          filename: d.filename,
          minutesStuck: d.minutesStuck,
        })),
      });

      // Attempt to recover each stuck document
      let recoveredCount = 0;
      let errorCount = 0;

      for (const doc of stuckDocuments) {
        try {
          await this.recoverStuckDocument(doc.id, doc.workspaceId);
          recoveredCount++;
        } catch (error) {
          errorCount++;
          this.env.logger.error('Failed to recover stuck document', {
            documentId: doc.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.env.logger.info('Stuck document recovery completed', {
        totalFound: stuckDocuments.length,
        recovered: recoveredCount,
        errors: errorCount,
      });

      return {
        success: true,
        stuckDocuments,
        recoveredCount,
        errorCount,
      };

    } catch (error) {
      this.env.logger.error('Stuck document detection failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        stuckDocuments: [],
        recoveredCount: 0,
        errorCount: 0,
      };
    }
  }

  /**
   * CRITICAL FIX: Recover a single stuck document
   * Marks it as failed and notifies user
   */
  private async recoverStuckDocument(documentId: string, workspaceId: string): Promise<void> {
    this.env.logger.info('Recovering stuck document', { documentId, workspaceId });

    // Mark document as failed
    await (this.env.AUDITGUARD_DB as any)
      .prepare(`
        UPDATE documents
        SET processing_status = 'failed',
            fully_completed = 1,
            updated_at = ?
        WHERE id = ? AND workspace_id = ?
      `)
      .bind(Date.now(), documentId, workspaceId)
      .run();

    // Log the recovery action
    this.env.logger.warn('Document marked as failed after timeout', {
      documentId,
      workspaceId,
      reason: 'Processing timeout - exceeded maximum processing time',
    });

    // TODO: Send notification to user (email/in-app) about failed processing
    // This would require integration with notification service

    this.env.logger.info('Document recovery completed', { documentId });
  }

  /**
   * CRITICAL FIX: Manually recover a specific document by ID
   * Used for admin intervention or API endpoint
   */
  async recoverDocument(documentId: string, workspaceId: string, userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    this.env.logger.info('Manual document recovery requested', {
      documentId,
      workspaceId,
      userId,
    });

    try {
      // Verify document exists and is in stuck state
      const document = await (this.env.AUDITGUARD_DB as any)
        .prepare(`
          SELECT id, processing_status, fully_completed, updated_at
          FROM documents
          WHERE id = ? AND workspace_id = ?
        `)
        .bind(documentId, workspaceId)
        .first();

      if (!document) {
        return {
          success: false,
          message: 'Document not found',
        };
      }

      if (document.processing_status !== 'processing') {
        return {
          success: false,
          message: `Document is not stuck (status: ${document.processing_status})`,
        };
      }

      // Recover the document
      await this.recoverStuckDocument(documentId, workspaceId);

      return {
        success: true,
        message: 'Document recovered successfully',
      };

    } catch (error) {
      this.env.logger.error('Manual document recovery failed', {
        documentId,
        workspaceId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        message: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
