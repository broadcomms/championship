'use client';

import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkspaceSelector() {
  const { currentWorkspace, workspaces, setCurrentWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleWorkspaceSelect = (workspace: typeof workspaces[0]) => {
    setCurrentWorkspace(workspace);
    setIsOpen(false);
  };

  if (!currentWorkspace) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <Building2 className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">No workspace selected</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Workspace Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          isOpen && 'ring-2 ring-blue-500 ring-offset-2'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Building2 className="h-4 w-4 flex-shrink-0 text-gray-500" />
        <span className="flex-1 truncate text-left min-w-0">
          {currentWorkspace.name}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 text-gray-500 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 z-50 mt-2 w-64 origin-top-left rounded-lg border border-gray-200 bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none max-h-96 overflow-y-auto">
          <div className="p-2">
            <div className="mb-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Switch Workspace
            </div>

            <div className="space-y-1" role="listbox">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceSelect(workspace)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
                    currentWorkspace.id === workspace.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                  role="option"
                  aria-selected={currentWorkspace.id === workspace.id}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{workspace.name}</div>
                      {workspace.description && (
                        <div className="truncate text-xs text-gray-500">
                          {workspace.description}
                        </div>
                      )}
                      {workspace.role && (
                        <div className="mt-0.5 text-xs text-gray-400">
                          {workspace.role}
                        </div>
                      )}
                    </div>
                  </div>
                  {currentWorkspace.id === workspace.id && (
                    <Check className="h-4 w-4 flex-shrink-0 text-blue-600" />
                  )}
                </button>
              ))}
            </div>

            {workspaces.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                No workspaces available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}