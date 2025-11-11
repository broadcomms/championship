import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://auditguard-v2.raindrop.lol';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
): Promise<NextResponse> {
  try {
    const { workspaceId } = params;

    // Get session token from cookie
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Forward query parameters
    const url = new URL(request.url);
    const searchParams = new URLSearchParams();
    
    const industry = url.searchParams.get('industry');
    if (industry) searchParams.set('industry', industry);
    
    const size = url.searchParams.get('size');
    if (size) searchParams.set('size', size);

    const queryString = searchParams.toString();
    const backendUrl = `${BACKEND_URL}/api/workspaces/${workspaceId}/analytics/benchmarks${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Cookie: `session_token=${sessionToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Backend error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch benchmark comparisons' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching benchmark comparisons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
