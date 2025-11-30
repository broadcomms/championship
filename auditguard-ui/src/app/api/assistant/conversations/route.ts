import { NextRequest, NextResponse } from 'next/server';
import type { Conversation } from '@/types/assistant';

interface BackendConversation {
  id?: string;
  session_id?: string;
  title?: string;
  last_message?: string;
  lastMessage?: string;
  lastActivityAt?: string;
  last_activity_at?: string;
  updated_at?: string;
  created_at?: string;
  messageCount?: number;
  message_count?: number;
  status?: string;
  is_pinned?: boolean;
  isPinned?: boolean;
  is_archived?: boolean;
  isArchived?: boolean;
  is_unread?: boolean;
  isUnread?: boolean;
  tags?: string[];
  frameworks?: string[];
  completion_percentage?: number;
}

// Simple session validation
async function getSession(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const sessionCookie = request.cookies.get('session');

  let sessionId = null;
  if (authHeader?.startsWith('Bearer ')) {
    sessionId = authHeader.replace('Bearer ', '');
  } else if (sessionCookie) {
    sessionId = sessionCookie.value;
  }

  if (!sessionId) {
    return null;
  }

  return {
    userId: sessionId,
    token: sessionId
  };
}

/**
 * GET /api/assistant/conversations
 * List all conversations for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const limit = searchParams.get('limit') || '20';

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    // Fetch sessions from backend
    const response = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/assistant/sessions?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      }
    );

    if (!response.ok) {
      console.error('Backend error fetching conversations:', response.status);
      return NextResponse.json({ conversations: [], hasMore: false });
    }

    const data = await response.json();

    // Transform backend sessions to Conversation format
    // Backend returns: { id, title, startedAt, lastActivityAt, messageCount }
    const conversations: Conversation[] = (data.sessions || []).map((s: BackendConversation) => ({
      id: s.id || s.session_id,
      title: s.title || 'Untitled Conversation',
      lastMessage: s.last_message || s.lastMessage || '',
      lastMessageTime: new Date(s.lastActivityAt || s.last_activity_at || s.updated_at || s.created_at || Date.now()),
      messageCount: s.messageCount || s.message_count || 0,
      status: s.status || 'active',
      isPinned: s.is_pinned || s.isPinned || false,
      isArchived: s.is_archived || s.isArchived || false,
      isUnread: s.is_unread || s.isUnread || false,
      tags: s.tags || [],
      frameworks: s.frameworks || [],
      completionPercentage: s.completion_percentage || 0,
    }));

    return NextResponse.json({
      conversations,
      hasMore: data.hasMore || false,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ conversations: [], hasMore: false });
  }
}

/**
 * POST /api/assistant/conversations
 * List conversations with filters, pagination, and sorting
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, filters, page = 1, limit = 20 } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    // Build query params
    const queryParams = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (filters?.search) queryParams.set('search', filters.search);
    if (filters?.status?.length) queryParams.set('status', filters.status.join(','));
    if (filters?.showPinned) queryParams.set('pinned', 'true');
    if (filters?.showArchived) queryParams.set('archived', 'true');

    // Fetch sessions from backend
    const response = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/assistant/sessions?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      }
    );

    if (!response.ok) {
      console.error('Backend error fetching conversations:', response.status);
      return NextResponse.json({ conversations: [], hasMore: false, total: 0 });
    }

    const data = await response.json();

    // Transform backend sessions to Conversation format
    // Backend returns: { id, title, startedAt, lastActivityAt, messageCount }
    const conversations: Conversation[] = (data.sessions || []).map((s: BackendConversation) => ({
      id: s.id || s.session_id,
      title: s.title || 'Untitled Conversation',
      lastMessage: s.last_message || s.lastMessage || '',
      lastMessageTime: new Date(s.lastActivityAt || s.last_activity_at || s.updated_at || s.created_at || Date.now()),
      messageCount: s.messageCount || s.message_count || 0,
      status: s.status || 'active',
      isPinned: s.is_pinned || s.isPinned || false,
      isArchived: s.is_archived || s.isArchived || false,
      isUnread: s.is_unread || s.isUnread || false,
      tags: s.tags || [],
      frameworks: s.frameworks || [],
      completionPercentage: s.completion_percentage || 0,
    }));

    return NextResponse.json({
      conversations,
      hasMore: data.hasMore || false,
      total: data.total || conversations.length,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ conversations: [], hasMore: false, total: 0 });
  }
}
