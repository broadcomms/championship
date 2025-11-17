'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { MultiLevelSidebar } from '@/components/sidebar/MultiLevelSidebar';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: number;
  last_active?: number;
}

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'member';
  invited_by: string;
  invited_at: number;
  expires_at: number;
  status: 'pending' | 'accepted' | 'expired';
}

export default function OrganizationMembersPage() {
  const params = useParams();
  const orgId = params.id as string;

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        api.get(`/organizations/${orgId}/members`),
        api.get(`/organizations/${orgId}/invitations`),
      ]);

      setMembers(membersRes.data);
      setInvitations(invitationsRes.data);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      await api.post(`/organizations/${orgId}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
      });

      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
      await fetchData();
    } catch (error) {
      console.error('Failed to invite member:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      await api.delete(`/organizations/${orgId}/members/${memberId}`);
      await fetchData();
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member. Please try again.');
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      await api.patch(`/organizations/${orgId}/members/${memberId}`, {
        role: newRole,
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update member role. Please try again.');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await api.delete(`/organizations/${orgId}/invitations/${invitationId}`);
      await fetchData();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      alert('Failed to cancel invitation. Please try again.');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <MultiLevelSidebar currentOrgId={orgId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <MultiLevelSidebar currentOrgId={orgId} />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-5xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Organization Members
              </h1>
              <p className="text-gray-600">
                Manage who has access to this organization
              </p>
            </div>
            <Button onClick={() => setShowInviteModal(true)}>
              + Invite Member
            </Button>
          </div>

          {/* Members List */}
          <div className="bg-white rounded-lg border border-gray-200 mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Members ({members.length})
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {member.email[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div>
                      <div className="font-medium text-gray-900">
                        {member.email}
                      </div>
                      <div className="text-sm text-gray-600">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                        {member.last_active && (
                          <span className="ml-3">
                            · Last active{' '}
                            {new Date(member.last_active).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Role Badge/Selector */}
                    {member.role === 'owner' ? (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(
                          member.role
                        )}`}
                      >
                        Owner
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleUpdateRole(
                            member.id,
                            e.target.value as 'admin' | 'member'
                          )
                        }
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    )}

                    {/* Remove Button */}
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {members.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500">
                  No members yet
                </div>
              )}
            </div>
          </div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Pending Invitations ({invitations.length})
                </h2>
              </div>

              <div className="divide-y divide-gray-200">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="px-6 py-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {invitation.email}
                      </div>
                      <div className="text-sm text-gray-600">
                        Invited {new Date(invitation.invited_at).toLocaleDateString()}
                        · Expires {new Date(invitation.expires_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(
                          invitation.role
                        )}`}
                      >
                        {invitation.role}
                      </span>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Invite Member
                  </h3>
                </div>

                <form onSubmit={handleInvite} className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as 'admin' | 'member')
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="member">Member - Can view and collaborate</option>
                      <option value="admin">
                        Admin - Can manage members and settings
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowInviteModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviting}>
                      {inviting ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
