'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { AssignmentModal } from '@/components/issues/AssignmentModal';
import { 
  ComplianceIssue, 
  IssueComment, 
  IssueStatus, 
  SEVERITY_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_COLORS
} from '@/types/compliance';

interface IssueCommentsResponse {
  comments: IssueComment[];
}

const normalizeApiResponse = <T,>(response: T | { data: T }): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
};

const getApiErrorMessage = (err: unknown): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: string }).message || 'Something went wrong');
  }
  return 'Something went wrong';
};

export default function IssueDetailsPage() {
  const params = useParams<{ id: string; wsId: string; issueId: string }>();
  const router = useRouter();
  const { id: orgId, wsId: workspaceId, issueId } = params;
  const { user } = useAuth();
  const accountId = user?.userId;

  const [issue, setIssue] = useState<ComplianceIssue | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const fetchIssueDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<ComplianceIssue>(
        `/api/workspaces/${workspaceId}/issues/${issueId}`
      );
      const issueData = normalizeApiResponse(response);
      setIssue(issueData);
      setError(null);
    } catch (fetchError) {
      console.error('Failed to fetch issue details:', fetchError);
      setError('Failed to load issue details');
    } finally {
      setLoading(false);
    }
  }, [issueId, workspaceId]);

  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const response = await api.get<IssueCommentsResponse>(
        `/api/workspaces/${workspaceId}/issues/${issueId}/comments?limit=100&offset=0`
      );
      const data = normalizeApiResponse(response);
      setComments(data.comments || []);
    } catch (fetchError) {
      console.error('Failed to fetch comments:', fetchError);
    } finally {
      setLoadingComments(false);
    }
  }, [issueId, workspaceId]);

  useEffect(() => {
    fetchIssueDetails();
    fetchComments();
  }, [fetchComments, fetchIssueDetails]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await api.post(
        `/api/workspaces/${workspaceId}/issues/${issueId}/comments`,
        {
          commentText: newComment,
          commentType: 'comment',
        }
      );
      setNewComment('');
      fetchComments(); // Refresh comments
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert(getApiErrorMessage(error));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: IssueStatus) => {
    try {
      await api.patch(`/api/workspaces/${workspaceId}/issues/${issueId}/status`, {
        status: newStatus,
      });
      if (issue) {
        setIssue({ ...issue, status: newStatus });
      }
      fetchComments(); // Refresh to show status change comment
    } catch (error) {
      console.error('Failed to update issue status:', error);
      alert(getApiErrorMessage(error));
    }
  };

  const formatDate = (dateString: string | number | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateInput: string | number): string => {
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateInput);
  };

  const getCommentIcon = (type: IssueComment['commentType']): string => {
    switch (type) {
      case 'status_change': return '🔄';
      case 'assignment': return '👤';
      case 'resolution': return '✅';
      case 'system': return '⚙️';
      default: return '💬';
    }
  };

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId as string} workspaceId={workspaceId as string}>
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading issue details...</div>
        </div>
      ) : error || !issue ? (
        <div className="flex flex-col items-center justify-center h-96">
          <div className="text-red-500 text-xl mb-4">{error || 'Issue not found'}</div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      ) : (
        <div className="p-8 max-w-6xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2 font-medium"
          >
            ← Back to Issues
          </button>

          <div className="grid grid-cols-3 gap-6">
            {/* Main Content - 2 columns */}
            <div className="col-span-2 space-y-6">
              {/* Header */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded text-sm font-semibold uppercase border ${
                    SEVERITY_COLORS[issue.severity]
                  }`}>
                    {issue.severity}
                  </span>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    STATUS_COLORS[issue.status]
                  }`}>
                    {STATUS_LABELS[issue.status]}
                  </span>
                  {issue.priorityLevel && (
                    <span className={`px-3 py-1 rounded text-sm font-bold ${
                      PRIORITY_COLORS[issue.priorityLevel]
                    }`}>
                      {issue.priorityLevel}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{issue.title}</h1>
                <p className="text-sm text-gray-500">
                  Category: {issue.category} • Created: {formatDate(issue.createdAt)}
                </p>
              </div>

              {/* Document Reference */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  📄 Document Reference
                </h2>
                <div className="space-y-4">
                  {/* Document Info */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">📄</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {issue.documentName || 'Document'}
                        </h3>
                        {issue.framework && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                            {issue.framework}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {issue.documentId || 'No document ID'}
                      </p>
                      {issue.sectionRef && (
                        <p className="text-xs text-gray-500">
                          📍 Location: {issue.sectionRef}
                        </p>
                      )}
                      <button
                        onClick={() => router.push(`/org/${orgId}/workspace/${workspaceId}/documents/${issue.documentId}`)}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        View Document →
                      </button>
                    </div>
                  </div>

                  {/* Affected Excerpt */}
                  {(issue.excerpt || issue.fullExcerpt) && (
                    <div className="border-l-4 border-orange-400 bg-orange-50 p-4 rounded-r-lg">
                      <h3 className="text-sm font-semibold text-orange-900 mb-2 flex items-center gap-2">
                        ⚠️ Affected Text from Document
                      </h3>
                      <div className="bg-white rounded p-3 border border-orange-200">
                        <p className="text-sm text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                          {issue.fullExcerpt || issue.excerpt}
                        </p>
                      </div>
                      {issue.sectionRef && (
                        <p className="text-xs text-orange-700 mt-2">
                          Found in: {issue.sectionRef}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Suggested Correction */}
                  {issue.remediationSteps && (
                    <div className="border-l-4 border-green-400 bg-green-50 p-4 rounded-r-lg">
                      <h3 className="text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                        ✅ Suggested Correction
                      </h3>
                      <div className="bg-white rounded p-3 border border-green-200">
                        <p className="text-sm text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                          {issue.remediationSteps}
                        </p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button 
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                          onClick={() => {
                            navigator.clipboard.writeText(issue.remediationSteps || '');
                            alert('Copied to clipboard!');
                          }}
                        >
                          📋 Copy Correction
                        </button>
                        <button 
                          className="px-3 py-1.5 text-xs bg-white text-green-700 border border-green-300 rounded hover:bg-green-50 font-medium"
                          disabled
                          title="Auto-fix feature coming soon"
                        >
                          🔧 Apply to Document (Coming Soon)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Regulation Citation */}
                  {issue.regulationCitation && (
                    <div className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded-r-lg">
                      <h3 className="text-sm font-semibold text-blue-900 mb-2">
                        📖 Regulation Citation
                      </h3>
                      <p className="text-sm text-blue-800">{issue.regulationCitation}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description & Details */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Issue Description</h2>
                <p className="text-gray-700 mb-6 whitespace-pre-wrap">{issue.description}</p>

                {issue.recommendation && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Recommendation</h3>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{issue.recommendation}</p>
                  </div>
                )}
              </div>

              {/* Enhanced LLM Response Sections */}
              {issue.llmResponse && (
                <>
                  {/* Impact Assessment */}
                  {issue.llmResponse.impact_assessment && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm">
                      <h2 className="text-xl font-semibold text-red-900 mb-3 flex items-center gap-2">
                        ⚠️ Impact Assessment
                      </h2>
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

                  {/* Problematic Content */}
                  {issue.llmResponse.original_text && issue.llmResponse.original_text !== 'None' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm">
                      <h2 className="text-xl font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                        📄 Problematic Content from Document
                      </h2>
                      <div className="bg-white border border-yellow-300 rounded-md p-4">
                        <p className="text-gray-800 italic leading-relaxed font-mono text-sm">
                          &ldquo;{issue.llmResponse.original_text}&rdquo;
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Framework Requirements */}
                  {(issue.llmResponse.framework_section || issue.llmResponse.framework_requirement) && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 shadow-sm">
                      <h2 className="text-xl font-semibold text-purple-900 mb-4 flex items-center gap-2">
                        🛡️ Framework Requirements
                      </h2>
                      <div className="space-y-3">
                        {issue.llmResponse.framework && (
                          <div>
                            <p className="text-sm font-medium text-purple-900 mb-1">Framework:</p>
                            <p className="text-purple-800 font-semibold">{issue.llmResponse.framework}</p>
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
                            <p className="text-sm font-medium text-purple-900 mb-2">Full Requirement:</p>
                            <div className="bg-white border border-purple-300 rounded-md p-4">
                              <p className="text-purple-800 leading-relaxed">
                                {issue.llmResponse.framework_requirement}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Gap Analysis */}
                  {(issue.llmResponse.current_state || issue.llmResponse.required_state) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm">
                      <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center gap-2">
                        🔄 Gap Analysis
                      </h2>
                      <div className="grid md:grid-cols-2 gap-4">
                        {issue.llmResponse.current_state && (
                          <div>
                            <p className="text-sm font-medium text-blue-900 mb-2">Current State:</p>
                            <div className="bg-white border border-blue-300 rounded-md p-4">
                              <p className="text-blue-800 leading-relaxed">
                                {issue.llmResponse.current_state}
                              </p>
                            </div>
                          </div>
                        )}
                        {issue.llmResponse.required_state && (
                          <div>
                            <p className="text-sm font-medium text-blue-900 mb-2">Required State:</p>
                            <div className="bg-white border border-green-300 rounded-md p-4">
                              <p className="text-green-800 leading-relaxed font-medium">
                                {issue.llmResponse.required_state}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Remediation Steps */}
                  {issue.llmResponse.fix && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 shadow-sm">
                      <h2 className="text-xl font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                        🔧 Detailed Remediation Steps
                      </h2>
                      <div className="bg-white border border-indigo-300 rounded-md p-4">
                        <p className="text-indigo-800 leading-relaxed whitespace-pre-wrap">
                          {issue.llmResponse.fix}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Suggested Text Correction */}
                  {issue.llmResponse.suggested_text && (
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-6 shadow-sm">
                      <h2 className="text-xl font-semibold text-teal-900 mb-3 flex items-center gap-2">
                        🎯 Suggested Text Correction
                      </h2>
                      <div className="bg-white border border-teal-300 rounded-md p-4">
                        <p className="text-teal-800 leading-relaxed font-mono text-sm whitespace-pre-wrap">
                          {issue.llmResponse.suggested_text}
                        </p>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => {
                            if (issue.llmResponse?.suggested_text) {
                              navigator.clipboard.writeText(issue.llmResponse.suggested_text);
                              alert('Suggested text copied to clipboard!');
                            }
                          }}
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm flex items-center gap-2"
                        >
                          📋 Copy Suggested Text
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Comments & Activity */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Activity Timeline</h2>
                
                {/* Comments List */}
                <div className="space-y-4 mb-6">
                  {loadingComments ? (
                    <div className="text-center py-8 text-gray-500">Loading activity...</div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">No activity yet</div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3 border-l-2 border-gray-200 pl-4">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                            {comment.userEmail?.[0]?.toUpperCase() || '?'}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">
                              {comment.userName || comment.userEmail || 'Unknown User'}
                            </span>
                            <span className="text-sm text-gray-500">
                              {getCommentIcon(comment.commentType)} {comment.commentType.replace('_', ' ')}
                            </span>
                            <span className="text-sm text-gray-400">
                              {formatRelativeTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{comment.commentText}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment */}
                <div className="border-t pt-4">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {submittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-6">
              {/* Status Workflow */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Status</h3>
                <select
                  value={issue.status}
                  onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open">🔴 Open</option>
                  <option value="in_progress">🔵 In Progress</option>
                  <option value="review">🟡 Review</option>
                  <option value="resolved">🟢 Resolved</option>
                  <option value="dismissed">⚫ Dismissed</option>
                </select>
              </div>

              {/* Assignment */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Assignment</h3>
                {issue.assignedTo ? (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {issue.assignedTo[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{issue.assignedTo}</p>
                      <p className="text-sm text-gray-500">
                        Assigned {issue.assignedAt ? formatRelativeTime(issue.assignedAt) : 'recently'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 mb-4">Unassigned</p>
                )}
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {issue.assignedTo ? 'Reassign' : 'Assign'}
                </button>
              </div>

              {/* Due Date */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Due Date</h3>
                {issue.dueDate ? (
                  <div className="text-gray-900">
                    <p className="text-lg font-medium">
                      {new Date(issue.dueDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {Math.ceil((new Date(issue.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500">No due date set</p>
                )}
              </div>

              {/* Metadata */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">Confidence:</span>
                    <span className="ml-2 font-medium">{issue.confidence || 'N/A'}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Risk Score:</span>
                    <span className="ml-2 font-medium">{issue.riskScore || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <span className="ml-2">{formatDate(issue.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Updated:</span>
                    <span className="ml-2">{formatDate(issue.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Modal Placeholder */}
          <AssignmentModal
            isOpen={showAssignModal}
            onClose={() => setShowAssignModal(false)}
            workspaceId={workspaceId as string}
            issueId={issueId as string}
            currentAssignee={issue.assignedTo}
            currentDueDate={issue.dueDate}
            currentPriority={issue.priorityLevel}
            onAssigned={() => {
              fetchIssueDetails();
              fetchComments();
            }}
          />
        </div>
      )}
    </OrganizationLayout>
  );
}
