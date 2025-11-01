export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt?: number; // Unix timestamp in milliseconds
  updatedAt: number;  // Unix timestamp in milliseconds
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: number; // Unix timestamp in milliseconds
}

export interface WorkspaceWithRole extends Workspace {
  role: 'owner' | 'admin' | 'member' | 'viewer';
  memberCount?: number;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
}

export interface InviteMemberInput {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}
