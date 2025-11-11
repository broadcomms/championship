/**
 * Real-time Event Broadcasting Utilities
 * 
 * Provides helper functions to broadcast real-time updates to WebSocket clients
 * via the realtime-service
 */

// Message type definitions (duplicated from realtime-service to avoid circular dependency)
export type Message =
  | { type: 'compliance_check_update'; data: { checkId: string; workspaceId: string; status: 'pending' | 'running' | 'completed' | 'failed'; progress?: number; issuesFound?: number; overallScore?: number } }
  | { type: 'dashboard_update'; data: { workspaceId: string; overallScore: number; totalIssues: number; openIssues: number } }
  | { type: 'issue_update'; data: { issueId: string; workspaceId: string; status: 'open' | 'in_progress' | 'resolved' | 'dismissed'; assignedTo?: string | null } }
  | { type: 'document_processing_update'; data: { documentId: string; workspaceId: string; status: 'pending' | 'processing' | 'completed' | 'failed'; progress?: number } };

interface RealtimeEnv {
  logger: {
    info: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
  };
  REALTIME_SERVICE?: any; // Optional - gracefully degrade if not available
}

/**
 * Broadcast a message to all clients subscribed to a workspace channel
 */
export async function broadcastToWorkspace(
  env: RealtimeEnv,
  workspaceId: string,
  channel: string,
  message: Message
): Promise<number> {
  // Gracefully degrade if realtime service is not available
  if (!env.REALTIME_SERVICE) {
    env.logger.info('Real-time service not available, skipping broadcast', {
      workspaceId,
      channel,
      messageType: message.type,
    });
    return 0;
  }

  try {
    // Call realtime service broadcast endpoint
    const response = await env.REALTIME_SERVICE.fetch(`http://internal/ws/${workspaceId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, message }),
    });

    if (!response.ok) {
      throw new Error(`Broadcast failed: ${response.status}`);
    }

    const result = await response.json() as { sent: number };
    
    env.logger.info('Real-time broadcast sent', {
      workspaceId,
      channel,
      messageType: message.type,
      recipientCount: result.sent,
    });

    return result.sent;
  } catch (error) {
    env.logger.error('Failed to broadcast real-time message', {
      workspaceId,
      channel,
      messageType: message.type,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - real-time updates are optional, shouldn't break main flow
    return 0;
  }
}

/**
 * Broadcast compliance check status update
 */
export async function broadcastComplianceCheckUpdate(
  env: RealtimeEnv,
  workspaceId: string,
  data: {
    checkId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    issuesFound?: number;
    overallScore?: number;
  }
): Promise<void> {
  await broadcastToWorkspace(env, workspaceId, 'compliance-checks', {
    type: 'compliance_check_update',
    data: {
      ...data,
      workspaceId,
    },
  });
}

/**
 * Broadcast dashboard metrics update
 */
export async function broadcastDashboardUpdate(
  env: RealtimeEnv,
  workspaceId: string,
  data: {
    overallScore: number;
    totalIssues: number;
    openIssues: number;
  }
): Promise<void> {
  await broadcastToWorkspace(env, workspaceId, 'dashboard', {
    type: 'dashboard_update',
    data: {
      ...data,
      workspaceId,
    },
  });
}

/**
 * Broadcast issue status update
 */
export async function broadcastIssueUpdate(
  env: RealtimeEnv,
  workspaceId: string,
  data: {
    issueId: string;
    status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
    assignedTo?: string | null;
  }
): Promise<void> {
  await broadcastToWorkspace(env, workspaceId, 'issues', {
    type: 'issue_update',
    data: {
      ...data,
      workspaceId,
    },
  });
}

/**
 * Broadcast document processing update
 */
export async function broadcastDocumentProcessingUpdate(
  env: RealtimeEnv,
  workspaceId: string,
  data: {
    documentId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
  }
): Promise<void> {
  await broadcastToWorkspace(env, workspaceId, 'documents', {
    type: 'document_processing_update',
    data: {
      ...data,
      workspaceId,
    },
  });
}
