'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ComplianceIssueDetails, IssueStatus } from '@/types/compliance';
import { 
  X, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  User,
  Calendar,
  FileText,
  MessageSquare,
  ExternalLink
} from 'lucide-react';

interface IssueDetailPanelProps {
  workspaceId: string;
  issueId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (issueId: string, newStatus: IssueStatus) => void;
}

export function IssueDetailPanel({
  workspaceId,
  issueId,
  isOpen,
  onClose,
  onStatusChange
}: IssueDetailPanelProps) {
  const [issue, setIssue] = useState<ComplianceIssueDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchIssueDetails = useCallback(async () => {
    if (!issueId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/issues/${issueId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch issue details');
      }

      const data = await response.json();
      setIssue(data);
    } catch (err) {
      console.error('Error fetching issue:', err);
      setError(err instanceof Error ? err.message : 'Failed to load issue');
    } finally {
      setLoading(false);
    }
  }, [issueId, workspaceId]);

  useEffect(() => {
    if (isOpen && issueId) {
      fetchIssueDetails();
    }
  }, [fetchIssueDetails, isOpen, issueId]);

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!issue) return;

    setUpdating(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/issues/${issue.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      setIssue({ ...issue, status: newStatus });
      if (onStatusChange) {
        onStatusChange(issue.id, newStatus);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update issue status');
    } finally {
      setUpdating(false);
    }
  };

  const handleResolve = async () => {
    if (!issue) return;

    setUpdating(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/issues/${issue.id}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to resolve issue');
      }

      setIssue({ ...issue, status: 'resolved', resolvedAt: Date.now() });
      if (onStatusChange) {
        onStatusChange(issue.id, 'resolved');
      }
    } catch (err) {
      console.error('Error resolving issue:', err);
      alert('Failed to resolve issue');
    } finally {
      setUpdating(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: IssueStatus) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'resolved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'dismissed':
        return <X className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Background overlay */}
        <div 
          className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="w-screen max-w-2xl">
            <div className="h-full flex flex-col bg-white shadow-xl">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : error ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-600">{error}</p>
                    <button
                      onClick={fetchIssueDetails}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : issue ? (
                <>
                  {/* Header */}
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(issue.status)}
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900" id="slide-over-title">
                            Issue Details
                          </h2>
                          <p className="text-sm text-gray-500 mt-1">
                            {issue.category}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={onClose}
                        className="rounded-md text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-6 space-y-6">
                      {/* Title and Severity */}
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 flex-1">
                            {issue.title}
                          </h3>
                          <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getSeverityColor(issue.severity)}`}>
                            {issue.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-600">
                          {issue.description}
                        </p>
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">Created</div>
                          <div className="flex items-center gap-2 text-sm text-gray-900">
                            <Calendar className="w-4 h-4" />
                            {new Date(issue.createdAt).toLocaleString()}
                          </div>
                        </div>
                        {issue.assignedTo && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Assigned To</div>
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <User className="w-4 h-4" />
                              {issue.assignedTo}
                            </div>
                          </div>
                        )}
                        {issue.resolvedAt && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Resolved</div>
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <CheckCircle className="w-4 h-4" />
                              {new Date(issue.resolvedAt).toLocaleString()}
                            </div>
                          </div>
                        )}
                        {issue.sectionRef && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Section</div>
                            <div className="text-sm text-gray-900">{issue.sectionRef}</div>
                          </div>
                        )}
                      </div>

                      {/* Excerpt */}
                      {issue.excerpt && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Relevant Content
                          </h4>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-700 italic">
                              &ldquo;{issue.excerpt}&rdquo;
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Recommendation */}
                      {issue.recommendation && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Recommendation
                          </h4>
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-gray-700">
                              {issue.recommendation}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Regulation Citation */}
                      {issue.regulationCitation && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Regulation Reference
                          </h4>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-700">
                              {issue.regulationCitation}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Risk Score */}
                      {issue.riskScore !== null && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Risk Score</h4>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    issue.riskScore >= 80 ? 'bg-red-600' :
                                    issue.riskScore >= 60 ? 'bg-orange-600' :
                                    issue.riskScore >= 40 ? 'bg-yellow-600' :
                                    'bg-blue-600'
                                  }`}
                                  style={{ width: `${issue.riskScore}%` }}
                                ></div>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {issue.riskScore}/100
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Document Link */}
                      {issue.documentId && (
                        <div>
                          <a
                            href={`/workspaces/${workspaceId}/documents/${issue.documentId}`}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                          >
                            <FileText className="w-4 h-4" />
                            View Source Document
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        <select
                          value={issue.status}
                          onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
                          disabled={updating}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="dismissed">Dismissed</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {issue.status !== 'resolved' && (
                          <button
                            onClick={handleResolve}
                            disabled={updating}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Mark Resolved
                          </button>
                        )}
                        <button
                          onClick={onClose}
                          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
