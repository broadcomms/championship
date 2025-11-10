'use client';

import React, { useEffect, useState } from 'react';
import {
  ComplianceIssueDetails,
  IssueStatus,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/types';

interface IssueDetailsModalProps {
  workspaceId: string;
  issueId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function IssueDetailsModal({
  workspaceId,
  issueId,
  isOpen,
  onClose,
  onUpdate,
}: IssueDetailsModalProps) {
  const [issue, setIssue] = useState<ComplianceIssueDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    if (isOpen && issueId) {
      fetchIssueDetails();
    }
  }, [isOpen, issueId]);

  const fetchIssueDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/issues/${issueId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch issue details');
      }

      const data = await response.json();
      setIssue(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issue');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: IssueStatus) => {
    if (!issue) return;

    setUpdating(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/issues/${issueId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      await fetchIssueDetails();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const resolveIssue = async () => {
    if (!issue) return;

    setUpdating(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/issues/${issueId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ resolutionNotes }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to resolve issue');
      }

      await fetchIssueDetails();
      onUpdate?.();
      setResolutionNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve issue');
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Issue Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {issue && !loading && (
            <div className="space-y-6">
              {/* Title and Badges */}
              <div>
                <div className="flex items-start gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${SEVERITY_COLORS[issue.severity]}`}>
                    {SEVERITY_LABELS[issue.severity]}
                  </span>
                  <span className={`px-3 py-1 rounded border text-sm ${STATUS_COLORS[issue.status]}`}>
                    {STATUS_LABELS[issue.status]}
                  </span>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">{issue.title}</h3>
                <p className="text-gray-600">{issue.description}</p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium">{issue.category}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Framework</p>
                  <p className="font-medium">{issue.framework}</p>
                </div>
                {issue.riskScore !== null && (
                  <div>
                    <p className="text-sm text-gray-500">Risk Score</p>
                    <p className="font-medium">{issue.riskScore}/100</p>
                  </div>
                )}
                {issue.sectionRef && (
                  <div>
                    <p className="text-sm text-gray-500">Section Reference</p>
                    <p className="font-medium">{issue.sectionRef}</p>
                  </div>
                )}
              </div>

              {/* Recommendation */}
              {issue.recommendation && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                  <p className="text-gray-700 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    {issue.recommendation}
                  </p>
                </div>
              )}

              {/* Remediation Steps */}
              {issue.remediationSteps && issue.remediationSteps.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Remediation Steps</h4>
                  <ol className="list-decimal list-inside space-y-2">
                    {issue.remediationSteps.map((step, index) => (
                      <li key={index} className="text-gray-700">{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Full Excerpt */}
              {issue.fullExcerpt && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Document Excerpt</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-700 italic whitespace-pre-wrap">{issue.fullExcerpt}</p>
                  </div>
                </div>
              )}

              {/* Regulation Citation */}
              {issue.regulationCitation && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Regulation Citation</h4>
                  <p className="text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    {issue.regulationCitation}
                  </p>
                </div>
              )}

              {/* Resolution Notes (if resolved) */}
              {issue.status === 'resolved' && issue.resolutionNotes && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Resolution Notes</h4>
                  <p className="text-gray-700 bg-green-50 border border-green-200 rounded-lg p-4">
                    {issue.resolutionNotes}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Resolved {new Date(issue.resolvedAt!).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Actions */}
              {issue.status !== 'resolved' && (
                <div className="border-t pt-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Actions</h4>

                  {/* Status Update Buttons */}
                  <div className="flex gap-2 mb-4">
                    {issue.status !== 'in_progress' && (
                      <button
                        onClick={() => updateStatus('in_progress')}
                        disabled={updating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Mark In Progress
                      </button>
                    )}
                    {issue.status !== 'dismissed' && (
                      <button
                        onClick={() => updateStatus('dismissed')}
                        disabled={updating}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>

                  {/* Resolve Issue Form */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-2">Resolve Issue</h5>
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Add resolution notes (optional)..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <button
                      onClick={resolveIssue}
                      disabled={updating}
                      className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {updating ? 'Resolving...' : 'Mark as Resolved'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
