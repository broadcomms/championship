'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Issue {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'review' | 'resolved';
  severity: 'critical' | 'high' | 'medium' | 'low';
  assignee_email?: string;
  framework?: string;
  document_name?: string;
  created_at: number;
  updated_at: number;
}

interface KanbanColumn {
  id: 'open' | 'in_progress' | 'review' | 'resolved';
  title: string;
  color: string;
  icon: string;
}

interface KanbanBoardProps {
  workspaceId: string;
  orgId: string;
}

const COLUMNS: KanbanColumn[] = [
  { id: 'open', title: 'Open', color: 'bg-red-50 border-red-200', icon: '🔴' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50 border-blue-200', icon: '🔵' },
  { id: 'review', title: 'Review', color: 'bg-yellow-50 border-yellow-200', icon: '🟡' },
  { id: 'resolved', title: 'Resolved', color: 'bg-green-50 border-green-200', icon: '🟢' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
};

export function KanbanBoard({ workspaceId, orgId }: KanbanBoardProps) {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedIssue, setDraggedIssue] = useState<Issue | null>(null);

  useEffect(() => {
    fetchIssues();
  }, [workspaceId]);

  const fetchIssues = async () => {
    try {
      const response = await api.get(`/workspaces/${workspaceId}/issues`);
      setIssues(response.data);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (issue: Issue) => {
    setDraggedIssue(issue);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (
    e: React.DragEvent,
    newStatus: 'open' | 'in_progress' | 'review' | 'resolved'
  ) => {
    e.preventDefault();

    if (!draggedIssue || draggedIssue.status === newStatus) {
      setDraggedIssue(null);
      return;
    }

    try {
      await api.patch(`/issues/${draggedIssue.id}/status`, {
        status: newStatus,
      });

      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === draggedIssue.id
            ? { ...issue, status: newStatus, updated_at: Date.now() }
            : issue
        )
      );
    } catch (error) {
      console.error('Failed to update issue status:', error);
      alert('Failed to move issue. Please try again.');
    } finally {
      setDraggedIssue(null);
    }
  };

  const getIssuesByStatus = (status: string) => {
    return issues.filter((issue) => issue.status === status);
  };

  const handleIssueClick = (issueId: string) => {
    router.push(`/org/${orgId}/workspace/${workspaceId}/issues/${issueId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading issues...</div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {COLUMNS.map((column) => {
        const columnIssues = getIssuesByStatus(column.id);

        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className={`rounded-lg border-2 p-4 mb-4 ${column.color}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{column.icon}</span>
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                </div>
                <span className="bg-white px-2 py-1 rounded-full text-xs font-semibold text-gray-700">
                  {columnIssues.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-3 min-h-[200px]">
              {columnIssues.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No issues
                </div>
              ) : (
                columnIssues.map((issue) => (
                  <div
                    key={issue.id}
                    draggable
                    onDragStart={() => handleDragStart(issue)}
                    onClick={() => handleIssueClick(issue.id)}
                    className={`bg-white rounded-lg border-2 p-4 cursor-move hover:shadow-lg transition ${
                      draggedIssue?.id === issue.id ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Severity Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${
                          SEVERITY_COLORS[issue.severity]
                        }`}
                      >
                        {issue.severity}
                      </span>
                      {issue.framework && (
                        <span className="text-xs text-gray-500">
                          {issue.framework}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
                      {issue.title}
                    </h4>

                    {/* Description */}
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {issue.description}
                    </p>

                    {/* Document */}
                    {issue.document_name && (
                      <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                        <span>📄</span>
                        <span className="truncate">{issue.document_name}</span>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs">
                      {issue.assignee_email ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                            {issue.assignee_email[0].toUpperCase()}
                          </div>
                          <span className="text-gray-600 truncate max-w-[120px]">
                            {issue.assignee_email.split('@')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                      <span className="text-gray-400">
                        {new Date(issue.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
