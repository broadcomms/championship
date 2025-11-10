import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://auditguard-v2.liquidmetal-ai.workers.dev';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    const response = await fetch(
      `${BACKEND_URL}/api/workspaces/${params.workspaceId}/reports`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(sessionCookie && { Cookie: `session=${sessionCookie.value}` }),
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/api/workspaces/${params.workspaceId}/reports`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionCookie && { Cookie: `session=${sessionCookie.value}` }),
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to save report' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
