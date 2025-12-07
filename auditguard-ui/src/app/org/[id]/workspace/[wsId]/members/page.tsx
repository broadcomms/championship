'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';

type WorkspaceRole = 'admin' | 'member' | 'viewer';
type InvitationStatus = 'pending' | 'accepted' | 'expired';

interface WorkspaceMember {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  added_at: number;
  last_active?: number;
}

interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;
  invited_at: number;
  status: InvitationStatus;
}

const normalizeApiResponse = <T,>(response: T | { data: T }): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
};

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const responseErr = err as { response?: { data?: { message?: string } } };
    return responseErr.response?.data?.message || fallback;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: string }).message || fallback);
  }
  return fallback;
};

export default function WorkspaceMembersPage() {
  const params = useParams<{ id: string; wsId: string }>();
  const orgId = params.id;
  const wsId = params.wsId;
  const { user } = useAuth();
  const accountId = user?.userId;

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchMembers = useCallback(async (withLoader = false) => {
    if (!wsId) return;
    if (withLoader) {
      setLoading(true);
    }
    try {
      const response = await api.get<{ members: WorkspaceMember[] }>(`/api/workspaces/${wsId}/members`);
      const normalized = normalizeApiResponse(response);
      // Backend returns { members: [...] }, extract the members array
      const membersArray = Array.isArray(normalized) ? normalized : (normalized?.members || []);
      setMembers(membersArray);
      setLoadError(null);
    } catch (error) {
      console.error('Failed to fetch members:', error);
      setLoadError(getApiErrorMessage(error, 'Failed to load members'));
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  const fetchInvitations = useCallback(async () => {
    if (!wsId) return;
    try {
      const response = await api.get<Invitation[]>(`/api/workspaces/${wsId}/invitations`);
      setInvitations(normalizeApiResponse(response));
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  }, [wsId]);

  const pendingInvitations = useMemo(() => {
    return Array.isArray(invitations) 
      ? invitations.filter((i) => i.status === 'pending')
      : [];
  }, [invitations]);

  useEffect(() => {
    fetchMembers(true);
    fetchInvitations();
  }, [fetchInvitations, fetchMembers]);

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/workspaces/${wsId}/invitations`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
      await fetchInvitations();
    } catch (error) {
      console.error('Failed to invite member:', error);
      alert(getApiErrorMessage(error, 'Failed to send invitation'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: WorkspaceRole) => {
    try {
      await api.patch(`/api/workspaces/${wsId}/members/${memberId}`, {
        role: newRole,
      });
      await fetchMembers();
    } catch (error) {
      console.error('Failed to update role:', error);
      alert(getApiErrorMessage(error, 'Failed to update member role'));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the workspace?')) {
      return;
    }

    try {
      await api.delete(`/api/workspaces/${wsId}/members/${memberId}`);
      await fetchMembers();
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert(getApiErrorMessage(error, 'Failed to remove member'));
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await api.delete(`/api/invitations/${invitationId}`);
      await fetchInvitations();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      alert(getApiErrorMessage(error, 'Failed to cancel invitation'));
    }
  };

  const getRoleBadgeColor = (role: WorkspaceRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'member':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 1) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  if (loadError) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load members</h3>
            <p className="text-gray-600 mb-4">{loadError}</p>
            <Button onClick={() => fetchMembers(true)}>Retry</Button>
          </div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Workspace Members</h1>
              <p className="text-gray-600">
                Manage who has access to this workspace
              </p>
            </div>
            <Button onClick={() => setShowInviteModal(true)}>
              ➕ Invite Member
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Total Members</span>
                <span className="text-2xl">👥</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{members.length}</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Admins</span>
                <span className="text-2xl">👑</span>
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {Array.isArray(members) ? members.filter((m) => m.role === 'admin').length : 0}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Pending Invites</span>
                <span className="text-2xl">📧</span>
              </div>
              <div className="text-3xl font-bold text-yellow-600">
                {pendingInvitations.length}
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white rounded-lg border border-gray-200 mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Members</h2>
            </div>

            <div className="divide-y divide-gray-200">
              {Array.isArray(members) && members.map((member) => (
                <div key={member.id} className="px-6 py-4 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="relative w-12 h-12">
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/user/profile-picture/${member.user_id}`}
                          alt={member.name || member.email}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                        <div className="hidden w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center text-white text-lg font-semibold">
                          {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-gray-900">
                            {member.name || member.email}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getRoleBadgeColor(
                              member.role
                            )}`}
                          >
                            {member.role}
                          </span>
                        </div>
                        {member.name && (
                          <div className="text-sm text-gray-600">{member.email}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Added {formatTimestamp(member.added_at)}
                          {member.last_active && (
                            <span> • Last active {formatTimestamp(member.last_active)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleUpdateRole(
                            member.id,
                            e.target.value as WorkspaceRole
                          )
                        }
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Pending Invitations</h2>
              </div>

              <div className="divide-y divide-gray-200">
                {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="px-6 py-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-white text-lg">
                            📧
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-gray-900">
                                {invitation.email}
                              </h3>
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getRoleBadgeColor(
                                  invitation.role
                                )}`}
                              >
                                {invitation.role}
                              </span>
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                                PENDING
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Invited by {invitation.invited_by} •{' '}
                              {formatTimestamp(invitation.invited_at)}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Role Permissions */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-4">Role Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">👑 Admin</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Full workspace access</li>
                  <li>• Manage members and settings</li>
                  <li>• Upload and delete documents</li>
                  <li>• Run compliance checks</li>
                  <li>• Assign and resolve issues</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">👤 Member</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Upload documents</li>
                  <li>• Run compliance checks</li>
                  <li>• View and resolve issues</li>
                  <li>• Comment on issues</li>
                  <li>• Cannot manage members</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">👁️ Viewer</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• View documents</li>
                  <li>• View compliance results</li>
                  <li>• View issues</li>
                  <li>• Cannot upload or modify</li>
                  <li>• Read-only access</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Invite Member to Workspace
                  </h3>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="admin">Admin - Full access</option>
                      <option value="member">Member - Can upload and edit</option>
                      <option value="viewer">Viewer - Read-only access</option>
                    </select>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-600">
                      An email invitation will be sent to this address. They&rsquo;ll need to accept
                      the invitation to join the workspace.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setShowInviteModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleInviteMember} disabled={saving}>
                      {saving ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    </OrganizationLayout>
  );
}
