'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  ComplianceIssue,
  IssueSeverity,
  IssueStatus,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from '@/types';
import { IssueCard } from './IssueCard';
import { EnhancedIssueDetailPanel } from './EnhancedIssueDetailPanel';

interface DocumentComplianceIssuesListProps {
  workspaceId: string;
  documentId: string;
  checkId?: string;
}

const SEVERITY_OPTIONS: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
const STATUS_OPTIONS: IssueStatus[] = ['open', 'in_progress', 'resolved', 'dismissed'];

export function DocumentComplianceIssuesList({
  workspaceId,
  documentId,
  checkId,
}: DocumentComplianceIssuesListProps) {
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [selectedSeverities, setSelectedSeverities] = useState<IssueSeverity[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<IssueStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Modal state
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (checkId) params.append('checkId', checkId);
      if (selectedSeverities.length > 0) {
        params.append('severity', selectedSeverities.join(','));
      }
      if (selectedStatuses.length > 0) {
        params.append('status', selectedStatuses.join(','));
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(
        `/api/workspaces/${workspaceId}/documents/${documentId}/issues?${params}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch issues');
      }

      const data = await response.json();
      setIssues(data.issues);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, documentId, checkId, selectedSeverities, selectedStatuses, searchQuery, offset]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const toggleSeverity = (severity: IssueSeverity) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity]
    );
    setOffset(0); // Reset pagination
  };

  const toggleStatus = (status: IssueStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
    setOffset(0); // Reset pagination
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setOffset(0); // Reset pagination
  };

  const handleIssueClick = (issueId: string) => {
    setSelectedIssueId(issueId);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedIssueId(null);
  };

  const handleIssueUpdate = () => {
    fetchIssues(); // Refresh the list
  };

  const clearFilters = () => {
    setSelectedSeverities([]);
    setSelectedStatuses([]);
    setSearchQuery('');
    setOffset(0);
  };

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {/* Search */}
        <div className="mb-4">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Issues
          </label>
          <input
            id="search"
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by title, description, or recommendation..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Severity Filters */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Severity
          </label>
          <div className="flex flex-wrap gap-2">
            {SEVERITY_OPTIONS.map((severity) => (
              <button
                key={severity}
                onClick={() => toggleSeverity(severity)}
                className={`
                  px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
                  ${
                    selectedSeverities.includes(severity)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }
                `}
              >
                {SEVERITY_LABELS[severity]}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filters */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Status
          </label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`
                  px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
                  ${
                    selectedStatuses.includes(status)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }
                `}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {/* Clear Filters */}
        {(selectedSeverities.length > 0 || selectedStatuses.length > 0 || searchQuery) && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {loading ? 'Loading...' : `${total} ${total === 1 ? 'Issue' : 'Issues'} Found`}
        </h3>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Issues List */}
      {!loading && issues.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">No issues found</p>
        </div>
      )}

      {!loading && issues.length > 0 && (
        <div className="space-y-3">
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onClick={() => handleIssueClick(issue.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > limit && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={!hasMore}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Enhanced Issue Details Panel */}
      <EnhancedIssueDetailPanel
        workspaceId={workspaceId}
        issueId={selectedIssueId}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onStatusChange={() => {
          handleIssueUpdate();
        }}
      />
    </div>
  );
}
