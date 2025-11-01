'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/common/Button';
import { InviteMemberDialog } from '@/components/workspaces/InviteMemberDialog';
import { api } from '@/lib/api';
import { WorkspaceWithRole, WorkspaceMember } from '@/types/workspace';

interface WorkspaceMemberItem {
  userId: string;
  email: string;
  name?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  addedAt: number;
  addedBy: string;
}

const roleColors = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
};

export default function WorkspaceMembersPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<WorkspaceWithRole | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [workspaceData, membersResponse] = await Promise.all([
        api.get<WorkspaceWithRole>(`/api/workspaces/${workspaceId}`),
        api.get<{ members: WorkspaceMemberItem[] }>(`/api/workspaces/${workspaceId}/members`),
      ]);
      setWorkspace(workspaceData);
      setMembers(membersResponse.members || []);
    } catch (err: any) {
      setError(err.error || 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member' | 'viewer') => {
    setUpdatingMemberId(memberId);
    try {
      await api.put(`/api/workspaces/${workspaceId}/members/${memberId}`, { role: newRole });
      await fetchData();
    } catch (err: any) {
      setError(err.error || 'Failed to update role');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      await api.delete(`/api/workspaces/${workspaceId}/members/${memberId}`);
      await fetchData();
    } catch (err: any) {
      setError(err.error || 'Failed to remove member');
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading members...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !workspace) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/workspaces')}
              className="mt-3"
            >
              Back to Workspaces
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const canManage = workspace?.role === 'owner' || workspace?.role === 'admin';

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}`)}
              className="text-gray-400 hover:text-gray-600"
            >
              ←
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage who has access to {workspace?.name}
              </p>
            </div>
          </div>
          {canManage && (
            <Button variant="primary" onClick={() => setIsInviteDialogOpen(true)}>
              + Invite Member
            </Button>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Members List */}
        <div className="rounded-lg bg-white shadow">
          <div className="divide-y divide-gray-200">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                    {member.name
                      ? member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                      : member.email.substring(0, 2).toUpperCase()}
                  </div>

                  {/* User Info */}
                  <div>
                    <p className="font-medium text-gray-900">{member.name || member.email}</p>
                    <p className="text-sm text-gray-600">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Role Badge/Selector */}
                  {canManage && member.role !== 'owner' ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(
                          member.userId,
                          e.target.value as 'admin' | 'member' | 'viewer'
                        )
                      }
                      disabled={updatingMemberId === member.userId}
                      className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        roleColors[member.role]
                      }`}
                    >
                      {member.role}
                    </span>
                  )}

                  {/* Remove Button */}
                  {canManage && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {members.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-4xl">👥</div>
              <p className="mt-4 text-sm text-gray-600">No members yet</p>
              <p className="mt-1 text-xs text-gray-500">
                Invite team members to collaborate on this workspace
              </p>
            </div>
          )}
        </div>

        {/* Role Descriptions */}
        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-blue-900">Role Permissions</h3>
          <div className="space-y-1 text-xs text-blue-800">
            <p>
              <strong>Owner:</strong> Full access including workspace deletion (cannot be changed)
            </p>
            <p>
              <strong>Admin:</strong> Can manage members, settings, and all workspace content
            </p>
            <p>
              <strong>Member:</strong> Can upload documents and run compliance checks
            </p>
            <p>
              <strong>Viewer:</strong> Read-only access to documents and reports
            </p>
          </div>
        </div>
      </div>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        isOpen={isInviteDialogOpen}
        workspaceId={workspaceId}
        onClose={() => setIsInviteDialogOpen(false)}
        onSuccess={fetchData}
      />
    </AppLayout>
  );
}
