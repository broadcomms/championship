'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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
  messages: {
    current: number;
    limit: number;
    percentage: number;
    history: Array<{ date: string; count: number }>;
  };
  storage: {
    current_bytes: number;
    limit_gb: number;
    percentage: number;
    current_gb: number;
  };
  period_start: number;
  period_end: number;
}

interface WorkspaceUsage {
  workspace_id: string;
  workspace_name: string;
  uploads: number;
  checks: number;
  messages: number;
  storage_bytes: number;
  members: number;
  documents: number;
}

export default function OrganizationUsagePage() {
  const params = useParams();
  const { user } = useAuth();
  const orgId = params.id as string;
  const accountId = user?.userId;

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [workspaceUsage, setWorkspaceUsage] = useState<WorkspaceUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'current' | 'last30days' | 'all-time'>('current');

  useEffect(() => {
    fetchData();
  }, [orgId, timeRange]);

  const fetchData = async () => {
    try {
      // Fetch usage data and plan limits
      const [usageRes, workspaces, forecast] = await Promise.all([
        api.get(`/api/organizations/${orgId}/usage?period=${timeRange}`),
        api.get(`/api/organizations/${orgId}/workspaces`),
        api.get(`/api/organizations/${orgId}/usage/forecast`).catch(() => null),
      ]);

      // Get actual limits from forecast API (uses subscription plan limits)
      const limits = forecast?.plan_limits || {
        max_documents: 0,
        max_checks: 0,
        max_messages: 0,
        max_storage_gb: 0,
      };

      console.log('Usage data:', usageRes);
      console.log('Plan limits from forecast:', limits);

      // Map backend data structure to frontend expected format
      const mappedUsage: UsageData = {
        uploads: {
          current: usageRes?.total_documents || 0,
          limit: limits.max_documents,
          percentage: limits.max_documents > 0 ? ((usageRes?.total_documents || 0) / limits.max_documents) * 100 : 0,
          history: [],
        },
        checks: {
          current: usageRes?.total_checks || 0,
          limit: limits.max_checks,
          percentage: limits.max_checks > 0 ? ((usageRes?.total_checks || 0) / limits.max_checks) * 100 : 0,
          history: [],
        },
        messages: {
          current: usageRes?.total_messages || 0,
          limit: limits.max_messages,
          percentage: limits.max_messages > 0 ? ((usageRes?.total_messages || 0) / limits.max_messages) * 100 : 0,
          history: [],
        },
        storage: {
          current_bytes: usageRes?.total_storage_bytes || 0,
          limit_gb: limits.max_storage_gb,
          percentage: limits.max_storage_gb > 0 ? ((usageRes?.total_storage_bytes || 0) / (limits.max_storage_gb * 1024 * 1024 * 1024)) * 100 : 0,
          current_gb: (usageRes?.total_storage_bytes || 0) / (1024 * 1024 * 1024),
        },
        period_start: usageRes?.start_date ? new Date(usageRes.start_date).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000,
        period_end: usageRes?.end_date ? new Date(usageRes.end_date).getTime() : Date.now(),
      };

      setUsage(mappedUsage);

      // Map workspace data - backend returns by_workspace array
      const mappedWorkspaces = (usageRes?.by_workspace || []).map((ws: any) => ({
        workspace_id: ws.workspace_id,
        workspace_name: ws.workspace_name,
        uploads: ws.documents || 0,
        checks: ws.checks || 0,
        messages: ws.messages || 0,
        storage_bytes: ws.storage_bytes || 0,
        members: 0, // Not included in usage response
        documents: ws.documents || 0,
      }));

      setWorkspaceUsage(mappedWorkspaces);
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
      // Set safe defaults (no limits)
      setUsage({
        uploads: {
          current: 0,
          limit: 0,
          percentage: 0,
          history: [],
        },
        checks: {
          current: 0,
          limit: 0,
          percentage: 0,
          history: [],
        },
        messages: {
          current: 0,
          limit: 0,
          percentage: 0,
          history: [],
        },
        storage: {
          current_bytes: 0,
          limit_gb: 0,
          percentage: 0,
          current_gb: 0,
        },
        period_start: Date.now() - 30 * 24 * 60 * 60 * 1000,
        period_end: Date.now(),
      });
      setWorkspaceUsage([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  if (!usage) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-red-500">Failed to load usage data</div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId}>
      <div className="p-8">
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
              {(['current', 'last30days', 'all-time'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                    timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {range === 'current' ? 'Current Period' : range === 'last30days' ? 'Last 30 Days' : 'All Time'}
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

              {/* AI Messages */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    AI Messages
                  </span>
                  <span className="text-sm text-gray-900 font-semibold">
                    {usage.messages.current} / {usage.messages.limit === -1 ? '∞' : usage.messages.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      usage.messages.percentage > 90
                        ? 'bg-red-600'
                        : usage.messages.percentage > 75
                        ? 'bg-yellow-600'
                        : 'bg-purple-600'
                    }`}
                    style={{
                      width: `${Math.min(usage.messages.percentage, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    {usage.messages.percentage.toFixed(1)}% used
                  </span>
                  {usage.messages.percentage > 75 && (
                    <span className="text-red-600 font-medium">
                      ⚠️ Approaching limit
                    </span>
                  )}
                </div>
              </div>

              {/* Storage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Storage
                  </span>
                  <span className="text-sm text-gray-900 font-semibold">
                    {usage.storage.current_gb.toFixed(2)} GB / {usage.storage.limit_gb === -1 ? '∞' : usage.storage.limit_gb} GB
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      usage.storage.percentage > 90
                        ? 'bg-red-600'
                        : usage.storage.percentage > 75
                        ? 'bg-yellow-600'
                        : 'bg-indigo-600'
                    }`}
                    style={{
                      width: `${Math.min(usage.storage.percentage, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    {usage.storage.percentage.toFixed(1)}% used
                  </span>
                  {usage.storage.percentage > 75 && (
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
                      AI Messages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Storage
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
                        {workspace.messages}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(workspace.storage_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workspace.members}
                      </td>
                    </tr>
                  ))}
                  {workspaceUsage.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
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
    </OrganizationLayout>
  );
}
