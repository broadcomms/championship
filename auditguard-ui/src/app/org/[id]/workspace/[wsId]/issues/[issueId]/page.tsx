'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface Issue {
  id: string;
  checkId: string;
  documentId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  recommendation: string | null;
  location: string | null;
  status: 'open' | 'in_progress' | 'review' | 'resolved';
  assignedTo: string | null;
  createdAt: number;
  resolvedAt: number | null;
}

const severityColors = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
};

const statusColors = {
  open: 'bg-red-100 text-red-800',
  in_progress: 'bg-blue-100 text-blue-800',
  review: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
};

export default function IssueDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { id: orgId, wsId: workspaceId, issueId } = params;
  const { user } = useAuth();
  const accountId = user?.userId;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIssueDetails();
  }, [issueId]);

  const fetchIssueDetails = async () => {
    try {
      const response = await api.get(`/api/workspaces/${workspaceId}/issues/${issueId}`);
      console.log('📥 Issue Details Response:', response);
      // API returns issue directly, not wrapped in data
      const issueData = response.data || response;
      console.log('📋 Issue data:', issueData);
      setIssue(issueData);
    } catch (error) {
      console.error('Failed to fetch issue details:', error);
      setError('Failed to load issue details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.patch(`/api/workspaces/${workspaceId}/issues/${issueId}/status`, {
        status: newStatus,
      });
      if (issue) {
        setIssue({ ...issue, status: newStatus as Issue['status'] });
      }
    } catch (error) {
      console.error('Failed to update issue status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleResolve = async () => {
    try {
      await api.post(`/api/workspaces/${workspaceId}/issues/${issueId}/resolve`, {
        resolution: 'Issue resolved by user',
      });
      if (issue) {
        setIssue({ ...issue, status: 'resolved', resolvedAt: Date.now() });
      }
    } catch (error) {
      console.error('Failed to resolve issue:', error);
      alert('Failed to resolve issue. Please try again.');
    }
  };

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId as string} workspaceId={workspaceId as string}>
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading issue details...</div>
        </div>
      ) : error || !issue ? (
        <div className="flex flex-col items-center justify-center h-96">
          <div className="text-red-500 text-xl mb-4">{error || 'Issue not found'}</div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      ) : (
        <div className="p-8 max-w-5xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
      >
        ← Back to Issues
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${severityColors[issue.severity]}`}>
                {issue.severity.toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[issue.status]}`}>
                {issue.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{issue.title}</h1>
            <p className="text-sm text-gray-500 mt-2">
              Category: {issue.category} • Created: {new Date(issue.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <select
            value={issue.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="resolved">Resolved</option>
          </select>

          {issue.status !== 'resolved' && (
            <button
              onClick={handleResolve}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Mark as Resolved
            </button>
          )}
        </div>
      </div>

      {/* Issue Details */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Issue Details</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Description</h3>
            <p className="mt-1 text-gray-900">{issue.description}</p>
          </div>

          {issue.location && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Location</h3>
              <p className="mt-1 text-gray-900">{issue.location}</p>
            </div>
          )}

          {issue.recommendation && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Recommendation</h3>
              <p className="mt-1 text-gray-900">{issue.recommendation}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Document ID</h3>
              <p className="mt-1 text-gray-900 font-mono text-sm">{issue.documentId}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Check ID</h3>
              <p className="mt-1 text-gray-900 font-mono text-sm">{issue.checkId}</p>
            </div>
          </div>

          {issue.assignedTo && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Assigned To</h3>
              <p className="mt-1 text-gray-900">{issue.assignedTo}</p>
            </div>
          )}

          {issue.resolvedAt && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Resolved At</h3>
              <p className="mt-1 text-gray-900">{new Date(issue.resolvedAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline (Placeholder) */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Activity Timeline</h2>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
            <div>
              <p className="text-sm text-gray-900">Issue created</p>
              <p className="text-xs text-gray-500">{new Date(issue.createdAt).toLocaleString()}</p>
            </div>
          </div>
          {issue.resolvedAt && (
            <div className="flex gap-3">
              <div className="w-2 h-2 mt-2 rounded-full bg-green-500" />
              <div>
                <p className="text-sm text-gray-900">Issue resolved</p>
                <p className="text-xs text-gray-500">{new Date(issue.resolvedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
        </div>
      )}
    </OrganizationLayout>
  );
}
