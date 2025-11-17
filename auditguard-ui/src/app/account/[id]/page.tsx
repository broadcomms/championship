'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  workspaceCount: number;
  memberCount: number;
  created_at: number;
}

interface AccountStats {
  totalOrganizations: number;
  totalWorkspaces: number;
  unreadNotifications: number;
}

interface GettingStartedItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action: string;
  actionUrl: string;
}

export default function AccountDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<AccountStats>({
    totalOrganizations: 0,
    totalWorkspaces: 0,
    unreadNotifications: 0
  });
  const [gettingStarted, setGettingStarted] = useState<GettingStartedItem[]>([
    {
      id: '1',
      title: 'Create your first organization',
      description: 'Organizations help you manage teams and billing',
      completed: false,
      action: 'Create Organization',
      actionUrl: '/organizations/new'
    },
    {
      id: '2',
      title: 'Set up your profile',
      description: 'Add your name and profile picture',
      completed: false,
      action: 'Edit Profile',
      actionUrl: `/account/${accountId}/profile`
    },
    {
      id: '3',
      title: 'Configure notifications',
      description: 'Choose how you want to be notified',
      completed: false,
      action: 'Notification Settings',
      actionUrl: `/account/${accountId}/notifications`
    }
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAccountData();
  }, [accountId]);

  const fetchAccountData = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Fetch user's organizations
      const orgsData = await api.get<Organization[]>('/api/organizations');
      setOrganizations(orgsData);

      // Calculate stats
      const totalWorkspaces = orgsData.reduce((sum, org) => sum + (org.workspaceCount || 0), 0);

      setStats({
        totalOrganizations: orgsData.length,
        totalWorkspaces: totalWorkspaces,
        unreadNotifications: 0 // Will be fetched from notification service
      });

      // Update getting started checklist
      setGettingStarted(prev => prev.map(item => {
        if (item.id === '1') {
          return { ...item, completed: orgsData.length > 0 };
        }
        return item;
      }));
    } catch (err: any) {
      setError(err.error || 'Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AccountLayout accountId={accountId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading account...</p>
          </div>
        </div>
      </AccountLayout>
    );
  }

  if (error) {
    return (
      <AccountLayout accountId={accountId}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </AccountLayout>
    );
  }

  const completedCount = gettingStarted.filter(item => item.completed).length;
  const progressPercentage = (completedCount / gettingStarted.length) * 100;

  return (
    <AccountLayout accountId={accountId}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your organizations, workspaces, and account settings
          </p>
        </div>

        {/* Stats Overview */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Organizations</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalOrganizations}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Workspaces</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalWorkspaces}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Notifications</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.unreadNotifications}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Getting Started Checklist */}
        {completedCount < gettingStarted.length && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {completedCount} of {gettingStarted.length} completed
                </p>
              </div>
              <span className="text-sm font-medium text-blue-600">
                {Math.round(progressPercentage)}% Complete
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-4">
              {gettingStarted.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    item.completed ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        item.completed ? 'bg-green-600' : 'border-2 border-gray-300 bg-white'
                      }`}
                    >
                      {item.completed && (
                        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className={`font-medium ${item.completed ? 'text-green-900' : 'text-gray-900'}`}>
                        {item.title}
                      </h3>
                      <p className={`text-sm ${item.completed ? 'text-green-700' : 'text-gray-600'}`}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {!item.completed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(item.actionUrl)}
                    >
                      {item.action}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organizations List */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Your Organizations</h2>
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push('/organizations/new')}
              >
                + New Organization
              </Button>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {organizations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-medium text-gray-900">No organizations</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Get started by creating your first organization
                </p>
                <div className="mt-6">
                  <Button
                    variant="primary"
                    onClick={() => router.push('/organizations/new')}
                  >
                    Create Organization
                  </Button>
                </div>
              </div>
            ) : (
              organizations.map((org) => (
                <div
                  key={org.id}
                  className="cursor-pointer px-6 py-4 transition-colors hover:bg-gray-50"
                  onClick={() => router.push(`/org/${org.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{org.name}</h3>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                        <span>{org.workspaceCount || 0} workspaces</span>
                        <span>•</span>
                        <span>{org.memberCount || 0} members</span>
                        <span>•</span>
                        <span className="capitalize">{org.role}</span>
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="outline"
            className="justify-start p-6 text-left"
            onClick={() => router.push(`/account/${accountId}/profile`)}
          >
            <div>
              <h3 className="font-medium text-gray-900">Profile Settings</h3>
              <p className="mt-1 text-sm text-gray-600">Update your personal information</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start p-6 text-left"
            onClick={() => router.push(`/account/${accountId}/notifications`)}
          >
            <div>
              <h3 className="font-medium text-gray-900">Notifications</h3>
              <p className="mt-1 text-sm text-gray-600">Manage notification preferences</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start p-6 text-left"
            onClick={() => router.push('/notifications')}
          >
            <div>
              <h3 className="font-medium text-gray-900">Notification Center</h3>
              <p className="mt-1 text-sm text-gray-600">View all notifications</p>
            </div>
          </Button>
        </div>
      </div>
    </AccountLayout>
  );
}
