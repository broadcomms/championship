'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Archive,
  Database,
  FileText,
  FolderOpen,
  GitBranch,
  Home,
  Package,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: Home,
  },
  {
    name: 'Database Explorer',
    href: '/admin/database',
    icon: Database,
  },
  {
    name: 'Vector Index',
    href: '/admin/vectors',
    icon: Activity,
  },
  {
    name: 'SmartBuckets',
    href: '/admin/buckets',
    icon: FolderOpen,
  },
  {
    name: 'System Health',
    href: '/admin/health',
    icon: Shield,
  },
  {
    name: 'Error Logs',
    href: '/admin/logs',
    icon: AlertTriangle,
  },
  {
    name: 'Backups',
    href: '/admin/backups',
    icon: Archive,
  },
  {
    name: 'Migrations',
    href: '/admin/migrations',
    icon: GitBranch,
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-8 w-8 text-blue-500" />
          <div>
            <h1 className="text-xl font-bold">AuditGuardX</h1>
            <p className="text-xs text-gray-400">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          // Special handling for Dashboard - exact match only
          const isActive = item.href === '/admin' 
            ? pathname === '/admin'
            : pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-400">
          <p>Version 1.0.0</p>
          <p className="mt-1">© 2025 AuditGuardX</p>
        </div>
      </div>
    </div>
  );
}
