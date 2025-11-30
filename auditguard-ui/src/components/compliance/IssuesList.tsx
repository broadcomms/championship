'use client';

import { useState, useEffect } from 'react';
import { IssueSeverity, IssueStatus, ComplianceIssue } from '@/types/compliance';

interface IssuesListProps {
  checkId: string;
  workspaceId: string;
}

const SEVERITY_COLORS: Record<IssueSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  low: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  info: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
};

const STATUS_COLORS: Record<IssueStatus, { bg: string; text: string }> = {
  open: { bg: 'bg-red-100', text: 'text-red-800' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  review: { bg: 'bg-purple-100', text: 'text-purple-800' },
  resolved: { bg: 'bg-green-100', text: 'text-green-800' },
  dismissed: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

export function IssuesList({ checkId, workspaceId }: IssuesListProps) {
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<IssueSeverity | 'all'>('all');
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/compliance/${checkId}/issues`,
          {
            credentials: 'include',
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch issues');
        }

        const data = await response.json();
        setIssues(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch issues');
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, [checkId, workspaceId]);

  const toggleIssue = (issueId: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const filteredIssues =
    selectedSeverity === 'all'
      ? issues
      : issues.filter((issue) => issue.severity === selectedSeverity);

  const severityCounts = issues.reduce(
    (acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    },
    {} as Record<IssueSeverity, number>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <svg
            className="animate-spin h-6 w-6 text-blue-600 mr-3"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-gray-700">Loading issues...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-red-800">Error Loading Issues</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Issues Found</h3>
          <p className="mt-1 text-sm text-gray-500">
            This document passed all compliance checks without any issues.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Compliance Issues ({filteredIssues.length})
          </h3>
        </div>

        {/* Severity filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedSeverity('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedSeverity === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({issues.length})
          </button>
          {(['critical', 'high', 'medium', 'low', 'info'] as IssueSeverity[]).map((severity) => {
            const count = severityCounts[severity] || 0;
            const colors = SEVERITY_COLORS[severity];
            return (
              <button
                key={severity}
                onClick={() => setSelectedSeverity(severity)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedSeverity === severity
                    ? `${colors.bg} ${colors.text} border ${colors.border}`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {filteredIssues.map((issue) => {
          const isExpanded = expandedIssues.has(issue.id);
          const severityColors = SEVERITY_COLORS[issue.severity];
          const statusColors = STATUS_COLORS[issue.status];

          return (
            <div key={issue.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => toggleIssue(issue.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityColors.bg} ${severityColors.text}`}
                    >
                      {issue.severity.toUpperCase()}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                    >
                      {issue.status.replace('_', ' ').toUpperCase()}
                    </span>
                    {issue.category && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {issue.category}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-medium text-gray-900 mb-1">{issue.title}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">{issue.description}</p>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ml-4 flex-shrink-0 ${
                    isExpanded ? 'transform rotate-180' : ''
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
                  <div>
                    <h5 className="text-sm font-medium text-gray-900 mb-1">Description</h5>
                    <p className="text-sm text-gray-700">{issue.description}</p>
                  </div>

                  {issue.recommendation && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 mb-1">Recommendation</h5>
                      <p className="text-sm text-gray-700">{issue.recommendation}</p>
                    </div>
                  )}

                  {issue.sectionRef && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 mb-1">Document Section</h5>
                      <p className="text-sm text-gray-700 font-mono bg-gray-50 p-2 rounded">
                        {issue.sectionRef}
                      </p>
                    </div>
                  )}

                  {issue.excerpt && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 mb-1">Excerpt</h5>
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded italic">
                        &ldquo;{issue.excerpt}&rdquo;
                      </p>
                    </div>
                  )}

                  {issue.regulationCitation && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 mb-1">Regulation Citation</h5>
                      <p className="text-sm text-gray-700">{issue.regulationCitation}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>ID: {issue.id}</span>
                    <span>Created: {new Date(issue.createdAt).toLocaleString()}</span>
                    {issue.riskScore !== null && (
                      <span>Risk Score: {issue.riskScore}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
