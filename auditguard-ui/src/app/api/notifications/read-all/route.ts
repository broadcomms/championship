import { NextRequest, NextResponse } from 'next/server';

async function getSession(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  if (!sessionCookie?.value) return null;
  return { token: sessionCookie.value };
}

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(`${backendUrl}/api/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        userId: session.token,
        category: body.category,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ success: false }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
