'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { TopNavBar } from '@/components/navigation/TopNavBar';
import { MultiLevelSidebar } from '@/components/sidebar/MultiLevelSidebar';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { AIChatWidget } from '@/components/assistant/AIChatWidget';
import { ChatWidgetProvider, useChatWidget } from '@/contexts/ChatWidgetContext';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useState } from 'react';

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
 * - AI Chat Widget with voice mode support
 */
export function OrganizationLayout({
  children,
  accountId,
  orgId,
  workspaceId,
}: OrganizationLayoutProps) {
  return (
    <ProtectedRoute>
      <ChatWidgetProvider>
        <OrganizationLayoutContent
          accountId={accountId}
          orgId={orgId}
          workspaceId={workspaceId}
        >
          {children}
        </OrganizationLayoutContent>
      </ChatWidgetProvider>
    </ProtectedRoute>
  );
}

function OrganizationLayoutContent({
  children,
  accountId,
  orgId,
  workspaceId,
}: OrganizationLayoutProps) {
  const chatWidget = useChatWidget();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  return (
    <div className="flex h-screen flex-col">
      {/* Top Navbar with org switcher */}
      <TopNavBar currentOrgId={orgId} showOrgSwitcher={true} />

      {/* Main content area with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Multi-Level Sidebar with toggle */}
        <div className={`bg-white border-r border-gray-200 transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-0'
        } overflow-hidden flex-shrink-0`}>
          <MultiLevelSidebar
            currentOrgId={orgId}
            currentWorkspaceId={workspaceId}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 relative">
          {/* Breadcrumb + Sidebar Toggle Row */}
          <div className="bg-white border-b border-gray-200">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
              {/* Sidebar Toggle Button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg shadow-sm transition-colors flex items-center justify-center"
                title={isSidebarOpen ? 'Hide navigation' : 'Show navigation'}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose className="w-4 h-4 text-gray-600" />
                ) : (
                  <PanelLeft className="w-4 h-4 text-gray-600" />
                )}
              </button>

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
      {workspaceId && (
        <AIChatWidget
          workspaceId={workspaceId}
          initialMode={chatWidget.mode}
          onModeChange={chatWidget.setMode}
        />
      )}
    </div>
  );
}
