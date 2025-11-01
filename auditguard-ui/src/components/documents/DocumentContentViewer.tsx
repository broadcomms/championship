'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Chunk {
  text: string;
  score?: number;
}

interface DocumentContent {
  chunks: Chunk[];
  fullText: string;
  summary: string;
}

interface DocumentContentViewerProps {
  workspaceId: string;
  documentId: string;
  isCompleted: boolean;
}

export function DocumentContentViewer({
  workspaceId,
  documentId,
  isCompleted,
}: DocumentContentViewerProps) {
  const [content, setContent] = useState<DocumentContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'fullText' | 'chunks'>('summary');

  useEffect(() => {
    if (isCompleted) {
      fetchContent();
    }
  }, [isCompleted, workspaceId, documentId]);

  const fetchContent = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<DocumentContent>(
        `/api/workspaces/${workspaceId}/documents/${documentId}/content`
      );
      setContent(data);
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to load document content');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isCompleted) {
    return (
      <div className="rounded-lg bg-blue-50 p-6">
        <p className="text-sm text-blue-800">
          Document content will be available once processing is completed.
        </p>
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
      <div className="rounded-lg bg-red-50 p-6">
        <p className="text-sm text-red-800">{error}</p>
        <button
          onClick={fetchContent}
          className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className="rounded-lg bg-white shadow">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-6 py-4 text-sm font-medium ${
              activeTab === 'summary'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('fullText')}
            className={`px-6 py-4 text-sm font-medium ${
              activeTab === 'fullText'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Full Text
          </button>
          <button
            onClick={() => setActiveTab('chunks')}
            className={`px-6 py-4 text-sm font-medium ${
              activeTab === 'chunks'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Chunks ({content.chunks.length})
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {activeTab === 'summary' && (
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Document Summary</h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed">{content.summary}</p>
            </div>
          </div>
        )}

        {activeTab === 'fullText' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Extracted Text</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(content.fullText);
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                📋 Copy
              </button>
            </div>
            <div className="max-h-[600px] overflow-y-auto rounded-md bg-gray-50 p-4">
              <pre className="whitespace-pre-wrap font-mono text-xs text-gray-800">
                {content.fullText}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'chunks' && (
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Document Chunks ({content.chunks.length})
            </h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {content.chunks.map((chunk, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      Chunk {index + 1}
                    </span>
                    {chunk.score !== undefined && (
                      <span className="text-xs text-gray-400">
                        Score: {(chunk.score * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {chunk.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
