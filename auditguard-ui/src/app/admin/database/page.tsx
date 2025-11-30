'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Database,
  ChevronRight,
  Search,
  Loader2,
} from 'lucide-react';
import { DatabaseTable } from '@/components/admin/DatabaseTable';
import { SqlEditor } from '@/components/admin/SqlEditor';

interface TableInfo {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
  }>;
  rowCount: number;
}

interface DatabaseSchema {
  tables: TableInfo[];
}

export default function DatabaseExplorer() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'browse' | 'query'>('browse');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: schema, isLoading } = useQuery<DatabaseSchema>({
    queryKey: ['admin', 'database', 'schema'],
    queryFn: async () => {
      const response = await fetch('/api/admin/database/schema', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch schema');
      return response.json();
    },
  });

  const filteredTables = schema?.tables?.filter((table) =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Database Explorer</h1>
          <p className="text-sm text-gray-600 mt-1">
            Browse and query your database
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'browse'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Browse Tables
          </button>
          <button
            onClick={() => setActiveTab('query')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'query'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            SQL Query
          </button>
        </div>
      </div>

      {activeTab === 'browse' ? (
        <div className="grid grid-cols-[320px_1fr] gap-6">
          {/* Sidebar - Table List */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tables..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTables?.map((table) => (
                    <button
                      key={table.name}
                      onClick={() => setSelectedTable(table.name)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                        selectedTable === table.name
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Database
                          className={`h-4 w-4 ${
                            selectedTable === table.name
                              ? 'text-blue-600'
                              : 'text-gray-400'
                          }`}
                        />
                        <div>
                          <p
                            className={`text-sm font-medium ${
                              selectedTable === table.name
                                ? 'text-blue-900'
                                : 'text-gray-900'
                            }`}
                          >
                            {table.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {table.rowCount?.toLocaleString() || 0} rows
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 ${
                          selectedTable === table.name
                            ? 'text-blue-600'
                            : 'text-gray-400'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Table Viewer */}
          <div>
            {selectedTable ? (
              <DatabaseTable tableName={selectedTable} />
            ) : (
              <div className="bg-white rounded-lg shadow border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
                <Database className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Table Selected
                </h3>
                <p className="text-sm text-gray-600 max-w-md">
                  Select a table from the sidebar to view its contents and structure
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <SqlEditor />
      )}
    </div>
  );
}
