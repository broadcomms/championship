'use client';

import React, { useState, useEffect, lazy, Suspense, memo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { ComplianceScoreGauge } from '@/components/compliance/ComplianceScoreGauge';
import { ConnectionStatus } from '@/components/realtime';
import { ErrorDisplay, SectionErrorBoundary } from '@/components/errors';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';
import { retryFetch } from '@/utils/retry';
import { NetworkError, toAppError } from '@/utils/errors';
import type {
  ComplianceCheckListItem,
  MaturityLevel,
  RiskLevel,
  FrameworkScore,
  ComplianceFramework,
} from '@/types';
import { IssueStatus } from '@/types/compliance';

// Lazy load heavy components
const ComplianceIssuesList = lazy(() => import('@/components/compliance/ComplianceIssuesList').then(m => ({ default: m.ComplianceIssuesList })));
const IssueDetailPanel = lazy(() => import('@/components/compliance/IssueDetailPanel').then(m => ({ default: m.IssueDetailPanel })));

/**
 * Compliance Dashboard Page
 *
 * Main compliance overview for a workspace, showing:
 * - Overall compliance score
 * - Recent compliance checks
 * - Risk level and maturity assessment
 * - Quick actions to run new checks
 *
 * Route: /workspaces/[id]/compliance
 */

interface PageProps {
  params: {
    id: string;
  };
}

interface Dashboard {
  overallScore: number;
  riskLevel: RiskLevel;
  totalDocuments: number;
  documentsChecked: number;
  coveragePercentage: number;
  totalIssues: number;
  recentActivity: {
    documentsUploaded: number;
    checksCompleted: number;
    issuesResolved: number;
    period: string;
  };
  maturityLevel?: MaturityLevel;
  complianceByFramework?: Array<{
    framework: ComplianceFramework;
    averageScore: number;
    checksCount: number;
    lastCheckDate: number;
  }>;
  topIssues?: Array<{
    category: string;
    count: number;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  }>;
}

export default function CompliancePage(props: PageProps) {
  const workspaceId = props.params.id;
  const router = useRouter();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [recentChecks, setRecentChecks] = useState<ComplianceCheckListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewCheck, setShowNewCheck] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // WebSocket for real-time updates
  const { status: wsStatus, subscribe, reconnect } = useWebSocket({
    workspaceId,
    onMessage: (message: WebSocketMessage) => {
      console.log('WebSocket message received:', message);

      switch (message.type) {
        case 'compliance_check_update':
          // Update check in recent checks list
          if (message.data) {
            setRecentChecks(prev => {
              const existing = prev.find(c => c.id === message.data.checkId);
              if (existing) {
                return prev.map(c => 
                  c.id === message.data.checkId 
                    ? { ...c, status: message.data.status, score: message.data.score }
                    : c
                );
              }
              return prev;
            });
          }
          break;

        case 'dashboard_update':
          // Update dashboard metrics
          if (message.data) {
            setDashboard(prev => prev ? {
              ...prev,
              overallScore: message.data.overallScore ?? prev.overallScore,
              totalIssues: message.data.totalIssues ?? prev.totalIssues,
            } : null);
          }
          break;

        case 'issue_update':
          // Refresh issues list when an issue is updated
          console.log('Issue updated, refreshing data...');
          break;
      }
    },
    onConnect: () => {
      console.log('Connected to real-time updates');
    },
    onDisconnect: () => {
      console.log('Disconnected from real-time updates');
    },
  });

  // Subscribe to relevant channels
  useEffect(() => {
    subscribe('compliance-checks');
    subscribe('dashboard');
    subscribe('issues');
  }, [subscribe]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await retryFetch(
          `/api/workspaces/${workspaceId}/dashboard`,
          { credentials: 'include' },
          {
            maxAttempts: 3,
            initialDelay: 1000,
            onRetry: (error, attempt, delay) => {
              console.warn(`Retrying dashboard fetch (attempt ${attempt}, delay ${delay}ms):`, error);
            },
          }
        );

        if (!response.ok) {
          throw new NetworkError(
            `Failed to load dashboard: ${response.statusText}`,
            { operation: 'fetchDashboard', workspaceId },
            response.status
          );
        }

        const data = await response.json();
        setDashboard(data);
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        const appError = toAppError(err, {
          operation: 'fetchDashboard',
          workspaceId,
        });
        setError(appError.getUserMessage());
      }
    };

    const fetchRecentChecks = async () => {
      try {
        const response = await retryFetch(
          `/api/workspaces/${workspaceId}/compliance`,
          { credentials: 'include' },
          {
            maxAttempts: 3,
            initialDelay: 1000,
            onRetry: (error, attempt, delay) => {
              console.warn(`Retrying checks fetch (attempt ${attempt}, delay ${delay}ms):`, error);
            },
          }
        );

        if (!response.ok) {
          throw new NetworkError(
            `Failed to load compliance checks: ${response.statusText}`,
            { operation: 'fetchRecentChecks', workspaceId },
            response.status
          );
        }

        const data = await response.json();
        setRecentChecks(data.checks?.slice(0, 5) || []);
      } catch (err) {
        console.error('Error fetching checks:', err);
        // Don't block dashboard if checks fail
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    fetchRecentChecks();
  }, [workspaceId]);

  const getRiskColor = (level: RiskLevel): string => {
    const colors: Record<RiskLevel, string> = {
      low: 'text-green-700 bg-green-100 border-green-200',
      medium: 'text-yellow-700 bg-yellow-100 border-yellow-200',
      high: 'text-orange-700 bg-orange-100 border-orange-200',
      critical: 'text-red-700 bg-red-100 border-red-200',
    };
    return colors[level] || 'text-gray-700 bg-gray-100 border-gray-200';
  };

  const handleIssueClick = (issueId: string) => {
    setSelectedIssueId(issueId);
  };

  const handleBulkAction = async (issueIds: string[], action: string) => {
    console.log('Bulk action:', action, 'on issues:', issueIds);
    // TODO: Implement bulk actions
  };

  const handleIssueStatusChange = (issueId: string, newStatus: IssueStatus) => {
    console.log('Issue status changed:', issueId, newStatus);
    // Refresh dashboard or update locally
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-8">
          <ErrorDisplay
            error={new Error(error)}
            onRetry={() => window.location.reload()}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-gray-500">Monitor and manage compliance issues and remediation</p>
              <ConnectionStatus status={wsStatus} onReconnect={reconnect} />
            </div>
          </div>
          <button
            onClick={() => setShowNewCheck(!showNewCheck)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {showNewCheck ? 'Cancel' : 'New Check'}
          </button>
        </div>

        {/* New Check Form */}
        {showNewCheck && dashboard && (
          <div className="animate-in slide-in-from-top-5 duration-300 bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600">Workspace-level compliance checking coming soon. Use document-level compliance from individual document pages.</p>
          </div>
        )}

        {/* Overview Cards */}
        {dashboard && (
          <SectionErrorBoundary>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Overall Score with Gauge */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <ComplianceScoreGauge score={dashboard.overallScore ?? 0} size="small" />
              </div>

              {/* Risk Level */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="text-center">
                  <span
                    className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium ${getRiskColor(
                      dashboard.riskLevel ?? 'low'
                    )}`}
                  >
                    {(dashboard.riskLevel ?? 'low').toUpperCase()}
                  </span>
                  <p className="text-sm text-gray-500 mt-4">Risk Level</p>
                </div>
              </div>

              {/* Coverage */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {(dashboard.coveragePercentage ?? 0).toFixed(0)}%
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {dashboard.documentsChecked ?? 0} of {dashboard.totalDocuments ?? 0} documents
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Coverage</p>
                </div>
              </div>

              {/* Total Issues */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{dashboard.totalIssues ?? 0}</div>
                  <p className="text-sm text-gray-500 mt-2">Open Issues</p>
                  <p className="text-xs text-gray-400 mt-1">Across all frameworks</p>
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* Recent Checks Table */}
        {recentChecks.length > 0 && (
          <SectionErrorBoundary>
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Compliance Checks</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Framework
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Issues
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentChecks.map((check) => (
                    <tr
                      key={check.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/workspaces/${workspaceId}/documents/${check.documentId}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {check.documentName || check.documentId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {check.framework}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="font-semibold text-blue-600">
                          {check.overallScore ?? 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`font-medium ${
                            check.issuesFound > 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {check.issuesFound}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            check.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : check.status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {check.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(check.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </SectionErrorBoundary>
        )}

        {/* Recent Activity */}
        <SectionErrorBoundary>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Activity
              {dashboard?.recentActivity?.period && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({dashboard.recentActivity.period})
                </span>
              )}
            </h2>
            {dashboard?.recentActivity ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="text-2xl font-bold text-blue-900">
                    {dashboard.recentActivity.documentsUploaded ?? 0}
                  </div>
                  <p className="text-sm text-blue-700 mt-1">Documents Uploaded</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="text-2xl font-bold text-green-900">
                    {dashboard.recentActivity.checksCompleted ?? 0}
                  </div>
                  <p className="text-sm text-green-700 mt-1">Checks Completed</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="text-2xl font-bold text-purple-900">
                    {dashboard.recentActivity.issuesResolved ?? 0}
                  </div>
                  <p className="text-sm text-purple-700 mt-1">Issues Resolved</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No recent activity data available</p>
                <p className="text-sm mt-1">Activity metrics will appear as checks are run</p>
              </div>
            )}
          </div>
        </SectionErrorBoundary>

        {/* Framework Breakdown */}
        <SectionErrorBoundary>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Framework Compliance</h2>
            {dashboard?.complianceByFramework && dashboard.complianceByFramework.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard.complianceByFramework.map((fw) => (
                  <div key={fw.framework} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{fw.framework}</h3>
                      <span className="text-2xl font-bold text-blue-600">{fw.averageScore.toFixed(0)}</span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Checks:</span>
                        <span className="font-medium">{fw.checksCount}</span>
                      </div>
                      {fw.lastCheckDate > 0 && (
                        <div className="flex justify-between">
                          <span>Last Check:</span>
                          <span className="font-medium">
                            {new Date(fw.lastCheckDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No framework compliance data available</p>
                <p className="text-sm mt-1">Run compliance checks to see framework breakdown</p>
              </div>
            )}
          </div>
        </SectionErrorBoundary>

        {/* Top Issues by Category */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Issue Categories</h2>
          {dashboard?.topIssues && dashboard.topIssues.length > 0 ? (
            <div className="space-y-3">
              {dashboard.topIssues.map((issue, idx) => {
                const getSeverityColor = (severity: string) => {
                  const colors: Record<string, string> = {
                    critical: 'bg-red-500',
                    high: 'bg-orange-500',
                    medium: 'bg-yellow-500',
                    low: 'bg-blue-500',
                    info: 'bg-gray-500',
                  };
                  return colors[severity] || 'bg-gray-500';
                };

                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${getSeverityColor(issue.severity)}`} />
                      <span className="font-medium text-gray-900">{issue.category}</span>
                      <span className="text-xs text-gray-500 uppercase">{issue.severity}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{issue.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No issue categories to display</p>
              <p className="text-sm mt-1">Issues will be categorized as compliance checks are completed</p>
            </div>
          )}
        </div>

        {/* Compliance Issues Management */}
        <Suspense fallback={
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="ml-3 text-sm text-gray-600">Loading issues...</p>
            </div>
          </div>
        }>
          <ComplianceIssuesList
            workspaceId={workspaceId}
            onIssueClick={handleIssueClick}
            onBulkAction={handleBulkAction}
          />
        </Suspense>

        {/* Issue Detail Panel */}
        {selectedIssueId && (
          <Suspense fallback={null}>
            <IssueDetailPanel
              workspaceId={workspaceId}
              issueId={selectedIssueId}
              isOpen={selectedIssueId !== null}
              onClose={() => setSelectedIssueId(null)}
              onStatusChange={handleIssueStatusChange}
            />
          </Suspense>
        )}
      </div>
      </div>
    </AppLayout>
  );
}
