'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/common/Button';
import { User, Lock, Shield, AlertCircle, Check } from 'lucide-react';
import { api } from '@/lib/api';

interface PasswordChangeForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfileSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading, checkAuth } = useAuth();
  const accountId = params.id as string;

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState('');
  const [profileUpdateError, setProfileUpdateError] = useState('');

  // Profile form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password change form
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // After loading completes, check if user exists
    if (!user) {
      router.push('/login');
      return;
    }

    // Verify user is accessing their own profile
    if (user.userId !== accountId) {
      router.push(`/account/${user.userId}/profile`);
      return;
    }

    // Initialize form with user data
    setEmail(user.email || '');
    setName(user.name || '');
  }, [user, loading, accountId, router]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileUpdateError('');
    setProfileUpdateSuccess('');

    try {
      await api.put('/api/user/profile', { name });

      // Refresh user data from server to show updated name
      await checkAuth();

      setProfileUpdateSuccess('Profile updated successfully!');

      setTimeout(() => {
        setProfileUpdateSuccess('');
      }, 3000);
    } catch (err) {
      const error = err as { error?: string };
      setProfileUpdateError(error.error || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setError('');
    setSuccess('');

    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      setPasswordSaving(false);
      return;
    }

    // Validate password strength
    if (passwordForm.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setPasswordSaving(false);
      return;
    }

    try {
      await api.post('/api/user/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setSuccess('Password changed successfully!');

      // Clear form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      const error = err as { error?: string };
      setError(error.error || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AccountLayout>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your personal information and account security
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Information */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                <p className="text-sm text-gray-600">Update your personal details</p>
              </div>
            </div>

            {profileUpdateSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
                <Check className="h-5 w-5" />
                <p className="text-sm">{profileUpdateSuccess}</p>
              </div>
            )}

            {profileUpdateError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{profileUpdateError}</p>
              </div>
            )}

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    disabled
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-500 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email address cannot be changed. Contact support if you need to update it.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>

          {/* Security - Change Password */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
                <p className="text-sm text-gray-600">Update your password to keep your account secure</p>
              </div>
            </div>

            {success && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
                <Check className="h-5 w-5" />
                <p className="text-sm">{success}</p>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new password (min. 8 characters)"
                  required
                  minLength={8}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 8 characters long
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={passwordSaving} variant="danger">
                  {passwordSaving ? 'Changing...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </div>

          {/* Account Information */}
          <div className="rounded-lg border border-gray-200 bg-blue-50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Account Information</h3>
            </div>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-gray-600">User ID</p>
                <p className="font-mono text-gray-900">{user.userId}</p>
              </div>
              <div>
                <p className="text-gray-600">Account Created</p>
                <p className="text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
