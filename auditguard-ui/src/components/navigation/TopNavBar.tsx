'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, LogOut, User, Shield, ShieldCheck, Building2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { RealtimeStatusIndicator } from '@/components/status/RealtimeStatusIndicator';
import { NotificationBell } from '@/components/notifications/NotificationBell';

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
      <div className="mx-auto px-2 pr-6 sm:px-2 sm:pr-4 lg:px-2n lg:pr-4">
        <div className="flex h-16 items-center justify-between">
          {/* Left side - Logo & Org Switcher */}
          <div className="flex items-center gap-4">
            {/* Logo */}
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-2 py-1"
            >
              <ShieldCheck className="h-7 w-7 text-blue-600 group-hover:text-blue-700 transition-colors" />
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
            <NotificationBell />

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
