'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  accountId?: string;
  orgId?: string;
  workspaceId?: string;
  customItems?: BreadcrumbItem[];
}

export function Breadcrumb({ accountId, orgId, workspaceId, customItems }: BreadcrumbProps) {
  const pathname = usePathname();

  const [orgName, setOrgName] = useState<string>('');
  const [workspaceName, setWorkspaceName] = useState<string>('');

  useEffect(() => {
    const fetchNames = async () => {
      try {
        if (orgId) {
          const orgResponse = await api.get<{ name?: string }>(`/api/organizations/${orgId}`);
          setOrgName(orgResponse.name ?? 'Organization');
        }
        if (workspaceId) {
          const wsResponse = await api.get<{ name?: string }>(`/api/workspaces/${workspaceId}`);
          setWorkspaceName(wsResponse.name ?? 'Workspace');
        }
      } catch (error) {
        console.error('Failed to fetch breadcrumb names:', error);
      }
    };

    fetchNames();
  }, [orgId, workspaceId]);

  // Build breadcrumb items
  const items: BreadcrumbItem[] = [];

  // Home - always links to landing page
  items.push({ label: '🏠 Home', href: '/' });

  // Account level - always show if we have accountId
  if (accountId) {
    items.push({ label: 'Account', href: `/account/${accountId}` });
  }

  // Organization level
  if (orgId) {
    items.push({
      label: orgName || 'Organization',
      href: `/org/${orgId}`,
    });

    // Check for org-level pages
    if (pathname?.includes('/billing')) {
      items.push({ label: 'Billing', href: `/org/${orgId}/billing` });
    } else if (pathname?.includes('/members') && !pathname?.includes('/workspace/')) {
      items.push({ label: 'Members', href: `/org/${orgId}/members` });
    } else if (pathname?.includes('/usage')) {
      items.push({ label: 'Usage', href: `/org/${orgId}/usage` });
    } else if (pathname?.includes('/sso')) {
      items.push({ label: 'SSO', href: `/org/${orgId}/sso` });
    }
  }

  // Workspace level
  if (workspaceId && orgId) {
    items.push({
      label: workspaceName || 'Workspace',
      href: `/org/${orgId}/workspace/${workspaceId}`,
    });

    // Check for workspace-level pages
    if (pathname?.includes('/documents/upload')) {
      items.push({
        label: 'Documents',
        href: `/org/${orgId}/workspace/${workspaceId}/documents`,
      });
      items.push({
        label: 'Upload',
        href: `/org/${orgId}/workspace/${workspaceId}/documents/upload`,
      });
    } else if (pathname?.includes('/documents')) {
      items.push({
        label: 'Documents',
        href: `/org/${orgId}/workspace/${workspaceId}/documents`,
      });
    } else if (pathname?.includes('/compliance/run')) {
      items.push({
        label: 'Compliance',
        href: `/org/${orgId}/workspace/${workspaceId}/compliance`,
      });
      items.push({
        label: 'Run Check',
        href: `/org/${orgId}/workspace/${workspaceId}/compliance/run`,
      });
    } else if (pathname?.includes('/compliance')) {
      items.push({
        label: 'Compliance',
        href: `/org/${orgId}/workspace/${workspaceId}/compliance`,
      });
    } else if (pathname?.includes('/issues/') && pathname?.split('/').length > 7) {
      items.push({
        label: 'Issues',
        href: `/org/${orgId}/workspace/${workspaceId}/issues`,
      });
      items.push({
        label: 'Issue Details',
        href: pathname,
      });
    } else if (pathname?.includes('/issues')) {
      items.push({
        label: 'Issues',
        href: `/org/${orgId}/workspace/${workspaceId}/issues`,
      });
    } else if (pathname?.includes('/analytics')) {
      items.push({
        label: 'Analytics',
        href: `/org/${orgId}/workspace/${workspaceId}/analytics`,
      });
    } else if (pathname?.includes('/assistant')) {
      items.push({
        label: 'AI Assistant',
        href: `/org/${orgId}/workspace/${workspaceId}/assistant`,
      });
    } else if (pathname?.includes('/members')) {
      items.push({
        label: 'Members',
        href: `/org/${orgId}/workspace/${workspaceId}/members`,
      });
    } else if (pathname?.includes('/settings')) {
      items.push({
        label: 'Settings',
        href: `/org/${orgId}/workspace/${workspaceId}/settings`,
      });
    }
  }

  // Add custom items if provided
  if (customItems) {
    items.push(...customItems);
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600">
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <span className="mx-2 text-gray-400">/</span>}
          {index === items.length - 1 ? (
            <span className="font-semibold text-gray-900">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="hover:text-blue-600 transition"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
