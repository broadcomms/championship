'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MultiLevelSidebar } from '@/components/sidebar/MultiLevelSidebar';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';

interface WorkspaceSettings {
  name: string;
  description: string;
  notifications: {
    email_on_check_complete: boolean;
    email_on_critical_issue: boolean;
    email_daily_digest: boolean;
    slack_webhook_url?: string;
  };
  retention: {
    document_retention_days: number;
    check_history_retention_days: number;
  };
  automation: {
    auto_assign_issues: boolean;
    auto_run_checks_on_upload: boolean;
  };
}

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;
  const wsId = params.wsId as string;

  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [wsId]);

  const fetchSettings = async () => {
    try {
      const response = await api.get(`/workspaces/${wsId}/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await api.patch(`/workspaces/${wsId}/settings`, settings);
      alert('Settings saved successfully');
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      alert(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== settings?.name) {
      alert('Please type the workspace name correctly to confirm deletion');
      return;
    }

    try {
      await api.delete(`/workspaces/${wsId}`);
      router.push(`/org/${orgId}`);
    } catch (error: any) {
      console.error('Failed to delete workspace:', error);
      alert(error.response?.data?.message || 'Failed to delete workspace');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <MultiLevelSidebar currentOrgId={orgId} currentWorkspaceId={wsId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex h-screen">
        <MultiLevelSidebar currentOrgId={orgId} currentWorkspaceId={wsId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500">Failed to load settings</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <MultiLevelSidebar currentOrgId={orgId} currentWorkspaceId={wsId} />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Workspace Settings</h1>
            <p className="text-gray-600">
              Configure workspace preferences and behavior
            </p>
          </div>

          {/* General Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">General</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) =>
                    setSettings({ ...settings, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={settings.description}
                  onChange={(e) =>
                    setSettings({ ...settings, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.email_on_check_complete}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        email_on_check_complete: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    Email on compliance check complete
                  </div>
                  <div className="text-sm text-gray-600">
                    Receive an email when compliance checks finish running
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.email_on_critical_issue}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        email_on_critical_issue: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    Email on critical issues
                  </div>
                  <div className="text-sm text-gray-600">
                    Get notified immediately when critical compliance issues are found
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.email_daily_digest}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        email_daily_digest: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Daily digest email</div>
                  <div className="text-sm text-gray-600">
                    Receive a daily summary of workspace activity
                  </div>
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slack Webhook URL (Optional)
                </label>
                <input
                  type="url"
                  value={settings.notifications.slack_webhook_url || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        slack_webhook_url: e.target.value,
                      },
                    })
                  }
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Send notifications to a Slack channel
                </p>
              </div>
            </div>
          </div>

          {/* Automation Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Automation</h2>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.automation.auto_assign_issues}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      automation: {
                        ...settings.automation,
                        auto_assign_issues: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    Auto-assign issues to members
                  </div>
                  <div className="text-sm text-gray-600">
                    Automatically assign new issues to workspace members based on their roles
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.automation.auto_run_checks_on_upload}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      automation: {
                        ...settings.automation,
                        auto_run_checks_on_upload: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    Auto-run checks on document upload
                  </div>
                  <div className="text-sm text-gray-600">
                    Automatically run compliance checks when new documents are uploaded
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Retention Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Retention</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Retention (Days)
                </label>
                <input
                  type="number"
                  value={settings.retention.document_retention_days}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      retention: {
                        ...settings.retention,
                        document_retention_days: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set to 0 for unlimited retention
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check History Retention (Days)
                </label>
                <input
                  type="number"
                  value={settings.retention.check_history_retention_days}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      retention: {
                        ...settings.retention,
                        check_history_retention_days: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How long to keep compliance check history (0 = unlimited)
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 mb-8">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h2>
            <p className="text-sm text-red-800 mb-4">
              Once you delete a workspace, there is no going back. All documents, compliance
              checks, and issues will be permanently deleted.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Delete Workspace
            </Button>
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-red-900">
                    Delete Workspace
                  </h3>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-900 font-semibold mb-2">
                      ⚠️ This action cannot be undone
                    </p>
                    <ul className="text-sm text-red-800 space-y-1">
                      <li>• All documents will be permanently deleted</li>
                      <li>• All compliance checks and history will be lost</li>
                      <li>• All issues and comments will be removed</li>
                      <li>• Workspace members will lose access</li>
                    </ul>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type <span className="font-bold">{settings.name}</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={settings.name}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeleteConfirmText('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDelete}
                      disabled={deleteConfirmText !== settings.name}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete Workspace
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
