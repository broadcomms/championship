'use client';

import { useState, useMemo, memo, lazy, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/common/Button';
import { CategoryBadge } from '@/components/documents/CategoryBadge';
import { ProcessingIndicator } from '@/components/documents/ProcessingIndicator';
import { useDocuments } from '@/hooks/useDocuments';
import { DocumentCategory } from '@/types';
import { FileText } from 'lucide-react';
import { preloadOnHover } from '@/utils/preload';
import { ErrorDisplay, SectionErrorBoundary } from '@/components/errors';
import { retryFetch } from '@/utils/retry';
import { NetworkError, toAppError } from '@/utils/errors';

// Lazy load heavy components - only load when needed
const DocumentUploadFactory = () => import('@/components/documents/DocumentUpload').then(m => ({ default: m.DocumentUpload }));
const VectorSearchFactory = () => import('@/components/documents/VectorSearch').then(m => ({ default: m.VectorSearch }));
const ReportGeneratorModalFactory = () => import('@/components/reporting').then(m => ({ default: m.ReportGeneratorModal }));

const DocumentUpload = lazy(DocumentUploadFactory);
const VectorSearch = lazy(VectorSearchFactory);
const ReportGeneratorModal = lazy(ReportGeneratorModalFactory);

type SortField = 'filename' | 'uploadedAt' | 'fileSize';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'search';

// Memoized document row component to prevent unnecessary re-renders
const DocumentRow = memo(({ 
  document, 
  workspaceId, 
  onNavigate, 
  onReprocess, 
  formatFileSize, 
  formatDate 
}: any) => {
  return (
    <tr
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => onNavigate(`/workspaces/${workspaceId}/documents/${document.id}`)}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📄</span>
          <div>
            <p className="font-medium text-gray-900">
              {document.title || document.filename}
            </p>
            {document.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {document.description}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">{document.contentType}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <CategoryBadge category={document.category} />
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {formatFileSize(document.fileSize)}
      </td>
      <td className="px-6 py-4">
        <ProcessingIndicator status={document.processingStatus} />
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        <div>
          <p>{formatDate(document.uploadedAt)}</p>
          <p className="text-xs text-gray-500">{document.uploaderEmail}</p>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(`/workspaces/${workspaceId}/documents/${document.id}`);
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View
          </button>
          {document.processingStatus === 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReprocess(document.id);
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
              title="Reprocess to extract title and description"
            >
              ↻ Reprocess
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

DocumentRow.displayName = 'DocumentRow';

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const { documents, isLoading, error, refetch } = useDocuments(workspaceId);

  const [showUpload, setShowUpload] = useState(false);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('uploadedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents;

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((doc) => doc.category === categoryFilter);
    }

    // Sort documents
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'filename':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'uploadedAt':
          comparison = a.uploadedAt - b.uploadedAt;
          break;
        case 'fileSize':
          comparison = a.fileSize - b.fileSize;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [documents, categoryFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleReprocess = async (documentId: string) => {
    try {
      const response = await retryFetch(
        `/api/workspaces/${workspaceId}/documents/${documentId}/process`,
        { method: 'POST', credentials: 'include' },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          onRetry: (error, attempt, delay) => {
            console.warn(`Retrying reprocess (attempt ${attempt}, delay ${delay}ms):`, error);
          },
        }
      );
      
      if (!response.ok) {
        throw new NetworkError(
          `Failed to reprocess document: ${response.statusText}`,
          { operation: 'reprocessDocument', workspaceId, documentId },
          response.status
        );
      }
      
      refetch();
    } catch (error) {
      console.error('Failed to reprocess:', error);
      const appError = toAppError(error, {
        operation: 'reprocessDocument',
        workspaceId,
        documentId,
      });
      alert(appError.getUserMessage());
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading documents...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <ErrorDisplay
            error={new Error(error)}
            onRetry={() => refetch()}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}`)}
              className="text-gray-400 hover:text-gray-600"
            >
              ←
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
              <p className="mt-1 text-sm text-gray-600">
                {documents.length} document{documents.length !== 1 ? 's' : ''} in workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReportGenerator(true)}
              onMouseEnter={preloadOnHover(ReportGeneratorModalFactory)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileText className="h-4 w-4" />
              Generate Report
            </button>
            <Button 
              variant="primary" 
              onClick={() => setShowUpload(!showUpload)}
              onMouseEnter={preloadOnHover(DocumentUploadFactory)}
            >
              {showUpload ? '✕ Cancel' : '+ Upload Document'}
            </Button>
          </div>
        </div>

        {/* Upload Section */}
        {showUpload && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Upload Document</h2>
            <Suspense fallback={
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              </div>
            }>
              <DocumentUpload
                workspaceId={workspaceId}
                onSuccess={() => {
                  setShowUpload(false);
                  refetch();
                }}
                onClose={() => setShowUpload(false)}
              />
            </Suspense>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Phase 5: View Mode Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setViewMode('list')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                viewMode === 'list'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              📄 All Documents ({documents.length})
            </button>
            <button
              onClick={() => setViewMode('search')}
              onMouseEnter={preloadOnHover(VectorSearchFactory)}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                viewMode === 'search'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              🔍 AI Search
            </button>
          </nav>
        </div>

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {/* Filters */}
            <div className="mb-6 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Category:</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as DocumentCategory | 'all')}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  <option value="policy">Policy</option>
                  <option value="procedure">Procedure</option>
                  <option value="evidence">Evidence</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Documents Table */}
            <SectionErrorBoundary>
              <div className="rounded-lg bg-white shadow overflow-hidden">
                {filteredAndSortedDocuments.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="text-4xl">📄</div>
                    <p className="mt-4 text-sm text-gray-600">
                      {categoryFilter !== 'all' ? 'No documents in this category' : 'No documents yet'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {!showUpload && 'Click "Upload Document" to get started'}
                    </p>
                  </div>
                ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                      onClick={() => handleSort('filename')}
                    >
                      <div className="flex items-center gap-1">
                        Document Name
                        {sortField === 'filename' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Category
                    </th>
                    <th
                      className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                      onClick={() => handleSort('fileSize')}
                    >
                      <div className="flex items-center gap-1">
                        Size
                        {sortField === 'fileSize' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th
                      className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                      onClick={() => handleSort('uploadedAt')}
                    >
                      <div className="flex items-center gap-1">
                        Uploaded
                        {sortField === 'uploadedAt' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredAndSortedDocuments.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                      workspaceId={workspaceId}
                      onNavigate={handleNavigate}
                      onReprocess={handleReprocess}
                      formatFileSize={formatFileSize}
                      formatDate={formatDate}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
              </div>
            </SectionErrorBoundary>
          </>
        )}

        {/* Search View - Phase 5 */}
        {viewMode === 'search' && (
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                <p className="mt-4 text-sm text-gray-600">Loading search...</p>
              </div>
            </div>
          }>
            <VectorSearch workspaceId={workspaceId} />
          </Suspense>
        )}

        {/* Report Generator Modal */}
        {showReportGenerator && (
          <Suspense fallback={null}>
            <ReportGeneratorModal
              workspaceId={workspaceId}
              isOpen={showReportGenerator}
              onClose={() => setShowReportGenerator(false)}
            />
          </Suspense>
        )}
      </div>
    </AppLayout>
  );
}
