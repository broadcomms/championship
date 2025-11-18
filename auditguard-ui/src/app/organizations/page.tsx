'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { TopNavBar } from '@/components/navigation/TopNavBar';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizationCard } from '@/components/organizations/OrganizationCard';
import { api } from '@/lib/api';
import { OrganizationWithRole } from '@/types/organization';
import { Building2 } from 'lucide-react';

export default function OrganizationsPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrganizations = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<OrganizationWithRole[]>('/api/organizations');
      setOrganizations(data || []);
    } catch (err: any) {
      setError(err.error || 'Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  return (
    <ProtectedRoute>
      <div className="flex h-screen flex-col">
        {/* Top Navigation Bar - no org switcher on this page */}
        <TopNavBar showOrgSwitcher={false} />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage your organization settings, members, and billing
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-sm text-gray-600">Loading organizations...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={fetchOrganizations}
              className="mt-3 rounded-md bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && organizations.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto max-w-md">
              <Building2 className="mx-auto h-16 w-16 text-gray-400" />
              <h3 className="mt-6 text-lg font-medium text-gray-900">
                No Organizations
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                You are not a member of any organizations yet. Contact your administrator to be added to an organization.
              </p>
            </div>
          </div>
        )}

        {/* Organizations Grid */}
        {!isLoading && !error && organizations.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <OrganizationCard key={org.id} organization={org} />
            ))}
          </div>
        )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
