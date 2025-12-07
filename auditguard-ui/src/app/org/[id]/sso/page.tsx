'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface SSOConfiguration {
  enabled: boolean;
  provider?: string;
  workosOrganizationId?: string;
  workosConnectionId?: string;
  allowedDomains?: string[];
}

export default function OrganizationSSOPage() {
  const params = useParams();
  const { user } = useAuth();
  const orgId = params.id as string;
  const accountId = user?.userId;

  const [config, setConfig] = useState<SSOConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'workos' | 'okta' | 'azure' | 'google'>('workos');
  const [domain, setDomain] = useState('');
  const [workosOrgId, setWorkosOrgId] = useState('');
  const [workosConnId, setWorkosConnId] = useState('');

  const fetchConfig = useCallback(async () => {
    try {
      // Note: api.get() returns data directly, not wrapped in .data property
      const config = await api.get<SSOConfiguration | null>(`/api/organizations/${orgId}/sso/config`);
      setConfig(config || { enabled: false, provider: null });
    } catch (error) {
      console.error('Failed to fetch SSO config:', error);
      setConfig({ enabled: false, provider: null });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleEnableSSO = async () => {
    setSaving(true);
    try {
      // Parse comma-separated domains into array
      const allowedDomains = domain
        ? domain.split(',').map((d) => d.trim().toLowerCase()).filter((d) => d.length > 0)
        : undefined;

      // Send SSO configuration with required fields
      await api.post(`/api/organizations/${orgId}/sso/config`, {
        provider: selectedProvider === 'workos' ? 'saml' : selectedProvider,
        workosOrganizationId: workosOrgId,
        workosConnectionId: workosConnId || undefined,
        allowedDomains,
      });

      setShowSetupModal(false);
      await fetchConfig();
      alert('SSO configured successfully! You can now enable it.');
    } catch (error) {
      console.error('Failed to enable SSO:', error);
      alert('Failed to configure SSO. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSSO = async () => {
    if (!config) return;

    // If enabling, just enable it
    // If disabling, confirm first
    if (config.enabled) {
      if (!confirm('Are you sure you want to disable SSO? Users will need to sign in with email/password.')) {
        return;
      }
    }

    setSaving(true);
    try {
      await api.patch(`/api/organizations/${orgId}/sso/config`, {
        enabled: !config.enabled,
      });
      await fetchConfig();
      alert(`SSO ${!config.enabled ? 'enabled' : 'disabled'} successfully!`);
    } catch (error) {
      console.error('Failed to toggle SSO:', error);
      alert('Failed to toggle SSO. Please try again.');
    } finally {
      setSaving(false);
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

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId}>
      <div className="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Single Sign-On (SSO)
            </h1>
            <p className="text-gray-600">
              Configure SAML or OAuth-based Single Sign-On for your organization
            </p>
          </div>

          {/* Enterprise Badge */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <div className="font-semibold text-purple-900">
                  Enterprise Feature
                </div>
                <div className="text-sm text-purple-700">
                  SSO is available on the Enterprise plan. Upgrade to enable secure,
                  centralized authentication for your team.
                </div>
              </div>
            </div>
          </div>

          {/* SSO Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  SSO Status
                </h2>
                <p className="text-sm text-gray-600">
                  {config?.provider
                    ? config.enabled
                      ? `Active with ${config.provider?.toUpperCase()}`
                      : 'Configured but not enabled'
                    : 'Not configured'}
                </p>
              </div>
              <div
                className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  config?.enabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {config?.enabled ? '✓ Enabled' : 'Disabled'}
              </div>
            </div>

            {config?.provider && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 mb-1">Provider</div>
                    <div className="font-medium text-gray-900 capitalize">
                      {config.provider}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">WorkOS Organization ID</div>
                    <div className="font-mono text-xs text-gray-900">{config.workosOrganizationId}</div>
                  </div>
                  {config.workosConnectionId && (
                    <div>
                      <div className="text-gray-600 mb-1">WorkOS Connection ID</div>
                      <div className="font-mono text-xs text-gray-900">{config.workosConnectionId}</div>
                    </div>
                  )}
                  {config.allowedDomains && config.allowedDomains.length > 0 && (
                    <div className="col-span-2">
                      <div className="text-gray-600 mb-1">Allowed Domains</div>
                      <div className="flex flex-wrap gap-1">
                        {config.allowedDomains.map((domain) => (
                          <span
                            key={domain}
                            className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                          >
                            {domain}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {config?.provider ? (
              <div className="flex gap-3">
                <Button
                  variant={config.enabled ? 'outline' : 'primary'}
                  onClick={handleToggleSSO}
                  disabled={saving}
                >
                  {saving ? (config.enabled ? 'Disabling...' : 'Enabling...') : (config.enabled ? 'Disable SSO' : 'Enable SSO')}
                </Button>
                <Button variant="outline" onClick={() => setShowSetupModal(true)}>
                  Reconfigure
                </Button>
              </div>
            ) : (
              <Button onClick={() => setShowSetupModal(true)}>
                Configure SSO
              </Button>
            )}
          </div>

          {/* Benefits Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Benefits of SSO
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">🔐</span>
                <div>
                  <div className="font-medium text-gray-900 mb-1">
                    Enhanced Security
                  </div>
                  <div className="text-sm text-gray-600">
                    Centralized authentication with your identity provider
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">⚡</span>
                <div>
                  <div className="font-medium text-gray-900 mb-1">
                    Seamless Access
                  </div>
                  <div className="text-sm text-gray-600">
                    One-click sign-in for your team members
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">👥</span>
                <div>
                  <div className="font-medium text-gray-900 mb-1">
                    Centralized Management
                  </div>
                  <div className="text-sm text-gray-600">
                    Manage user access from your identity provider
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">📋</span>
                <div>
                  <div className="font-medium text-gray-900 mb-1">
                    Compliance Ready
                  </div>
                  <div className="text-sm text-gray-600">
                    Meet enterprise security requirements
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Supported Providers */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Supported Providers
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Okta', logo: '🔷' },
                { name: 'Azure AD', logo: '🔵' },
                { name: 'Google Workspace', logo: '🔴' },
                { name: 'OneLogin', logo: '🟢' },
              ].map((provider) => (
                <div
                  key={provider.name}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg"
                >
                  <span className="text-2xl">{provider.logo}</span>
                  <span className="font-medium text-gray-900">{provider.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Setup Modal */}
          {showSetupModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Configure SSO
                  </h3>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Identity Provider
                    </label>
                    <select
                      value={selectedProvider}
                      onChange={(e) =>
                        setSelectedProvider(
                          e.target.value as 'workos' | 'okta' | 'azure' | 'google'
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="workos">WorkOS (SAML)</option>
                      <option value="okta">Okta</option>
                      <option value="azure">Azure Active Directory</option>
                      <option value="google">Google Workspace</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WorkOS Organization ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={workosOrgId}
                      onChange={(e) => setWorkosOrgId(e.target.value)}
                      placeholder="org_XXXXXXXXXXXXXXXXXXXXXXXX"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Required: Your WorkOS organization ID from the WorkOS dashboard
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WorkOS Connection ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={workosConnId}
                      onChange={(e) => setWorkosConnId(e.target.value)}
                      placeholder="conn_XXXXXXXXXXXXXXXXXXXXXXXX"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Optional: Specific connection ID for direct routing
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allowed Email Domains
                    </label>
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="company.com, example.org"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Users with these email domains will be automatically redirected to SSO (comma-separated)
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      Make sure you&rsquo;ve set up your WorkOS organization and connection in the WorkOS dashboard first.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowSetupModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleEnableSSO}
                      disabled={saving || !workosOrgId}
                    >
                      {saving ? 'Configuring...' : 'Save Configuration'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </OrganizationLayout>
  );
}
