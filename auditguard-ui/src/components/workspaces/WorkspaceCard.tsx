'use client';

import { useRouter } from 'next/navigation';
import { WorkspaceWithRole } from '@/types/workspace';
import { cn } from '@/lib/utils';

interface WorkspaceCardProps {
  workspace: WorkspaceWithRole;
}

const roleColors = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
};

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/workspaces/${workspace.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
    >
      {/* Workspace Icon and Title */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-2xl">
            🏢
          </div>
          <div className="ml-3">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
              {workspace.name}
            </h3>
            <div className="mt-1">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  roleColors[workspace.role]
                )}
              >
                {workspace.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {workspace.description && (
        <p className="mb-4 line-clamp-2 text-sm text-gray-600">
          {workspace.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-100 pt-4 text-xs text-gray-500">
        <div className="flex items-center">
          <span className="mr-1">👥</span>
          <span>
            {workspace.memberCount ?? 1} member{workspace.memberCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center">
          <span className="mr-1">📅</span>
          <span>
            {new Date(workspace.createdAt || workspace.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
