'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { Building2, Users, CreditCard, Settings, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function OrganizationNav() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const organizationId = params.id as string;

  const navItems: NavItem[] = [
    { name: 'Settings', path: `/organizations/${organizationId}/settings`, icon: Settings },
    { name: 'Members', path: `/organizations/${organizationId}/members`, icon: Users },
    { name: 'Billing', path: `/organizations/${organizationId}/billing`, icon: CreditCard },
    { name: 'SSO', path: `/organizations/${organizationId}/sso`, icon: Shield },
  ];

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Back to Organizations Link */}
          <button
            onClick={() => router.push('/organizations')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1"
          >
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Organizations</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 -mb-px">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
