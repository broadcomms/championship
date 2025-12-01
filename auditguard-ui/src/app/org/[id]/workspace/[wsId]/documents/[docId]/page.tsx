'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { CategoryBadge } from '@/components/documents/CategoryBadge';
import { ProcessingIndicator } from '@/components/documents/ProcessingIndicator';
import { ProcessingProgress } from '@/components/documents/ProcessingProgress';
import { DocumentContentViewer } from '@/components/documents/DocumentContentViewer';
import { DocumentComplianceTab } from '@/components/compliance/DocumentComplianceTab';
import { DocumentCorrectionTab } from '@/components/documents/DocumentCorrectionTab';
import { ComponentErrorBoundary } from '@/components/common/ErrorBoundary';
import { useDocumentPolling } from '@/hooks/useDocumentPolling';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Document, DocumentCategory } from '@/types';

type TabType = 'preview' | 'issues' | 'correction';

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) {
    return err.message || fallback;
  }
  if (err && typeof err === 'object' && 'error' in err) {
    return String((err as { error?: string }).error || fallback);
  }
  return fallback;
};

export default function DocumentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const workspaceId = params.wsId as string;
  const documentId = params.docId as string;
  const accountId = user?.userId;

  // Use polling hook for real-time status updates
  const {
    document: polledDocument,
    error: pollingError,
    startPolling
  } = useDocumentPolling(workspaceId, documentId);

  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('preview');

  // Form state for editing
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('other');
  const [editFrameworkId, setEditFrameworkId] = useState<number | null>(null);
  const [frameworks, setFrameworks] = useState<Array<{ id: number; name: string; displayName: string }>>([]);

  // Update document state from polling
  useEffect(() => {
    if (polledDocument) {
      setDocument(polledDocument);
      setEditTitle(polledDocument.title || polledDocument.filename);
      setEditCategory(polledDocument.category || 'other');
      setEditFrameworkId(polledDocument.complianceFrameworkId || null);
      setIsLoading(false);
    }
  }, [polledDocument]);

  // Update error state from polling
  useEffect(() => {
    if (pollingError) {
      setError(pollingError);
      setIsLoading(false);
    }
  }, [pollingError]);

  // Start polling when component mounts
  useEffect(() => {
    startPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, workspaceId]); // Only restart when documentId or workspaceId changes

  // Fetch available compliance frameworks
  useEffect(() => {
    const fetchFrameworks = async () => {
      try {
        const data = await api.get<Array<{ id: number; name: string; displayName: string }>>(
          `/api/workspaces/${workspaceId}/frameworks`
        );
        setFrameworks(data);
      } catch (err) {
        console.error('Failed to fetch frameworks:', err);
      }
    };
    if (workspaceId) {
      fetchFrameworks();
    }
  }, [workspaceId]);

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
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to download document'));
    }
  };

  const handleUpdate = async () => {
    setError('');
    try {
      const updated = await api.put<Document>(
        `/api/workspaces/${workspaceId}/documents/${documentId}`,
        {
          title: editTitle,
          category: editCategory,
          frameworkId: editFrameworkId,
        }
      );
      setDocument(updated);
      setIsEditing(false);
      
      // Force a refresh from the backend to ensure we have the latest data
      startPolling();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update document'));
    }
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/documents/${documentId}/process`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!data.success) {
        // Check if it's a "missing text" error
        if (data.details?.includes('not yet extracted') || data.details?.includes('text not yet extracted')) {
          setError('Text not yet extracted. Please go to the "Full Text" tab and click "Re-extract Text" first, then try reprocessing again.');
        } else {
          setError(data.details || data.error || 'Failed to process document');
        }
        return;
      }

      // Success - document queued for full reprocessing
      setSuccessMessage('Document queued for full reprocessing. The progress indicator below will show the processing status.');

      // CRITICAL FIX: Restart polling to get real-time updates
      // Polling may have stopped when document was previously completed
      startPolling();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to process document'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await api.delete(`/api/workspaces/${workspaceId}/documents/${documentId}`);
      router.push(`/org/${orgId}/workspace/${workspaceId}/documents`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete document'));
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
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={workspaceId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading document...</p>
          </div>
        </div>
      </OrganizationLayout>
    );
  }

  if (error && !document) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={workspaceId}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/org/${orgId}/workspace/${workspaceId}/documents`)}
              className="mt-3"
            >
              Back to Documents
            </Button>
          </div>
        </div>
      </OrganizationLayout>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={workspaceId}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{document.title || document.filename}</h1>
            {document.description && (
              <p className="mt-2 text-lg text-gray-600">{document.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <CategoryBadge category={document.category} />
              <ProcessingIndicator status={document.processingStatus} />
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button variant="outline" onClick={handleDownload}>
                ⬇ Download
              </Button>
              {!isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  ⚙ Settings
                </Button>
              )}

              {/* IMPROVED: Only show Reprocess when FULLY completed */}
              {document.fullyCompleted && (
                <Button
                  variant="outline"
                  onClick={handleProcess}
                  loading={isProcessing}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Reprocessing...' : '↻ Reprocess'}
                </Button>
              )}

              {/* IMPROVED: Show Process button when not fully completed */}
              {!document.fullyCompleted && document.processingStatus !== 'processing' && (
                <Button
                  variant="primary"
                  onClick={handleProcess}
                  loading={isProcessing}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' :
                   document.processingStatus === 'failed' ? '⚙ Retry Processing' :
                   '⚙ Process Document'}
                </Button>
              )}

              {/* Close Button */}
              <Button
                variant="outline"
                onClick={() => router.push(`/org/${orgId}/workspace/${workspaceId}/documents`)}
              >
                ✕ Close
              </Button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message Display */}
        {successMessage && (
          <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Settings Section - Only shown when editing */}
        {isEditing && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Document Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Name
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter document title"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Compliance Framework</label>
                <select
                  value={editFrameworkId || ''}
                  onChange={(e) => setEditFrameworkId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {frameworks.map((framework) => (
                    <option key={framework.id} value={framework.id}>
                      {framework.displayName}
                    </option>
                  ))}
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

            {/* Danger Zone - Inside Settings */}
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
              <h3 className="mb-2 text-lg font-semibold text-red-900">Danger Zone</h3>
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
        )}

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('preview')}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                ${
                  activeTab === 'preview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }
              `}
            >
              Document Preview
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                ${
                  activeTab === 'issues'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }
              `}
            >
              Compliance Issues
            </button>
            <button
              onClick={() => setActiveTab('correction')}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                ${
                  activeTab === 'correction'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }
              `}
            >
              Document Correction
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mb-8">
          {/* Document Preview Tab */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              {/* Processing Status */}
              {document.processingStatus !== 'failed' && !document.fullyCompleted && (
                <div className="rounded-lg bg-white p-6 shadow">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Processing Status</h2>
                  <ProcessingProgress
                    processingStatus={document.processingStatus}
                    textExtracted={document.textExtracted}
                    chunkCount={document.chunkCount}
                    embeddingsGenerated={document.embeddingsGenerated}
                    vectorIndexingStatus={document.vectorIndexingStatus}
                    pageCount={document.pageCount}
                    wordCount={document.wordCount}
                    fullyCompleted={document.fullyCompleted}
                  />
                </div>
              )}

              {/* Document Metadata */}
              <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Document Information</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">File Size</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatFileSize(document.fileSize)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Content Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{document.contentType}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Uploaded</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(document.uploadedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(document.updatedAt)}</dd>
                  </div>
                  {document.pageCount && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Pages</dt>
                      <dd className="mt-1 text-sm text-gray-900">{document.pageCount}</dd>
                    </div>
                  )}
                  {document.wordCount && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Word Count</dt>
                      <dd className="mt-1 text-sm text-gray-900">{document.wordCount.toLocaleString()}</dd>
                    </div>
                  )}
                  {document.characterCount && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Character Count</dt>
                      <dd className="mt-1 text-sm text-gray-900">{document.characterCount.toLocaleString()}</dd>
                    </div>
                  )}
                  {document.chunkCount > 0 && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Text Chunks</dt>
                      <dd className="mt-1 text-sm text-gray-900">{document.chunkCount}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Full Text Viewer */}
              <ComponentErrorBoundary>
                <DocumentContentViewer
                  workspaceId={workspaceId}
                  documentId={documentId}
                  document={document}
                  hasExtractedText={document.textExtracted || false}
                  chunkCount={document.chunkCount}
                />
              </ComponentErrorBoundary>
            </div>
          )}

          {/* Compliance Issues Tab */}
          {activeTab === 'issues' && (
            <ComponentErrorBoundary>
              <DocumentComplianceTab
                workspaceId={workspaceId}
                documentId={documentId}
              />
            </ComponentErrorBoundary>
          )}

          {/* Document Correction Tab */}
          {activeTab === 'correction' && (
            <ComponentErrorBoundary>
              <DocumentCorrectionTab
                workspaceId={workspaceId}
                documentId={documentId}
                document={{
                  filename: document.filename,
                  characterCount: document.characterCount,
                  pageCount: document.pageCount
                }}
              />
            </ComponentErrorBoundary>
          )}
        </div>
      </div>
    </OrganizationLayout>
  );
}
