'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { api } from '@/lib/api';
import { Workspace, WorkspaceWithRole } from '@/types/workspace';

const updateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
});

type UpdateWorkspaceForm = z.infer<typeof updateWorkspaceSchema>;

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<WorkspaceWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateWorkspaceForm>({
    resolver: zodResolver(updateWorkspaceSchema),
  });

  useEffect(() => {
    fetchWorkspace();
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<WorkspaceWithRole>(`/api/workspaces/${workspaceId}`);
      setWorkspace(data);
      reset({
        name: data.name,
        description: data.description || '',
      });
    } catch (err: any) {
      setError(err.error || 'Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UpdateWorkspaceForm) => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const updated = await api.put<Workspace>(
        `/api/workspaces/${workspaceId}`,
        data
      );
      // Preserve role and memberCount from existing workspace state
      setWorkspace({
        ...updated,
        role: workspace!.role,
        memberCount: workspace!.memberCount,
      });
      setSuccessMessage('Workspace updated successfully');
    } catch (err: any) {
      setError(err.error || 'Failed to update workspace');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      await api.delete(`/api/workspaces/${workspaceId}`);
      router.push('/workspaces');
    } catch (err: any) {
      setError(err.error || 'Failed to delete workspace');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading settings...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !workspace) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
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

  const canManage = workspace?.role === 'owner' || workspace?.role === 'admin';

  if (!canManage) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              You don't have permission to manage this workspace's settings.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/workspaces/${workspaceId}`)}
              className="mt-3"
            >
              Back to Workspace
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}`)}
              className="text-gray-400 hover:text-gray-600"
            >
              ←
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Workspace Settings</h1>
          </div>
        </div>

        {/* General Settings */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">General</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Workspace Name"
              placeholder="e.g., ACME Corp Compliance"
              error={errors.name?.message}
              {...register('name')}
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                placeholder="Brief description of this workspace..."
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...register('description')}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {successMessage && (
              <div className="rounded-md bg-green-50 p-3">
                <p className="text-sm text-green-800">{successMessage}</p>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" variant="primary" loading={isSaving}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>

        {/* Workspace Info */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Workspace Information</h2>
          <div className="space-y-3 text-sm">
            {workspace?.createdAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Created</span>
                <span className="font-medium text-gray-900">
                  {new Date(workspace.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated</span>
              <span className="font-medium text-gray-900">
                {workspace && new Date(workspace.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Your Role</span>
              <span className="font-medium text-gray-900">{workspace?.role}</span>
            </div>
          </div>
        </div>

        {/* Danger Zone - Only for owners */}
        {workspace?.role === 'owner' && (
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
            <h2 className="mb-2 text-lg font-semibold text-red-900">Danger Zone</h2>
            <p className="mb-4 text-sm text-red-700">
              Deleting a workspace is permanent and cannot be undone. All documents, members,
              and data will be lost.
            </p>

            {!showDeleteConfirm ? (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Workspace
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-red-900">
                  Are you sure? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    loading={isDeleting}
                    onClick={handleDelete}
                  >
                    Yes, Delete Forever
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
