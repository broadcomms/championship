'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MultiLevelSidebar } from '@/components/sidebar/MultiLevelSidebar';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';

interface Document {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: number;
  status: 'processing' | 'ready' | 'error';
  tags?: string[];
  framework?: string;
  compliance_score?: number;
}

export default function WorkspaceDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;
  const wsId = params.wsId as string;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'processing' | 'ready' | 'error'>('all');
  const [filterFramework, setFilterFramework] = useState<string>('all');

  useEffect(() => {
    fetchDocuments();
  }, [wsId]);

  const fetchDocuments = async () => {
    try {
      const response = await api.get(`/workspaces/${wsId}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/documents/${documentId}`);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('doc')) return '📝';
    if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
    if (fileType.includes('image')) return '🖼️';
    return '📎';
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    const matchesFramework = filterFramework === 'all' || doc.framework === filterFramework;
    return matchesSearch && matchesStatus && matchesFramework;
  });

  const frameworks = Array.from(new Set(documents.filter((d) => d.framework).map((d) => d.framework)));

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

  return (
    <div className="flex h-screen">
      <MultiLevelSidebar currentOrgId={orgId} currentWorkspaceId={wsId} />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
              <p className="text-gray-600">
                Manage and organize your compliance documents
              </p>
            </div>
            <Button
              onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/documents/upload`)}
            >
              📤 Upload Document
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="ready">Ready</option>
                  <option value="processing">Processing</option>
                  <option value="error">Error</option>
                </select>
              </div>

              {/* Framework Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Framework
                </label>
                <select
                  value={filterFramework}
                  onChange={(e) => setFilterFramework(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Frameworks</option>
                  {frameworks.map((framework) => (
                    <option key={framework} value={framework}>
                      {framework}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Documents Grid */}
          {filteredDocuments.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
              </h3>
              <p className="text-gray-600 mb-6">
                {documents.length === 0
                  ? 'Upload your first document to get started with compliance checking'
                  : 'Try adjusting your search or filters'}
              </p>
              {documents.length === 0 && (
                <Button
                  onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/documents/upload`)}
                >
                  📤 Upload Document
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-3xl">{getFileIcon(doc.file_type)}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate mb-1">
                          {doc.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{formatFileSize(doc.file_size)}</span>
                          <span>•</span>
                          <span>{doc.file_type.split('/')[1]?.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${getStatusColor(
                        doc.status
                      )}`}
                    >
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 mb-4">
                    {doc.framework && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Framework:</span>
                        <span className="font-medium text-gray-900">{doc.framework}</span>
                      </div>
                    )}
                    {doc.compliance_score !== undefined && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Compliance Score:</span>
                        <span
                          className={`font-semibold ${
                            doc.compliance_score >= 80
                              ? 'text-green-600'
                              : doc.compliance_score >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {doc.compliance_score}%
                        </span>
                      </div>
                    )}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {doc.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      <div>Uploaded by {doc.uploaded_by}</div>
                      <div>{formatTimestamp(doc.uploaded_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          router.push(`/org/${orgId}/workspace/${wsId}/documents/${doc.id}`)
                        }
                        className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats Footer */}
          {documents.length > 0 && (
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-900">
                    {documents.length}
                  </div>
                  <div className="text-sm text-blue-700">Total Documents</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-900">
                    {documents.filter((d) => d.status === 'ready').length}
                  </div>
                  <div className="text-sm text-green-700">Ready</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-900">
                    {documents.filter((d) => d.status === 'processing').length}
                  </div>
                  <div className="text-sm text-blue-700">Processing</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-900">
                    {documents.filter((d) => d.status === 'error').length}
                  </div>
                  <div className="text-sm text-red-700">Errors</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
