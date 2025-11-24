'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface ComplianceCheck {
  id: string;
  documentId: string;
  framework: string;
  status: string;
  overallScore: number | null;
  issuesFound: number;
  createdAt: number;
  completedAt: number | null;
}

interface ComplianceIssue {
  id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  recommendation: string | null;
  location: string | null;
  createdAt: number;
  status?: string;
  firstDetectedCheckId?: string;
  lastConfirmedCheckId?: string;
  issueFingerprint?: string;
  isActive?: boolean;
  framework?: string | null;
}

export default function ComplianceCheckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const accountId = user?.userId;

  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const checkId = params.checkId as string;

  const [check, setCheck] = useState<ComplianceCheck | null>(null);
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchComplianceCheck();
  }, [checkId]);

  const fetchComplianceCheck = async () => {
    try {
      setLoading(true);
      
      // Fetch compliance check details
      const checkResponse = await api.get(`/api/workspaces/${wsId}/compliance/${checkId}`);
      setCheck(checkResponse);

      // Fetch compliance issues
      const issuesResponse = await api.get(`/api/workspaces/${wsId}/compliance/${checkId}/issues`);
      setIssues(issuesResponse.issues || []);

    } catch (error) {
      console.error('Failed to fetch compliance check:', error);
      setError('Failed to load compliance check details');
    } finally {
      setLoading(false);
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

  const getIssueStatusBadge = (issue: ComplianceIssue) => {
    // Determine if issue is new, reopened, or updated based on deduplication metadata
    const isNew = issue.firstDetectedCheckId === checkId;
    const wasReopened = issue.status === 'reopened';
    const wasDismissed = issue.status === 'dismissed';
    
    if (wasDismissed) {
      return (
        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
          ❌ DISMISSED
        </span>
      );
    }
    
    if (wasReopened) {
      return (
        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
          🔄 REOPENED
        </span>
      );
    }
    
    if (isNew) {
      return (
        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
          🆕 NEW
        </span>
      );
    }
    
    // Issue exists but was updated (confirmed again in this check)
    if (issue.lastConfirmedCheckId === checkId && issue.firstDetectedCheckId !== checkId) {
      return (
        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          📝 UPDATED
        </span>
      );
    }
    
    // Default: no badge (issue from previous check, not confirmed in this one)
    return null;
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-600';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  if (error || !check) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-600 mb-2">❌</div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Check</h3>
            <p className="text-red-800 mb-4">{error || 'Compliance check not found'}</p>
            <Button
              variant="outline"
              onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance`)}
            >
              ← Back to Compliance
            </Button>
          </div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance`)}
            className="p-2 rounded-md hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Back to compliance dashboard"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compliance Check Results</h1>
            <p className="text-sm text-gray-500 mt-1">
              {check.framework} • {formatTimestamp(check.createdAt)}
            </p>
          </div>
        </div>

        {/* Check Status and Score */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className={`text-4xl font-bold mb-2 ${getScoreColor(check.overallScore)}`}>
                {check.overallScore !== null ? `${check.overallScore}%` : 'N/A'}
              </div>
              <div className="text-gray-600">Compliance Score</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-bold text-red-600 mb-2">{issues.length}</div>
              <div className="text-gray-600">Issues Found</div>
            </div>
            
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                check.status === 'completed' ? 'bg-green-100 text-green-800' :
                check.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Issues List */}
        {issues.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Compliance Issues</h2>
            
            {issues.map((issue) => (
              <div key={issue.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(issue.severity)}`}>
                        {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                      </span>
                      <span className="text-sm text-gray-600">{issue.category}</span>
                      {check.framework && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded border border-purple-200">
                          {check.framework}
                        </span>
                      )}
                      {getIssueStatusBadge(issue)}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{issue.title}</h3>
                    <p className="text-gray-700 mb-4">{issue.description}</p>
                    
                    {issue.recommendation && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-blue-900 mb-2">📋 Recommendation</h4>
                        <p className="text-blue-800 text-sm">{issue.recommendation}</p>
                      </div>
                    )}
                    
                    {issue.location && (
                      <div className="text-sm text-gray-600 mb-4">
                        <span className="font-medium">Location:</span> {issue.location}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/issues/${issue.id}`)}
                      >
                        View Details →
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Issues Found
            </h3>
            <p className="text-gray-600">
              This document meets all {check.framework} compliance requirements.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance`)}
          >
            ← Back to All Checks
          </Button>
          
          <Button
            onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance/run`)}
          >
            Run Another Check
          </Button>
        </div>
      </div>
    </OrganizationLayout>
  );
}