'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { DocumentChunksViewer } from './DocumentChunksViewer';

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
  hasExtractedText: boolean;
  chunkCount?: number;
}

export function DocumentContentViewer({
  workspaceId,
  documentId,
  hasExtractedText,
  chunkCount,
}: DocumentContentViewerProps) {
  const [content, setContent] = useState<DocumentContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isContentUnavailable, setIsContentUnavailable] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'fullText' | 'chunks'>('summary');

  const totalChunks = chunkCount ?? content?.chunks?.length ?? 0;
  const hasChunks = totalChunks > 0;

  useEffect(() => {
    if (hasExtractedText) {
      fetchContent();
    }
  }, [workspaceId, documentId, hasExtractedText]);

  useEffect(() => {
    if (!hasChunks && activeTab === 'chunks') {
      setActiveTab('summary');
    }
  }, [hasChunks, activeTab]);

  const fetchContent = async () => {
    setIsLoading(true);
    setError('');
    setIsContentUnavailable(false);
    try {
      const data = await api.get<DocumentContent>(
        `/api/workspaces/${workspaceId}/documents/${documentId}/content`
      );
      setContent(data);
    } catch (err: any) {
      if (err?.status === 404) {
        setContent(null);
        setIsContentUnavailable(true);
        return;
      }
      setError(err.error || err.message || 'Failed to load document content');
    } finally {
      setIsLoading(false);
    }
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
            active={activeTab === 'summary'}
            onClick={() => setActiveTab('summary')}
            label="Summary"
          />
          <TabButton
            active={activeTab === 'fullText'}
            onClick={() => setActiveTab('fullText')}
            label="Full Text"
          />
          {hasChunks && (
            <TabButton
              active={activeTab === 'chunks'}
              onClick={() => setActiveTab('chunks')}
              label={`Document Chunks (${totalChunks})`}
            />
          )}
        </nav>
      </div>

      {/* Content Display */}
      <div className="p-6">
        {activeTab === 'summary' && <SummaryTab summary={content.summary} />}
        {activeTab === 'fullText' && <FullTextTab fullText={content.fullText} />}
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

interface SummaryTabProps {
  summary: string;
}

function SummaryTab({ summary }: SummaryTabProps) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Document Summary</h3>
      <div className="prose prose-sm max-w-none">
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
      </div>
    </div>
  );
}

interface FullTextTabProps {
  fullText: string;
}

function FullTextTab({ fullText }: FullTextTabProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Extracted Text</h3>
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
      <div className="max-h-[600px] overflow-y-auto rounded-md bg-gray-50 border border-gray-200 p-4">
        <pre className="whitespace-pre-wrap font-mono text-xs text-gray-800 leading-relaxed">
          {fullText}
        </pre>
      </div>
    </div>
  );
}
