'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Bell, Mail, Smartphone, Moon, Clock } from 'lucide-react';
import {
  NotificationSettings as NotificationSettingsType,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '@/types/notification';

interface NotificationSettingsPanelProps {
  workspaceId: string;
  onSave?: (settings: NotificationSettingsType) => void;
}

export default function NotificationSettingsPanel({
  workspaceId,
  onSave,
}: NotificationSettingsPanelProps) {
  const [settings, setSettings] = useState<NotificationSettingsType>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [workspaceId]);

  const loadSettings = async () => {
    try {
      const response = await fetch(`/api/assistant/notifications/settings?workspaceId=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || DEFAULT_NOTIFICATION_SETTINGS);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const response = await fetch(`/api/assistant/notifications/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          settings,
        }),
      });

      if (response.ok) {
        setSaveSuccess(true);
        if (onSave) {
          onSave(settings);
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = (path: string, value: any) => {
    setSettings((prev) => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-gray-700" />
          <h2 className="text-2xl font-semibold text-gray-900">Notification Settings</h2>
        </div>
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            saveSuccess
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Master Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Enable Notifications</h3>
              <p className="text-sm text-gray-600">Receive notifications for important updates</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateSettings('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Notification Categories</h3>
        <p className="text-sm text-gray-600">Choose which types of notifications you want to receive</p>

        <div className="space-y-3">
          {Object.entries(settings.categories).map(([category, enabled]) => (
            <ToggleItem
              key={category}
              label={getCategoryLabel(category)}
              description={getCategoryDescription(category)}
              checked={enabled}
              onChange={(checked) => updateSettings(`categories.${category}`, checked)}
              disabled={!settings.enabled}
            />
          ))}
        </div>
      </div>

      {/* Channels */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Notification Channels</h3>
        <p className="text-sm text-gray-600">Select how you want to receive notifications</p>

        <div className="space-y-3">
          <ToggleItem
            icon={<Bell className="w-5 h-5 text-blue-600" />}
            label="In-App Notifications"
            description="Show notifications within the application"
            checked={settings.channels.inApp}
            onChange={(checked) => updateSettings('channels.inApp', checked)}
            disabled={!settings.enabled}
          />
          <ToggleItem
            icon={<Mail className="w-5 h-5 text-green-600" />}
            label="Email Notifications"
            description="Send notifications to your email address"
            checked={settings.channels.email}
            onChange={(checked) => updateSettings('channels.email', checked)}
            disabled={!settings.enabled}
          />
          <ToggleItem
            icon={<Smartphone className="w-5 h-5 text-purple-600" />}
            label="Push Notifications"
            description="Show browser push notifications"
            checked={settings.channels.push}
            onChange={(checked) => updateSettings('channels.push', checked)}
            disabled={!settings.enabled}
          />
        </div>
      </div>

      {/* Frequency */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Notification Frequency</h3>
        <p className="text-sm text-gray-600">Control how often you receive notifications</p>

        <div className="space-y-4">
          <ToggleItem
            label="Real-Time Notifications"
            description="Receive notifications immediately as events occur"
            checked={settings.frequency.realTime}
            onChange={(checked) => updateSettings('frequency.realTime', checked)}
            disabled={!settings.enabled}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email Digest Frequency</label>
            <select
              value={settings.frequency.digest}
              onChange={(e) => updateSettings('frequency.digest', e.target.value)}
              disabled={!settings.enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="never">Never</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {/* Quiet Hours */}
          <div className="space-y-3 pt-3 border-t border-gray-200">
            <ToggleItem
              icon={<Clock className="w-5 h-5 text-orange-600" />}
              label="Quiet Hours"
              description="Mute notifications during specific hours"
              checked={settings.frequency.quietHours.enabled}
              onChange={(checked) => updateSettings('frequency.quietHours.enabled', checked)}
              disabled={!settings.enabled}
            />

            {settings.frequency.quietHours.enabled && (
              <div className="grid grid-cols-2 gap-3 ml-8">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Start Time</label>
                  <input
                    type="time"
                    value={settings.frequency.quietHours.startTime}
                    onChange={(e) => updateSettings('frequency.quietHours.startTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">End Time</label>
                  <input
                    type="time"
                    value={settings.frequency.quietHours.endTime}
                    onChange={(e) => updateSettings('frequency.quietHours.endTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Priority Levels */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Priority Levels</h3>
        <p className="text-sm text-gray-600">Choose which priority levels to receive</p>

        <div className="space-y-3">
          {Object.entries(settings.priorities).map(([priority, enabled]) => (
            <ToggleItem
              key={priority}
              label={getPriorityLabel(priority)}
              description={getPriorityDescription(priority)}
              checked={enabled}
              onChange={(checked) => updateSettings(`priorities.${priority}`, checked)}
              disabled={!settings.enabled}
            />
          ))}
        </div>
      </div>

      {/* Do Not Disturb */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <ToggleItem
          icon={<Moon className="w-5 h-5 text-indigo-600" />}
          label="Do Not Disturb"
          description="Mute all notifications except urgent ones"
          checked={settings.doNotDisturb.enabled}
          onChange={(checked) => updateSettings('doNotDisturb.enabled', checked)}
          disabled={!settings.enabled}
        />

        {settings.doNotDisturb.enabled && (
          <div className="ml-8 text-sm text-gray-600 bg-indigo-50 rounded-lg p-3">
            <p>Only urgent notifications will be shown while Do Not Disturb is enabled.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Toggle Item Component
function ToggleItem({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {description && <p className="text-xs text-gray-600">{description}</p>}
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
      </label>
    </div>
  );
}

// Helper Functions
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    compliance: 'Compliance Alerts',
    system: 'System Notifications',
    insight: 'AI Insights',
    report: 'Reports & Summaries',
    alert: 'Critical Alerts',
  };
  return labels[category] || category;
}

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    compliance: 'Notifications about compliance issues and violations',
    system: 'General system updates and messages',
    insight: 'AI-generated insights and recommendations',
    report: 'Weekly and monthly report summaries',
    alert: 'Critical alerts requiring immediate attention',
  };
  return descriptions[category] || '';
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    urgent: 'Urgent (Critical issues)',
    high: 'High (Important updates)',
    normal: 'Normal (General notifications)',
    low: 'Low (Informational)',
  };
  return labels[priority] || priority;
}

function getPriorityDescription(priority: string): string {
  const descriptions: Record<string, string> = {
    urgent: 'Critical issues requiring immediate action',
    high: 'Important updates that need attention soon',
    normal: 'General notifications and updates',
    low: 'Informational messages and tips',
  };
  return descriptions[priority] || '';
}
