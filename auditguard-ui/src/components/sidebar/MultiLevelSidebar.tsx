'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

interface Workspace {
  id: string;
  name: string;
  organization_id: string;
}

interface SidebarProps {
  currentOrgId?: string;
  currentWorkspaceId?: string;
}

export function MultiLevelSidebar({ currentOrgId, currentWorkspaceId }: SidebarProps) {
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch workspaces for current org
  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!currentOrgId) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/api/organizations/${currentOrgId}/workspaces`);
        setWorkspaces(response?.data || response || []);
      } catch (error) {
        console.error('Failed to fetch workspaces:', error);
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, [currentOrgId]);

  // Helper to check if link is active
  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  // Organization-level navigation items
  const orgNavItems = currentOrgId ? [
    { label: 'Overview', href: `/org/${currentOrgId}`, icon: '🏢' },
    { label: 'Billing', href: `/org/${currentOrgId}/billing`, icon: '💳' },
    { label: 'Members', href: `/org/${currentOrgId}/members`, icon: '👥' },
    { label: 'Usage', href: `/org/${currentOrgId}/usage`, icon: '📊' },
    { label: 'SSO', href: `/org/${currentOrgId}/sso`, icon: '🔐' },
  ] : [];

  // Workspace-level navigation items
  const workspaceNavItems = (currentOrgId && currentWorkspaceId) ? [
    { label: 'Dashboard', href: `/org/${currentOrgId}/workspace/${currentWorkspaceId}`, icon: '📈', exact: true },
    { label: 'Documents', href: `/org/${currentOrgId}/workspace/${currentWorkspaceId}/documents`, icon: '📄' },
    { label: 'Compliance', href: `/org/${currentOrgId}/workspace/${currentWorkspaceId}/compliance`, icon: '✓' },
    { label: 'Issues', href: `/org/${currentOrgId}/workspace/${currentWorkspaceId}/issues`, icon: '📋' },
    { label: 'Analytics', href: `/org/${currentOrgId}/workspace/${currentWorkspaceId}/analytics`, icon: '📊' },
    { label: 'Assistant', href: `/org/${currentOrgId}/workspace/${currentWorkspaceId}/assistant`, icon: '🤖' },
    { label: 'Members', href: `/org/${currentOrgId}/workspace/${currentWorkspaceId}/members`, icon: '👤' },
    { label: 'Settings', href: `/org/${currentOrgId}/workspace/${currentWorkspaceId}/settings`, icon: '⚙️' },
  ] : [];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* Organization-level Navigation */}
        {currentOrgId && (
          <div className="py-4">
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Organization
            </h3>
            <nav className="space-y-1 px-2">
              {orgNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* Workspaces Section */}
        {currentOrgId && workspaces.length > 0 && (
          <div className="py-4 border-t border-gray-200">
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Workspaces
            </h3>
            <div className="space-y-4">
              {workspaces.map((workspace) => (
                <div key={workspace.id}>
                  {/* Workspace Name */}
                  <Link
                    href={`/org/${currentOrgId}/workspace/${workspace.id}`}
                    className={`block px-4 py-2 text-sm font-semibold transition ${
                      workspace.id === currentWorkspaceId
                        ? 'text-blue-700 bg-blue-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {workspace.name}
                  </Link>

                  {/* Workspace Navigation (only show for current workspace) */}
                  {workspace.id === currentWorkspaceId && (
                    <nav className="mt-1 space-y-1 px-2">
                      {workspaceNavItems.map((item) => {
                        const itemIsActive = item.exact
                          ? pathname === item.href
                          : isActive(item.href);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                              itemIsActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-base">{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </nav>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {currentOrgId && workspaces.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-gray-500">
            <p className="text-sm mb-4">No workspaces yet</p>
            <Link
              href={`/org/${currentOrgId}/workspace/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              <span>+</span>
              <span>Create Workspace</span>
            </Link>
          </div>
        )}
      </div>

      {/* Footer - Create Workspace Button */}
      {currentOrgId && workspaces.length > 0 && (
        <div className="p-4 border-t border-gray-200">
          <Link
            href={`/org/${currentOrgId}/workspace/new`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            <span>+</span>
            <span>New Workspace</span>
          </Link>
        </div>
      )}
    </aside>
  );
}
