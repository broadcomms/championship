'use client';

import { useRouter } from 'next/navigation';
import { OrganizationWithRole } from '@/types/organization';
import { cn } from '@/lib/utils';
import { Building2, Users, Briefcase, Settings } from 'lucide-react';

interface OrganizationCardProps {
  organization: OrganizationWithRole;
}

const roleColors = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  billing: 'bg-amber-100 text-amber-800',
};

export function OrganizationCard({ organization }: OrganizationCardProps) {
  const router = useRouter();

  const handleNavigate = (path: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(path);
  };

  return (
    <div className="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
      {/* Organization Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <div className="ml-3">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
              {organization.name}
            </h3>
            <div className="mt-1">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  roleColors[organization.role as keyof typeof roleColors] || roleColors.member
                )}
              >
                {organization.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 flex items-center gap-4 border-t border-gray-100 pt-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          <span>
            {organization.member_count} member{organization.member_count !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Briefcase className="h-4 w-4" />
          <span>
            {organization.workspace_count} workspace{organization.workspace_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 border-t border-gray-100 pt-4">
        <button
          onClick={handleNavigate(`/organizations/${organization.id}/settings`)}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
        <button
          onClick={handleNavigate(`/organizations/${organization.id}/members`)}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Users className="h-4 w-4" />
          Members
        </button>
      </div>
    </div>
  );
}
