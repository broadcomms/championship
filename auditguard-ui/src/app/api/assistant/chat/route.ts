import { NextRequest, NextResponse } from 'next/server';

// Simple session validation - adapt this based on your auth implementation
async function getSession(request: NextRequest) {
  // Check for session cookie or authorization header
  const authHeader = request.headers.get('authorization');
  const sessionCookie = request.cookies.get('session');

  // Extract session ID from auth header or cookie
  let sessionId = null;
  if (authHeader?.startsWith('Bearer ')) {
    sessionId = authHeader.replace('Bearer ', '');
  } else if (sessionCookie) {
    sessionId = sessionCookie.value;
  }

  if (!sessionId) {
    return null;
  }

  // Validate session with backend auth service
  // Note: In production, you should validate the session token properly
  // For now, we'll pass it through and let the backend validate
  return {
    userId: sessionId, // Backend will validate and return actual userId
    token: sessionId
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSession(request);
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workspaceId, message, sessionId, context } = body;

    // Validate input
    if (!workspaceId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId and message are required' },
        { status: 400 }
      );
    }

    // Call backend assistant service via API gateway
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'https://svc-01ka207rnhxjkfs7x39r5f129j.01k8njsj98qqesz0ppxff2yq4n.lmapp.run';
    
    console.log(`[AI Assistant] Calling backend: ${backendUrl}/api/workspaces/${workspaceId}/assistant/chat`);
    
    const response = await fetch(`${backendUrl}/api/workspaces/${workspaceId}/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({
        message,
        sessionId,
        context: {
          ...context,
          userId: session.userId
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to process request';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      console.error(`[AI Assistant] Backend error (${response.status}):`, errorMessage);
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log(`[AI Assistant] Success - Session: ${data.sessionId}`);
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('[AI Assistant] API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve session history
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const sessionId = searchParams.get('sessionId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameter: workspaceId' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'https://svc-01ka207rnhxjkfs7x39r5f129j.01k8njsj98qqesz0ppxff2yq4n.lmapp.run';
    
    let endpoint = `${backendUrl}/api/workspaces/${workspaceId}/assistant/sessions`;
    if (sessionId) {
      endpoint += `/${sessionId}`;
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch sessions' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[AI Assistant] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
