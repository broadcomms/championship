'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Bell, Settings, LogOut, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { user, logout } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notificationCount] = useState(3); // TODO: Replace with actual notification count

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

  // Navigate to workspace dashboard or workspaces list
  const handleLogoClick = () => {
    if (currentWorkspace) {
      router.push(`/workspaces/${currentWorkspace.id}`);
    } else {
      router.push('/workspaces');
    }
  };

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left side - Logo/Brand */}
          <div className="flex items-center">
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-2 py-1"
            >
              <ShieldCheck className="h-7 w-7 text-blue-600 group-hover:text-blue-700 transition-colors" />
              <span className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                AuditGuardX
              </span>
            </button>
          </div>

          {/* Right side - notifications, user menu */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button
              className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Notifications ${notificationCount > 0 ? `(${notificationCount} unread)` : ''}`}
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* User email (hidden on small screens) */}
            <div className="hidden text-sm sm:block">
              <p className="font-medium text-gray-900">{user?.email}</p>
            </div>

            {/* User menu dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  isMenuOpen && 'ring-2 ring-blue-500 ring-offset-2'
                )}
                aria-label="User menu"
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
              >
                {user?.email && getInitials(user.email)}
              </button>

              {/* Dropdown menu */}
              {isMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsMenuOpen(false)}
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
                          setIsMenuOpen(false);
                          router.push('/workspaces');
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <User className="h-4 w-4" />
                        Your Workspaces
                      </button>

                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          router.push('/settings');
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </button>

                      <div className="my-2 border-t border-gray-200" />

                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
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
