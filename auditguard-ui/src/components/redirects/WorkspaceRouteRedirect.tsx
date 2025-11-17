'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface WorkspaceRouteRedirectProps {
  subPath?: string;
}

export function WorkspaceRouteRedirect({ subPath = '' }: WorkspaceRouteRedirectProps) {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  useEffect(() => {
    const redirectToNewRoute = async () => {
      try {
        const workspace = await api.get(`/api/workspaces/${workspaceId}`);
        const orgId = workspace.organization_id || workspace.organizationId;

        if (orgId) {
          const newPath = `/org/${orgId}/workspace/${workspaceId}${subPath}`;
          router.replace(newPath);
        } else {
          // Fallback: redirect to organizations list
          router.replace('/organizations');
        }
      } catch (error) {
        console.error('Failed to redirect:', error);
        router.replace('/organizations');
      }
    };

    redirectToNewRoute();
  }, [workspaceId, subPath, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-4 text-sm text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
