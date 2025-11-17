'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { MultiLevelSidebar } from '@/components/sidebar/MultiLevelSidebar';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { Button } from '@/components/common/Button';

export default function WorkspaceIssuesPage() {
  const params = useParams();
  const orgId = params.id as string;
  const wsId = params.wsId as string;

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  return (
    <div className="flex h-screen">
      <MultiLevelSidebar currentOrgId={orgId} currentWorkspaceId={wsId} />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-[1800px] mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Compliance Issues
              </h1>
              <p className="text-gray-600">
                Track and resolve compliance issues across your documents
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex gap-2 bg-white border border-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-4 py-2 rounded font-medium text-sm transition ${
                    viewMode === 'kanban'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  📋 Kanban
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded font-medium text-sm transition ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  📃 List
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm font-medium text-gray-700">Filter by severity:</span>
            <div className="flex gap-2">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map((severity) => (
                <button
                  key={severity}
                  onClick={() => setFilterSeverity(severity)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filterSeverity === severity
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Kanban Board */}
          {viewMode === 'kanban' ? (
            <KanbanBoard workspaceId={wsId} orgId={orgId} />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              List view coming soon
            </div>
          )}

          {/* Help Text */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              💡 How to use the Kanban board
            </h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Drag and drop cards between columns to update their status</li>
              <li>• Click on a card to view details and add comments</li>
              <li>• Issues are color-coded by severity (Critical, High, Medium, Low)</li>
              <li>• Assign team members to issues for accountability</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
