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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [unreadCount, setUnreadCount] = useState(3); // TODO: Connect to real notification system

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
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
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

            {/* Notifications */}
            <button
              onClick={() => router.push('/notifications')}
              className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

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
                  <div className="absolute right-0 z-20 mt-2 w-64 origin-top-right rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="p-2">
                      {/* User info */}
                      <div className="border-b border-gray-200 px-3 py-3 mb-2">
                        <p className="text-sm font-medium text-gray-900">
                          {user?.email}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Account settings
                        </p>
                      </div>

                      {/* Menu items */}
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
                        <User className="h-4 w-4" />
                        Account Dashboard
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.push('/organizations');
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <Building2 className="h-4 w-4" />
                        All Organizations
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.push('/settings');
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
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
                            Admin Dashboard
                          </button>
                        </>
                      )}

                      <div className="my-2 border-t border-gray-200" />

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
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
