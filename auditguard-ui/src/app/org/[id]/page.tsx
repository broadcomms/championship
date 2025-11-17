'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Organization {
  id: string;
  name: string;
  role: string;
  subscription_tier: string;
  created_at: number;
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  document_count: number;
}

interface OrganizationStats {
  total_workspaces: number;
  total_members: number;
  total_documents: number;
  total_compliance_checks: number;
  subscription_tier: string;
  uploads_used: number;
  uploads_limit: number;
  checks_used: number;
  checks_limit: number;
}

export default function OrganizationOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const accountId = user?.userId;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgRes, workspacesRes, statsRes] = await Promise.all([
          api.get(`/organizations/${orgId}`),
          api.get(`/organizations/${orgId}/workspaces`),
          api.get(`/organizations/${orgId}/stats`),
        ]);

        setOrganization(orgRes.data);
        setWorkspaces(workspacesRes.data);
        setStats(statsRes.data);
      } catch (error) {
        console.error('Failed to fetch organization data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId]);

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId}>
      <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {organization?.name}
            </h1>
            <p className="text-gray-600">
              Organization Overview · {organization?.subscription_tier} Plan
            </p>
          </div>

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm">Workspaces</span>
                  <span className="text-2xl">🏢</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {stats.total_workspaces}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm">Total Members</span>
                  <span className="text-2xl">👥</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {stats.total_members}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm">Documents</span>
                  <span className="text-2xl">📄</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {stats.total_documents}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm">Compliance Checks</span>
                  <span className="text-2xl">✓</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {stats.total_compliance_checks}
                </div>
              </div>
            </div>
          )}

          {/* Usage Metrics */}
          {stats && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Usage This Month
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Uploads */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Document Uploads</span>
                    <span className="text-sm font-medium text-gray-900">
                      {stats.uploads_used} / {stats.uploads_limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (stats.uploads_used / stats.uploads_limit) * 100 > 80
                          ? 'bg-red-600'
                          : 'bg-blue-600'
                      }`}
                      style={{
                        width: `${Math.min(
                          (stats.uploads_used / stats.uploads_limit) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Checks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Compliance Checks</span>
                    <span className="text-sm font-medium text-gray-900">
                      {stats.checks_used} / {stats.checks_limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (stats.checks_used / stats.checks_limit) * 100 > 80
                          ? 'bg-red-600'
                          : 'bg-green-600'
                      }`}
                      style={{
                        width: `${Math.min(
                          (stats.checks_used / stats.checks_limit) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Workspaces List */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Workspaces</h2>
              <Button
                onClick={() => router.push(`/org/${orgId}/workspace/new`)}
                size="sm"
              >
                + New Workspace
              </Button>
            </div>

            {workspaces.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">🏢</div>
                <p className="font-medium mb-2">No workspaces yet</p>
                <p className="text-sm mb-4">
                  Create your first workspace to get started
                </p>
                <Button onClick={() => router.push(`/org/${orgId}/workspace/new`)}>
                  Create Workspace
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition cursor-pointer"
                    onClick={() =>
                      router.push(`/org/${orgId}/workspace/${workspace.id}`)
                    }
                  >
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {workspace.name}
                    </h3>
                    {workspace.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {workspace.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>👥 {workspace.member_count} members</span>
                      <span>📄 {workspace.document_count} docs</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
    </OrganizationLayout>
  );
}
