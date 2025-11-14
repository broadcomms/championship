'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { WorkspaceWithRole } from '@/types/workspace';

interface WorkspaceStats {
  documents: number;
  members: number;
  lastActivity: string;
}

export default function WorkspaceDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<WorkspaceWithRole | null>(null);
  const [stats, setStats] = useState<WorkspaceStats>({
    documents: 0,
    members: 0,
    lastActivity: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWorkspace();
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [workspaceData, membersResponse, statsResponse] = await Promise.all([
        api.get<WorkspaceWithRole>(`/api/workspaces/${workspaceId}`),
        api.get<{ members: any[] }>(`/api/workspaces/${workspaceId}/members`),
        api.get<{ totalDocuments: number; totalChecks: number; totalIssues: number; averageScore: number; storageUsed: number }>(`/api/workspaces/${workspaceId}/stats`),
      ]);
      setWorkspace(workspaceData);

      // Update stats with actual data
      setStats({
        documents: statsResponse.totalDocuments || 0,
        members: membersResponse.members?.length || 0,
        lastActivity: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.error || 'Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading workspace...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !workspace) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error || 'Workspace not found'}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/workspaces')}
              className="mt-3"
            >
              Back to Workspaces
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const canManage = workspace.role === 'owner' || workspace.role === 'admin';

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Workspace Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/workspaces')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ←
                </button>
                <h1 className="text-3xl font-bold text-gray-900">{workspace.name}</h1>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                  {workspace.role}
                </span>
              </div>
              {workspace.description && (
                <p className="mt-2 text-sm text-gray-600">{workspace.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              {canManage && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/workspaces/${workspaceId}/settings`)}
                >
                  Settings
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => router.push(`/workspaces/${workspaceId}/members`)}
              >
                Members
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Documents</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.documents}</p>
              </div>
              <div className="text-4xl">📄</div>
            </div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Members</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.members}</p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Last Activity</p>
                <p className="mt-2 text-sm font-medium text-gray-900">
                  {new Date(stats.lastActivity).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="text-4xl">⏱️</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}/documents`)}
              className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="mb-2 text-2xl">📄</div>
              <h3 className="font-medium text-gray-900">Documents</h3>
              <p className="mt-1 text-xs text-gray-600">View and manage compliance documents</p>
            </button>
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}/billing`)}
              className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-green-300 hover:bg-green-50"
            >
              <div className="mb-2 text-2xl">💳</div>
              <h3 className="font-medium text-gray-900">Billing & Plans</h3>
              <p className="mt-1 text-xs text-gray-600">Manage subscription and usage</p>
            </button>
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}/compliance`)}
              className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="mb-2 text-2xl">✓</div>
              <h3 className="font-medium text-gray-900">Compliance Checks</h3>
              <p className="mt-1 text-xs text-gray-600">Analyze documents for compliance</p>
            </button>
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}/analytics`)}
              className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="mb-2 text-2xl">📊</div>
              <h3 className="font-medium text-gray-900">Analytics</h3>
              <p className="mt-1 text-xs text-gray-600">View compliance reports</p>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Recent Activity</h2>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="text-center py-8">
              <div className="text-4xl">📋</div>
              <p className="mt-4 text-sm text-gray-600">No recent activity</p>
              <p className="mt-1 text-xs text-gray-500">
                Activity will appear here as you and your team work in this workspace
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
