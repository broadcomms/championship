'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/common/Button';
import { Bell, Mail, MessageSquare, AlertCircle, Check } from 'lucide-react';

interface NotificationPreferences {
  email: {
    issueAssigned: boolean;
    comments: boolean;
    mentions: boolean;
    dueDate: boolean;
    statusChange: boolean;
    weeklyDigest: boolean;
  };
  inApp: {
    enabled: boolean;
    sound: boolean;
  };
  browserPush: {
    enabled: boolean;
  };
}

export default function NotificationSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const accountId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {
      issueAssigned: true,
      comments: true,
      mentions: true,
      dueDate: true,
      statusChange: true,
      weeklyDigest: false
    },
    inApp: {
      enabled: true,
      sound: true
    },
    browserPush: {
      enabled: false
    }
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Verify user is accessing their own settings
    if (user.userId !== accountId) {
      router.push(`/account/${user.userId}/notifications`);
      return;
    }

    // Load preferences
    loadPreferences();
  }, [user, accountId, router]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      // TODO: Implement API endpoint to fetch notification preferences
      // const data = await api.get('/api/user/notification-preferences');
      // setPreferences(data);
      
      // For now, use default preferences
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // TODO: Implement API endpoint to save notification preferences
      // await api.put('/api/user/notification-preferences', preferences);
      
      setSuccess('Notification preferences saved successfully! (API endpoint pending)');
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (category: keyof NotificationPreferences, key: string, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  if (!user || loading) {
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
          <h1 className="text-3xl font-bold text-gray-900">Notification Settings</h1>
          <p className="mt-2 text-gray-600">
            Choose how you want to be notified about activity in AuditGuardX
          </p>
        </div>

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
            <Check className="h-5 w-5" />
            <p className="text-sm">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Email Notifications */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Email Notifications</h2>
                <p className="text-sm text-gray-600">Receive notifications via email</p>
              </div>
            </div>

            <div className="space-y-4">
              <NotificationToggle
                label="Issue Assigned"
                description="Get notified when an issue is assigned to you"
                checked={preferences.email.issueAssigned}
                onChange={(value) => updatePreference('email', 'issueAssigned', value)}
              />
              
              <NotificationToggle
                label="Comments"
                description="Get notified about new comments on issues you're involved with"
                checked={preferences.email.comments}
                onChange={(value) => updatePreference('email', 'comments', value)}
              />
              
              <NotificationToggle
                label="Mentions"
                description="Get notified when someone mentions you"
                checked={preferences.email.mentions}
                onChange={(value) => updatePreference('email', 'mentions', value)}
              />
              
              <NotificationToggle
                label="Due Dates"
                description="Reminders when issues are approaching their due date"
                checked={preferences.email.dueDate}
                onChange={(value) => updatePreference('email', 'dueDate', value)}
              />
              
              <NotificationToggle
                label="Status Changes"
                description="Updates when issue status changes"
                checked={preferences.email.statusChange}
                onChange={(value) => updatePreference('email', 'statusChange', value)}
              />
              
              <NotificationToggle
                label="Weekly Digest"
                description="Receive a weekly summary of your activity"
                checked={preferences.email.weeklyDigest}
                onChange={(value) => updatePreference('email', 'weeklyDigest', value)}
              />
            </div>
          </div>

          {/* In-App Notifications */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">In-App Notifications</h2>
                <p className="text-sm text-gray-600">Notifications within AuditGuardX</p>
              </div>
            </div>

            <div className="space-y-4">
              <NotificationToggle
                label="Enable In-App Notifications"
                description="Show notifications while using AuditGuardX"
                checked={preferences.inApp.enabled}
                onChange={(value) => updatePreference('inApp', 'enabled', value)}
              />
              
              <NotificationToggle
                label="Notification Sounds"
                description="Play sounds for new notifications"
                checked={preferences.inApp.sound}
                onChange={(value) => updatePreference('inApp', 'sound', value)}
                disabled={!preferences.inApp.enabled}
              />
            </div>
          </div>

          {/* Browser Push Notifications */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Browser Push Notifications</h2>
                <p className="text-sm text-gray-600">Get notifications even when AuditGuardX is closed</p>
              </div>
            </div>

            <div className="space-y-4">
              <NotificationToggle
                label="Enable Push Notifications"
                description="Receive browser notifications when not using AuditGuardX"
                checked={preferences.browserPush.enabled}
                onChange={(value) => updatePreference('browserPush', 'enabled', value)}
              />
              
              {preferences.browserPush.enabled && (
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> You may need to grant browser permissions for push notifications to work.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => router.push(`/account/${accountId}`)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}

// Toggle component for notification settings
interface NotificationToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function NotificationToggle({ label, description, checked, onChange, disabled = false }: NotificationToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <label className={`block font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
          {label}
        </label>
        <p className={`mt-1 text-sm ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          disabled
            ? 'bg-gray-200 cursor-not-allowed'
            : checked
            ? 'bg-blue-600'
            : 'bg-gray-200'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
