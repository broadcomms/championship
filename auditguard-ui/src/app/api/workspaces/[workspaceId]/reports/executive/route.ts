import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = params;

    // Get request body
    const body = await request.json();

    // Get backend API URL from environment
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!backendUrl) {
      console.error('NEXT_PUBLIC_API_URL not configured');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Forward cookies for authentication
    const cookies = request.headers.get('cookie');

    // Call backend reporting service
    const backendResponse = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/reports/executive`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookies && { Cookie: cookies }),
        },
        body: JSON.stringify(body),
      }
    );

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend executive summary error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate executive summary' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Executive summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
