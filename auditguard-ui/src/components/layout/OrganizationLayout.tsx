'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { TopNavBar } from '@/components/navigation/TopNavBar';
import { MultiLevelSidebar } from '@/components/sidebar/MultiLevelSidebar';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { AIChatWidget } from '@/components/assistant/AIChatWidget';

interface OrganizationLayoutProps {
  children: React.ReactNode;
  accountId?: string;
  orgId: string;
  workspaceId?: string;
}

/**
 * OrganizationLayout - Full navigation layout for organization and workspace pages
 *
 * Features:
 * - Top navigation bar with org switcher, notifications, user menu, real-time status
 * - Multi-level sidebar with:
 *   - Organization selector dropdown
 *   - Organization-level navigation (Overview, Billing, Members, Usage, SSO)
 *   - Workspace list with expandable sub-navigation
 * - Breadcrumb navigation
 * - NO TABS design pattern - all navigation in sidebar
 */
export function OrganizationLayout({
  children,
  accountId,
  orgId,
  workspaceId,
}: OrganizationLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen flex-col">
        {/* Top Navbar with org switcher */}
        <TopNavBar currentOrgId={orgId} showOrgSwitcher={true} />

        {/* Main content area with sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Multi-Level Sidebar */}
          <MultiLevelSidebar
            currentOrgId={orgId}
            currentWorkspaceId={workspaceId}
          />

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-gray-50">
            {/* Breadcrumb */}
            <div className="bg-white border-b border-gray-200">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
                <Breadcrumb
                  accountId={accountId}
                  orgId={orgId}
                  workspaceId={workspaceId}
                />
              </div>
            </div>

            {/* Page content */}
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>

        {/* AI Assistant Chat Widget - Available on all workspace pages */}
        {workspaceId && <AIChatWidget workspaceId={workspaceId} />}
      </div>
    </ProtectedRoute>
  );
}
