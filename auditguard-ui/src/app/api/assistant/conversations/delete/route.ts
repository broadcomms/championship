import { NextRequest, NextResponse } from 'next/server';

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

  if (!sessionId) return null;
  return { userId: sessionId, token: sessionId };
}

/**
 * POST /api/assistant/conversations/delete
 * Delete a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, workspaceId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    // Call backend to delete the session
    const response = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/assistant/sessions/${conversationId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend delete error:', errorText);
      return NextResponse.json(
        { error: 'Failed to delete conversation' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      conversationId,
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
