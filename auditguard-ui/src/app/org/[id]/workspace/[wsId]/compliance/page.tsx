"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ComplianceCheckListItem } from '@/types';

const POLL_INTERVAL_MS = 10_000;

type FilterStatus = 'all' | 'pending' | 'running' | 'completed' | 'failed';

interface ComplianceChecksResponse {
  checks: ComplianceCheckListItem[];
}

const normalizeApiResponse = <T,>(response: T | { data: T }): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response;
};

const getApiErrorMessage = (err: unknown): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    return typeof message === 'string' && message.trim()
      ? message
      : 'Failed to load compliance checks';
  }
  return 'Failed to load compliance checks';
};

const getStatusColor = (status: ComplianceCheckListItem['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'running':
    case 'processing':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const formatTimestamp = (timestamp: number | null | undefined) => {
  if (!timestamp) {
    return 'N/A';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getDuration = (start: number, end: number) => {
  const durationMs = Math.max(0, end - start);
  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${seconds || 0}s`;
};

export default function WorkspaceCompliancePage() {
  const params = useParams<{ id: string; wsId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params?.id;
  const wsId = params?.wsId;
  const accountId = user?.userId;

  const [checks, setChecks] = useState<ComplianceCheckListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterFramework, setFilterFramework] = useState('all');

  const fetchChecks = useCallback(
    async (withLoader = false) => {
      if (!wsId) return;
      if (withLoader) {
        setLoading(true);
      }

      try {
        const response = await api.get<ComplianceChecksResponse>(
          `/api/workspaces/${wsId}/compliance`
        );
        const data = normalizeApiResponse(response);
        setChecks(data.checks);
        setError(null);
      } catch (fetchError) {
        console.error('Failed to fetch compliance checks:', fetchError);
        setError(getApiErrorMessage(fetchError));
      } finally {
        setLoading(false);
      }
    },
    [wsId]
  );

  useEffect(() => {
    if (!wsId) {
      setLoading(false);
      return;
    }

    fetchChecks(true);
    const interval = setInterval(() => {
      fetchChecks();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchChecks, wsId]);

  const filteredChecks = useMemo(() => {
    return checks.filter((check) => {
      const matchesStatus =
        filterStatus === 'all' ||
        check.status === filterStatus ||
        (filterStatus === 'running' && check.status === 'processing');
      const matchesFramework = filterFramework === 'all' || check.framework === filterFramework;
      return matchesStatus && matchesFramework;
    });
  }, [checks, filterFramework, filterStatus]);

  const frameworks = useMemo(() => {
    return Array.from(new Set(checks.map((c) => c.framework))).filter(Boolean);
  }, [checks]);

  const stats = useMemo(() => {
    const scoredChecks = checks.filter((c) => typeof c.overallScore === 'number' && c.overallScore !== null);
    const totalScore = scoredChecks.reduce((sum, c) => sum + (c.overallScore ?? 0), 0);
    return {
      total: checks.length,
      completed: checks.filter((c) => c.status === 'completed').length,
      running: checks.filter((c) => c.status === 'processing' || c.status === 'running').length,
      avgScore: scoredChecks.length ? totalScore / scoredChecks.length : 0,
    };
  }, [checks]);

  const handleViewResults = useCallback(
    (checkId: string) => {
      if (!orgId || !wsId) {
        return;
      }
      router.push(`/org/${orgId}/workspace/${wsId}/compliance/${checkId}`);
    },
    [orgId, router, wsId]
  );

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  if (error) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load checks</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => fetchChecks(true)}>Retry</Button>
          </div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Compliance Checks</h1>
            <p className="text-gray-600">View compliance check history and results</p>
          </div>
          <Button onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance/run`)}>
            ✓ Run New Check
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Total Checks</span>
              <span className="text-2xl">📊</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Completed</span>
              <span className="text-2xl">✓</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Running</span>
              <span className="text-2xl">⚙️</span>
            </div>
            <div className="text-3xl font-bold text-blue-600">{stats.running}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Avg Score</span>
              <span className="text-2xl">🎯</span>
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(stats.avgScore)}`}>
              {stats.avgScore > 0 ? `${Math.round(stats.avgScore)}%` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as FilterStatus)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="running">Running</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Framework Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Framework</label>
              <select
                value={filterFramework}
                onChange={(e) => setFilterFramework(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Frameworks</option>
                {frameworks.map((framework) => (
                  <option key={framework} value={framework}>
                    {framework}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Checks List */}
        {filteredChecks.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">✓</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {checks.length === 0 ? 'No compliance checks yet' : 'No matching checks'}
            </h3>
            <p className="text-gray-600 mb-6">
              {checks.length === 0
                ? 'Run your first compliance check to start monitoring document compliance'
                : 'Try adjusting your filters'}
            </p>
            {checks.length === 0 && (
              <Button onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance/run`)}>
                ✓ Run Compliance Check
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            {filteredChecks.map((check) => (
              <div key={check.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 text-lg">{check.framework}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                          check.status
                        )}`}
                      >
                        {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>📄 {check.documentName}</span>
                    </div>
                  </div>

                  {check.status === 'completed' && check.overallScore !== null && (
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${getScoreColor(check.overallScore)}`}>
                        {check.overallScore}%
                      </div>
                      <div className="text-xs text-gray-500">Compliance Score</div>
                    </div>
                  )}
                </div>

                {/* Issues Summary */}
                {check.status === 'completed' && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Issues Found:</span>
                      <span className="text-lg font-bold text-gray-900">{check.issuesFound}</span>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center gap-3">
                      <span>{formatTimestamp(check.createdAt)}</span>
                      {check.completedAt && (
                        <>
                          <span>•</span>
                          <span>Duration: {getDuration(check.createdAt, check.completedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {check.status === 'completed' && (
                    <Button variant="outline" onClick={() => handleViewResults(check.id)}>
                      View Results
                    </Button>
                  )}

                  {check.status === 'processing' && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <div className="animate-spin">⚙️</div>
                      <span className="text-sm font-medium">Processing...</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help Section */}
        {checks.length > 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Understanding Compliance Checks</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Compliance checks analyze documents against specific framework requirements</li>
              <li>• Scores represent the percentage of requirements met</li>
              <li>• Issues are automatically categorized by severity (Critical, High, Medium, Low)</li>
              <li>• You can view detailed results and recommendations for each check</li>
            </ul>
          </div>
        )}
      </div>
    </OrganizationLayout>
  );
}
