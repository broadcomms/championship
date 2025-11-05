'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Download,
  Upload,
  Database,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface Backup {
  backupId: string;
  filename: string;
  tables: string[];
  totalSize: number;
  created: number;
  rowCount: number;
}

interface BackupListResponse {
  backups: Backup[];
}

interface DatabaseStats {
  tables: Array<{
    name: string;
    rowCount: number;
    columnCount: number;
    estimatedSize: number;
  }>;
  totalTables: number;
  totalRows: number;
  totalSize: number;
}

export default function BackupsPage() {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState({
    dryRun: true,
    overwrite: false,
  });
  const queryClient = useQueryClient();

  const { data: backups, isLoading: backupsLoading, refetch: refetchBackups } = useQuery<BackupListResponse>({
    queryKey: ['admin', 'backups', 'list'],
    queryFn: async () => {
      const response = await fetch('/api/admin/backup/list', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch backups');
      return response.json();
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DatabaseStats>({
    queryKey: ['admin', 'backup', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/backup/stats', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: async (options: { includeTables?: string[]; excludeTables?: string[] }) => {
      const response = await fetch('/api/admin/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(options),
      });
      if (!response.ok) throw new Error('Failed to create backup');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
      alert('Backup created successfully!');
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: { backupData: string; dryRun: boolean; overwrite: boolean }) => {
      const response = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to import backup');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.dryRun) {
        alert(`Dry run completed. Would import ${data.totalRows} rows across ${data.tables.length} tables.`);
      } else {
        alert(`Import completed! Imported ${data.totalRows} rows.`);
        queryClient.invalidateQueries({ queryKey: ['admin', 'backup', 'stats'] });
      }
    },
  });

  const handleCreateBackup = () => {
    if (confirm('Create a new database backup?')) {
      createBackupMutation.mutate({
        ...(selectedTables.length > 0 && { includeTables: selectedTables }),
      });
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      alert('Please select a file to import');
      return;
    }

    const text = await importFile.text();

    if (importOptions.dryRun) {
      importMutation.mutate({
        backupData: text,
        dryRun: true,
        overwrite: importOptions.overwrite,
      });
    } else {
      if (confirm('This will modify the database. Are you sure?')) {
        importMutation.mutate({
          backupData: text,
          dryRun: false,
          overwrite: importOptions.overwrite,
        });
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backups & Exports</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create, manage, and restore database backups
          </p>
        </div>
        <button
          onClick={() => refetchBackups()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Database Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Tables</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statsLoading ? '...' : stats?.totalTables}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Database className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Rows</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statsLoading ? '...' : stats?.totalRows?.toLocaleString() || '0'}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Archive className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Database Size</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statsLoading ? '...' : formatBytes(stats?.totalSize || 0)}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Download className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Create Backup Section */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Backup</h3>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Select tables to include (leave empty for all tables):
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
            {stats?.tables?.map((table) => (
              <label key={table.name} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedTables.includes(table.name)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTables([...selectedTables, table.name]);
                    } else {
                      setSelectedTables(selectedTables.filter((t) => t !== table.name));
                    }
                  }}
                  className="rounded border-gray-300"
                />
                <span className="truncate">{table.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={createBackupMutation.isPending}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
        >
          {createBackupMutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Creating Backup...</span>
            </>
          ) : (
            <>
              <Archive className="h-5 w-5" />
              <span>Create Backup</span>
            </>
          )}
        </button>
      </div>

      {/* Import Backup Section */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Backup</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Backup File
            </label>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={importOptions.dryRun}
                onChange={(e) =>
                  setImportOptions({ ...importOptions, dryRun: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Dry Run (preview only)</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={importOptions.overwrite}
                onChange={(e) =>
                  setImportOptions({ ...importOptions, overwrite: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Overwrite existing data</span>
            </label>
          </div>

          {!importOptions.dryRun && (
            <div className="flex items-start space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Warning: This will modify the database. Make sure you have a backup first!
              </p>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!importFile || importMutation.isPending}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span>Import Backup</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Backup History */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Backup History</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {backupsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : backups?.backups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No backups found
            </div>
          ) : (
            backups?.backups?.map((backup) => (
              <div key={backup.backupId} className="p-6 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Archive className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{backup.filename}</h4>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(backup.created).toLocaleString()}</span>
                      </span>
                      <span>{backup.tables.length} tables</span>
                      <span>{formatBytes(backup.totalSize)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4" />
                    <span>Complete</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
