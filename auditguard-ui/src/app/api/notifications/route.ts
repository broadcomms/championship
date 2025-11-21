import { NextRequest, NextResponse } from 'next/server';

async function getSession(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  if (!sessionCookie?.value) return null;
  return { token: sessionCookie.value };
}

/**
 * POST /api/notifications
 * Get notifications with filters
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(`${backendUrl}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        userId: session.token,
        filter: body.filter || {},
      }),
    });

    if (!response.ok) {
      // Return empty list on error
      return NextResponse.json({
        notifications: [],
        total: 0,
        unreadCount: 0,
        hasMore: false,
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json({
      notifications: [],
      total: 0,
      unreadCount: 0,
      hasMore: false,
    });
  }
}

/**
 * GET /api/notifications
 * Get notifications (simplified)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(`${backendUrl}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
      body: JSON.stringify({ userId: session.token }),
    });

    if (!response.ok) {
      return NextResponse.json({ notifications: [], total: 0 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json({ notifications: [], total: 0 });
  }
}
