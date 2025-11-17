'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { MultiLevelSidebar } from '@/components/sidebar/MultiLevelSidebar';
import { api } from '@/lib/api';

interface UsageData {
  uploads: {
    current: number;
    limit: number;
    percentage: number;
    history: Array<{ date: string; count: number }>;
  };
  checks: {
    current: number;
    limit: number;
    percentage: number;
    history: Array<{ date: string; count: number }>;
  };
  period_start: number;
  period_end: number;
}

interface WorkspaceUsage {
  workspace_id: string;
  workspace_name: string;
  uploads: number;
  checks: number;
  members: number;
  documents: number;
}

export default function OrganizationUsagePage() {
  const params = useParams();
  const orgId = params.id as string;

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [workspaceUsage, setWorkspaceUsage] = useState<WorkspaceUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchData();
  }, [orgId, timeRange]);

  const fetchData = async () => {
    try {
      const [usageRes, workspacesRes] = await Promise.all([
        api.get(`/organizations/${orgId}/usage?range=${timeRange}`),
        api.get(`/organizations/${orgId}/workspace-usage`),
      ]);

      setUsage(usageRes.data);
      setWorkspaceUsage(workspacesRes.data);
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <MultiLevelSidebar currentOrgId={orgId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="flex h-screen">
        <MultiLevelSidebar currentOrgId={orgId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500">Failed to load usage data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <MultiLevelSidebar currentOrgId={orgId} />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Usage Analytics
              </h1>
              <p className="text-gray-600">
                Monitor document uploads and compliance checks across your organization
              </p>
            </div>

            {/* Time Range Selector */}
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                    timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
                </button>
              ))}
            </div>
          </div>

          {/* Current Period Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Current Billing Period
              </h2>
              <span className="text-sm text-gray-600">
                {new Date(usage.period_start).toLocaleDateString()} -{' '}
                {new Date(usage.period_end).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Document Uploads */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Document Uploads
                  </span>
                  <span className="text-sm text-gray-900 font-semibold">
                    {usage.uploads.current} / {usage.uploads.limit === -1 ? '∞' : usage.uploads.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      usage.uploads.percentage > 90
                        ? 'bg-red-600'
                        : usage.uploads.percentage > 75
                        ? 'bg-yellow-600'
                        : 'bg-blue-600'
                    }`}
                    style={{
                      width: `${Math.min(usage.uploads.percentage, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    {usage.uploads.percentage.toFixed(1)}% used
                  </span>
                  {usage.uploads.percentage > 75 && (
                    <span className="text-red-600 font-medium">
                      ⚠️ Approaching limit
                    </span>
                  )}
                </div>
              </div>

              {/* Compliance Checks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Compliance Checks
                  </span>
                  <span className="text-sm text-gray-900 font-semibold">
                    {usage.checks.current} / {usage.checks.limit === -1 ? '∞' : usage.checks.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      usage.checks.percentage > 90
                        ? 'bg-red-600'
                        : usage.checks.percentage > 75
                        ? 'bg-yellow-600'
                        : 'bg-green-600'
                    }`}
                    style={{
                      width: `${Math.min(usage.checks.percentage, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    {usage.checks.percentage.toFixed(1)}% used
                  </span>
                  {usage.checks.percentage > 75 && (
                    <span className="text-red-600 font-medium">
                      ⚠️ Approaching limit
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Usage Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Uploads Trend */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Upload Trend
              </h3>
              <div className="space-y-2">
                {usage.uploads.history.slice(-10).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-20">
                      {new Date(item.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 bg-blue-600 rounded-full"
                          style={{
                            width: `${
                              (item.count / Math.max(...usage.uploads.history.map((h) => h.count))) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-900 w-8 text-right">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Checks Trend */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Compliance Checks Trend
              </h3>
              <div className="space-y-2">
                {usage.checks.history.slice(-10).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-20">
                      {new Date(item.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 bg-green-600 rounded-full"
                          style={{
                            width: `${
                              (item.count / Math.max(...usage.checks.history.map((h) => h.count))) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-900 w-8 text-right">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Workspace Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Usage by Workspace
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workspace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documents
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Checks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Members
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workspaceUsage.map((workspace) => (
                    <tr key={workspace.workspace_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {workspace.workspace_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workspace.documents}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workspace.uploads}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workspace.checks}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workspace.members}
                      </td>
                    </tr>
                  ))}
                  {workspaceUsage.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        No workspace data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
