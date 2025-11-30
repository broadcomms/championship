'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';

interface Workspace {
  id: string;
  name: string;
  description: string;
  organization_id: string;
  created_at: number;
  updated_at: number;
  member_count?: number;
  document_count?: number;
}

const normalizeApiResponse = <T,>(response: T | { data: T }): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
};

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const responseErr = err as { response?: { data?: { message?: string } } };
    return responseErr.response?.data?.message || fallback;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: string }).message || fallback);
  }
  return fallback;
};

export default function WorkspaceSettingsPage() {
  const params = useParams<{ id: string; wsId: string }>();
  const router = useRouter();
  const orgId = params.id;
  const wsId = params.wsId;
  const { user } = useAuth();
  const accountId = user?.userId;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async (withLoader = false) => {
    if (!wsId) return;
    if (withLoader) {
      setLoading(true);
    }
    try {
      const response = await api.get<Workspace>(`/api/workspaces/${wsId}`);
      const data = normalizeApiResponse(response);
      setWorkspace(data);
      setName(data.name || '');
      setDescription(data.description || '');
      setError(null);
    } catch (fetchError) {
      console.error('Failed to fetch settings:', fetchError);
      setError(getApiErrorMessage(fetchError, 'Failed to load workspace settings'));
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => {
    fetchWorkspace(true);
  }, [fetchWorkspace]);

  const handleSave = async () => {
    if (!workspace) return;

    setSaving(true);
    try {
      const updates: { name?: string; description?: string } = {};
      if (name !== workspace.name) updates.name = name;
      if (description !== workspace.description) updates.description = description;

      await api.put(`/api/workspaces/${wsId}`, updates);
      alert('Settings saved successfully');
      await fetchWorkspace(); // Refresh data
    } catch (saveError) {
      console.error('Failed to save settings:', saveError);
      alert(getApiErrorMessage(saveError, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== workspace?.name) {
      alert('Please type the workspace name correctly to confirm deletion');
      return;
    }

    try {
      await api.delete(`/api/workspaces/${wsId}`);
      router.push(`/org/${orgId}`);
    } catch (deleteError) {
      console.error('Failed to delete workspace:', deleteError);
      alert(getApiErrorMessage(deleteError, 'Failed to delete workspace'));
    }
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

  if (!workspace) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-red-500">{error || 'Failed to load settings'}</div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Workspace Settings</h1>
          <p className="text-gray-600">
            Manage your workspace configuration
          </p>
        </div>

        {/* General Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">General</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workspace Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what this workspace is used for..."
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Workspace Info */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Workspace Information</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Workspace ID</div>
              <div className="font-mono text-gray-900">{workspace.id}</div>
            </div>
            <div>
              <div className="text-gray-600">Created</div>
              <div className="text-gray-900">
                {new Date(workspace.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
            {workspace.member_count !== undefined && (
              <div>
                <div className="text-gray-600">Members</div>
                <div className="text-gray-900">{workspace.member_count}</div>
              </div>
            )}
            {workspace.document_count !== undefined && (
              <div>
                <div className="text-gray-600">Documents</div>
                <div className="text-gray-900">{workspace.document_count}</div>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h2>
          <p className="text-sm text-red-800 mb-4">
            Once you delete a workspace, there is no going back. All documents, compliance
            checks, and issues will be permanently deleted.
          </p>
          <Button
            variant="outline"
            onClick={() => setShowDeleteModal(true)}
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            Delete Workspace
          </Button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-red-900">
                  Delete Workspace
                </h3>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ This action cannot be undone. All data will be permanently deleted.
                  </p>
                </div>

                <p className="text-sm text-gray-700">
                  Type <strong>{workspace.name}</strong> to confirm deletion:
                </p>

                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Enter workspace name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== workspace.name}
                  className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete Workspace
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </OrganizationLayout>
  );
}
