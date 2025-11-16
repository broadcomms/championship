'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { api } from '@/lib/api';
import { OrganizationSettings, OrganizationMember } from '@/types/organization';

const roleColors = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  billing: 'bg-yellow-100 text-yellow-800',
};

export default function OrganizationMembersPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;

  const [organization, setOrganization] = useState<OrganizationSettings | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'billing'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [orgData, membersData] = await Promise.all([
        api.get<OrganizationSettings>(`/api/organizations/${organizationId}/settings`),
        api.get<OrganizationMember[]>(`/api/organizations/${organizationId}/members`),
      ]);
      setOrganization(orgData);
      setMembers(membersData);
    } catch (err: any) {
      setError(err.error || 'Failed to load organization members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail) {
      setError('Please enter an email address');
      return;
    }

    setIsInviting(true);
    setError('');
    setSuccessMessage('');

    try {
      await api.post(`/api/organizations/${organizationId}/members`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setSuccessMessage(`Successfully invited ${inviteEmail} as ${inviteRole}`);
      setInviteEmail('');
      setInviteRole('member');
      setIsInviteFormOpen(false);
      await fetchData();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.error || 'Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member' | 'billing') => {
    setUpdatingMemberId(memberId);
    setError('');
    try {
      await api.patch(`/api/organizations/${organizationId}/members/${memberId}`, {
        role: newRole,
      });
      await fetchData();
    } catch (err: any) {
      setError(err.error || 'Failed to update role');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from this organization?`)) {
      return;
    }

    setError('');
    try {
      await api.delete(`/api/organizations/${organizationId}/members/${memberId}`);
      setSuccessMessage('Member removed successfully');
      await fetchData();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
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

  if (error && !organization) {
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
              Back to Dashboard
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-600"
            >
              ←
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Organization Members</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage who has access to {organization?.name}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => setIsInviteFormOpen(!isInviteFormOpen)}
          >
            + Add Member
          </Button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Invite Form */}
        {isInviteFormOpen && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Add New Member</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="member@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'admin' | 'member' | 'billing')
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="billing">Billing</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="primary"
                onClick={handleInviteMember}
                loading={isInviting}
              >
                Add Member
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsInviteFormOpen(false);
                  setInviteEmail('');
                  setError('');
                }}
                disabled={isInviting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="rounded-lg bg-white shadow">
          <div className="divide-y divide-gray-200">
            {members.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-600">No members found</p>
              </div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                      {member.email.substring(0, 2).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div>
                      <p className="font-medium text-gray-900">{member.email}</p>
                      <p className="text-xs text-gray-500">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Role Badge/Selector */}
                    {member.role !== 'owner' ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(
                            member.id,
                            e.target.value as 'admin' | 'member' | 'billing'
                          )
                        }
                        disabled={updatingMemberId === member.id}
                        className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="billing">Billing</option>
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

                    {/* Remove Button - Only for non-owners */}
                    {member.role !== 'owner' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id, member.email)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Member Count */}
        <div className="mt-4 text-center text-sm text-gray-600">
          {members.length} {members.length === 1 ? 'member' : 'members'} total
        </div>
      </div>
    </AppLayout>
  );
}
