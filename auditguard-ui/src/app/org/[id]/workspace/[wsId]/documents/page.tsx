'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Document {
  id: string;
  filename: string;
  title: string | null;
  description: string | null;
  fileSize: number;
  contentType: string;
  category: string | null;
  uploadedBy: string;
  uploaderEmail: string;
  uploadedAt: number;
  updatedAt: number;
  processingStatus: string;
  textExtracted: boolean;
  chunkCount: number;
}

export default function WorkspaceDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const accountId = user?.userId;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed'>('all');
  const [filterFramework, setFilterFramework] = useState<string>('all');

  useEffect(() => {
    fetchDocuments();
  }, [wsId]);

  const fetchDocuments = async () => {
    try {
      const response = await api.get(`/api/workspaces/${wsId}/documents`);
      setDocuments(response.documents);
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
      await api.delete(`/api/workspaces/${wsId}/documents/${documentId}`);
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
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'failed':
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
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || doc.processingStatus === filterStatus;
    const matchesFramework = filterFramework === 'all' || doc.category === filterFramework;
    return matchesSearch && matchesStatus && matchesFramework;
  });

  const categories = Array.from(new Set(documents.filter((d) => d.category).map((d) => d.category!)));

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
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
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={filterFramework}
                  onChange={(e) => setFilterFramework(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
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
                      <span className="text-3xl">{getFileIcon(doc.contentType)}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate mb-1">
                          {doc.title || doc.filename}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{formatFileSize(doc.fileSize)}</span>
                          <span>•</span>
                          <span>{doc.contentType.split('/')[1]?.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${getStatusColor(
                        doc.processingStatus
                      )}`}
                    >
                      {doc.processingStatus.charAt(0).toUpperCase() + doc.processingStatus.slice(1)}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 mb-4">
                    {doc.description && (
                      <div className="text-sm text-gray-600">
                        {doc.description}
                      </div>
                    )}
                    {doc.category && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Category:</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {doc.category}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">Chunks:</span>
                      <span className="font-medium text-gray-900">{doc.chunkCount}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      <div>Uploaded by {doc.uploaderEmail}</div>
                      <div>{formatTimestamp(doc.uploadedAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          router.push(`/org/${orgId}/workspace/${wsId}/documents/${doc.id}`)
                        }
                        className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        Open
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
                    {documents.filter((d) => d.processingStatus === 'completed').length}
                  </div>
                  <div className="text-sm text-green-700">Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-900">
                    {documents.filter((d) => d.processingStatus === 'processing' || d.processingStatus === 'pending').length}
                  </div>
                  <div className="text-sm text-blue-700">Processing</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-900">
                    {documents.filter((d) => d.processingStatus === 'failed').length}
                  </div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
              </div>
            </div>
          )}
      </div>
    </OrganizationLayout>
  );
}
