'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { DocumentChunksViewer } from './DocumentChunksViewer';
import { CategoryBadge } from './CategoryBadge';
import { ComplianceFrameworkBadge } from './ComplianceFrameworkBadge';
import { ProcessingIndicator } from './ProcessingIndicator';
import { Document } from '@/types';

interface DocumentContent {
  fullText: string;
  summary: string;
  chunks?: Array<{
    text: string;
    score?: number;
  }>;
}

interface DocumentContentViewerProps {
  workspaceId: string;
  documentId: string;
  document: Document;
  hasExtractedText: boolean;
  chunkCount?: number;
}

export function DocumentContentViewer({
  workspaceId,
  documentId,
  document,
  hasExtractedText,
  chunkCount,
}: DocumentContentViewerProps) {
  const [content, setContent] = useState<DocumentContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isContentUnavailable, setIsContentUnavailable] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'fullText' | 'chunks'>('info');

  const totalChunks = chunkCount ?? content?.chunks?.length ?? 0;
  const hasChunks = totalChunks > 0;

  // CRITICAL FIX: Add fetchContent to dependency array to prevent stale closures
  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setIsContentUnavailable(false);
    try {
      const data = await api.get<DocumentContent>(
        `/api/workspaces/${workspaceId}/documents/${documentId}/content`
      );
      setContent(data);
    } catch (err: unknown) {
      const status = typeof err === 'object' && err && 'status' in err ? (err as { status?: number }).status : undefined;
      if (status === 404) {
        setContent(null);
        setIsContentUnavailable(true);
        return;
      }
      const rawMessage =
        (typeof err === 'object' && err && 'error' in err && typeof (err as { error?: string }).error === 'string'
          ? (err as { error?: string }).error
          : err instanceof Error
            ? err.message
            : 'Failed to load document content');
      const safeMessage = rawMessage && rawMessage.trim().length > 0 ? rawMessage : 'Failed to load document content';
      setError(safeMessage);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, documentId]);

  useEffect(() => {
    if (hasExtractedText) {
      fetchContent();
    }
  }, [workspaceId, documentId, hasExtractedText, fetchContent]);

  // INFINITE LOOP FIX: Use ref to prevent circular dependency
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    if (!hasChunks && activeTabRef.current === 'chunks') {
      setActiveTab('info');
    }
  }, [hasChunks]); // Remove activeTab from dependencies

  const handleReExtract = () => {
    // Refresh content after re-extraction
    fetchContent();
  };

  if (!hasExtractedText) {
    return (
      <div className="rounded-lg bg-gray-50 border-2 border-dashed border-gray-300 p-8">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Text extraction in progress</h3>
          <p className="mt-1 text-sm text-gray-500">Content will appear here once extraction completes</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading document content...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-800">{error}</p>
        </div>
        <button
          onClick={fetchContent}
          className="mt-3 text-sm font-medium text-red-600 hover:text-red-700 underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isContentUnavailable) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-gray-900">Document content not available yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          We couldn&rsquo;t find extracted content for this document. Try again in a moment or reprocess the file.
        </p>
        <div className="mt-4 flex justify-center">
          <button
            onClick={fetchContent}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-600"
          >
            Retry loading
          </button>
        </div>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className="rounded-lg bg-white shadow">
      {/* Clean Header - No polling banners */}
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex" aria-label="Tabs">
          <TabButton
            active={activeTab === 'info'}
            onClick={() => setActiveTab('info')}
            label="Information"
          />
          <TabButton
            active={activeTab === 'fullText'}
            onClick={() => setActiveTab('fullText')}
            label="Text"
          />
          {hasChunks && (
            <TabButton
              active={activeTab === 'chunks'}
              onClick={() => setActiveTab('chunks')}
              label={`Chunks (${totalChunks})`}
            />
          )}
        </nav>
      </div>

      {/* Content Display */}
      <div className="p-6">
        {activeTab === 'info' && <InfoTab document={document} />}
        {activeTab === 'fullText' && (
          <FullTextTab 
            fullText={content.fullText} 
            workspaceId={workspaceId}
            documentId={documentId}
            onReExtract={handleReExtract}
          />
        )}
        {activeTab === 'chunks' && hasChunks && (
          <div className="-mx-6">
            <DocumentChunksViewer
              workspaceId={workspaceId}
              documentId={documentId}
              chunkCount={totalChunks}
              embedded
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components for Clean Modularity
// ============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function TabButton({ active, onClick, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-4 text-sm font-medium transition-colors ${
        active
          ? 'border-b-2 border-blue-500 text-blue-600'
          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

interface InfoTabProps {
  document: Document;
}

function InfoTab({ document }: InfoTabProps) {
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

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Document Information</h3>
      <div className="space-y-3 text-sm">
        {document.title && (
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-600">Title</span>
            <span className="font-medium text-gray-900">{document.title}</span>
          </div>
        )}
        {document.description && (
          <div className="border-b border-gray-100 pb-2">
            <span className="text-gray-600 block mb-1">Description</span>
            <p className="font-medium text-gray-900 text-sm leading-relaxed">{document.description}</p>
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
        {document.complianceFrameworkId && (
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-600">Compliance Framework</span>
            <ComplianceFrameworkBadge 
              frameworkId={document.complianceFrameworkId} 
              workspaceId={document.workspaceId}
            />
          </div>
        )}
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
            {document.wordCount && (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Word Count</span>
                <span className="font-medium text-gray-900">{document.wordCount.toLocaleString()}</span>
              </div>
            )}
            {document.characterCount && (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Character Count</span>
                <span className="font-medium text-gray-900">{document.characterCount.toLocaleString()}</span>
              </div>
            )}
            {document.pageCount && (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Page Count</span>
                <span className="font-medium text-gray-900">{document.pageCount}</span>
              </div>
            )}
            {document.chunkCount && (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Chunk Count</span>
                <span className="font-medium text-gray-900">{document.chunkCount}</span>
              </div>
            )}
            {document.vectorIndexingStatus && (
              <>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-600">Vector Indexing</span>
                  <span className={`font-medium ${
                    document.vectorIndexingStatus === 'completed' ? 'text-green-600' :
                    document.vectorIndexingStatus === 'processing' ? 'text-blue-600' :
                    document.vectorIndexingStatus === 'indexing' ? 'text-orange-600' :
                    document.vectorIndexingStatus === 'failed' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {document.vectorIndexingStatus === 'completed' && '✓ Completed - Searchable'}
                    {document.vectorIndexingStatus === 'processing' && (
                      <>
                        Processing... {document.embeddingsGenerated && document.chunkCount 
                          ? `${Math.round((document.embeddingsGenerated / document.chunkCount) * 100)}%`
                          : '0%'}
                      </>
                    )}
                    {document.vectorIndexingStatus === 'indexing' && 'Indexing... Please wait'}
                    {document.vectorIndexingStatus === 'failed' && '✗ Failed'}
                    {document.vectorIndexingStatus === 'pending' && '⏳ Pending'}
                    {document.vectorIndexingStatus === 'partial' && '⚠ Partial'}
                  </span>
                </div>
                {/* Phase 2.4: Progress bar for embedding generation */}
                {document.vectorIndexingStatus === 'processing' && document.embeddingsGenerated !== undefined && document.chunkCount > 0 && (
                  <div className="border-b border-gray-100 pb-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Embedding Progress</span>
                      <span>{document.embeddingsGenerated} / {document.chunkCount} chunks</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((document.embeddingsGenerated / document.chunkCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            {document.embeddingsGenerated !== undefined && document.embeddingsGenerated > 0 && (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Embeddings Generated</span>
                <span className="font-medium text-gray-900">{document.embeddingsGenerated}</span>
              </div>
            )}
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
  );
}

interface FullTextTabProps {
  fullText: string;
  workspaceId: string;
  documentId: string;
  onReExtract?: () => void;
}

function FullTextTab({ fullText, workspaceId, documentId, onReExtract }: FullTextTabProps) {
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [reExtractError, setReExtractError] = useState('');
  const [reExtractSuccess, setReExtractSuccess] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleReExtractText = async () => {
    setIsReExtracting(true);
    setReExtractError('');
    setReExtractSuccess('');
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/documents/${documentId}/re-extract-text`, {
        method: 'POST',
        credentials: 'include',
      });

      // CRITICAL FIX: Check response.ok before parsing JSON
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        setReExtractError(errorData.details || errorData.error || `Request failed with status ${response.status}`);
        return;
      }

      const data = await response.json();

      if (!data.success) {
        setReExtractError(data.details || data.error || 'Failed to re-extract text');
        return;
      }

      // Success - show success message
      setReExtractSuccess(`Text re-extracted successfully! (${data.wordCount?.toLocaleString() || 0} words${data.pageCount ? `, ${data.pageCount} pages` : ''})`);
      
      // Call parent callback to refresh document data
      if (onReExtract) {
        onReExtract();
      }
    } catch (error: unknown) {
      // Differentiate between network errors and server errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setReExtractError('Network error: Unable to connect to server');
      } else if (error instanceof SyntaxError) {
        setReExtractError('Server returned invalid response');
      } else {
        const fallback = error instanceof Error ? error.message : 'Failed to re-extract text from storage';
        setReExtractError(fallback);
      }
    } finally {
      setIsReExtracting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Extracted Text</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReExtractText}
            disabled={isReExtracting}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Re-extract text from original file (useful for old documents)"
          >
            {isReExtracting ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Re-extracting...
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-extract Text
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Copy text
          </button>
        </div>
      </div>

      {/* Re-extraction success/error messages */}
      {reExtractSuccess && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3">
          <p className="text-sm text-green-800">{reExtractSuccess}</p>
        </div>
      )}
      {reExtractError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-800">{reExtractError}</p>
        </div>
      )}

      <div className="max-h-[600px] overflow-y-auto rounded-md bg-gray-50 border border-gray-200 p-4">
        <pre className="whitespace-pre-wrap font-mono text-xs text-gray-800 leading-relaxed">
          {fullText}
        </pre>
      </div>
    </div>
  );
}
