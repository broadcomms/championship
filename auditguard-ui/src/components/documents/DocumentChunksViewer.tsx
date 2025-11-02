'use client';

import { useState, useEffect } from 'react';
import { DocumentChunk, ChunkFrameworkTag } from '@/types';
import { api } from '@/lib/api';

interface DocumentChunksViewerProps {
  workspaceId: string;
  documentId: string;
  chunkCount?: number;
}

export function DocumentChunksViewer({
  workspaceId,
  documentId,
  chunkCount = 0,
}: DocumentChunksViewerProps) {
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (chunkCount > 0) {
      fetchChunks();
    }
  }, [workspaceId, documentId, chunkCount]);

  const fetchChunks = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<DocumentChunk[]>(
        `/api/workspaces/${workspaceId}/documents/${documentId}/chunks`
      );
      setChunks(data);
    } catch (err: any) {
      setError(err.error || 'Failed to load chunks');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChunk = (chunkId: number) => {
    const newExpanded = new Set(expandedChunks);
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId);
    } else {
      newExpanded.add(chunkId);
    }
    setExpandedChunks(newExpanded);
  };

  const getRelevanceColor = (score: number): string => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 0.6) return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (chunkCount === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">
          No chunks available. Document may still be processing.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="ml-3 text-sm text-gray-600">Loading chunks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">No chunks found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Document Chunks ({chunks.length})
        </h2>
        <div className="text-sm text-gray-600">
          {chunks.filter((c) => c.embeddingStatus === 'completed').length} / {chunks.length} indexed
        </div>
      </div>

      <div className="space-y-3">
        {chunks.map((chunk) => {
          const isExpanded = expandedChunks.has(chunk.id);
          const previewLength = 200;
          const preview = chunk.content.substring(0, previewLength);
          const hasMore = chunk.content.length > previewLength;

          return (
            <div
              key={chunk.id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4 transition-all hover:border-blue-300"
            >
              {/* Chunk Header */}
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">
                      Chunk #{chunk.chunkIndex + 1}
                    </span>
                    {chunk.sectionTitle && (
                      <span className="text-xs text-gray-600">• {chunk.sectionTitle}</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span>{chunk.tokenCount} tokens</span>
                    <span>•</span>
                    <span>{chunk.chunkSize} chars</span>
                    {chunk.embeddingStatus === 'completed' && (
                      <>
                        <span>•</span>
                        <span className="text-green-600">✓ Indexed</span>
                      </>
                    )}
                    {chunk.embeddingStatus === 'processing' && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600">⚙ Processing</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Framework Tags */}
              {chunk.tags && chunk.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {chunk.tags.map((tag) => (
                    <span
                      key={tag.frameworkId}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRelevanceColor(
                        tag.relevanceScore
                      )}`}
                      title={`Relevance: ${(tag.relevanceScore * 100).toFixed(0)}%${
                        tag.autoTagged ? ' (auto-tagged)' : ' (manual)'
                      }`}
                    >
                      {tag.frameworkDisplayName}
                      <span className="text-xs opacity-75">
                        {(tag.relevanceScore * 100).toFixed(0)}%
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Chunk Content */}
              <div className="text-sm text-gray-700">
                <p className="whitespace-pre-wrap font-mono leading-relaxed">
                  {isExpanded ? chunk.content : preview}
                  {hasMore && !isExpanded && '...'}
                </p>
                {hasMore && (
                  <button
                    onClick={() => toggleChunk(chunk.id)}
                    className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    {isExpanded ? '← Show Less' : 'Show More →'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
