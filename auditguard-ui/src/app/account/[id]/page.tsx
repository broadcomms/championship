'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Folder, Bell, Clock, Shield, CheckCircle2 } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  workspace_count?: number;
  workspaceCount?: number;
  member_count?: number;
  memberCount?: number;
  created_at: number;
}

interface AccountStats {
  totalOrganizations: number;
  totalWorkspaces: number;
  unreadNotifications: number;
}

interface RecentActivity {
  id: string;
  type: 'organization' | 'workspace' | 'compliance';
  title: string;
  description: string;
  timestamp: number;
  icon: string;
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
  const { user } = useAuth();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<AccountStats>({
    totalOrganizations: 0,
    totalWorkspaces: 0,
    unreadNotifications: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
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

  // Handle OAuth redirect - capture session token from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('session');

      if (sessionToken) {
        // Store session token in cookie
        document.cookie = `session=${sessionToken}; path=/; max-age=604800; SameSite=Lax`;

        // Clean up URL by removing session parameter
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, []);

  useEffect(() => {
    fetchAccountData();
  }, [accountId, user]);

  const fetchAccountData = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Fetch user's organizations
      const orgsData = await api.get<Organization[]>('/api/organizations');
      setOrganizations(orgsData);

      // Fetch notification count
      let notificationCount = 0;
      try {
        const notifData = await api.get<{ unread: number }>('/api/notifications/count');
        notificationCount = notifData.unread || 0;
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }

      // Calculate stats - handle both camelCase and snake_case from API
      const totalWorkspaces = orgsData.reduce((sum, org) => {
        const count = org.workspace_count ?? org.workspaceCount ?? 0;
        return sum + count;
      }, 0);

      setStats({
        totalOrganizations: orgsData.length,
        totalWorkspaces: totalWorkspaces,
        unreadNotifications: notificationCount
      });

      // Generate recent activity based on organizations
      const activities: RecentActivity[] = [];
      orgsData.slice(0, 3).forEach((org) => {
        activities.push({
          id: `org-${org.id}`,
          type: 'organization',
          title: org.name,
          description: `You joined as ${org.role}`,
          timestamp: org.created_at || Date.now(),
          icon: 'building'
        });
      });
      setRecentActivity(activities);

      // Update getting started checklist
      setGettingStarted(prev => prev.map(item => {
        if (item.id === '1') {
          // Organization created
          return { ...item, completed: orgsData.length > 0 };
        }
        if (item.id === '2') {
          // Profile completed (both name and profile picture)
          const hasName = !!user?.name;
          const hasProfilePicture = !!user?.profilePictureUrl;
          return { ...item, completed: hasName && hasProfilePicture };
        }
        return item;
      }));
    } catch (err: unknown) {
      const fallbackMessage = 'Failed to load account data';
      if (err instanceof Error) {
        setError(err.message || fallbackMessage);
        return;
      }
      if (typeof err === 'object' && err !== null && 'error' in err) {
        const errorMessage = String((err as { error?: string }).error || fallbackMessage);
        setError(errorMessage);
        return;
      }
      setError(fallbackMessage);
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
          {/* Organizations Card */}
          <div className="group relative overflow-hidden rounded-lg bg-white p-6 shadow transition-all hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Organizations</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalOrganizations}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {stats.totalOrganizations === 0 ? 'Create your first' : 'Active organizations'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 transition-colors group-hover:bg-blue-200">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
          </div>

          {/* Workspaces Card */}
          <div className="group relative overflow-hidden rounded-lg bg-white p-6 shadow transition-all hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Workspaces</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalWorkspaces}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {stats.totalWorkspaces === 0 ? 'Create your first' : 'Across all organizations'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 transition-colors group-hover:bg-green-200">
                <Folder className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-green-500 to-green-600"></div>
          </div>

          {/* Notifications Card */}
          <div className="group relative overflow-hidden rounded-lg bg-white p-6 shadow transition-all hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Notifications</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.unreadNotifications}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {stats.unreadNotifications === 0 ? 'All caught up!' : 'Unread notifications'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 transition-colors group-hover:bg-yellow-200">
                <Bell className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-yellow-500 to-yellow-600"></div>
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
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Your Organizations</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Manage teams, workspaces, and billing for your organizations
                </p>
              </div>
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
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-blue-100">
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No organizations yet</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Organizations help you collaborate with your team and manage compliance across multiple workspaces
                </p>
                <div className="mt-6">
                  <Button
                    variant="primary"
                    onClick={() => router.push('/organizations/new')}
                  >
                    Create Your First Organization
                  </Button>
                </div>
              </div>
            ) : (
              organizations.map((org) => {
                const workspaceCount = org.workspace_count ?? org.workspaceCount ?? 0;
                const memberCount = org.member_count ?? org.memberCount ?? 0;
                
                return (
                  <div
                    key={org.id}
                    className="group cursor-pointer px-6 py-4 transition-all hover:bg-gray-50"
                    onClick={() => router.push(`/org/${org.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {org.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Folder className="h-4 w-4" />
                              {workspaceCount} {workspaceCount === 1 ? 'workspace' : 'workspaces'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Shield className="h-4 w-4" />
                              {memberCount} {memberCount === 1 ? 'member' : 'members'}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium capitalize text-blue-800">
                              {org.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <svg className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Links and Recent Activity Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Quick Links - 2 columns */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Profile Settings Card */}
              <button
                onClick={() => router.push(`/account/${accountId}/profile`)}
                className="group relative overflow-hidden rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-500 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      Profile Settings
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Update your personal information and preferences
                    </p>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-all group-hover:w-full"></div>
              </button>

              {/* Notifications Card */}
              <button
                onClick={() => router.push(`/account/${accountId}/notifications`)}
                className="group relative overflow-hidden rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-yellow-500 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600 transition-colors group-hover:bg-yellow-600 group-hover:text-white">
                    <Bell className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-yellow-600 transition-colors">
                      Notification Settings
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Manage how and when you receive notifications
                    </p>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all group-hover:w-full"></div>
              </button>

              {/* Notification Center Card */}
              <button
                onClick={() => router.push('/notifications')}
                className="group relative overflow-hidden rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-green-500 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 transition-colors group-hover:bg-green-600 group-hover:text-white">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                        Notification Center
                      </h3>
                      {stats.unreadNotifications > 0 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                          {stats.unreadNotifications}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      View all your notifications in one place
                    </p>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-green-500 to-green-600 transition-all group-hover:w-full"></div>
              </button>

              {/* All Organizations Card */}
              <button
                onClick={() => router.push('/organizations')}
                className="group relative overflow-hidden rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-purple-500 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                      All Organizations
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Manage all your organizations and teams
                    </p>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-purple-500 to-purple-600 transition-all group-hover:w-full"></div>
              </button>
            </div>
          </div>

          {/* Recent Activity - 1 column */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Activity</h2>
            <div className="rounded-lg border border-gray-200 bg-white">
              {recentActivity.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <Clock className="mx-auto h-10 w-10 text-gray-300" />
                  <p className="mt-3 text-sm text-gray-600">No recent activity</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Your activity will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {activity.title}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-600">
                            {activity.description}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
