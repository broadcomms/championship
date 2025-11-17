'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_at: number;
}

interface WorkspaceStats {
  total_documents: number;
  recent_uploads: number;
  compliance_checks: number;
  open_issues: number;
  completion_rate: number;
}

interface RecentActivity {
  id: string;
  type: 'document' | 'compliance' | 'issue' | 'comment';
  title: string;
  description: string;
  user_email: string;
  timestamp: number;
}

interface QuickAction {
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
}

export default function WorkspaceDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const accountId = user?.userId;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [orgId, wsId]);

  const fetchData = async () => {
    try {
      const [workspaceRes, statsRes, activityRes] = await Promise.all([
        api.get(`/workspaces/${wsId}`),
        api.get(`/workspaces/${wsId}/stats`),
        api.get(`/workspaces/${wsId}/activity?limit=10`),
      ]);

      setWorkspace(workspaceRes.data);
      setStats(statsRes.data);
      setActivity(activityRes.data);
    } catch (error) {
      console.error('Failed to fetch workspace data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions: QuickAction[] = [
    {
      title: 'Upload Document',
      description: 'Add new documents for compliance checking',
      icon: '📤',
      href: `/org/${orgId}/workspace/${wsId}/documents/upload`,
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    },
    {
      title: 'Run Compliance Check',
      description: 'Check documents against frameworks',
      icon: '✓',
      href: `/org/${orgId}/workspace/${wsId}/compliance/run`,
      color: 'bg-green-50 border-green-200 hover:bg-green-100',
    },
    {
      title: 'View Issues',
      description: 'Manage compliance issues and tasks',
      icon: '📋',
      href: `/org/${orgId}/workspace/${wsId}/issues`,
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    },
    {
      title: 'AI Assistant',
      description: 'Ask questions about compliance',
      icon: '🤖',
      href: `/org/${orgId}/workspace/${wsId}/assistant`,
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'document':
        return '📄';
      case 'compliance':
        return '✓';
      case 'issue':
        return '📋';
      case 'comment':
        return '💬';
      default:
        return '•';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  if (!workspace || !stats) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-red-500">Failed to load workspace</div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {workspace.name}
            </h1>
            {workspace.description && (
              <p className="text-gray-600">{workspace.description}</p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Total Documents</span>
                <span className="text-2xl">📄</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.total_documents}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                +{stats.recent_uploads} this week
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Compliance Checks</span>
                <span className="text-2xl">✓</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.compliance_checks}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                All time
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Open Issues</span>
                <span className="text-2xl">📋</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.open_issues}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Requires attention
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Completion Rate</span>
                <span className="text-2xl">📊</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.completion_rate}%
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Issues resolved
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  onClick={() => router.push(action.href)}
                  className={`text-left p-6 rounded-lg border-2 transition ${action.color}`}
                >
                  <div className="text-3xl mb-3">{action.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Activity
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              {activity.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="font-medium mb-1">No activity yet</p>
                  <p className="text-sm">
                    Get started by uploading documents or running compliance checks
                  </p>
                </div>
              ) : (
                activity.map((item) => (
                  <div
                    key={item.id}
                    className="px-6 py-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl">{getActivityIcon(item.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 mb-1">
                          {item.title}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {item.description}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{item.user_email}</span>
                          <span>•</span>
                          <span>{formatTimestamp(item.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
      </div>
    </OrganizationLayout>
  );
}
