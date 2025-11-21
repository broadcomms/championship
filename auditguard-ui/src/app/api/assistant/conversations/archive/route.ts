import { NextRequest, NextResponse } from 'next/server';

async function getSession(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const sessionCookie = request.cookies.get('session');
  let sessionId = null;
  if (authHeader?.startsWith('Bearer ')) {
    sessionId = authHeader.replace('Bearer ', '');
  } else if (sessionCookie) {
    sessionId = sessionCookie.value;
  }
  if (!sessionId) return null;
  return { userId: sessionId, token: sessionId };
}

/**
 * POST /api/assistant/conversations/archive
 * Archive or unarchive a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, isArchived, workspaceId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/assistant/sessions/${conversationId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ is_archived: isArchived }),
      }
    );

    if (!response.ok) {
      console.error('Backend archive error:', await response.text());
      return NextResponse.json(
        { error: 'Failed to archive conversation' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      conversationId,
      isArchived,
    });
  } catch (error) {
    console.error('Error archiving conversation:', error);
    return NextResponse.json(
      { error: 'Failed to archive conversation' },
      { status: 500 }
    );
  }
}
