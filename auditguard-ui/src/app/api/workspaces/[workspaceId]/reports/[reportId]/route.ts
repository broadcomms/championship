import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://auditguard-v2.liquidmetal-ai.workers.dev';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string; reportId: string } }
) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    const response = await fetch(
      `${BACKEND_URL}/api/workspaces/${params.workspaceId}/reports/${params.reportId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(sessionCookie && { Cookie: `session=${sessionCookie.value}` }),
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch report' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
