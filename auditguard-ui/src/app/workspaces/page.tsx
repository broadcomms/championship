'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { WorkspaceCard } from '@/components/workspaces/WorkspaceCard';
import { CreateWorkspaceDialog } from '@/components/workspaces/CreateWorkspaceDialog';
import { api } from '@/lib/api';
import { WorkspaceWithRole } from '@/types/workspace';

export default function WorkspacesPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const getErrorMessage = useCallback((err: unknown, fallback: string): string => {
    if (err instanceof Error) {
      return err.message || fallback;
    }
    if (err && typeof err === 'object' && 'error' in err) {
      return String((err as { error?: string }).error || fallback);
    }
    return fallback;
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.get<{ workspaces: WorkspaceWithRole[] }>('/api/workspaces');
      setWorkspaces(response.workspaces || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load workspaces'));
    } finally {
      setIsLoading(false);
    }
  }, [getErrorMessage]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleCreateSuccess = () => {
    fetchWorkspaces();
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Workspaces</h1>
            <p className="mt-2 text-sm text-gray-600">
              Welcome back, {user?.name}! Manage your compliance workspaces here.
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
            + Create Workspace
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-sm text-gray-600">Loading workspaces...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchWorkspaces} className="mt-3">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && workspaces.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto max-w-md">
              <div className="text-6xl">🏢</div>
              <h3 className="mt-6 text-lg font-medium text-gray-900">
                No Workspaces Yet
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Get started by creating your first workspace. Organize your compliance documents, team members, and stay on top of regulatory requirements.
              </p>
              <div className="mt-6">
                <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
                  Create Your First Workspace
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Workspaces Grid */}
        {!isLoading && !error && workspaces.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
        )}
      </div>

      {/* Create Workspace Dialog */}
      <CreateWorkspaceDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </AppLayout>
  );
}
