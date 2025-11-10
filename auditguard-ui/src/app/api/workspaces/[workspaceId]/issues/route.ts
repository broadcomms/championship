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

    const { searchParams } = new URL(request.url);
    const framework = searchParams.get('framework');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');

    let url = `${BACKEND_URL}/api/workspaces/${params.workspaceId}/issues`;
    const queryParams = new URLSearchParams();
    
    if (framework) queryParams.append('framework', framework);
    if (severity) queryParams.append('severity', severity);
    if (status) queryParams.append('status', status);
    
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie && { Cookie: `session=${sessionCookie.value}` }),
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch issues' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching workspace issues:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
