'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  role?: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load workspaces from API
  const refreshWorkspaces = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/workspaces', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }

      const data = await response.json();
      setWorkspaces(data.workspaces || []);

      // If no current workspace is set, set the first one
      if (!currentWorkspace && data.workspaces && data.workspaces.length > 0) {
        const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
        const workspace = savedWorkspaceId
          ? data.workspaces.find((w: Workspace) => w.id === savedWorkspaceId)
          : data.workspaces[0];

        setCurrentWorkspaceState(workspace || data.workspaces[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching workspaces:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Set current workspace and persist to localStorage
  const setCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    localStorage.setItem('currentWorkspaceId', workspace.id);
  };

  // Load workspaces on mount
  useEffect(() => {
    refreshWorkspaces();
  }, []);

  const value: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    isLoading,
    error,
    setCurrentWorkspace,
    refreshWorkspaces,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}