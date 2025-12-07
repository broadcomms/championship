'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { OrganizationSettings, UpdateOrganizationInput } from '@/types/organization';
import { AlertTriangle, Settings as SettingsIcon, Save } from 'lucide-react';

const getApiErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'error' in error) {
    return String(error.error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An error occurred';
};

export default function OrganizationSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const accountId = user?.userId;

  const [organization, setOrganization] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    billing_email: '',
  });

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [cancelSubscription, setCancelSubscription] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isOwner = organization?.owner_user_id === user?.userId;

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const data = await api.get<OrganizationSettings>(`/api/organizations/${orgId}`);
        setOrganization(data);
        setFormData({
          name: data.name,
          slug: data.slug,
          billing_email: data.billing_email || '',
        });
      } catch (err) {
        console.error('Failed to fetch organization:', err);
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [orgId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const updates: UpdateOrganizationInput = {};

      if (formData.name !== organization?.name) {
        updates.name = formData.name;
      }
      if (formData.slug !== organization?.slug) {
        updates.slug = formData.slug;
      }
      if (formData.billing_email !== (organization?.billing_email || '')) {
        updates.billing_email = formData.billing_email || undefined;
      }

      if (Object.keys(updates).length === 0) {
        setSuccess('No changes to save');
        return;
      }

      const updated = await api.patch<OrganizationSettings>(
        `/api/organizations/${orgId}`,
        updates
      );

      setOrganization(updated);
      setSuccess('Organization settings updated successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to update organization:', err);
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!organization) return;

    if (deleteConfirmText !== organization.name) {
      setDeleteError('Organization name does not match');
      return;
    }

    setDeleting(true);
    setDeleteError('');

    try {
      await api.delete(`/api/organizations/${orgId}`, {
        confirmText: organization.name,
        cancelSubscription,
      });

      // Redirect to organizations list after successful deletion
      router.push('/organizations');
    } catch (err) {
      console.error('Failed to delete organization:', err);
      setDeleteError(getApiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  if (!organization) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-red-600">Organization not found</div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId}>
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
              <SettingsIcon className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage your organization details and preferences
              </p>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* General Settings */}
        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">General Information</h2>

          <div className="space-y-6">
            {/* Organization Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving || !isOwner}
              />
              <p className="mt-1 text-xs text-gray-500">
                The display name for your organization
              </p>
            </div>

            {/* Organization Slug */}
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
                Organization Slug <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="slug"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                pattern="[a-z0-9-]+"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                disabled={saving || !isOwner}
              />
              <p className="mt-1 text-xs text-gray-500">
                URL-friendly identifier (lowercase letters, numbers, and hyphens only)
              </p>
            </div>

            {/* Billing Email */}
            <div>
              <label htmlFor="billing_email" className="block text-sm font-medium text-gray-700 mb-2">
                Billing Email
              </label>
              <input
                type="email"
                id="billing_email"
                value={formData.billing_email}
                onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving || !isOwner}
              />
              <p className="mt-1 text-xs text-gray-500">
                Email address for billing notifications and invoices
              </p>
            </div>
          </div>

          {/* Save Button */}
          {isOwner && (
            <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}

          {!isOwner && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Only the organization owner can modify these settings.
              </p>
            </div>
          )}
        </form>

        {/* Danger Zone */}
        {isOwner && (
          <div className="bg-red-50 rounded-lg border-2 border-red-200 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-red-900 mb-1">Danger Zone</h2>
                <p className="text-sm text-red-800">
                  Irreversible actions that will permanently delete your organization and all associated data.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-red-300 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Delete Organization</h3>
                  <p className="text-sm text-gray-600">
                    Permanently delete this organization, all workspaces, documents, and compliance data.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(true)}
                  className="ml-4 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
                >
                  Delete Organization
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Organization</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    This action cannot be undone. This will permanently delete the organization and remove all data.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-800">{deleteError}</p>
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  The following will be permanently deleted:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li>{organization?.workspace_count || 0} workspace(s)</li>
                  <li>All documents and compliance checks</li>
                  <li>All organization members and permissions</li>
                  <li>SSO connections and settings</li>
                </ul>
              </div>

              {organization?.subscription_status === 'active' && (
                <div className="mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cancelSubscription}
                      onChange={(e) => setCancelSubscription(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      Cancel active subscription
                    </span>
                  </label>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="delete-confirm" className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-mono font-semibold">{organization?.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder={organization?.name}
                  disabled={deleting}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                    setDeleteError('');
                  }}
                  disabled={deleting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== organization?.name}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? 'Deleting...' : 'Delete Organization'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </OrganizationLayout>
  );
}
