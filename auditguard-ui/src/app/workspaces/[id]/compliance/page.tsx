'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { ComplianceIssuesList } from '@/components/compliance/ComplianceIssuesList';
import { IssueDetailPanel } from '@/components/compliance/IssueDetailPanel';
import type {
  ComplianceCheckListItem,
  MaturityLevel,
  RiskLevel,
} from '@/types';
import { IssueStatus } from '@/types/compliance';
// TODO: Phase 1 workspace-level compliance features
// import {
//   ComplianceScoreGauge,
//   ComplianceCheckRunner,
// } from '@/components/compliance';

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

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/dashboard`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load dashboard');
        }

        const data = await response.json();
        setDashboard(data);
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      }
    };

    const fetchRecentChecks = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/compliance`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load checks');
        }

        const data = await response.json();
        setRecentChecks(data.checks?.slice(0, 5) || []);
      } catch (err) {
        console.error('Error fetching checks:', err);
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
          <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-800">
            <p className="font-medium">Error Loading Dashboard</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
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
            <p className="text-gray-500 mt-1">Monitor and manage compliance issues and remediation</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Overall Score */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{dashboard.overallScore ?? 0}</div>
                <p className="text-sm text-gray-500 mt-2">Overall Score</p>
              </div>
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
        )}

        {/* Recent Activity */}
        {dashboard?.recentActivity && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Activity
              {dashboard.recentActivity.period && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({dashboard.recentActivity.period})
                </span>
              )}
            </h2>
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
          </div>
        )}

        {/* Compliance Issues Management */}
        <ComplianceIssuesList
          workspaceId={workspaceId}
          onIssueClick={handleIssueClick}
          onBulkAction={handleBulkAction}
        />

        {/* Issue Detail Panel */}
        <IssueDetailPanel
          workspaceId={workspaceId}
          issueId={selectedIssueId}
          isOpen={selectedIssueId !== null}
          onClose={() => setSelectedIssueId(null)}
          onStatusChange={handleIssueStatusChange}
        />
      </div>
      </div>
    </AppLayout>
  );
}
