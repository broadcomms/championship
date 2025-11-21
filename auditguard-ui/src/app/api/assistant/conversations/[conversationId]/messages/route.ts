import { NextRequest, NextResponse } from 'next/server';

async function getSession(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  if (!sessionCookie?.value) return null;
  return { token: sessionCookie.value };
}

/**
 * GET /api/assistant/conversations/[conversationId]/messages
 * Get all messages for a specific conversation from the backend
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getSession(request);
    if (!session?.token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/assistant/sessions/${conversationId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Return empty messages for new conversations
        return NextResponse.json({
          messages: [],
          sessionId: conversationId,
          conversationId,
        });
      }
      const error = await response.text();
      console.error('Backend error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Transform backend format to frontend format
    const messages = (data.messages || []).map((m: any) => ({
      id: m.id || `msg_${m.createdAt || Date.now()}`,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
    }));
    return NextResponse.json({
      messages,
      sessionId: data.session?.id || conversationId,
      conversationId,
    });
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
