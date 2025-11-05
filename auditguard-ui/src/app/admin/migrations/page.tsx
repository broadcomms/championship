'use client';

import { useQuery } from '@tanstack/react-query';
import {
  GitBranch,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface Migration {
  name: string;
  version: number;
  appliedAt: number | null;
  status: 'applied' | 'pending';
  description: string;
}

interface MigrationStatusResponse {
  migrations: Migration[];
  currentVersion: number;
  pendingMigrations: number;
}

export default function MigrationsPage() {
  const { data, isLoading, refetch } = useQuery<MigrationStatusResponse>({
    queryKey: ['admin', 'migrations'],
    queryFn: async () => {
      const response = await fetch('/api/admin/migrations', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch migrations');
      return response.json();
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Database Migrations</h1>
          <p className="text-sm text-gray-600 mt-1">
            View migration history and status
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current Version</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    v{data?.currentVersion}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <GitBranch className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Applied</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {data?.migrations?.filter((m) => m.status === 'applied').length || 0}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">
                    {data?.pendingMigrations}
                  </p>
                </div>
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Pending Warning */}
          {data && data.pendingMigrations > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-900">
                  Pending Migrations Detected
                </h4>
                <p className="text-sm text-yellow-800 mt-1">
                  There are {data.pendingMigrations} pending migration(s). Your database schema may be
                  out of date. Contact your system administrator to apply pending migrations.
                </p>
              </div>
            </div>
          )}

          {/* Migrations Timeline */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Migration History</h3>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {data?.migrations?.map((migration, index) => (
                  <div key={migration.version} className="relative">
                    {/* Timeline Line */}
                    {index < (data?.migrations?.length || 0) - 1 && (
                      <div
                        className={`absolute left-6 top-12 w-0.5 h-full ${
                          migration.status === 'applied' ? 'bg-green-200' : 'bg-gray-200'
                        }`}
                      />
                    )}

                    {/* Migration Card */}
                    <div className="relative flex items-start space-x-4">
                      {/* Status Icon */}
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                          migration.status === 'applied'
                            ? 'bg-green-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        {migration.status === 'applied' ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <Clock className="h-6 w-6 text-gray-400" />
                        )}
                      </div>

                      {/* Migration Info */}
                      <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-3">
                              <h4 className="font-semibold text-gray-900">
                                {migration.name}
                              </h4>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                v{migration.version}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {migration.description}
                            </p>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              migration.status === 'applied'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {migration.status}
                          </span>
                        </div>

                        {migration.appliedAt && (
                          <div className="mt-3 flex items-center space-x-2 text-xs text-gray-500">
                            <Clock className="h-4 w-4" />
                            <span>
                              Applied on {new Date(migration.appliedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">About Database Migrations</h4>
            <p className="text-sm text-blue-800">
              Database migrations are version-controlled changes to your database schema. They ensure
              that your database structure stays synchronized with your application code. Migrations
              are automatically detected and tracked based on the existence of key database tables.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
