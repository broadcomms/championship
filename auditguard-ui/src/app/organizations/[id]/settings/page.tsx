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
import { OrganizationSettings } from '@/types/organization';

const updateOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(200, 'Name is too long'),
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug is too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  billing_email: z.string().email('Invalid email format').or(z.literal('')).optional(),
});

type UpdateOrganizationForm = z.infer<typeof updateOrganizationSchema>;

export default function OrganizationSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;

  const [organization, setOrganization] = useState<OrganizationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateOrganizationForm>({
    resolver: zodResolver(updateOrganizationSchema),
  });

  useEffect(() => {
    fetchOrganization();
  }, [organizationId]);

  const fetchOrganization = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<OrganizationSettings>(
        `/api/organizations/${organizationId}/settings`
      );
      setOrganization(data);
      reset({
        name: data.name,
        slug: data.slug,
        billing_email: data.billing_email || '',
      });
    } catch (err: any) {
      setError(err.error || 'Failed to load organization');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UpdateOrganizationForm) => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const updateData: any = {
        name: data.name,
        slug: data.slug,
      };

      // Only include billing_email if it's not empty
      if (data.billing_email) {
        updateData.billing_email = data.billing_email;
      }

      const updated = await api.patch<OrganizationSettings>(
        `/api/organizations/${organizationId}/settings`,
        updateData
      );
      setOrganization(updated);
      setSuccessMessage('Organization updated successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.error || 'Failed to update organization');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading organization settings...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !organization) {
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
              Back to Dashboard
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
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-600"
            >
              ←
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Manage your organization's information and billing settings
          </p>
        </div>

        {/* General Settings */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">General</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Organization Name"
              placeholder="e.g., ACME Corporation"
              error={errors.name?.message}
              {...register('name')}
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Organization Slug
              </label>
              <Input
                placeholder="e.g., acme-corp"
                error={errors.slug?.message}
                {...register('slug')}
              />
              <p className="mt-1 text-xs text-gray-500">
                Used in URLs. Only lowercase letters, numbers, and hyphens allowed.
              </p>
            </div>

            <Input
              label="Billing Email"
              type="email"
              placeholder="billing@example.com"
              error={errors.billing_email?.message}
              {...register('billing_email')}
            />

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

        {/* Organization Statistics */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Organization Statistics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-2xl font-bold text-gray-900">{organization?.member_count || 0}</div>
              <div className="text-sm text-gray-600">Members</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-2xl font-bold text-gray-900">{organization?.workspace_count || 0}</div>
              <div className="text-sm text-gray-600">Workspaces</div>
            </div>
          </div>
        </div>

        {/* Subscription Info */}
        {organization?.subscription_plan && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Subscription</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Current Plan</span>
                <span className="font-medium text-gray-900">
                  {organization.subscription_plan}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  organization.subscription_status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : organization.subscription_status === 'trialing'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {organization.subscription_status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Organization Info */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Organization Information</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Organization ID</span>
              <span className="font-mono text-xs text-gray-900">{organization?.id}</span>
            </div>
            {organization?.stripe_customer_id && (
              <div className="flex justify-between">
                <span className="text-gray-600">Stripe Customer ID</span>
                <span className="font-mono text-xs text-gray-900">{organization.stripe_customer_id}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Created</span>
              <span className="font-medium text-gray-900">
                {organization && new Date(organization.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated</span>
              <span className="font-medium text-gray-900">
                {organization && new Date(organization.updated_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Links</h2>
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/organizations/${organizationId}/members`)}
              className="w-full justify-start"
            >
              Manage Members →
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/organizations/${organizationId}/billing`)}
              className="w-full justify-start"
            >
              Billing & Subscription →
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/organizations/${organizationId}/sso`)}
              className="w-full justify-start"
            >
              SSO Configuration →
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
