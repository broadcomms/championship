'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppLayout } from '@/components/layout/AppLayout';
import { OrganizationNav } from '@/components/organizations/OrganizationNav';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { api } from '@/lib/api';

const ssoConfigSchema = z.object({
  provider: z.enum(['google', 'okta', 'azure', 'saml', 'generic-saml']),
  workosOrganizationId: z.string().min(1, 'WorkOS Organization ID is required'),
  workosConnectionId: z.string().optional(),
});

type SSOConfigForm = z.infer<typeof ssoConfigSchema>;

interface SSOConnection {
  id: string;
  organizationId: string;
  provider: string;
  workosOrganizationId: string;
  workosConnectionId: string | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export default function OrganizationSSOPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;

  const [ssoConfig, setSsoConfig] = useState<SSOConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SSOConfigForm>({
    resolver: zodResolver(ssoConfigSchema),
  });

  useEffect(() => {
    fetchSSOConfig();
  }, [organizationId]);

  const fetchSSOConfig = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<SSOConnection>(
        `/api/organizations/${organizationId}/sso/config`
      );
      setSsoConfig(data);
      reset({
        provider: data.provider as any,
        workosOrganizationId: data.workosOrganizationId,
        workosConnectionId: data.workosConnectionId || '',
      });
    } catch (err: any) {
      // If SSO is not configured, it's not an error - just show the setup form
      if (err.error?.includes('not configured') || err.status === 404) {
        setSsoConfig(null);
      } else {
        setError(err.error || 'Failed to load SSO configuration');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: SSOConfigForm) => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await api.post<SSOConnection>(
        `/api/organizations/${organizationId}/sso/config`,
        {
          provider: data.provider,
          workosOrganizationId: data.workosOrganizationId,
          workosConnectionId: data.workosConnectionId || undefined,
        }
      );
      setSsoConfig(response);
      setSuccessMessage('SSO configuration saved successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.error || 'Failed to save SSO configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSSO = async () => {
    if (!ssoConfig) return;

    setIsToggling(true);
    setError('');
    setSuccessMessage('');

    try {
      await api.patch(
        `/api/organizations/${organizationId}/sso/config`,
        { enabled: !ssoConfig.enabled }
      );
      setSsoConfig({ ...ssoConfig, enabled: !ssoConfig.enabled });
      setSuccessMessage(
        `SSO ${!ssoConfig.enabled ? 'enabled' : 'disabled'} successfully`
      );

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.error || 'Failed to toggle SSO');
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteSSO = async () => {
    setIsDeleting(true);
    setError('');
    setSuccessMessage('');

    try {
      await api.delete(`/api/organizations/${organizationId}/sso/config`);
      setSsoConfig(null);
      setShowDeleteConfirm(false);
      reset({
        provider: 'google',
        workosOrganizationId: '',
        workosConnectionId: '',
      });
      setSuccessMessage('SSO configuration deleted successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.error || 'Failed to delete SSO configuration');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <OrganizationNav />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading SSO configuration...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <OrganizationNav />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SSO Configuration</h1>
          <p className="mt-2 text-sm text-gray-600">
            Configure Single Sign-On (SSO) for your organization using WorkOS
          </p>
        </div>

        {/* Status Banner */}
        {ssoConfig && (
          <div className={`mb-6 rounded-lg p-4 ${
            ssoConfig.enabled
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-medium ${
                  ssoConfig.enabled ? 'text-green-900' : 'text-yellow-900'
                }`}>
                  SSO is {ssoConfig.enabled ? 'Enabled' : 'Disabled'}
                </h3>
                <p className={`mt-1 text-sm ${
                  ssoConfig.enabled ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {ssoConfig.enabled
                    ? 'Users can sign in using their identity provider'
                    : 'Users must use email/password authentication'}
                </p>
              </div>
              <Button
                variant={ssoConfig.enabled ? 'outline' : 'primary'}
                size="sm"
                onClick={handleToggleSSO}
                loading={isToggling}
              >
                {ssoConfig.enabled ? 'Disable SSO' : 'Enable SSO'}
              </Button>
            </div>
          </div>
        )}

        {/* Messages */}
        {successMessage && (
          <div className="mb-6 rounded-md bg-green-50 p-3">
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Configuration Form */}
        {!ssoConfig && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Setup SSO</h2>
            <p className="mb-6 text-sm text-gray-600">
              Configure your WorkOS SSO connection. You'll need to create an organization
              and connection in the WorkOS dashboard first.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Identity Provider
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  {...register('provider')}
                >
                  <option value="google">Google Workspace</option>
                  <option value="okta">Okta</option>
                  <option value="azure">Microsoft Azure AD</option>
                  <option value="saml">Generic SAML</option>
                  <option value="generic-saml">Generic SAML 2.0</option>
                </select>
                {errors.provider && (
                  <p className="mt-1 text-sm text-red-600">{errors.provider.message}</p>
                )}
              </div>

              <Input
                label="WorkOS Organization ID"
                placeholder="org_XXXXXXXXXXXXXXXXXXXXXXXX"
                error={errors.workosOrganizationId?.message}
                {...register('workosOrganizationId')}
              />

              <Input
                label="WorkOS Connection ID (Optional)"
                placeholder="conn_XXXXXXXXXXXXXXXXXXXXXXXX"
                error={errors.workosConnectionId?.message}
                {...register('workosConnectionId')}
              />

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={isSaving}>
                  Save Configuration
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Current Configuration */}
        {ssoConfig && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Current Configuration</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Provider</span>
                <span className="font-medium text-gray-900 capitalize">{ssoConfig.provider}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">WorkOS Organization ID</span>
                <span className="font-mono text-xs text-gray-900">{ssoConfig.workosOrganizationId}</span>
              </div>
              {ssoConfig.workosConnectionId && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">WorkOS Connection ID</span>
                  <span className="font-mono text-xs text-gray-900">{ssoConfig.workosConnectionId}</span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Status</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  ssoConfig.enabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {ssoConfig.enabled ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created</span>
                <span className="font-medium text-gray-900">
                  {new Date(ssoConfig.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* WorkOS Documentation */}
        <div className="mb-8 rounded-lg bg-blue-50 p-6">
          <h3 className="mb-2 text-sm font-semibold text-blue-900">Need Help?</h3>
          <p className="mb-3 text-sm text-blue-700">
            Visit the WorkOS dashboard to create and manage your SSO connections:
          </p>
          <a
            href="https://dashboard.workos.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            WorkOS Dashboard →
          </a>
        </div>

        {/* Danger Zone */}
        {ssoConfig && (
          <div className="mb-8 rounded-lg border-2 border-red-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-red-900">Danger Zone</h2>
            <p className="mb-4 text-sm text-gray-600">
              Deleting your SSO configuration will prevent users from signing in via SSO.
              They will need to use email/password authentication instead.
            </p>

            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                Delete SSO Configuration
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-800">
                    Are you sure you want to delete this SSO configuration?
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleDeleteSSO}
                    loading={isDeleting}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Yes, Delete SSO Config
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Links */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Links</h2>
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/organizations/${organizationId}/settings`)}
              className="w-full justify-start"
            >
              Organization Settings →
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/organizations/${organizationId}/members`)}
              className="w-full justify-start"
            >
              Manage Members →
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
