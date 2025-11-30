'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ComplianceIssue, IssueStatus } from '@/types/compliance';
import { 
  X, 
  AlertCircle, 
  CheckCircle, 
  User,
  Calendar,
  FileText,
  ExternalLink,
  Info,
  AlertTriangle,
  Shield,
  BookOpen,
  Target,
  Lightbulb,
  GitCompare,
  Wrench,
  TrendingUp,
} from 'lucide-react';

interface EnhancedIssueDetailPanelProps {
  workspaceId: string;
  issueId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (issueId: string, newStatus: IssueStatus) => void;
}

export function EnhancedIssueDetailPanel({
  workspaceId,
  issueId,
  isOpen,
  onClose,
  onStatusChange
}: EnhancedIssueDetailPanelProps) {
  const [issue, setIssue] = useState<ComplianceIssue | null>(null);
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

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <Info className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500';
    if (confidence >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
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
          <div className="w-screen max-w-4xl">
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
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-3 rounded-lg ${getSeverityColor(issue.severity)}`}>
                          {getSeverityIcon(issue.severity)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold text-gray-900" id="slide-over-title">
                              {issue.title}
                            </h2>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(issue.severity)}`}>
                              {issue.severity.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Shield className="w-4 h-4" />
                              {issue.category}
                            </span>
                            {issue.llmResponse?.framework && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-4 h-4" />
                                {issue.llmResponse.framework}
                              </span>
                            )}
                            {issue.confidence && (
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" />
                                {issue.confidence}% Confidence
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={onClose}
                        className="rounded-md text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-6 space-y-6">
                      {/* Issue Description */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-blue-600" />
                          Issue Description
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                          {issue.description}
                        </p>
                      </div>

                      {/* Impact Assessment */}
                      {issue.llmResponse?.impact_assessment && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm">
                          <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            Impact Assessment
                          </h3>
                          <p className="text-red-800 leading-relaxed mb-3">
                            {issue.llmResponse.impact_assessment}
                          </p>
                          {issue.llmResponse.impact && (
                            <div className="mt-3 pt-3 border-t border-red-200">
                              <p className="text-sm font-medium text-red-900 mb-1">Potential Consequences:</p>
                              <p className="text-sm text-red-700">{issue.llmResponse.impact}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Original Problematic Text */}
                      {issue.llmResponse?.original_text && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm">
                          <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-yellow-600" />
                            Problematic Content
                          </h3>
                          <div className="bg-white border border-yellow-300 rounded-md p-4">
                            <p className="text-gray-800 italic leading-relaxed">
                              &ldquo;{issue.llmResponse.original_text}&rdquo;
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Framework Compliance Details */}
                      {issue.llmResponse && (issue.llmResponse.framework_section || issue.llmResponse.framework_requirement) && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 shadow-sm">
                          <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-purple-600" />
                            Framework Requirements
                          </h3>
                          <div className="space-y-3">
                            {issue.llmResponse.framework && (
                              <div>
                                <p className="text-sm font-medium text-purple-900 mb-1">Framework:</p>
                                <p className="text-purple-800">{issue.llmResponse.framework}</p>
                              </div>
                            )}
                            {issue.llmResponse.framework_section && (
                              <div>
                                <p className="text-sm font-medium text-purple-900 mb-1">Section:</p>
                                <p className="text-purple-800">{issue.llmResponse.framework_section}</p>
                              </div>
                            )}
                            {issue.llmResponse.framework_subsection && (
                              <div>
                                <p className="text-sm font-medium text-purple-900 mb-1">Subsection:</p>
                                <p className="text-purple-800">{issue.llmResponse.framework_subsection}</p>
                              </div>
                            )}
                            {issue.llmResponse.framework_article && (
                              <div>
                                <p className="text-sm font-medium text-purple-900 mb-1">Article:</p>
                                <p className="text-purple-800">{issue.llmResponse.framework_article}</p>
                              </div>
                            )}
                            {issue.llmResponse.framework_requirement && (
                              <div className="mt-3 pt-3 border-t border-purple-200">
                                <p className="text-sm font-medium text-purple-900 mb-2">Requirement:</p>
                                <div className="bg-white border border-purple-300 rounded-md p-3">
                                  <p className="text-purple-800 text-sm leading-relaxed">
                                    {issue.llmResponse.framework_requirement}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Current vs Required State */}
                      {(issue.llmResponse?.current_state || issue.llmResponse?.required_state) && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm">
                          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                            <GitCompare className="w-5 h-5 text-blue-600" />
                            Gap Analysis
                          </h3>
                          <div className="grid md:grid-cols-2 gap-4">
                            {issue.llmResponse.current_state && (
                              <div>
                                <p className="text-sm font-medium text-blue-900 mb-2">Current State:</p>
                                <div className="bg-white border border-blue-300 rounded-md p-3">
                                  <p className="text-blue-800 text-sm leading-relaxed">
                                    {issue.llmResponse.current_state}
                                  </p>
                                </div>
                              </div>
                            )}
                            {issue.llmResponse.required_state && (
                              <div>
                                <p className="text-sm font-medium text-blue-900 mb-2">Required State:</p>
                                <div className="bg-white border border-green-300 rounded-md p-3">
                                  <p className="text-green-800 text-sm leading-relaxed">
                                    {issue.llmResponse.required_state}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Recommendation */}
                      {(issue.recommendation || issue.llmResponse?.recommendation) && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow-sm">
                          <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-green-600" />
                            Recommended Action
                          </h3>
                          <p className="text-green-800 leading-relaxed">
                            {issue.llmResponse?.recommendation || issue.recommendation}
                          </p>
                        </div>
                      )}

                      {/* Remediation Steps */}
                      {issue.llmResponse?.fix && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 shadow-sm">
                          <h3 className="text-lg font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-indigo-600" />
                            Remediation Steps
                          </h3>
                          <p className="text-indigo-800 leading-relaxed">
                            {issue.llmResponse.fix}
                          </p>
                        </div>
                      )}

                      {/* Suggested Correction */}
                      {issue.llmResponse?.suggested_text && (
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-6 shadow-sm">
                          <h3 className="text-lg font-semibold text-teal-900 mb-3 flex items-center gap-2">
                            <Target className="w-5 h-5 text-teal-600" />
                            Suggested Text Correction
                          </h3>
                          <div className="bg-white border border-teal-300 rounded-md p-4">
                            <p className="text-teal-800 leading-relaxed">
                              {issue.llmResponse.suggested_text}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">Created</div>
                          <div className="flex items-center gap-2 text-sm text-gray-900">
                            <Calendar className="w-4 h-4" />
                            {new Date(issue.createdAt).toLocaleString()}
                          </div>
                        </div>
                        {issue.confidence && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Confidence</div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${getConfidenceColor(issue.confidence)}`}
                                    style={{ width: `${issue.confidence}%` }}
                                  ></div>
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-gray-900">
                                {issue.confidence}%
                              </span>
                            </div>
                          </div>
                        )}
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
                      </div>

                      {/* Document Link */}
                      {issue.documentId && (
                        <div>
                          <a
                            href={`/workspaces/${workspaceId}/documents/${issue.documentId}`}
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Mark Resolved
                          </button>
                        )}
                        <button
                          onClick={onClose}
                          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
