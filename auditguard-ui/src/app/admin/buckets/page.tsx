'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderOpen,
  File,
  Trash2,
  Download,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface BucketObject {
  key: string;
  size: number;
  lastModified: string;
  contentType: string;
  metadata?: Record<string, any>;
}

interface BucketListResponse {
  objects: BucketObject[];
  totalCount: number;
  continuationToken?: string;
}

export default function SmartBucketPage() {
  const [selectedBucket] = useState('documents-bucket');
  const [searchPrefix, setSearchPrefix] = useState('');
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<BucketListResponse>({
    queryKey: ['admin', 'buckets', selectedBucket, searchPrefix],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(searchPrefix && { prefix: searchPrefix }),
        limit: '100',
      });
      const response = await fetch(
        `/api/admin/buckets/${selectedBucket}/objects?${params}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch bucket objects');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      const response = await fetch(`/api/admin/buckets/${selectedBucket}/objects`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ keys }),
      });
      if (!response.ok) throw new Error('Failed to delete objects');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'buckets'] });
      setSelectedObjects(new Set());
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const response = await fetch(`/api/admin/buckets/${selectedBucket}/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dryRun }),
      });
      if (!response.ok) throw new Error('Failed to cleanup');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'buckets'] });
    },
  });

  const handleDownload = async (key: string) => {
    try {
      const response = await fetch(
        `/api/admin/buckets/${selectedBucket}/objects/${encodeURIComponent(key)}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to download');

      const data = await response.json();
      const blob = new Blob([data.content], { type: data.contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = key.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download object');
    }
  };

  const handleDelete = () => {
    if (selectedObjects.size === 0) return;
    if (confirm(`Delete ${selectedObjects.size} object(s)?`)) {
      deleteMutation.mutate(Array.from(selectedObjects));
    }
  };

  const toggleSelection = (key: string) => {
    const newSelection = new Set(selectedObjects);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedObjects(newSelection);
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
          <h1 className="text-2xl font-bold text-gray-900">SmartBucket Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage document storage and objects
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => cleanupMutation.mutate(true)}
            disabled={cleanupMutation.isPending}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {cleanupMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>Cleanup Check</span>
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Objects</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {data?.totalCount?.toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <File className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Size</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatBytes(data?.objects?.reduce((sum, obj) => sum + obj.size, 0) || 0)}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <FolderOpen className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Selected</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {selectedObjects.size}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Trash2 className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Objects List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchPrefix}
                onChange={(e) => setSearchPrefix(e.target.value)}
                placeholder="Search by prefix..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {selectedObjects.size > 0 && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>Delete ({selectedObjects.size})</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : data?.objects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No objects found in this bucket
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        (data?.objects?.length || 0) > 0 &&
                        data?.objects?.every((obj) => selectedObjects.has(obj.key)) || false
                      }
                      onChange={(e) => {
                        if (e.target.checked && data?.objects) {
                          setSelectedObjects(new Set(data.objects.map((obj) => obj.key)));
                        } else {
                          setSelectedObjects(new Set());
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Modified
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.objects.map((obj) => (
                  <tr key={obj.key} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedObjects.has(obj.key)}
                        onChange={() => toggleSelection(obj.key)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <File className="h-4 w-4 text-gray-400" />
                        <span className="truncate max-w-md">{obj.key}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatBytes(obj.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {obj.contentType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(obj.lastModified).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleDownload(obj.key)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
