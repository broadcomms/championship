'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { WorkspaceSelector } from './WorkspaceSelector';
import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigationItems: NavItem[] = [
  { name: 'Dashboard', path: '', icon: LayoutDashboard },
  { name: 'Documents', path: '/documents', icon: FileText },
  { name: 'Compliance', path: '/compliance', icon: CheckCircle2 },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: Settings },
];

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export function Sidebar({ onCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      const collapsed = savedState === 'true';
      setIsCollapsed(collapsed);
      onCollapse?.(collapsed);
    }
  }, [onCollapse]);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
    onCollapse?.(newState);
  };

  // Build workspace-aware navigation URLs
  const getNavigationUrl = (path: string) => {
    if (!currentWorkspace) {
      return '/workspaces'; // Fallback if no workspace selected
    }
    return `/workspaces/${currentWorkspace.id}${path}`;
  };

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-gray-200 bg-white transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Workspace Selector & Toggle */}
      <div className="border-b border-gray-200">
        <div className="flex h-16 items-center justify-between px-3 gap-2">
          {!isCollapsed && (
            <div className="flex-1 min-w-0 relative z-50">
              <WorkspaceSelector />
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const itemUrl = getNavigationUrl(item.path);
          // For Dashboard (empty path), only match exact URL
          // For other routes, match exact or any child routes
          const isActive = item.path === ''
            ? pathname === itemUrl
            : pathname === itemUrl || pathname?.startsWith(itemUrl + '/');

          return (
            <button
              key={item.name}
              onClick={() => router.push(itemUrl)}
              disabled={!currentWorkspace}
              className={cn(
                'group flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                isCollapsed && 'justify-center',
                !currentWorkspace && 'opacity-50 cursor-not-allowed'
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon
                className={cn(
                  'h-5 w-5 flex-shrink-0',
                  isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700',
                  !isCollapsed && 'mr-3'
                )}
              />
              {!isCollapsed && <span>{item.name}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        {isCollapsed ? (
          <div className="flex justify-center">
            <div className="h-2 w-2 rounded-full bg-green-500" title="System operational" />
          </div>
        ) : (
          <div className="text-xs text-gray-500">
            <p className="font-medium">AuditGuardX v2</p>
            <p className="mt-1">AI-Powered Compliance</p>
          </div>
        )}
      </div>
    </div>
  );
}
