'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle,
  Database,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Trash2,
} from 'lucide-react';

interface VectorStats {
  indexName: string;
  dimensions: number;
  metric: string;
  totalVectors: number;
  databaseVectors: number;
  mismatch: number;
  sampleVectors: Array<{
    id: string;
    documentId: string;
    chunkIndex: number;
    hasEmbedding: boolean;
    embeddingStatus: string;
  }>;
}

interface EmbeddingStatus {
  summary: {
    totalDocuments: number;
    documentsWithEmbeddings: number;
    totalChunks: number;
    chunksCompleted: number;
    chunksPending: number;
    chunksFailed: number;
    completionPercentage: number;
  };
  recentDocuments: Array<{
    documentId: string;
    filename: string;
    uploadedAt: number;
    chunkCount: number;
    embeddingsGenerated: number;
    status: string;
  }>;
  failedChunks: Array<{
    chunkId: number;
    documentId: string;
    chunkIndex: number;
    error: string;
  }>;
}

interface ServiceHealth {
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  modelName: string;
  dimensions: number;
  totalRequests: number;
  totalEmbeddings: number;
  totalErrors: number;
  avgLatencyMs: number;
  lastChecked: number;
  error?: string;
}

interface VectorSearchResult {
  documentId: string;
  chunkIndex: number;
  score: number;
  text: string;
}

interface VectorSearchResponse {
  results: VectorSearchResult[];
  searchTime: number;
}

export default function VectorIndexPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VectorSearchResponse | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{
    totalEmbeddings: number;
    validDocuments: number;
    orphanedEmbeddings: number;
    deletedEmbeddings: number;
    deletedChunks: number;
    deletedDocuments: number;
    errors: number;
  } | null>(null);

  const { data: vectorStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<VectorStats>({
    queryKey: ['admin', 'vectors', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/vectors/stats', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch vector stats');
      return response.json();
    },
  });

  const { data: embeddingStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<EmbeddingStatus>({
    queryKey: ['admin', 'vectors', 'embedding-status'],
    queryFn: async () => {
      const response = await fetch('/api/admin/vectors/embedding-status', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch embedding status');
      return response.json();
    },
  });

  const { data: serviceHealth, isLoading: healthLoading, refetch: refetchHealth } = useQuery<ServiceHealth>({
    queryKey: ['admin', 'vectors', 'service-health'],
    queryFn: async () => {
      const response = await fetch('/api/admin/vectors/service-health', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch service health');
      return response.json();
    },
  });

  const searchMutation = useMutation<VectorSearchResponse, Error, string>({
    mutationFn: async (query: string) => {
      const response = await fetch('/api/admin/vectors/search-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query, topK: 5 }),
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      console.log('[Cleanup] Making API request to /api/admin/cleanup/orphaned-vectors');
      const response = await fetch('/api/admin/cleanup/orphaned-vectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      console.log('[Cleanup] Response status:', response.status);
      if (!response.ok) {
        const error = await response.json();
        console.error('[Cleanup] Error response:', error);
        throw new Error(error.error || 'Cleanup failed');
      }
      const data = await response.json();
      console.log('[Cleanup] Success response:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('[Cleanup] onSuccess called with data:', data);
      setCleanupResult(data);
      // Refresh stats after cleanup
      refetchStats();
      refetchStatus();
      refetchHealth();
    },
    onError: (error) => {
      console.error('[Cleanup] onError called with error:', error);
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleCleanup = () => {
    if (confirm('This will scan and delete all orphaned vectors from the embedding service. Continue?')) {
      console.log('[Cleanup] Starting cleanup operation');
      setCleanupResult(null);
      cleanupMutation.mutate();
    } else {
      console.log('[Cleanup] Cleanup cancelled by user');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vector Index Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor and manage vector embeddings
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCleanup}
            disabled={cleanupMutation.isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center space-x-2"
          >
            {cleanupMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cleaning...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Cleanup Orphaned</span>
              </>
            )}
          </button>
          <button
            onClick={() => {
              refetchStats();
              refetchStatus();
              refetchHealth();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh All</span>
          </button>
        </div>
      </div>

      {/* Service Health Card */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Embedding Service</h3>
          {serviceHealth && (
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                serviceHealth.status === 'healthy'
                  ? 'bg-green-100 text-green-800'
                  : serviceHealth.status === 'unhealthy'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {serviceHealth.status}
            </span>
          )}
        </div>

        {healthLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : serviceHealth ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Model</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {serviceHealth.modelName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Dimensions</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {serviceHealth.dimensions}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {serviceHealth?.totalRequests?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Latency</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {serviceHealth?.avgLatencyMs?.toFixed(0) || '0'}ms
              </p>
            </div>
          </div>
        ) : null}

        {serviceHealth?.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {serviceHealth.error}
          </div>
        )}
      </div>

      {/* Vector Index Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Vectors</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statsLoading ? '...' : vectorStats?.totalVectors?.toLocaleString() || '0'}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Database className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Index Dimensions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statsLoading ? '...' : vectorStats?.dimensions}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Metric Type</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statsLoading ? '...' : vectorStats?.metric}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Server className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Embedding Status */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Embedding Generation Status</h3>

        {statusLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : embeddingStatus ? (
          <>
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Completion Progress</span>
                <span className="text-sm font-semibold text-gray-900">
                  {embeddingStatus?.summary?.completionPercentage?.toFixed(1) || '0'}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${embeddingStatus?.summary?.completionPercentage || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                <span>
                  {embeddingStatus?.summary?.chunksCompleted?.toLocaleString() || '0'} / {embeddingStatus?.summary?.totalChunks?.toLocaleString() || '0'} chunks
                </span>
                <span>
                  {embeddingStatus?.summary?.chunksPending?.toLocaleString() || '0'} pending, {embeddingStatus?.summary?.chunksFailed?.toLocaleString() || '0'} failed
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {embeddingStatus?.summary?.totalDocuments || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">Total Documents</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {embeddingStatus?.summary?.chunksCompleted || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">Completed</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">
                  {embeddingStatus?.summary?.chunksPending || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">Pending</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {embeddingStatus?.summary?.chunksFailed || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">Failed</p>
              </div>
            </div>

            {/* Recent Documents */}
            {embeddingStatus?.recentDocuments?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Recent Documents</h4>
                <div className="space-y-2">
                  {embeddingStatus?.recentDocuments?.slice(0, 5).map((doc) => (
                    <div
                      key={doc.documentId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                        <p className="text-xs text-gray-600">
                          {doc.embeddingsGenerated} / {doc.chunkCount} chunks embedded
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          doc.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : doc.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Cleanup Results */}
      {cleanupResult && (
        <div className="bg-white rounded-lg shadow-lg border-2 border-blue-500 p-6 animate-pulse-once">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Cleanup Results
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {cleanupResult.totalEmbeddings?.toLocaleString() || '0'}
              </p>
              <p className="text-sm text-gray-600 mt-1">Total Embeddings</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {cleanupResult.validDocuments?.toLocaleString() || '0'}
              </p>
              <p className="text-sm text-gray-600 mt-1">Valid Documents</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {cleanupResult.deletedEmbeddings?.toLocaleString() || '0'}
              </p>
              <p className="text-sm text-gray-600 mt-1">Deleted Embeddings</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">
                {cleanupResult.errors || 0}
              </p>
              <p className="text-sm text-gray-600 mt-1">Errors</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-lg font-semibold text-yellow-700">
                {cleanupResult.orphanedEmbeddings?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Orphaned Embeddings</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-lg font-semibold text-orange-700">
                {cleanupResult.deletedChunks?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Deleted Chunks</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-lg font-semibold text-red-700">
                {cleanupResult.deletedDocuments?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Orphaned Documents</p>
            </div>
          </div>
          {cleanupResult.deletedEmbeddings === 0 && cleanupResult.errors === 0 && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-400 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <span className="text-lg font-semibold text-green-800">Cleanup Complete!</span>
              </div>
              <p className="text-sm text-green-700">
                No orphaned embeddings found. Your vector index is perfectly in sync with the database!
              </p>
              <p className="text-xs text-green-600 mt-2">
                Scanned {cleanupResult.totalEmbeddings?.toLocaleString()} embeddings across {cleanupResult.validDocuments} documents.
              </p>
            </div>
          )}
          {cleanupResult.deletedEmbeddings > 0 && cleanupResult.errors === 0 && (
            <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-400 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-semibold text-blue-800">Cleanup Successful!</span>
              </div>
              <p className="text-sm text-blue-700">
                Successfully cleaned up {cleanupResult.deletedDocuments} orphaned documents, {cleanupResult.deletedChunks} chunks, and {cleanupResult.deletedEmbeddings} embeddings!
              </p>
              <p className="text-xs text-blue-600 mt-2">
                PostgreSQL is now in sync with D1 database.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cleanup Error */}
      {cleanupMutation.isError && (
        <div className="bg-white rounded-lg shadow border border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4">Cleanup Error</h3>
          <p className="text-sm text-red-700">
            {cleanupMutation.error?.message || 'An unknown error occurred'}
          </p>
        </div>
      )}

      {/* Vector Search Test */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Vector Search</h3>

        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter search query..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={searchMutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {searchMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            <span>Search</span>
          </button>
        </div>

        {searchResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{searchResults.results?.length || 0} results</span>
              <span>{searchResults.searchTime}ms</span>
            </div>

            {searchResults.results && searchResults.results.length > 0 ? (
              <div className="space-y-2">
                {searchResults.results.map((result, idx: number) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-mono text-gray-500">
                        {result.documentId} (chunk {result.chunkIndex})
                      </span>
                      <span className="text-sm font-semibold text-blue-600">
                        {(result.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{result.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No results found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
