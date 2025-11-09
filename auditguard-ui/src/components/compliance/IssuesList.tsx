'use client';

import React, { useState, useMemo } from 'react';
import type { ComplianceIssue, IssueSeverity } from '@/types';

/**
 * Issues List Component
 *
 * Displays a filterable list of compliance issues with expandable details.
 *
 * Features:
 * - Filter by severity
 * - Expandable issue cards
 * - Severity-coded badges
 * - Issue count by severity
 * - Responsive design
 * - Accessible with keyboard navigation
 *
 * @example
 * <IssuesList issues={issues} workspaceId="wks_123" />
 */

export interface IssuesListProps {
  /** Array of compliance issues to display */
  issues: ComplianceIssue[];
  /** Workspace ID for context */
  workspaceId: string;
  /** Optional callback when issue is clicked */
  onIssueClick?: (issue: ComplianceIssue) => void;
  /** Optional class name */
  className?: string;
}

/**
 * Issue Card Component - Internal
 */
interface IssueCardProps {
  issue: ComplianceIssue;
  expanded: boolean;
  onToggle: () => void;
  onClick?: () => void;
}

function IssueCard({ issue, expanded, onToggle, onClick }: IssueCardProps) {
  const severityColors: Record<IssueSeverity, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className="p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
      role="article"
      aria-label={`Issue: ${issue.title}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Severity badge and category */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                severityColors[issue.severity]
              }`}
              role="status"
              aria-label={`Severity: ${issue.severity}`}
            >
              {issue.severity.toUpperCase()}
            </span>
            <span className="text-sm text-gray-500">{issue.category}</span>
            {issue.location && (
              <span className="text-xs text-gray-400">📍 {issue.location}</span>
            )}
          </div>

          {/* Title */}
          <button
            onClick={() => {
              onToggle();
              handleCardClick();
            }}
            className="text-left w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            aria-expanded={expanded}
            aria-controls={`issue-details-${issue.id}`}
          >
            <h4 className="text-base font-medium text-gray-900 mb-1 hover:text-blue-600 transition-colors">
              {issue.title}
            </h4>
          </button>

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-2">
            {issue.description}
          </p>
        </div>

        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="ml-4 text-gray-400 hover:text-gray-600 p-2 rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
          aria-expanded={expanded}
        >
          <svg
            className={`w-5 h-5 transform transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Expanded details */}
      {expanded && issue.recommendation && (
        <div
          id={`issue-details-${issue.id}`}
          className="mt-4 rounded-md bg-blue-50 border border-blue-200 p-4"
          role="region"
          aria-label="Issue recommendation"
        >
          <h5 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
            <span role="img" aria-label="lightbulb">💡</span>
            Recommendation
          </h5>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">
            {issue.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Main IssuesList Component
 */
export function IssuesList({
  issues,
  workspaceId,
  onIssueClick,
  className = '',
}: IssuesListProps) {
  const [filter, setFilter] = useState<IssueSeverity | 'all'>('all');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  // Calculate severity counts
  const severityCounts = useMemo(() => {
    return {
      critical: issues.filter((i) => i.severity === 'critical').length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length,
      info: issues.filter((i) => i.severity === 'info').length,
    };
  }, [issues]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    if (filter === 'all') return issues;
    return issues.filter((issue) => issue.severity === filter);
  }, [issues, filter]);

  // Filter button component
  const FilterButton = ({
    severity,
    label,
    count,
    colorClass,
  }: {
    severity: IssueSeverity | 'all';
    label: string;
    count: number;
    colorClass: string;
  }) => {
    const isActive = filter === severity;
    return (
      <button
        onClick={() => setFilter(severity)}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          isActive
            ? colorClass
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        aria-pressed={isActive}
        aria-label={`Filter by ${label} severity, ${count} issues`}
      >
        {label} ({count})
      </button>
    );
  };

  if (issues.length === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-8 text-center ${className}`}>
        <div className="text-gray-400 mb-2">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">No issues found</p>
        <p className="text-sm text-gray-400 mt-1">
          This document appears to be compliant
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      {/* Header with filters */}
      <div className="border-b border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Issues Found ({issues.length})
        </h3>

        {/* Severity filters */}
        <div
          className="flex gap-2 flex-wrap"
          role="group"
          aria-label="Filter issues by severity"
        >
          <FilterButton
            severity="all"
            label="All"
            count={issues.length}
            colorClass="bg-blue-600 text-white"
          />
          <FilterButton
            severity="critical"
            label="Critical"
            count={severityCounts.critical}
            colorClass="bg-red-600 text-white"
          />
          <FilterButton
            severity="high"
            label="High"
            count={severityCounts.high}
            colorClass="bg-orange-600 text-white"
          />
          <FilterButton
            severity="medium"
            label="Medium"
            count={severityCounts.medium}
            colorClass="bg-yellow-600 text-white"
          />
          <FilterButton
            severity="low"
            label="Low"
            count={severityCounts.low}
            colorClass="bg-green-600 text-white"
          />
          <FilterButton
            severity="info"
            label="Info"
            count={severityCounts.info}
            colorClass="bg-blue-500 text-white"
          />
        </div>
      </div>

      {/* Issues list */}
      <div className="divide-y divide-gray-200">
        {filteredIssues.length > 0 ? (
          filteredIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              expanded={expandedIssue === issue.id}
              onToggle={() =>
                setExpandedIssue(expandedIssue === issue.id ? null : issue.id)
              }
              onClick={onIssueClick ? () => onIssueClick(issue) : undefined}
            />
          ))
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>No {filter !== 'all' ? filter : ''} issues found</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default IssuesList;
