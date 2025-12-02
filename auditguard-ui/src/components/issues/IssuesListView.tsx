'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ComplianceIssue, IssueSeverity, IssueStatus, SEVERITY_COLORS, PRIORITY_COLORS } from '@/types/compliance';

interface IssuesListViewProps {
  workspaceId: string;
  orgId: string;
  filterSeverity?: 'all' | IssueSeverity;
}

export function IssuesListView({ workspaceId, orgId, filterSeverity = 'all' }: IssuesListViewProps) {
  const router = useRouter();
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'severity' | 'status' | 'createdAt' | 'framework'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchIssues = useCallback(async () => {
    try {
      const response = await api.get<{ issues: ComplianceIssue[] }>(`/api/workspaces/${workspaceId}/issues`);
      const issuesData = response?.issues || [];
      setIssues(issuesData);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const getFrameworkColor = (framework: string | null) => {
    if (!framework) return 'bg-gray-100 text-gray-700 border-gray-300';
    const fw = framework.toLowerCase();
    if (fw.includes('soc2') || fw.includes('soc 2')) return 'bg-purple-100 text-purple-700 border-purple-300';
    if (fw.includes('iso')) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (fw.includes('sox')) return 'bg-indigo-100 text-indigo-700 border-indigo-300';
    if (fw.includes('gdpr')) return 'bg-green-100 text-green-700 border-green-300';
    if (fw.includes('hipaa')) return 'bg-teal-100 text-teal-700 border-teal-300';
    if (fw.includes('pci')) return 'bg-pink-100 text-pink-700 border-pink-300';
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const formatFramework = (framework: string | null) => {
    if (!framework) return 'General';
    return framework.toUpperCase();
  };

  const getStatusColor = (status: IssueStatus) => {
    const colors = {
      open: 'bg-red-100 text-red-700 border-red-300',
      in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
      review: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      resolved: 'bg-green-100 text-green-700 border-green-300',
      dismissed: 'bg-gray-100 text-gray-700 border-gray-300',
    };
    return colors[status];
  };

  const getStatusLabel = (status: IssueStatus) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const filteredIssues = issues.filter(issue => {
    if (filterSeverity === 'all') return true;
    return issue.severity === filterSeverity;
  });

  const sortedIssues = [...filteredIssues].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    if (sortField === 'severity') {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (severityOrder[a.severity] - severityOrder[b.severity]) * direction;
    }
    
    if (sortField === 'status') {
      return a.status.localeCompare(b.status) * direction;
    }
    
    if (sortField === 'framework') {
      const aFramework = a.framework || '';
      const bFramework = b.framework || '';
      return aFramework.localeCompare(bFramework) * direction;
    }
    
    // Default: sort by createdAt
    return (a.createdAt - b.createdAt) * direction;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleIssueClick = (issueId: string) => {
    router.push(`/org/${orgId}/workspace/${workspaceId}/issues/${issueId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading issues...</div>
      </div>
    );
  }

  if (sortedIssues.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="text-gray-400 text-lg mb-2">No issues found</div>
        <p className="text-gray-500 text-sm">
          {filterSeverity !== 'all' 
            ? `No ${filterSeverity} severity issues in this workspace`
            : 'No compliance issues in this workspace'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">
          <button
            onClick={() => handleSort('severity')}
            className="col-span-1 text-left hover:text-gray-900 flex items-center gap-1"
          >
            Severity
            {sortField === 'severity' && (
              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
          
          <button
            onClick={() => handleSort('framework')}
            className="col-span-1 text-left hover:text-gray-900 flex items-center gap-1"
          >
            Framework
            {sortField === 'framework' && (
              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
          
          <div className="col-span-4 text-left">Issue</div>
          
          <div className="col-span-2 text-left">Document</div>
          
          <button
            onClick={() => handleSort('status')}
            className="col-span-1 text-left hover:text-gray-900 flex items-center gap-1"
          >
            Status
            {sortField === 'status' && (
              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
          
          <div className="col-span-2 text-left">Assigned</div>
          
          <button
            onClick={() => handleSort('createdAt')}
            className="col-span-1 text-left hover:text-gray-900 flex items-center gap-1"
          >
            Created
            {sortField === 'createdAt' && (
              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-200">
        {sortedIssues.map((issue) => (
          <div
            key={issue.id}
            onClick={() => handleIssueClick(issue.id)}
            className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition"
          >
            {/* Severity */}
            <div className="col-span-1 flex items-center">
              <span
                className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${
                  SEVERITY_COLORS[issue.severity]
                }`}
              >
                {issue.severity}
              </span>
            </div>

            {/* Framework */}
            <div className="col-span-1 flex items-center">
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${
                  getFrameworkColor(issue.framework)
                }`}
              >
                {formatFramework(issue.framework)}
              </span>
            </div>

            {/* Issue Title & Description */}
            <div className="col-span-4 flex flex-col justify-center min-w-0">
              <div className="font-medium text-gray-900 truncate mb-1 flex items-center gap-2">
                {issue.title}
                {issue.priorityLevel && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                      PRIORITY_COLORS[issue.priorityLevel]
                    }`}
                  >
                    {issue.priorityLevel}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 line-clamp-1">
                {issue.description}
              </p>
            </div>

            {/* Document */}
            <div className="col-span-2 flex items-center min-w-0">
              {issue.documentName ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-gray-400">📄</span>
                  <span className="text-sm text-gray-700 truncate" title={issue.documentName}>
                    {issue.documentName}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>

            {/* Status */}
            <div className="col-span-1 flex items-center">
              <span
                className={`px-2 py-1 rounded text-xs font-semibold border ${
                  getStatusColor(issue.status)
                }`}
              >
                {getStatusLabel(issue.status)}
              </span>
            </div>

            {/* Assigned To */}
            <div className="col-span-2 flex items-center gap-2 min-w-0">
              {issue.assignedTo ? (
                <>
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {issue.assignedTo[0]?.toUpperCase() || 'A'}
                  </div>
                  <span className="text-sm text-gray-700 truncate">
                    {issue.assignedTo.split('@')[0] || 'Assigned'}
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-400">Unassigned</span>
              )}
            </div>

            {/* Created Date */}
            <div className="col-span-1 flex items-center">
              <span className="text-sm text-gray-600">
                {new Date(issue.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
        <div className="text-sm text-gray-600">
          Showing {sortedIssues.length} {sortedIssues.length === 1 ? 'issue' : 'issues'}
          {filterSeverity !== 'all' && ` (${filterSeverity} severity)`}
        </div>
      </div>
    </div>
  );
}
