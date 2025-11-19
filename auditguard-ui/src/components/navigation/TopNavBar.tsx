'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, LogOut, User, Shield, Building2, ChevronDown, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { RealtimeStatusIndicator } from '@/components/status/RealtimeStatusIndicator';

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface TopNavBarProps {
  currentOrgId?: string;
  showOrgSwitcher?: boolean;
}

export function TopNavBar({ currentOrgId, showOrgSwitcher = true }: TopNavBarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch organizations
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await api.get<Organization[]>('/api/organizations');
        setOrganizations(response);

        // Find current organization
        if (currentOrgId) {
          const org = response.find((o: Organization) => o.id === currentOrgId);
          setCurrentOrg(org || null);
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      }
    };

    fetchOrganizations();
  }, [currentOrgId]);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications?unread=true&limit=5');
        setNotifications(Array.isArray(response) ? response : []);
        setUnreadCount(Array.isArray(response) ? response.length : 0);
      } catch (error) {
        // Silently fail - notifications endpoint may not be implemented yet
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('Notifications not available:', error);
        }
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    fetchNotifications();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Get user initials for avatar
  const getInitials = (email: string) => {
    return email
      .split('@')[0]
      .split('.')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format relative time for notifications
  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`, {});
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true, read_at: Date.now() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Navigate to home/account dashboard
  const handleLogoClick = () => {
    const accountId = user?.userId;
    if (accountId) {
      router.push(`/account/${accountId}`);
    } else {
      router.push('/');
    }
  };

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="mx-auto px-2 pr-6 sm:px-2 sm:pr-4 lg:px-2n lg:pr-4">
        <div className="flex h-16 items-center justify-between">
          {/* Left side - Logo & Org Switcher */}
          <div className="flex items-center gap-4">
            {/* Logo */}
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-2 py-1"
            >
              <Shield className="h-7 w-7 text-blue-600 group-hover:text-blue-700 transition-colors" />
              <span className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                AuditGuardX
              </span>
            </button>

            {/* Organization Switcher Dropdown */}
            {showOrgSwitcher && currentOrg && (
              <div className="relative">
                <button
                  onClick={() => setIsOrgMenuOpen(!isOrgMenuOpen)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
                    isOrgMenuOpen && 'ring-2 ring-blue-500'
                  )}
                >
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="max-w-[200px] truncate">{currentOrg.name}</span>
                  <ChevronDown className={cn(
                    'h-4 w-4 text-gray-500 transition-transform',
                    isOrgMenuOpen && 'rotate-180'
                  )} />
                </button>

                {/* Organization Dropdown Menu */}
                {isOrgMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsOrgMenuOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute left-0 z-20 mt-2 w-72 origin-top-left rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="p-2">
                        <div className="px-3 py-2 mb-2 border-b border-gray-200">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Switch Organization
                          </p>
                        </div>

                        {/* Organization List */}
                        <div className="max-h-64 overflow-y-auto">
                          {organizations.map((org) => (
                            <button
                              key={org.id}
                              onClick={() => {
                                setIsOrgMenuOpen(false);
                                router.push(`/org/${org.id}`);
                              }}
                              className={cn(
                                'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
                                org.id === currentOrgId && 'bg-blue-50'
                              )}
                            >
                              <Building2 className={cn(
                                'h-5 w-5 mt-0.5 flex-shrink-0',
                                org.id === currentOrgId ? 'text-blue-600' : 'text-gray-400'
                              )} />
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  'text-sm font-medium truncate',
                                  org.id === currentOrgId ? 'text-blue-700' : 'text-gray-900'
                                )}>
                                  {org.name}
                                </p>
                                <p className="text-xs text-gray-500 capitalize">
                                  {org.role}
                                </p>
                              </div>
                              {org.id === currentOrgId && (
                                <div className="flex-shrink-0">
                                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => {
                              setIsOrgMenuOpen(false);
                              router.push('/organizations/new');
                            }}
                            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <span className="text-lg">+</span>
                            <span>Create Organization</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right side - Status, Notifications, User menu */}
          <div className="flex items-center gap-4">
            {/* Real-time Status Indicator */}
            <RealtimeStatusIndicator position="inline" />

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationMenuOpen(!isNotificationMenuOpen)}
                className={cn(
                  'relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
                  isNotificationMenuOpen && 'bg-gray-100'
                )}
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded={isNotificationMenuOpen}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Menu */}
              {isNotificationMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsNotificationMenuOpen(false)}
                  />

                  {/* Menu */}
                  <div className="absolute right-0 z-20 mt-2 w-96 origin-top-right rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Notifications
                      </h3>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">No new notifications</p>
                        </div>
                      ) : (
                        <div className="py-2">
                          {notifications.map((notification) => (
                            <button
                              key={notification.id}
                              onClick={() => {
                                setIsNotificationMenuOpen(false);
                                if (!notification.read) markAsRead(notification.id);
                                router.push(notification.action_url || '/notifications');
                              }}
                              className={cn(
                                'w-full px-4 py-3 text-left hover:bg-gray-50 transition border-b border-gray-100 last:border-0',
                                !notification.read && 'bg-blue-50'
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <p className={cn(
                                      'text-sm text-gray-900',
                                      !notification.read && 'font-semibold'
                                    )}>
                                      {notification.title}
                                    </p>
                                    {!notification.read && (
                                      <span className="flex-shrink-0 h-2 w-2 bg-blue-600 rounded-full mt-1" />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 line-clamp-2">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatRelativeTime(notification.created_at)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => {
                          setIsNotificationMenuOpen(false);
                          router.push('/notifications');
                        }}
                        className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User menu dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  isUserMenuOpen && 'ring-2 ring-blue-500 ring-offset-2'
                )}
                aria-label="User menu"
                aria-haspopup="true"
                aria-expanded={isUserMenuOpen}
              >
                {user?.email && getInitials(user.email)}
              </button>

              {/* User Dropdown menu */}
              {isUserMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsUserMenuOpen(false)}
                  />

                  {/* Menu */}
                  <div className="absolute right-0 z-20 mt-2 w-64 origin-top-right rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
                    {/* User Profile Header */}
                    <div className="bg-gray-50 px-4 py-4 border-b border-gray-200">
                      <div className="flex flex-col items-center text-center">
                        {/* Profile Picture */}
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-semibold text-white mb-3">
                          {user?.email && getInitials(user.email)}
                        </div>
                        {/* Full Name - fallback to email username if no name */}
                        <p className="text-sm font-semibold text-gray-900">
                          {user?.name || user?.email?.split('@')[0] || 'User'}
                        </p>
                        {/* Email */}
                        <p className="text-xs text-gray-600 mt-0.5">
                          {user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="p-2">
                      {/* Account Dashboard */}
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          const accountId = user?.userId;
                          if (accountId) {
                            router.push(`/account/${accountId}`);
                          }
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <User className="h-4 w-4 text-gray-500" />
                        <span>Account Dashboard</span>
                      </button>

                      <div className="my-2 border-t border-gray-200" />

                      {/* All Organizations */}
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.push('/organizations');
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <Building2 className="h-4 w-4 text-gray-500" />
                        <span>Organizations</span>
                      </button>

                      {/* Settings */}
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.push('/settings');
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <Settings className="h-4 w-4 text-gray-500" />
                        <span>Settings</span>
                      </button>

                      {/* Admin link - only show for admin users */}
                      {user?.isAdmin && (
                        <>
                          <div className="my-2 border-t border-gray-200" />

                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              router.push('/admin');
                            }}
                            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          >
                            <Shield className="h-4 w-4" />
                            <span>Admin Dashboard</span>
                          </button>
                        </>
                      )}

                      <div className="my-2 border-t border-gray-200" />

                      {/* Sign out */}
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
