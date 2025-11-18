'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface DocumentDetail {
  id: string;
  workspaceId: string;
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
  wordCount?: number;
  characterCount?: number;
  pageCount?: number;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const docId = params.docId as string;
  const accountId = user?.userId;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocument();
  }, [docId]);

  const fetchDocument = async () => {
    try {
      const response = await api.get(`/api/workspaces/${wsId}/documents/${docId}`);
      setDocument(response);
    } catch (error) {
      console.error('Failed to fetch document:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'long',
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/api/workspaces/${wsId}/documents/${docId}`);
      router.push(`/org/${orgId}/workspace/${wsId}/documents`);
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  if (!document) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
        <div className="flex items-center justify-center p-8">
          <div className="text-red-500">Document not found</div>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {document.title || document.filename}
            </h1>
            {document.description && (
              <p className="text-gray-600">{document.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(
                document.processingStatus
              )}`}
            >
              {document.processingStatus.charAt(0).toUpperCase() + document.processingStatus.slice(1)}
            </span>
            <Button
              variant="outline"
              onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/documents`)}
            >
              Back to Documents
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Document Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Basic Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Filename:</span>
                <span className="font-medium text-gray-900">{document.filename}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">File Size:</span>
                <span className="font-medium text-gray-900">{formatFileSize(document.fileSize)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Content Type:</span>
                <span className="font-medium text-gray-900">{document.contentType}</span>
              </div>
              {document.category && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {document.category}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Processing Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(document.processingStatus)}`}>
                  {document.processingStatus.charAt(0).toUpperCase() + document.processingStatus.slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Text Extracted:</span>
                <span className="font-medium text-gray-900">{document.textExtracted ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Chunks:</span>
                <span className="font-medium text-gray-900">{document.chunkCount}</span>
              </div>
              {document.wordCount !== undefined && document.wordCount !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Words:</span>
                  <span className="font-medium text-gray-900">{document.wordCount.toLocaleString()}</span>
                </div>
              )}
              {document.pageCount !== undefined && document.pageCount !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Pages:</span>
                  <span className="font-medium text-gray-900">{document.pageCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Info */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">Uploaded By</div>
              <div className="font-medium text-gray-900">{document.uploaderEmail}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Uploaded At</div>
              <div className="font-medium text-gray-900">{formatTimestamp(document.uploadedAt)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Last Updated</div>
              <div className="font-medium text-gray-900">{formatTimestamp(document.updatedAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </OrganizationLayout>
  );
}
