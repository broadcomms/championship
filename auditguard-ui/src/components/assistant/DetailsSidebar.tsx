'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, TrendingUp, AlertCircle, Download, Share2, Pin, Archive } from 'lucide-react';
import type { SessionDetails, ComplianceScore, RelatedDocument } from '@/types/assistant';

interface DetailsSidebarProps {
  sessionId?: string;
  conversationId?: string;
  workspaceId: string;
  messageCount?: number; // Optional: pass message count directly for reliability
}

interface SessionAnalyticsResponse {
  messageCount?: number;
  startedAt?: string | number;
  duration?: string;
  tokensUsed?: number;
  estimatedCost?: number;
}

interface ComplianceApiResponse {
  overall_score?: number;
  frameworks?: ComplianceScore['frameworks'];
}

interface WorkspaceDocumentApiItem {
  id: string;
  filename: string;
  last_checked_at?: number | string;
  compliance_status?: string;
  issue_count?: number;
}

interface WorkspaceDocumentsResponse {
  documents?: WorkspaceDocumentApiItem[];
}

export function DetailsSidebar({ sessionId, conversationId, workspaceId, messageCount = 0 }: DetailsSidebarProps) {
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [complianceScore, setComplianceScore] = useState<ComplianceScore | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<RelatedDocument[]>([]);

  // Determine if we have an active session based on sessionId OR messageCount
  const hasActiveSession = !!sessionId || messageCount > 0;

  const getRelativeTime = useCallback((timestamp: number | string | undefined): string => {
    if (!timestamp && timestamp !== 0) return 'never';
    const numericTimestamp = typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp;
    if (!numericTimestamp) return 'never';
    const now = Date.now();
    const diff = now - numericTimestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'just now';
  }, []);

  const mapDocumentStatus = useCallback((status?: string): RelatedDocument['status'] => {
    if (status === 'compliant' || status === 'issues' || status === 'pending') {
      return status;
    }
    return 'pending';
  }, []);

  const loadSessionData = useCallback(async () => {
    try {
      // If we have sessionId, try to fetch analytics
      if (sessionId) {
        try {
          const analyticsRes = await fetch(`/api/assistant/session/${sessionId}/analytics?workspaceId=${workspaceId}`, {
            credentials: 'include',
          });

          if (analyticsRes.ok) {
            const analytics = (await analyticsRes.json()) as SessionAnalyticsResponse;
            setSessionDetails({
              id: sessionId,
              startedAt: new Date(analytics.startedAt || Date.now()),
              messageCount: analytics.messageCount || messageCount,
              duration: analytics.duration || '0s',
              tokenCount: Math.round(analytics.tokensUsed || 0),
              cost: analytics.estimatedCost || 0,
            });
          } else {
            // Fallback session details when API fails
            setSessionDetails({
              id: sessionId,
              startedAt: new Date(),
              messageCount: messageCount,
              duration: '0s',
              tokenCount: 0,
              cost: 0,
            });
          }
        } catch (error) {
          console.error('Analytics fetch error:', error);
          // Set fallback session details
          setSessionDetails({
            id: sessionId,
            startedAt: new Date(),
            messageCount: messageCount,
            duration: '0s',
            tokenCount: 0,
            cost: 0,
          });
        }
      } else {
        // No sessionId but we have messages
        setSessionDetails({
          id: 'active',
          startedAt: new Date(),
          messageCount: messageCount,
          duration: '0s',
          tokenCount: 0,
          cost: 0,
        });
      }

      // Fetch workspace compliance score
      const complianceRes = await fetch(`/api/workspaces/${workspaceId}/compliance`, {
        credentials: 'include',
      });

      if (complianceRes.ok) {
        const complianceData = (await complianceRes.json()) as ComplianceApiResponse;
        if (typeof complianceData.overall_score === 'number' && complianceData.frameworks) {
          setComplianceScore({
            overall: complianceData.overall_score,
            frameworks: complianceData.frameworks,
          });
        }
      }

      // Fetch related documents (recent documents)
      const docsRes = await fetch(
        `/api/workspaces/${workspaceId}/documents?limit=3&sort=recent`,
        {
          credentials: 'include',
        }
      );

      if (docsRes.ok) {
        const docsData = (await docsRes.json()) as WorkspaceDocumentsResponse;
        setRelatedDocuments(
          (docsData.documents || []).map((doc) => ({
            id: doc.id,
            name: doc.filename,
            lastChecked: getRelativeTime(doc.last_checked_at),
            status: mapDocumentStatus(doc.compliance_status),
            issueCount: doc.issue_count || 0,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load session data:', error);
    } finally {
    }
  }, [sessionId, workspaceId, messageCount, getRelativeTime, mapDocumentStatus]);

  // Load real data from APIs
  useEffect(() => {
    if (sessionId || messageCount > 0) {
      loadSessionData();
    } else {
      // Clear data when no session
      setSessionDetails(null);
      setComplianceScore(null);
      setRelatedDocuments([]);
    }
  }, [sessionId, workspaceId, messageCount, loadSessionData]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getDocumentStatusColor = (status: RelatedDocument['status']) => {
    switch (status) {
      case 'compliant':
        return 'text-green-600';
      case 'issues':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  // Show empty state when no active session
  if (!hasActiveSession) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              No Active Conversation
            </h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Start a conversation to see insights, compliance scores, and related documents
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Session Details */}
        {sessionDetails && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Session Details
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Started</span>
                <span className="text-gray-900 font-medium">
                  {sessionDetails.startedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Messages</span>
                <span className="text-gray-900 font-medium">
                  {sessionDetails.messageCount}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Duration</span>
                <span className="text-gray-900 font-medium">
                  {sessionDetails.duration}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tokens</span>
                <span className="text-gray-900 font-medium">
                  {sessionDetails.tokenCount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cost</span>
                <span className="text-gray-900 font-medium">
                  ${sessionDetails.cost.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Compliance Score */}
        {complianceScore && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Compliance Score
            </h3>
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-sm mb-2">
                  <span className={`text-3xl font-bold ${getScoreColor(complianceScore.overall)}`}>
                    {complianceScore.overall}%
                  </span>
                </div>
                <p className="text-sm text-gray-600">Overall Score</p>
              </div>
              <div className="space-y-3">
                {complianceScore.frameworks.map((framework) => (
                  <div key={framework.name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {framework.name}
                      </span>
                      <span className={`text-sm font-semibold ${getScoreColor(framework.score)}`}>
                        {framework.score}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${getScoreBarColor(framework.score)} transition-all duration-300`}
                        style={{ width: `${framework.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Suggested Actions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Suggested Actions
          </h3>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left">
              <FileText className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-gray-900">
                View GDPR Guide
              </span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-gray-900">
                Check Issues
              </span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-900">
                View Analytics
              </span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left">
              <Download className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                Export Report
              </span>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        {conversationId && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex flex-col items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors">
                <Share2 className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-900">Share</span>
              </button>
              <button className="flex flex-col items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors">
                <Pin className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-900">Pin</span>
              </button>
              <button className="flex flex-col items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors">
                <Download className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-900">Export</span>
              </button>
              <button className="flex flex-col items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors">
                <Archive className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-900">Archive</span>
              </button>
            </div>
          </div>
        )}

        {/* Related Documents */}
        {relatedDocuments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Related Documents
            </h3>
            <div className="space-y-2">
              {relatedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {doc.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      Checked {doc.lastChecked} ago
                    </span>
                    <span className={`font-medium ${getDocumentStatusColor(doc.status)}`}>
                      {doc.status === 'compliant' && '✓ Compliant'}
                      {doc.status === 'issues' && `${doc.issueCount} issues`}
                      {doc.status === 'pending' && 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
