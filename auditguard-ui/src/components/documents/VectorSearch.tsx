'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ComplianceFrameworkInfo } from '@/types';
import { Button } from '@/components/common/Button';
import DOMPurify from 'dompurify';

interface SearchResult {
  documentId: string;
  documentTitle: string;
  documentFilename: string;
  chunkId: number;
  chunkIndex: number;
  chunkContent: string;
  similarityScore: number;
  sectionTitle?: string;
  frameworkTags?: Array<{
    frameworkName: string;
    frameworkDisplayName: string;
    relevanceScore: number;
  }>;
}

interface VectorSearchProps {
  workspaceId: string;
}

export function VectorSearch({ workspaceId }: VectorSearchProps) {
  const [query, setQuery] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState<number | undefined>(undefined);
  const [retryForIndexing, setRetryForIndexing] = useState(false); // Phase 2.4: Retry toggle for recent uploads
  const [frameworks, setFrameworks] = useState<ComplianceFrameworkInfo[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [searchTime, setSearchTime] = useState<number | null>(null);

  // Load frameworks
  useEffect(() => {
    const fetchFrameworks = async () => {
      try {
        const data = await api.get<ComplianceFrameworkInfo[]>(
          `/api/workspaces/${workspaceId}/frameworks`
        );
        setFrameworks(data);
      } catch (err) {
        console.error('Failed to load frameworks:', err);
      }
    };

    fetchFrameworks();
  }, [workspaceId]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setError('');
    const startTime = Date.now();

    try {
      const response = await api.post<{ results: SearchResult[] }>(
        `/api/workspaces/${workspaceId}/documents/search`,
        {
          query,
          frameworkId: frameworkFilter,
          retryForIndexing, // Phase 2.4: Send retry parameter to backend
        }
      );

      setResults(response.results || []);
      setSearchTime(Date.now() - startTime);
    } catch (err: any) {
      setError(err.error || 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getSimilarityColor = (score: number): string => {
    // Phase 2.4: Updated thresholds for bge-small-en model
    if (score >= 0.70) return 'text-green-600 bg-green-50'; // High - same topic
    if (score >= 0.50) return 'text-blue-600 bg-blue-50'; // Medium - related content
    return 'text-gray-600 bg-gray-50'; // Low - different topics
  };

  const getSimilarityCategory = (score: number): string => {
    // Phase 2.4: Category labels for thresholds
    if (score >= 0.70) return 'Same Topic';
    if (score >= 0.50) return 'Related Content';
    return 'Different Topics';
  };

  /**
   * SECURITY FIX: Sanitize and highlight query terms safely
   * Prevents XSS attacks by sanitizing HTML before rendering
   */
  const highlightQuery = (text: string): string => {
    if (!query.trim()) return text;

    const words = query.trim().split(/\s+/);
    let highlighted = text;

    words.forEach(word => {
      // Escape special regex characters
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedWord})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
    });

    // CRITICAL SECURITY FIX: Sanitize HTML to prevent XSS
    return DOMPurify.sanitize(highlighted, {
      ALLOWED_TAGS: ['mark'],
      ALLOWED_ATTR: ['class'],
    });
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search documents using AI semantic search..."
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={frameworkFilter || ''}
            onChange={(e) => setFrameworkFilter(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isSearching}
          >
            <option value="">All Frameworks</option>
            {frameworks
              .filter((fw) => fw.isActive)
              .map((framework) => (
                <option key={framework.id} value={framework.id}>
                  {framework.displayName}
                </option>
              ))}
          </select>
          <Button
            variant="primary"
            onClick={handleSearch}
            loading={isSearching}
            disabled={!query.trim() || isSearching}
          >
            {isSearching ? 'Searching...' : '🔍 Search'}
          </Button>
        </div>
        
        {/* Phase 2.4: Retry toggle for recent uploads */}
        <div className="mt-3 flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={retryForIndexing}
              onChange={(e) => setRetryForIndexing(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Retry for recently uploaded documents (waits for indexing)</span>
          </label>
          <div className="group relative">
            <svg 
              className="h-4 w-4 text-gray-400 hover:text-gray-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
              Enable this if searching for a document uploaded in the last few minutes. The system will wait up to 5 seconds for the vector index to become available.
            </div>
          </div>
        </div>
        
        {searchTime !== null && (
          <p className="mt-2 text-xs text-gray-500">
            Found {results.length} results in {searchTime}ms
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Phase 2.4: Similarity Threshold Information */}
      {results.length > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">📊 Similarity Score Thresholds</h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-white rounded-md p-2 border border-green-200">
              <div className="font-medium text-green-700">High (≥70%)</div>
              <div className="text-gray-600 mt-1">Same topic - highly relevant content</div>
            </div>
            <div className="bg-white rounded-md p-2 border border-blue-200">
              <div className="font-medium text-blue-700">Medium (50-80%)</div>
              <div className="text-gray-600 mt-1">Related content - contextually similar</div>
            </div>
            <div className="bg-white rounded-md p-2 border border-gray-200">
              <div className="font-medium text-gray-700">Low (&lt;60%)</div>
              <div className="text-gray-600 mt-1">Different topics - weak connection</div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Search Results ({results.length})
          </h3>
          {results.map((result, index) => (
            <div
              key={`${result.documentId}-${result.chunkId}-${index}`}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Document Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <a
                    href={`/workspaces/${workspaceId}/documents/${result.documentId}`}
                    className="text-lg font-semibold text-blue-600 hover:text-blue-800"
                  >
                    {result.documentTitle || result.documentFilename}
                  </a>
                  {result.sectionTitle && (
                    <p className="text-sm text-gray-600">Section: {result.sectionTitle}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Chunk #{result.chunkIndex + 1}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`rounded-full px-3 py-1 text-sm font-medium ${getSimilarityColor(result.similarityScore)}`}>
                    {(result.similarityScore * 100).toFixed(0)}% match
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {getSimilarityCategory(result.similarityScore)}
                  </div>
                </div>
              </div>

              {/* Framework Tags */}
              {result.frameworkTags && result.frameworkTags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {result.frameworkTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                    >
                      {tag.frameworkDisplayName}
                      <span className="text-xs opacity-75">
                        {(tag.relevanceScore * 100).toFixed(0)}%
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Chunk Content with Highlighting */}
              <div
                className="text-sm text-gray-700"
                dangerouslySetInnerHTML={{
                  __html: highlightQuery(result.chunkContent.substring(0, 400) + (result.chunkContent.length > 400 ? '...' : '')),
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!isSearching && results.length === 0 && query && !error && (
        <div className="rounded-lg bg-gray-50 p-8 text-center">
          <p className="text-gray-600">No results found for "{query}"</p>
          <p className="mt-2 text-sm text-gray-500">
            Try different keywords or remove the framework filter
          </p>
        </div>
      )}

      {/* Initial State */}
      {!query && results.length === 0 && (
        <div className="rounded-lg bg-gray-50 p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-lg text-gray-900">AI-Powered Semantic Search</p>
          <p className="mt-2 text-sm text-gray-600">
            Search across all documents using natural language. Our AI understands context and meaning.
          </p>
          <div className="mt-4 text-left inline-block">
            <p className="text-sm font-medium text-gray-700 mb-2">Try searching for:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• "data privacy requirements"</li>
              <li>• "access control policies"</li>
              <li>• "incident response procedures"</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
