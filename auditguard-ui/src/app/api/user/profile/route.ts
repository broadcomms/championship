import { NextRequest, NextResponse } from 'next/server';

async function getSession(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  if (!sessionCookie?.value) return null;
  return { token: sessionCookie.value };
}

/**
 * PUT /api/user/profile
 * Update user profile
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(`${backendUrl}/api/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        name: body.name,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to update profile' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
