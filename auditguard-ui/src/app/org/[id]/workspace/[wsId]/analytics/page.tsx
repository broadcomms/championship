'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface AnalyticsData {
  compliance_trend: {
    date: string;
    score: number;
    framework: string;
  }[];
  issue_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  document_uploads: {
    date: string;
    count: number;
  }[];
  framework_scores: {
    framework: string;
    score: number;
    checks: number;
  }[];
  resolution_time: {
    avg_hours: number;
    by_severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  activity_summary: {
    total_checks: number;
    total_documents: number;
    total_issues: number;
    resolved_issues: number;
  };
}

export default function WorkspaceAnalyticsPage() {
  const params = useParams();
  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const { user } = useAuth();
  const accountId = user?.userId;

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [wsId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get(`/workspaces/${wsId}/analytics?range=${timeRange}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
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

  if (!analytics) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No analytics data available
            </h3>
            <p className="text-gray-600">
              Analytics will appear once you start running compliance checks
            </p>
          </div>
        </div>
      </OrganizationLayout>
    );
  }

  const resolutionRate =
    analytics.activity_summary.total_issues > 0
      ? Math.round(
          (analytics.activity_summary.resolved_issues / analytics.activity_summary.total_issues) *
            100
        )
      : 0;

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
              <p className="text-gray-600">
                Insights and trends for your compliance program
              </p>
            </div>

            {/* Time Range Selector */}
            <div className="flex gap-2 bg-white border border-gray-200 rounded-lg p-1">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded font-medium text-sm transition ${
                    timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Total Checks</span>
                <span className="text-2xl">✓</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {analytics.activity_summary.total_checks}
              </div>
              <div className="text-sm text-gray-500 mt-1">Compliance checks run</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Documents</span>
                <span className="text-2xl">📄</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {analytics.activity_summary.total_documents}
              </div>
              <div className="text-sm text-gray-500 mt-1">Total uploaded</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Active Issues</span>
                <span className="text-2xl">📋</span>
              </div>
              <div className="text-3xl font-bold text-orange-600">
                {analytics.activity_summary.total_issues -
                  analytics.activity_summary.resolved_issues}
              </div>
              <div className="text-sm text-gray-500 mt-1">Require attention</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Resolution Rate</span>
                <span className="text-2xl">🎯</span>
              </div>
              <div className="text-3xl font-bold text-green-600">{resolutionRate}%</div>
              <div className="text-sm text-gray-500 mt-1">Issues resolved</div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Compliance Trend */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Compliance Score Trend
              </h3>
              {analytics.compliance_trend.length > 0 ? (
                <div className="space-y-3">
                  {analytics.compliance_trend.slice(-5).map((point, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          {new Date(point.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="font-semibold text-gray-900">{point.score}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            point.score >= 80
                              ? 'bg-green-500'
                              : point.score >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${point.score}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500">{point.framework}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No compliance checks yet
                </div>
              )}
            </div>

            {/* Issue Breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Issue Breakdown by Severity
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Critical</span>
                    <span className="text-sm font-semibold text-red-900">
                      {analytics.issue_breakdown.critical}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-red-500 h-3 rounded-full"
                      style={{
                        width: `${
                          (analytics.issue_breakdown.critical /
                            (analytics.issue_breakdown.critical +
                              analytics.issue_breakdown.high +
                              analytics.issue_breakdown.medium +
                              analytics.issue_breakdown.low || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">High</span>
                    <span className="text-sm font-semibold text-orange-900">
                      {analytics.issue_breakdown.high}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-orange-500 h-3 rounded-full"
                      style={{
                        width: `${
                          (analytics.issue_breakdown.high /
                            (analytics.issue_breakdown.critical +
                              analytics.issue_breakdown.high +
                              analytics.issue_breakdown.medium +
                              analytics.issue_breakdown.low || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Medium</span>
                    <span className="text-sm font-semibold text-yellow-900">
                      {analytics.issue_breakdown.medium}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-yellow-500 h-3 rounded-full"
                      style={{
                        width: `${
                          (analytics.issue_breakdown.medium /
                            (analytics.issue_breakdown.critical +
                              analytics.issue_breakdown.high +
                              analytics.issue_breakdown.medium +
                              analytics.issue_breakdown.low || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Low</span>
                    <span className="text-sm font-semibold text-blue-900">
                      {analytics.issue_breakdown.low}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full"
                      style={{
                        width: `${
                          (analytics.issue_breakdown.low /
                            (analytics.issue_breakdown.critical +
                              analytics.issue_breakdown.high +
                              analytics.issue_breakdown.medium +
                              analytics.issue_breakdown.low || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Framework Scores */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Scores by Framework
              </h3>
              {analytics.framework_scores.length > 0 ? (
                <div className="space-y-4">
                  {analytics.framework_scores.map((framework, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {framework.framework}
                        </span>
                        <span
                          className={`text-sm font-semibold ${
                            framework.score >= 80
                              ? 'text-green-600'
                              : framework.score >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {framework.score}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            framework.score >= 80
                              ? 'bg-green-500'
                              : framework.score >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${framework.score}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {framework.checks} checks run
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No framework data available
                </div>
              )}
            </div>

            {/* Average Resolution Time */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Average Resolution Time
              </h3>
              <div className="mb-6">
                <div className="text-4xl font-bold text-blue-600 mb-1">
                  {analytics.resolution_time.avg_hours.toFixed(1)}h
                </div>
                <div className="text-sm text-gray-600">Overall average</div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Critical</span>
                  <span className="text-sm font-semibold text-red-900">
                    {analytics.resolution_time.by_severity.critical.toFixed(1)}h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">High</span>
                  <span className="text-sm font-semibold text-orange-900">
                    {analytics.resolution_time.by_severity.high.toFixed(1)}h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Medium</span>
                  <span className="text-sm font-semibold text-yellow-900">
                    {analytics.resolution_time.by_severity.medium.toFixed(1)}h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Low</span>
                  <span className="text-sm font-semibold text-blue-900">
                    {analytics.resolution_time.by_severity.low.toFixed(1)}h
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Document Uploads Timeline */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Document Upload Activity
            </h3>
            {analytics.document_uploads.length > 0 ? (
              <div className="flex items-end gap-2 h-48">
                {analytics.document_uploads.map((upload, index) => {
                  const maxCount = Math.max(...analytics.document_uploads.map((u) => u.count));
                  const height = (upload.count / maxCount) * 100;

                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="flex-1 flex items-end w-full">
                        <div
                          className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition"
                          style={{ height: `${height}%` }}
                          title={`${upload.count} uploads`}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-2 text-center">
                        {new Date(upload.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No upload activity</div>
            )}
          </div>
      </div>
    </OrganizationLayout>
  );
}
