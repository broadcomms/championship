'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { api } from '@/lib/api';
import { ComplianceIssue, IssueStatus, SEVERITY_COLORS, PRIORITY_COLORS } from '@/types/compliance';

interface KanbanColumn {
  id: IssueStatus;
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

export function KanbanBoard({ workspaceId, orgId }: KanbanBoardProps) {
  const router = useRouter();
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIssue, setActiveIssue] = useState<ComplianceIssue | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  const fetchIssues = useCallback(async () => {
    try {
      const response = await api.get<{ issues: ComplianceIssue[] }>(`/api/workspaces/${workspaceId}/issues`);
      console.log('📥 Issues API Response:', response);
      
      // Handle different response structures
      const issuesData = response?.issues || [];
      console.log('📋 Issues data:', issuesData);
      
      setIssues(issuesData);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      setIssues([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const issue = issues.find((i) => i.id === active.id);
    if (issue) {
      setActiveIssue(issue);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) {
      return;
    }

    const issueId = active.id as string;
    const newStatus = over.id as IssueStatus;
    const issue = issues.find((i) => i.id === issueId);

    if (!issue || issue.status === newStatus) {
      return;
    }

    // Optimistic update
    setIssues((prev) =>
      prev.map((i) =>
        i.id === issueId
          ? { ...i, status: newStatus, updatedAt: Date.now() }
          : i
      )
    );

    try {
      await api.patch(`/api/workspaces/${workspaceId}/issues/${issueId}/status`, {
        status: newStatus,
      });
      console.log(`✅ Issue ${issueId} moved to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update issue status:', error);
      // Revert on error
      setIssues((prev) =>
        prev.map((i) =>
          i.id === issueId
            ? { ...i, status: issue.status }
            : i
        )
      );
      alert('Failed to move issue. Please try again.');
    }
  };

  const getIssuesByStatus = (status: IssueStatus) => {
    return (issues || []).filter((issue) => issue.status === status);
  };

  const handleIssueClick = (issueId: string) => {
    router.push(`/org/${orgId}/workspace/${workspaceId}/issues/${issueId}`);
  };

  const formatDueDate = (dueDate: string | null): string => {
    if (!dueDate) return '';
    const date = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return '🔴 Overdue';
    if (diffDays === 0) return '⚠️ Today';
    if (diffDays === 1) return '📅 Tomorrow';
    if (diffDays <= 7) return `📅 ${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading issues...</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-4 w-full">
        {COLUMNS.map((column) => {
          const columnIssues = getIssuesByStatus(column.id);

          return (
            <KanbanColumn
              key={column.id}
              column={column}
              issues={columnIssues}
              onIssueClick={handleIssueClick}
              formatDueDate={formatDueDate}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeIssue ? (
          <IssueCard
            issue={activeIssue}
            onClick={() => {}}
            formatDueDate={formatDueDate}
            isDragging
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface KanbanColumnProps {
  column: KanbanColumn;
  issues: ComplianceIssue[];
  onIssueClick: (issueId: string) => void;
  formatDueDate: (date: string | null) => string;
}

function KanbanColumn({ column, issues, onIssueClick, formatDueDate }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col min-w-0">
      {/* Column Header */}
      <div className={`rounded-lg border-2 p-4 mb-4 ${column.color}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{column.icon}</span>
            <h3 className="font-semibold text-gray-900">{column.title}</h3>
          </div>
          <span className="bg-white px-2 py-1 rounded-full text-xs font-semibold text-gray-700">
            {issues.length}
          </span>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={`space-y-3 min-h-[200px] flex-1 rounded-lg transition-colors ${
          isOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
        }`}
      >
        {issues.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No issues
          </div>
        ) : (
          issues.map((issue) => (
            <DraggableIssueCard
              key={issue.id}
              issue={issue}
              onClick={() => onIssueClick(issue.id)}
              formatDueDate={formatDueDate}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface DraggableIssueCardProps {
  issue: ComplianceIssue;
  onClick: () => void;
  formatDueDate: (date: string | null) => string;
}

function DraggableIssueCard({ issue, onClick, formatDueDate }: DraggableIssueCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      <IssueCard
        issue={issue}
        onClick={onClick}
        formatDueDate={formatDueDate}
        isDragging={isDragging}
      />
    </div>
  );
}

interface IssueCardProps {
  issue: ComplianceIssue;
  onClick: () => void;
  formatDueDate: (date: string | null) => string;
  isDragging?: boolean;
  isDragOverlay?: boolean;
}

function IssueCard({ issue, onClick, formatDueDate, isDragging = false, isDragOverlay = false }: IssueCardProps) {
  // Framework badge colors
  const getFrameworkColor = (framework: string | null) => {
    if (!framework) return 'bg-gray-100 text-gray-700 border-gray-300';
    const fw = framework.toLowerCase();
    if (fw.includes('soc2') || fw.includes('soc 2')) return 'bg-purple-100 text-purple-700 border-purple-300';
    if (fw.includes('iso')) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (fw.includes('sox')) return 'bg-indigo-100 text-indigo-700 border-indigo-300';
    if (fw.includes('gdpr')) return 'bg-green-100 text-green-700 border-green-300';
    if (fw.includes('hipaa')) return 'bg-teal-100 text-teal-700 border-teal-300';
    if (fw.includes('pci')) return 'bg-pink-100 text-pink-700 border-pink-300';
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const formatFramework = (framework: string | null) => {
    if (!framework) return 'General';
    return framework.toUpperCase();
  };

  return (
    <div
      onClick={!isDragOverlay ? onClick : undefined}
      className={`bg-white rounded-lg border-2 p-4 cursor-pointer hover:shadow-lg transition ${
        isDragging ? 'opacity-40' : ''
      } ${isDragOverlay ? 'shadow-2xl rotate-3 scale-105' : ''}`}
    >
      {/* Header: Severity & Priority */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <span
          className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${
            SEVERITY_COLORS[issue.severity]
          }`}
        >
          {issue.severity}
        </span>
        {issue.priorityLevel && (
          <span
            className={`px-2 py-1 rounded text-xs font-bold ${
              PRIORITY_COLORS[issue.priorityLevel]
            }`}
          >
            {issue.priorityLevel}
          </span>
        )}
      </div>

      {/* Framework Badge */}
      {issue.framework && (
        <div className="mb-2">
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${
              getFrameworkColor(issue.framework)
            }`}
          >
            <span className="mr-1">🔖</span>
            {formatFramework(issue.framework)}
          </span>
        </div>
      )}

      {/* Title */}
      <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
        {issue.title}
      </h4>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {issue.description}
      </p>

      {/* Document Name */}
      {issue.documentName && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-gray-600">
          <span>📄</span>
          <span className="truncate font-medium">{issue.documentName}</span>
        </div>
      )}

      {/* Due Date */}
      {issue.dueDate && (
        <div className="mb-3 text-xs font-medium">
          {formatDueDate(issue.dueDate)}
        </div>
      )}

      {/* Footer: Assignee & Date */}
      <div className="flex items-center justify-between text-xs">
        {issue.assignedTo ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {issue.assignedTo[0]?.toUpperCase() || 'A'}
            </div>
            <span className="text-gray-600 truncate max-w-[120px]">
              {issue.assignedTo.split('@')[0] || 'Assigned'}
            </span>
          </div>
        ) : (
          <span className="text-gray-400">Unassigned</span>
        )}
        <span className="text-gray-400">
          {new Date(issue.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
}
