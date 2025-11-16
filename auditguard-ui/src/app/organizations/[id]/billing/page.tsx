'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { OrganizationSettings } from '@/types/organization';
import { AlertTriangle, TrendingUp, DollarSign, Calendar, AlertCircle } from 'lucide-react';

interface UsageData {
  organization_id: string;
  period: string;
  start_date: string;
  end_date: string;
  total_documents: number;
  total_checks: number;
  total_messages: number;
  total_api_calls: number;
  total_storage_bytes: number;
  by_workspace: Array<{
    workspace_id: string;
    workspace_name: string;
    documents: number;
    checks: number;
    messages: number;
    storage_bytes: number;
    percentage_of_total: number;
  }>;
}

interface ForecastData {
  organization_id: string;
  current_date: string;
  end_of_month_date: string;
  days_remaining: number;
  plan_limits: {
    max_documents: number;
    max_checks: number;
    max_messages: number;
    max_storage_gb: number;
  };
  current_usage: {
    documents: number;
    checks: number;
    messages: number;
    storage_bytes: number;
  };
  projected_usage: {
    documents: number;
    checks: number;
    messages: number;
    storage_bytes: number;
  };
  usage_percentages: {
    documents: number;
    checks: number;
    messages: number;
    storage: number;
  };
  alerts: Array<{
    metric: string;
    current: number;
    projected: number;
    limit: number;
    percentage: number;
    severity: 'info' | 'warning' | 'critical';
    message: string;
  }>;
}

export default function OrganizationBillingPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;

  const [organization, setOrganization] = useState<OrganizationSettings | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'current' | 'last30days' | 'all-time'>('current');

  useEffect(() => {
    fetchData();
  }, [organizationId, period]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [orgData, usageData, forecastData] = await Promise.all([
        api.get<OrganizationSettings>(`/api/organizations/${organizationId}/settings`),
        api.get<UsageData>(`/api/organizations/${organizationId}/usage?period=${period}`),
        api.get<ForecastData>(`/api/organizations/${organizationId}/usage/forecast`),
      ]);
      setOrganization(orgData);
      setUsage(usageData);
      setForecast(forecastData);
    } catch (err: any) {
      setError(err.error || 'Failed to load billing data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 70) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading billing data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !organization) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="mt-3"
            >
              Go Back
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-600"
            >
              ←
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Organization Billing</h1>
          </div>

          {/* Plan Info Card */}
          <div className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm opacity-90">Current Plan</div>
                <div className="text-2xl font-bold mt-1">
                  {organization?.subscription_plan || 'Free'}
                </div>
              </div>
              <div>
                <div className="text-sm opacity-90">Status</div>
                <div className="text-lg font-semibold mt-1 capitalize">
                  {organization?.subscription_status || 'N/A'}
                </div>
              </div>
              <div className="flex items-end justify-end">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/organizations/${organizationId}/settings`)}
                  className="bg-white text-blue-600 hover:bg-blue-50"
                >
                  Manage Plan
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Forecast Alerts */}
        {forecast && forecast.alerts.length > 0 && (
          <div className="mb-6 space-y-3">
            {forecast.alerts.map((alert, index) => (
              <div
                key={index}
                className={`rounded-lg border p-4 ${
                  alert.severity === 'critical'
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                      alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                    }`}
                  />
                  <div className="flex-1">
                    <h3
                      className={`text-sm font-semibold ${
                        alert.severity === 'critical' ? 'text-red-900' : 'text-yellow-900'
                      }`}
                    >
                      {alert.severity === 'critical' ? 'Critical' : 'Warning'}: {alert.metric.toUpperCase()} Usage Alert
                    </h3>
                    <p
                      className={`mt-1 text-sm ${
                        alert.severity === 'critical' ? 'text-red-800' : 'text-yellow-800'
                      }`}
                    >
                      {alert.message}
                    </p>
                    <div className="mt-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => router.push('/pricing')}
                      >
                        Upgrade Plan
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Period Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('current')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                period === 'current'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Current Month
            </button>
            <button
              onClick={() => setPeriod('last30days')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                period === 'last30days'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setPeriod('all-time')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                period === 'all-time'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Usage Metrics */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            Usage This Month
            {usage && (
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({new Date(usage.start_date).toLocaleDateString()} - {new Date(usage.end_date).toLocaleDateString()})
              </span>
            )}
          </h2>

          <div className="space-y-6">
            {/* Documents */}
            {forecast && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Documents</span>
                  <span className="text-sm text-gray-600">
                    {formatNumber(forecast.current_usage.documents)} /{' '}
                    {forecast.plan_limits.max_documents === -1
                      ? 'Unlimited'
                      : formatNumber(forecast.plan_limits.max_documents)}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full transition-all duration-300 ${getProgressColor(forecast.usage_percentages.documents)}`}
                    style={{ width: `${Math.min(forecast.usage_percentages.documents, 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>{forecast.usage_percentages.documents}% used</span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Projected: {formatNumber(forecast.projected_usage.documents)}
                  </span>
                </div>
              </div>
            )}

            {/* Compliance Checks */}
            {forecast && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Compliance Checks</span>
                  <span className="text-sm text-gray-600">
                    {formatNumber(forecast.current_usage.checks)} /{' '}
                    {forecast.plan_limits.max_checks === -1
                      ? 'Unlimited'
                      : formatNumber(forecast.plan_limits.max_checks)}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full transition-all duration-300 ${getProgressColor(forecast.usage_percentages.checks)}`}
                    style={{ width: `${Math.min(forecast.usage_percentages.checks, 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>{forecast.usage_percentages.checks}% used</span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Projected: {formatNumber(forecast.projected_usage.checks)}
                  </span>
                </div>
              </div>
            )}

            {/* AI Messages */}
            {forecast && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">AI Messages</span>
                  <span className="text-sm text-gray-600">
                    {formatNumber(forecast.current_usage.messages)} /{' '}
                    {forecast.plan_limits.max_messages === -1
                      ? 'Unlimited'
                      : formatNumber(forecast.plan_limits.max_messages)}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full transition-all duration-300 ${getProgressColor(forecast.usage_percentages.messages)}`}
                    style={{ width: `${Math.min(forecast.usage_percentages.messages, 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>{forecast.usage_percentages.messages}% used</span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Projected: {formatNumber(forecast.projected_usage.messages)}
                  </span>
                </div>
              </div>
            )}

            {/* Storage */}
            {forecast && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Storage</span>
                  <span className="text-sm text-gray-600">
                    {formatBytes(forecast.current_usage.storage_bytes)} /{' '}
                    {forecast.plan_limits.max_storage_gb === -1
                      ? 'Unlimited'
                      : `${forecast.plan_limits.max_storage_gb} GB`}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full transition-all duration-300 ${getProgressColor(forecast.usage_percentages.storage)}`}
                    style={{ width: `${Math.min(forecast.usage_percentages.storage, 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>{forecast.usage_percentages.storage}% used</span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Projected: {formatBytes(forecast.projected_usage.storage_bytes)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Usage by Workspace */}
        {usage && usage.by_workspace.length > 0 && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Usage by Workspace</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Workspace
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      Documents
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      Checks
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      Storage
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usage.by_workspace
                    .sort((a, b) => b.storage_bytes - a.storage_bytes)
                    .map((workspace) => (
                      <tr key={workspace.workspace_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {workspace.workspace_name}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {formatNumber(workspace.documents)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {formatNumber(workspace.checks)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {formatBytes(workspace.storage_bytes)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {workspace.percentage_of_total}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push(`/organizations/${organizationId}/settings`)}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left hover:bg-gray-50"
          >
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div>
              <div className="font-medium text-gray-900">Manage Subscription</div>
              <div className="text-sm text-gray-600">Update plan or payment method</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/pricing')}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left hover:bg-gray-50"
          >
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <div className="font-medium text-gray-900">Upgrade Plan</div>
              <div className="text-sm text-gray-600">View pricing and features</div>
            </div>
          </button>

          <button
            onClick={() => router.push(`/organizations/${organizationId}/members`)}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left hover:bg-gray-50"
          >
            <Calendar className="h-8 w-8 text-purple-600" />
            <div>
              <div className="font-medium text-gray-900">Team Management</div>
              <div className="text-sm text-gray-600">Add or remove team members</div>
            </div>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
