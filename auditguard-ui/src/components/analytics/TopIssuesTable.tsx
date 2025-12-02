'use client';

import { useState, useMemo } from 'react';
import { getRiskBadgeClass, formatNumber } from '@/lib/analytics/formatting';

interface IssueItem {
  category: string;
  severity: string;
  count: number;
  description?: string;
}

interface TopIssuesTableProps {
  issues: IssueItem[];
  className?: string;
}

type SortField = 'category' | 'severity' | 'count';
type SortDirection = 'asc' | 'desc';

const severityOrder: { [key: string]: number } = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function TopIssuesTable({ issues, className = '' }: TopIssuesTableProps) {
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedIssues = useMemo(() => {
    if (!issues || issues.length === 0) return [];

    return [...issues].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'severity':
          comparison = severityOrder[a.severity.toLowerCase()] - severityOrder[b.severity.toLowerCase()];
          break;
        case 'count':
          comparison = a.count - b.count;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [issues, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (!issues || issues.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issues</h3>
        <div className="flex items-center justify-center h-48 text-gray-500">
          No issues found
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issues</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                onClick={() => handleSort('category')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  Category
                  <span className="text-gray-400">{getSortIcon('category')}</span>
                </div>
              </th>
              <th
                onClick={() => handleSort('severity')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  Severity
                  <span className="text-gray-400">{getSortIcon('severity')}</span>
                </div>
              </th>
              <th
                onClick={() => handleSort('count')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  Count
                  <span className="text-gray-400">{getSortIcon('count')}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedIssues.map((issue, index) => (
              <tr key={index} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{issue.category}</div>
                  {issue.description && (
                    <div className="text-xs text-gray-500 mt-1">{issue.description}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={getRiskBadgeClass(issue.severity)}>
                    {issue.severity}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">{formatNumber(issue.count)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedIssues.length > 10 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Showing top {Math.min(10, sortedIssues.length)} of {sortedIssues.length} issues
        </div>
      )}
    </div>
  );
}
