'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function NewWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const accountId = user?.userId;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      // Note: api.post() returns data directly, not wrapped in .data property
      // Using blueprint pattern: /api/organizations/{orgId}/workspaces
      const newWorkspace = await api.post(`/api/organizations/${orgId}/workspaces`, {
        name: formData.name,
        description: formData.description,
      });

      // Navigate to the newly created workspace
      if (newWorkspace && newWorkspace.id) {
        router.push(`/org/${orgId}/workspace/${newWorkspace.id}`);
      } else {
        throw new Error('Workspace created but no ID returned');
      }
    } catch (err: any) {
      console.error('Failed to create workspace:', err);
      setError(err.error || 'Failed to create workspace. Please try again.');
      setCreating(false);
    }
  };

  const handleCancel = () => {
    router.push(`/org/${orgId}`);
  };

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId}>
      <div className="max-w-2xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create New Workspace
          </h1>
          <p className="text-gray-600">
            Workspaces help you organize documents and compliance checks
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Workspace Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Workspace Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., SOC 2 Compliance, HIPAA Documentation"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creating}
              />
              <p className="mt-1 text-xs text-gray-500">
                Choose a descriptive name for your workspace
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe the purpose of this workspace..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creating}
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Add more context about what this workspace is for
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !formData.name.trim()}>
              {creating ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-medium text-blue-900 mb-1">About Workspaces</h3>
              <p className="text-sm text-blue-800">
                Workspaces help you organize compliance work by project, framework, or team.
                You can invite members, upload documents, and run compliance checks within each workspace.
              </p>
            </div>
          </div>
        </div>
      </div>
    </OrganizationLayout>
  );
}
