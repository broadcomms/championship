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
  slug: string;
  owner_user_id: string;
  billing_email: string | null;
  stripe_customer_id: string | null;
  created_at: number;
  updated_at: number;
  member_count: number;
  workspace_count: number;
  subscription_plan: string | null;
  subscription_status: string | null;
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
        // Fetch organization data (includes subscription info)
        const orgRes = await api.get(`/api/organizations/${orgId}`).catch(err => {
          console.error('Failed to fetch organization:', err);
          return null;
        });

        // Backend wraps response in { data: ... }
        const orgData = orgRes?.data || orgRes;
        console.log('Organization data:', orgData);

        // Fetch workspaces
        const workspacesRes = await api.get(`/api/organizations/${orgId}/workspaces`).catch(err => {
          console.error('Failed to fetch workspaces:', err);
          return [];
        });

        const workspacesList = workspacesRes?.data || workspacesRes;
        console.log('Workspaces:', workspacesList);

        setOrganization(orgData || null);
        setWorkspaces(Array.isArray(workspacesList) ? workspacesList : []);

        // Fetch usage forecast to get accurate limits from backend
        if (orgData) {
          const forecast = await api.get(`/api/organizations/${orgId}/usage/forecast`).catch(err => {
            console.error('Failed to fetch usage forecast:', err);
            return null;
          });

          console.log('Usage forecast:', forecast);

          // Build stats with actual usage data from forecast
          setStats({
            total_workspaces: orgData.workspace_count || 0,
            total_members: orgData.member_count || 0,
            total_documents: forecast?.current_usage?.documents || 0,
            total_compliance_checks: forecast?.current_usage?.checks || 0,
            subscription_tier: orgData.subscription_plan || 'free',
            uploads_used: forecast?.current_usage?.documents || 0,
            uploads_limit: forecast?.plan_limits?.max_documents || 0,
            checks_used: forecast?.current_usage?.checks || 0,
            checks_limit: forecast?.plan_limits?.max_checks || 0,
          });
        }
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
          <div className="text-gray-500 justify-center">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId}>
      <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            {/* Trial Banner */}
            {organization?.subscription_status === 'trialing' && (
              <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <h3 className="font-semibold text-blue-900">
                        Your 14-Day Professional Trial is Active!
                      </h3>
                      <p className="text-sm text-blue-700">
                        Full access to all Professional features until December 6, 2025
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/org/${orgId}/billing`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Upgrade Now
                  </button>
                </div>
              </div>
            )}

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {organization?.name}
            </h1>
            <p className="text-gray-600">
              Organization Overview · {organization?.subscription_plan ? 
                organization.subscription_plan.charAt(0).toUpperCase() + organization.subscription_plan.slice(1) : 
                'Free'} Plan
              {organization?.subscription_status === 'trialing' && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  Trial Active
                </span>
              )}
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
