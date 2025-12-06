import { NextRequest, NextResponse } from 'next/server';

async function getSession(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  if (!sessionCookie?.value) return null;
  return { token: sessionCookie.value };
}

/**
 * POST /api/user/change-password
 * Change user password
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(`${backendUrl}/api/user/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to change password' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
