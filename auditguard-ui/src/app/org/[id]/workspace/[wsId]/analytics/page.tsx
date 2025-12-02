'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ScoreCard } from '@/components/analytics/ScoreCard';
import { RiskDistributionChart } from '@/components/analytics/RiskDistributionChart';
import { ComplianceTrendChart } from '@/components/analytics/ComplianceTrendChart';
import { FrameworkComparisonChart } from '@/components/analytics/FrameworkComparisonChart';
import { TopIssuesTable } from '@/components/analytics/TopIssuesTable';
import { calculatePercentage } from '@/lib/analytics/formatting';

interface FrameworkScore {
  framework: string;
  score: number;
  checksPassed?: number;
  checksFailed?: number;
  totalChecks?: number;
  lastCheckAt?: number | null;
}

interface ComplianceByFramework {
  frameworkId: string;
  frameworkName: string;
  displayName: string;
  score: number;
  checksCount: number;
  lastCheckDate?: number | null;
}

interface DashboardData {
  overallScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  totalDocuments: number;
  documentsChecked: number;
  coveragePercentage: number;
  totalIssues: number;
  openIssues: number;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  frameworkScores: FrameworkScore[];
  recentActivity?: {
    documentsUploaded: number;
    checksCompleted: number;
    issuesResolved: number;
  };
  complianceByFramework?: ComplianceByFramework[];
  topIssues?: Array<{
    category: string;
    severity: string;
    count: number;
  }>;
  trends?: Array<{
    date: string;
    score: number;
    framework?: string;
  }>;
}

const normalizeApiResponse = <T,>(response: T | { data: T }): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
};

const getApiErrorMessage = (err: unknown): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: string }).message || 'Failed to load analytics');
  }
  return 'Failed to load analytics';
};

export default function WorkspaceAnalyticsPage() {
  const params = useParams<{ id: string; wsId: string }>();
  const orgId = params.id;
  const wsId = params.wsId;
  const { user } = useAuth();
  const accountId = user?.userId;

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!wsId) return;

    setLoading(true);
    try {
      const response = await api.get<DashboardData>(`/api/workspaces/${wsId}/analytics/dashboard`);
      const data = normalizeApiResponse(response);
      
      console.log('Analytics API response:', data);
      
      // Ensure riskDistribution has default values if not present
      const normalizedData: DashboardData = {
        ...data,
        riskDistribution: data.riskDistribution || {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
        frameworkScores: data.frameworkScores || [],
        trends: data.trends || [],
        topIssues: data.topIssues || [],
        // Use complianceByFramework if available, otherwise convert frameworkScores
        complianceByFramework: data.complianceByFramework || (data.frameworkScores || []).map(fs => ({
          frameworkId: fs.framework,
          frameworkName: fs.framework,
          displayName: fs.framework.toUpperCase(),
          score: Math.round(fs.score),
          checksCount: fs.totalChecks || 0,
          lastCheckDate: fs.lastCheckAt,
        })),
      };
      
      setDashboard(normalizedData);
      setError(null);
    } catch (fetchError) {
      console.error('Failed to fetch analytics:', fetchError);
      setError(getApiErrorMessage(fetchError));
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  if (error || !dashboard) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {error ? 'Unable to load analytics' : 'No analytics data available'}
            </h3>
            <p className="text-gray-600 mb-4">
              {error
                ? error
                : 'Analytics will appear once you start running compliance checks'}
            </p>
            {error && (
              <button
                onClick={fetchAnalytics}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </OrganizationLayout>
    );
  }

  // Safe access with defaults
  const totalIssues = dashboard.totalIssues || 0;
  const openIssues = dashboard.openIssues || 0;
  const totalDocuments = dashboard.totalDocuments || 0;
  const documentsChecked = dashboard.documentsChecked || 0;
  const coveragePercentage = dashboard.coveragePercentage || 0;
  const overallScore = dashboard.overallScore || 0;
  const riskLevel = dashboard.riskLevel || 'info';
  
  const resolutionRate = totalIssues > 0 
    ? calculatePercentage(totalIssues - openIssues, totalIssues)
    : 0;

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
            <p className="text-gray-600">
              Comprehensive compliance insights and performance metrics
            </p>
          </div>

          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <ScoreCard
            title="Compliance Score"
            score={overallScore}
            subtitle={`Risk Level: ${riskLevel}`}
            icon="📊"
          />
          
          <ScoreCard
            title="Documents"
            score={totalDocuments}
            subtitle={`${documentsChecked} checked (${coveragePercentage}%)`}
            icon="📄"
            colorClass="text-gray-900"
          />
          
          <ScoreCard
            title="Open Issues"
            score={openIssues}
            subtitle={`${totalIssues} total issues`}
            icon="⚠️"
            colorClass="text-orange-600"
          />
          
          <ScoreCard
            title="Resolution Rate"
            score={`${resolutionRate}%`}
            subtitle={`${totalIssues - openIssues} resolved`}
            icon="✅"
            colorClass="text-green-600"
          />
        </div>

        {/* Charts Row 1 - Risk Distribution and Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <RiskDistributionChart distribution={dashboard.riskDistribution} />
          
          {dashboard.trends && dashboard.trends.length > 0 ? (
            <ComplianceTrendChart data={dashboard.trends} />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Trend</h3>
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">📈</div>
                  <p>Trend data will appear after multiple compliance checks</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Charts Row 2 - Framework Comparison and Top Issues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <FrameworkComparisonChart 
            frameworks={dashboard.complianceByFramework || dashboard.frameworkScores} 
          />
          
          {dashboard.topIssues && dashboard.topIssues.length > 0 ? (
            <TopIssuesTable issues={dashboard.topIssues} />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issues</h3>
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <p>No open issues found</p>
                  <p className="text-sm mt-1">Keep up the great work!</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </OrganizationLayout>
  );
}
