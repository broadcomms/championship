'use client';

import React, { useState, useEffect } from 'react';
import { FileText, TrendingUp, AlertCircle, Download, Share2, Pin, Archive } from 'lucide-react';
import type { SessionDetails, ComplianceScore, RelatedDocument } from '@/types/assistant';

interface DetailsSidebarProps {
  sessionId?: string;
  conversationId?: string;
  workspaceId: string;
}

export function DetailsSidebar({ sessionId, conversationId, workspaceId }: DetailsSidebarProps) {
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [complianceScore, setComplianceScore] = useState<ComplianceScore | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<RelatedDocument[]>([]);

  // Mock data for now - will be replaced with API calls
  useEffect(() => {
    if (sessionId) {
      setSessionDetails({
        id: sessionId,
        startedAt: new Date(),
        messageCount: 24,
        duration: '15m',
        tokenCount: 3456,
        cost: 0.012,
      });

      setComplianceScore({
        overall: 85,
        frameworks: [
          { name: 'GDPR', score: 92, status: 'good' },
          { name: 'SOC2', score: 78, status: 'warning' },
          { name: 'ISO 27001', score: 85, status: 'good' },
          { name: 'HIPAA', score: 95, status: 'good' },
        ],
      });

      setRelatedDocuments([
        { id: '1', name: 'Privacy Policy.pdf', lastChecked: '2d', status: 'compliant' },
        { id: '2', name: 'Data Processing.doc', lastChecked: '1w', status: 'issues', issueCount: 3 },
        { id: '3', name: 'Security Audit.xlsx', lastChecked: '3d', status: 'compliant' },
      ]);
    }
  }, [sessionId]);

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
