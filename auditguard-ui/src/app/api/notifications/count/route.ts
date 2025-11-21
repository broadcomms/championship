import { NextRequest, NextResponse } from 'next/server';

async function getSession(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  if (!sessionCookie?.value) return null;
  return { token: sessionCookie.value };
}

/**
 * GET /api/notifications/count
 * Get notification counts with category breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.token) {
      return NextResponse.json({
        total: 0,
        unread: 0,
        by_category: { ai: 0, workspace: 0, system: 0 },
        by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
      });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(
      `${backendUrl}/api/notifications/count?userId=${encodeURIComponent(session.token)}`,
      {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({
        total: 0,
        unread: 0,
        by_category: { ai: 0, workspace: 0, system: 0 },
        by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notification count error:', error);
    return NextResponse.json({
      total: 0,
      unread: 0,
      by_category: { ai: 0, workspace: 0, system: 0 },
      by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
    });
  }
}
