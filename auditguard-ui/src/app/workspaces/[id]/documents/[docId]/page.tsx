'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/common/Button';
import { CategoryBadge } from '@/components/documents/CategoryBadge';
import { ProcessingIndicator } from '@/components/documents/ProcessingIndicator';
import { DocumentContentViewer } from '@/components/documents/DocumentContentViewer';
import { useDocumentPolling } from '@/hooks/useDocumentPolling';
import { api } from '@/lib/api';
import { Document, DocumentCategory } from '@/types';

export default function DocumentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const documentId = params.docId as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state for editing
  const [editFilename, setEditFilename] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('other');

  // Use polling hook for processing status
  const { status, document: polledDocument, startPolling } = useDocumentPolling(
    workspaceId,
    documentId
  );

  useEffect(() => {
    fetchDocument();
  }, [workspaceId, documentId]);

  useEffect(() => {
    // Update document if polling returns new data
    if (polledDocument) {
      setDocument(polledDocument);
    }
  }, [polledDocument]);

  useEffect(() => {
    // Start polling if document is being processed
    if (document && (document.processingStatus === 'pending' || document.processingStatus === 'processing')) {
      startPolling();
    }
  }, [document?.processingStatus]);

  const fetchDocument = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<Document>(
        `/api/workspaces/${workspaceId}/documents/${documentId}`
      );
      setDocument(data);
      setEditFilename(data.filename);
      setEditCategory(data.category || 'other');
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to load document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/documents/${documentId}/download`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document?.filename || 'document';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download document');
    }
  };

  const handleUpdate = async () => {
    setError('');
    try {
      const updated = await api.put<Document>(
        `/api/workspaces/${workspaceId}/documents/${documentId}`,
        {
          filename: editFilename,
          category: editCategory,
        }
      );
      setDocument(updated);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.error || 'Failed to update document');
    }
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    setError('');
    try {
      await api.post(`/api/workspaces/${workspaceId}/documents/${documentId}/process`, {});
      // Start polling to watch for status changes
      startPolling();
      // Refresh document to get updated status
      await fetchDocument();
    } catch (err: any) {
      setError(err.error || 'Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await api.delete(`/api/workspaces/${workspaceId}/documents/${documentId}`);
      router.push(`/workspaces/${workspaceId}/documents`);
    } catch (err: any) {
      setError(err.error || 'Failed to delete document');
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading document...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !document) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/workspaces/${workspaceId}/documents`)}
              className="mt-3"
            >
              Back to Documents
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}/documents`)}
              className="text-gray-400 hover:text-gray-600"
            >
              ←
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{document.title || document.filename}</h1>
              {document.description && (
                <p className="mt-2 text-lg text-gray-600">{document.description}</p>
              )}
              <div className="mt-2 flex items-center gap-3">
                <CategoryBadge category={document.category} />
                <ProcessingIndicator status={document.processingStatus} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload}>
              ⬇ Download
            </Button>
            {!isEditing && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                ✎ Edit
              </Button>
            )}
            {document.processingStatus === 'completed' && (
              <Button
                variant="outline"
                onClick={handleProcess}
                loading={isProcessing}
                disabled={isProcessing}
              >
                {isProcessing ? 'Reprocessing...' : '↻ Reprocess'}
              </Button>
            )}
            {document.processingStatus !== 'completed' && (
              <Button
                variant="primary"
                onClick={handleProcess}
                loading={isProcessing}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : document.processingStatus === 'processing' ? '⚙ Retry Processing' : '⚙ Process Document'}
              </Button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Document Metadata */}
        {!isEditing ? (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Document Information</h2>
            <div className="space-y-3 text-sm">
              {document.title && (
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-600">Title</span>
                  <span className="font-medium text-gray-900">{document.title}</span>
                </div>
              )}
              {document.description && (
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-600">Description</span>
                  <span className="font-medium text-gray-900">{document.description}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">File Name</span>
                <span className="font-medium text-gray-900">{document.filename}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">File Size</span>
                <span className="font-medium text-gray-900">{formatFileSize(document.fileSize)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Content Type</span>
                <span className="font-medium text-gray-900">{document.contentType}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Category</span>
                <CategoryBadge category={document.category} />
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Processing Status</span>
                <ProcessingIndicator status={document.processingStatus} />
              </div>
              {document.textExtracted && (
                <>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-600">Text Extracted</span>
                    <span className="font-medium text-green-600">Yes</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-600">Chunk Count</span>
                    <span className="font-medium text-gray-900">{document.chunkCount}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Uploaded</span>
                <span className="font-medium text-gray-900">{formatDate(document.uploadedAt)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Last Updated</span>
                <span className="font-medium text-gray-900">{formatDate(document.updatedAt)}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Edit Form */
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Edit Document</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Name
                </label>
                <input
                  type="text"
                  value={editFilename}
                  onChange={(e) => setEditFilename(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="policy">Policy</option>
                  <option value="procedure">Procedure</option>
                  <option value="evidence">Evidence</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleUpdate}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Document Content Viewer */}
        {document.processingStatus === 'completed' && (
          <div className="mb-8">
            <DocumentContentViewer
              workspaceId={workspaceId}
              documentId={documentId}
              isCompleted={document.processingStatus === 'completed'}
            />
          </div>
        )}

        {/* Delete Section */}
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-red-900">Danger Zone</h2>
          <p className="mb-4 text-sm text-red-700">
            Deleting this document is permanent and cannot be undone. All associated data will be lost.
          </p>
          {!showDeleteConfirm ? (
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              Delete Document
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-900">
                Are you sure? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button variant="danger" loading={isDeleting} onClick={handleDelete}>
                  Yes, Delete Forever
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
