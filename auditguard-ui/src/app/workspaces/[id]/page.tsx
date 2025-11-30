'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface WorkspaceSummary {
  id: string;
  organization_id?: string;
  organizationId?: string;
}

interface OrganizationSummary {
  id: string;
}

export default function WorkspaceDashboardRedirect() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  useEffect(() => {
    // Fetch workspace to get organization ID, then redirect to new route structure
    const redirectToNewRoute = async () => {
      try {
        const workspace = await api.get<WorkspaceSummary>(`/api/workspaces/${workspaceId}`);
        const orgId = workspace.organization_id || workspace.organizationId;

        if (orgId) {
          // Redirect to new route structure
          router.replace(`/org/${orgId}/workspace/${workspaceId}`);
        } else {
          // If no org ID, try to get from organizations list
          const orgs = await api.get<OrganizationSummary[]>('/api/organizations');
          if (orgs && orgs.length > 0) {
            // Find the org that contains this workspace
            for (const org of orgs) {
              const workspaces = await api.get<WorkspaceSummary[]>(`/api/organizations/${org.id}/workspaces`);
              if (workspaces.some((ws) => ws.id === workspaceId)) {
                router.replace(`/org/${org.id}/workspace/${workspaceId}`);
                return;
              }
            }
          }

          // Fallback: redirect to organizations list
          router.replace('/organizations');
        }
      } catch (error) {
        console.error('Failed to redirect:', error);
        // Fallback: redirect to organizations list
        router.replace('/organizations');
      }
    };

    redirectToNewRoute();
  }, [workspaceId, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-4 text-sm text-gray-600">Redirecting to new workspace view...</p>
      </div>
    </div>
  );
}
