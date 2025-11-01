'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface Document {
  id: string;
  filename: string;
  title?: string;
  description?: string;
  fileSize: number;
  contentType: string;
  category: string | null;
  uploadedBy: string;
  uploaderEmail: string;
  uploadedAt: number;
  processingStatus: string;
  workspaceId: string;
  workspaceName: string;
}

interface Workspace {
  id: string;
  name: string;
}

export default function DocumentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Fetch all workspaces
      const workspacesResponse = await api.get<{ workspaces: Workspace[] }>('/api/workspaces');
      setWorkspaces(workspacesResponse.workspaces || []);

      // Fetch documents from all workspaces
      const allDocuments: Document[] = [];
      for (const workspace of workspacesResponse.workspaces || []) {
        try {
          const docsResponse = await api.get<{ documents: any[] }>(`/api/workspaces/${workspace.id}/documents`);
          const workspaceDocs = (docsResponse.documents || []).map((doc: any) => ({
            ...doc,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
          }));
          allDocuments.push(...workspaceDocs);
        } catch (err) {
          console.error(`Failed to fetch documents for workspace ${workspace.name}:`, err);
        }
      }

      // Sort by upload date (newest first)
      allDocuments.sort((a, b) => b.uploadedAt - a.uploadedAt);
      setDocuments(allDocuments);
    } catch (err: any) {
      setError(err.error || 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; emoji: string }> = {
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800', emoji: '⏳' },
      processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800', emoji: '⚙️' },
      completed: { label: 'Completed', className: 'bg-green-100 text-green-800', emoji: '✓' },
      failed: { label: 'Failed', className: 'bg-red-100 text-red-800', emoji: '✗' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
        <span>{config.emoji}</span>
        {config.label}
      </span>
    );
  };

  const filteredDocuments = documents.filter((doc) => {
    if (selectedWorkspace !== 'all' && doc.workspaceId !== selectedWorkspace) return false;
    if (selectedCategory !== 'all' && doc.category !== selectedCategory) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">All Documents</h1>
          <p className="mt-2 text-sm text-gray-600">
            View and manage documents across all your workspaces
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div>
            <label htmlFor="workspace-filter" className="mb-1 block text-sm font-medium text-gray-700">
              Workspace
            </label>
            <select
              id="workspace-filter"
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All Workspaces</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="category-filter" className="mb-1 block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All Categories</option>
              <option value="policy">Policy</option>
              <option value="procedure">Procedure</option>
              <option value="evidence">Evidence</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-sm text-gray-600">Loading documents...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredDocuments.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto max-w-md">
              <div className="text-6xl">📄</div>
              <h3 className="mt-6 text-lg font-medium text-gray-900">No Documents Found</h3>
              <p className="mt-2 text-sm text-gray-600">
                {documents.length === 0
                  ? "You don't have any documents yet. Upload documents to your workspaces to get started."
                  : 'No documents match your current filters. Try adjusting your filter criteria.'}
              </p>
            </div>
          </div>
        )}

        {/* Documents Table */}
        {!isLoading && !error && filteredDocuments.length > 0 && (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Document
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Workspace
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Size
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Uploaded
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="text-2xl mr-3">📄</div>
                          <div>
                            <div className="font-medium text-gray-900">{doc.title || doc.filename}</div>
                            {doc.description && (
                              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{doc.description}</div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">{doc.contentType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <button
                          onClick={() => router.push(`/workspaces/${doc.workspaceId}`)}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {doc.workspaceName}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 capitalize">
                          {doc.category || 'Other'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatFileSize(doc.fileSize)}</td>
                      <td className="px-6 py-4">{getStatusBadge(doc.processingStatus)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(doc.uploadedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/workspaces/${doc.workspaceId}/documents/${doc.id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View
                          </button>
                          {doc.processingStatus === 'completed' && (
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(
                                    `/api/workspaces/${doc.workspaceId}/documents/${doc.id}/process`,
                                    { method: 'POST', credentials: 'include' }
                                  );
                                  if (response.ok) {
                                    fetchData();
                                  }
                                } catch (error) {
                                  console.error('Failed to reprocess:', error);
                                }
                              }}
                              className="text-gray-600 hover:text-gray-800 font-medium"
                              title="Reprocess to extract title and description"
                            >
                              ↻ Reprocess
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
