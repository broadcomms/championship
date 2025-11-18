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
  documentName: string;
  framework: string;
  status: string;
  overallScore: number | null;
  issuesFound: number;
  createdAt: number;
  completedAt: number | null;
}

export default function WorkspaceCompliancePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const accountId = user?.userId;

  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all');
  const [filterFramework, setFilterFramework] = useState<string>('all');

  useEffect(() => {
    fetchChecks();
    const interval = setInterval(fetchChecks, 10000); // Poll every 10 seconds for running checks
    return () => clearInterval(interval);
  }, [wsId]);

  const fetchChecks = async () => {
    try {
      const response = await api.get(`/api/workspaces/${wsId}/compliance`);
      setChecks(response.checks);
    } catch (error) {
      console.error('Failed to fetch compliance checks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = (checkId: string) => {
    router.push(`/org/${orgId}/workspace/${wsId}/compliance/${checkId}`);
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

  const getDuration = (startTime: number, endTime?: number) => {
    const end = endTime || Date.now();
    const seconds = Math.floor((end - startTime) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'running':
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

  const filteredChecks = checks.filter((check) => {
    const matchesStatus = filterStatus === 'all' || check.status === filterStatus;
    const matchesFramework = filterFramework === 'all' || check.framework === filterFramework;
    return matchesStatus && matchesFramework;
  });

  const frameworks = Array.from(new Set(checks.map((c) => c.framework)));

  const stats = {
    total: checks.length,
    completed: checks.filter((c) => c.status === 'completed').length,
    running: checks.filter((c) => c.status === 'processing').length,
    avgScore: checks.filter((c) => c.overallScore !== null).reduce((sum, c) => sum + (c.overallScore || 0), 0) / checks.filter((c) => c.overallScore !== null).length || 0,
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

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Compliance Checks</h1>
              <p className="text-gray-600">
                View compliance check history and results
              </p>
            </div>
            <Button
              onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance/run`)}
            >
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Framework
                </label>
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
                <Button
                  onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance/run`)}
                >
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
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {check.framework}
                        </h3>
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
                            <span>
                              Duration: {getDuration(check.createdAt, check.completedAt)}
                            </span>
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
              <h3 className="font-semibold text-blue-900 mb-2">
                💡 Understanding Compliance Checks
              </h3>
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
