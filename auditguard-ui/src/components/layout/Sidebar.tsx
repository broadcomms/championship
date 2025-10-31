'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Workspaces', href: '/workspaces', icon: '🏢' },
  { name: 'Documents', href: '/documents', icon: '📄' },
  { name: 'Compliance', href: '/compliance', icon: '✓' },
  { name: 'Analytics', href: '/analytics', icon: '📈' },
  { name: 'AI Assistant', href: '/assistant', icon: '🤖' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <button
              key={item.name}
              onClick={() => router.push(item.href)}
              className={cn(
                'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="text-xs text-gray-500">
          <p className="font-medium">AuditGuard v2</p>
          <p className="mt-1">AI-Powered Compliance</p>
        </div>
      </div>
    </div>
  );
}
