import { NextRequest, NextResponse } from 'next/server';

async function getSession(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  if (!sessionCookie?.value) return null;
  return { token: sessionCookie.value };
}

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request);
    if (!session?.token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(
      `${backendUrl}/api/notifications/${params.id}/read`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ success: false }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
