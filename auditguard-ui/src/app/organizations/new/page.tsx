'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { TopNavBar } from '@/components/navigation/TopNavBar';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import type { ErrorResponse } from '@/types';
import type { CreateOrganizationInput, Organization } from '@/types/organization';
import { Building2 } from 'lucide-react';

const getApiErrorMessage = (error: unknown) => {
  if (
    error &&
    typeof error === 'object' &&
    'error' in error &&
    typeof (error as ErrorResponse).error === 'string'
  ) {
    return (error as ErrorResponse).error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Failed to create organization. Please try again.';
};

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

export default function NewOrganizationPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    billing_email: '',
  });
  const [autoGenerateSlug, setAutoGenerateSlug] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: autoGenerateSlug ? generateSlug(name) : prev.slug,
    }));
  };

  const handleSlugChange = (slug: string) => {
    setAutoGenerateSlug(false);
    setFormData(prev => ({ ...prev, slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const payload: CreateOrganizationInput = {
        name: formData.name,
        slug: formData.slug,
        ...(formData.billing_email && { billing_email: formData.billing_email }),
      };

      const newOrg = await api.post<Organization>(
        '/api/organizations',
        payload
      );

      // Navigate to the newly created organization
      if (newOrg && newOrg.id) {
        router.push(`/org/${newOrg.id}`);
      } else {
        throw new Error('Organization created but no ID returned');
      }
    } catch (err) {
      console.error('Failed to create organization:', err);
      setError(getApiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    router.push('/organizations');
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen flex-col">
        <TopNavBar showOrgSwitcher={false} />

        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Create New Organization
                  </h1>
                  <p className="mt-1 text-sm text-gray-600">
                    Set up a new organization to manage compliance and collaboration
                  </p>
                </div>
              </div>
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
                {/* Organization Name */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Organization Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g., Acme Corporation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={creating}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The display name for your organization
                  </p>
                </div>

                {/* Organization Slug */}
                <div>
                  <label
                    htmlFor="slug"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Organization Slug <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="slug"
                    required
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="e.g., acme-corporation"
                    pattern="[a-z0-9-]+"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    disabled={creating}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    URL-friendly identifier (lowercase letters, numbers, and hyphens only)
                  </p>
                </div>

                {/* Billing Email */}
                <div>
                  <label
                    htmlFor="billing_email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Billing Email
                  </label>
                  <input
                    type="email"
                    id="billing_email"
                    value={formData.billing_email}
                    onChange={(e) =>
                      setFormData({ ...formData, billing_email: e.target.value })
                    }
                    placeholder="billing@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={creating}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional: Email address for billing notifications and invoices
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
                <Button type="submit" disabled={creating || !formData.name.trim() || !formData.slug.trim()}>
                  {creating ? 'Creating...' : 'Create Organization'}
                </Button>
              </div>
            </form>

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">About Organizations</h3>
                  <p className="text-sm text-blue-800">
                    Organizations are the top-level container for your compliance work.
                    You can create workspaces, invite team members, and manage billing at the organization level.
                    You will be set as the owner of this organization.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
