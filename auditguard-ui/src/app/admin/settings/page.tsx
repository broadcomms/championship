'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface SystemSetting {
  key: string;
  value: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  category: string;
}

interface SystemSettingsResponse {
  settings: SystemSetting[];
}

export default function SystemSettingsPage() {
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SystemSettingsResponse>({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await fetch(`/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error('Failed to update setting');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
  });

  const handleSave = async (key: string) => {
    if (editedSettings[key] !== undefined) {
      setSaveStatus('saving');
      await updateMutation.mutateAsync({ key, value: editedSettings[key] });
      const newEdited = { ...editedSettings };
      delete newEdited[key];
      setEditedSettings(newEdited);
    }
  };

  const handleChange = (key: string, value: string) => {
    setEditedSettings({ ...editedSettings, [key]: value });
  };

  const getValue = (setting: SystemSetting) => {
    return editedSettings[setting.key] !== undefined
      ? editedSettings[setting.key]
      : setting.value;
  };

  const hasChanges = (key: string) => {
    return editedSettings[key] !== undefined;
  };

  // Group settings by category
  const groupedSettings = (data?.settings && Array.isArray(data.settings))
    ? data.settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category].push(setting);
        return acc;
      }, {} as Record<string, SystemSetting[]>)
    : {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure system-wide settings and preferences
          </p>
        </div>
        {saveStatus !== 'idle' && (
          <div className="flex items-center space-x-2">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm text-blue-600">Saving...</span>
              </>
            )}
            {saveStatus === 'success' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-600">Saved successfully!</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm text-red-600">Save failed</span>
              </>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSettings || {}).map(([category, settings]) => (
            <div key={category} className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 capitalize">
                  {category.replace(/_/g, ' ')}
                </h3>
              </div>

              <div className="p-6 space-y-6">
                {settings.map((setting) => (
                  <div key={setting.key} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900">
                          {setting.key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </label>
                        <p className="text-sm text-gray-600 mt-1">{setting.description}</p>
                      </div>

                      {hasChanges(setting.key) && (
                        <button
                          onClick={() => handleSave(setting.key)}
                          disabled={updateMutation.isPending}
                          className="ml-4 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 text-sm"
                        >
                          <Save className="h-4 w-4" />
                          <span>Save</span>
                        </button>
                      )}
                    </div>

                    <div className="max-w-xl">
                      {setting.type === 'boolean' ? (
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleChange(setting.key, 'true')}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                              getValue(setting) === 'true'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            Enabled
                          </button>
                          <button
                            onClick={() => handleChange(setting.key, 'false')}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                              getValue(setting) === 'false'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            Disabled
                          </button>
                        </div>
                      ) : setting.type === 'number' ? (
                        <input
                          type="number"
                          value={getValue(setting)}
                          onChange={(e) => handleChange(setting.key, e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={getValue(setting)}
                          onChange={(e) => handleChange(setting.key, e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-900">
                Caution: System-Wide Settings
              </h4>
              <p className="text-sm text-yellow-800 mt-1">
                Changes to these settings will affect all users and workspaces. Make sure you
                understand the impact of each setting before making changes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
