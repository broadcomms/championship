'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { TopNavBar } from '@/components/navigation/TopNavBar';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface AccountLayoutProps {
  children: React.ReactNode;
  accountId?: string;
  customBreadcrumbItems?: BreadcrumbItem[];
}

/**
 * AccountLayout - Minimal layout for account-level pages
 *
 * Features:
 * - Top navigation bar with user menu, notifications (no org switcher)
 * - Breadcrumb navigation
 * - No sidebar (account pages don't need workspace navigation)
 * - Real-time status indicator in top bar
 */
export function AccountLayout({ children, accountId, customBreadcrumbItems }: AccountLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen flex-col bg-gray-50">
        {/* Top Navbar - No org switcher for account pages */}
        <TopNavBar showOrgSwitcher={false} />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          {/* Breadcrumb */}
          {accountId && (
            <div className="bg-white border-b border-gray-200">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
                <Breadcrumb accountId={accountId} customItems={customBreadcrumbItems} />
              </div>
            </div>
          )}

          {/* Page content */}
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
