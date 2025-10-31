import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

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

    // Upload to SmartBucket
    await this.env.DOCUMENTS_BUCKET.put(storageKey, input.file, {
      httpMetadata: {
        contentType: input.contentType,
      },
      customMetadata: {
        workspaceId: input.workspaceId,
        documentId: documentId,
        uploadedBy: input.userId,
      },
    });

    // Store metadata in database
    await db
      .insertInto('documents')
      .values({
        id: documentId,
        workspace_id: input.workspaceId,
        filename: input.filename,
        file_size: fileSize,
        content_type: input.contentType,
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
      fileSize: number;
      contentType: string;
      category: string | null;
      uploadedBy: string;
      uploaderEmail: string;
      uploadedAt: number;
      updatedAt: number;
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
        'documents.file_size',
        'documents.content_type',
        'documents.category',
        'documents.uploaded_by',
        'users.email as uploader_email',
        'documents.uploaded_at',
        'documents.updated_at',
      ])
      .where('documents.workspace_id', '=', workspaceId)
      .orderBy('documents.uploaded_at', 'desc')
      .execute();

    return {
      documents: documents.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        fileSize: doc.file_size,
        contentType: doc.content_type,
        category: doc.category,
        uploadedBy: doc.uploaded_by,
        uploaderEmail: doc.uploader_email,
        uploadedAt: doc.uploaded_at,
        updatedAt: doc.updated_at,
      })),
    };
  }

  async getDocument(documentId: string, workspaceId: string, userId: string): Promise<{
    id: string;
    workspaceId: string;
    filename: string;
    fileSize: number;
    contentType: string;
    category: string | null;
    storageKey: string;
    uploadedBy: string;
    uploaderEmail: string;
    uploadedAt: number;
    updatedAt: number;
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
        'documents.file_size',
        'documents.content_type',
        'documents.category',
        'documents.storage_key',
        'documents.uploaded_by',
        'users.email as uploader_email',
        'documents.uploaded_at',
        'documents.updated_at',
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
      fileSize: document.file_size,
      contentType: document.content_type,
      category: document.category,
      storageKey: document.storage_key,
      uploadedBy: document.uploaded_by,
      uploaderEmail: document.uploader_email,
      uploadedAt: document.uploaded_at,
      updatedAt: document.updated_at,
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
}
