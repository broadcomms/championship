'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/common/Button';
import { User, Lock, Shield, AlertCircle, Check, Camera, Trash2, X } from 'lucide-react';
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

  // Profile picture state
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [pictureTimestamp, setPictureTimestamp] = useState(Date.now());
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [deletingPicture, setDeletingPicture] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const [pictureSuccess, setPictureSuccess] = useState('');

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
    setProfilePicture(user.profilePictureUrl || null);
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

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setPictureError('Only JPG, PNG, and GIF files are allowed');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setPictureError('File size must be less than 5MB');
      return;
    }

    setUploadingPicture(true);
    setPictureError('');
    setPictureSuccess('');

    try {
      // Use the uploadFile method from the API client
      await api.uploadFile('/api/user/profile-picture', file);

      // Refresh user data to get updated profile picture
      await checkAuth();

      // Update timestamp to bust cache
      setPictureTimestamp(Date.now());

      setPictureSuccess('Profile picture uploaded successfully!');
      setTimeout(() => setPictureSuccess(''), 3000);
    } catch (err) {
      const error = err as { error?: string };
      setPictureError(error.error || 'Failed to upload profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleProfilePictureDelete = async () => {
    setDeletingPicture(true);
    setPictureError('');
    setPictureSuccess('');

    try {
      await api.delete('/api/user/profile-picture');

      // Refresh user data to clear profile picture
      await checkAuth();

      // Update timestamp to bust cache
      setPictureTimestamp(Date.now());

      setPictureSuccess('Profile picture deleted successfully!');
      setTimeout(() => setPictureSuccess(''), 3000);
    } catch (err) {
      const error = err as { error?: string };
      setPictureError(error.error || 'Failed to delete profile picture');
    } finally {
      setDeletingPicture(false);
    }
  };

  const handleAccountDeletion = async () => {
    setDeletingAccount(true);
    setDeleteError('');

    // Validate email matches
    if (deleteEmail !== user?.email) {
      setDeleteError('Email does not match your account email');
      setDeletingAccount(false);
      return;
    }

    try {
      await api.delete('/api/user/account', {
        confirmEmail: deleteEmail,
        password: deletePassword,
      });

      // Redirect to login page after successful deletion
      router.push('/login?deleted=true');
    } catch (err) {
      const error = err as { error?: string };
      setDeleteError(error.error || 'Failed to delete account');
      setDeletingAccount(false);
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
    <AccountLayout
      accountId={accountId}
      customBreadcrumbItems={[
        { label: 'Profile Settings', href: `/account/${accountId}/profile` }
      ]}
    >
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
            <p className="mt-2 text-gray-600">
              Manage your personal information and account security
            </p>
          </div>
          <button
            onClick={() => router.push(`/account/${accountId}`)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
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

          {/* Profile Picture */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Profile Picture</h2>
                <p className="text-sm text-gray-600">Upload a profile picture (max 5MB)</p>
              </div>
            </div>

            {pictureSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
                <Check className="h-5 w-5" />
                <p className="text-sm">{pictureSuccess}</p>
              </div>
            )}

            {pictureError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{pictureError}</p>
              </div>
            )}

            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                {profilePicture && user?.userId ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/user/profile-picture/${user.userId}?t=${pictureTimestamp}`}
                    alt="Profile"
                    className="h-24 w-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white">
                    {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif"
                      onChange={handleProfilePictureUpload}
                      disabled={uploadingPicture}
                      className="hidden"
                    />
                    <span className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition">
                      {uploadingPicture ? 'Uploading...' : 'Upload Picture'}
                    </span>
                  </label>

                  {profilePicture && (
                    <Button
                      variant="outline"
                      onClick={handleProfilePictureDelete}
                      disabled={deletingPicture}
                    >
                      {deletingPicture ? 'Deleting...' : 'Delete Picture'}
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Supported formats: JPG, PNG, GIF (max 5MB)
                </p>
              </div>
            </div>
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

          {/* Danger Zone - Account Deletion */}
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-red-900">Danger Zone</h3>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              Once you delete your account, there is no going back. This will permanently delete:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-700 mb-4 space-y-1">
              <li>All organizations you own</li>
              <li>All workspaces in those organizations</li>
              <li>All documents and compliance checks</li>
              <li>Your Stripe subscription (if any)</li>
              <li>All your personal data</li>
            </ul>
            <Button
              variant="danger"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Account
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-w-md w-full rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Delete Account</h3>
              <p className="mt-2 text-sm text-gray-600">
                This action cannot be undone. Please confirm by entering your email and password.
              </p>
            </div>

            {deleteError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{deleteError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="deleteEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="deleteEmail"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="deletePassword"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteEmail('');
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  disabled={deletingAccount}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleAccountDeletion}
                  disabled={deletingAccount || !deleteEmail || !deletePassword}
                  className="flex-1"
                >
                  {deletingAccount ? 'Deleting...' : 'Delete Account'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
