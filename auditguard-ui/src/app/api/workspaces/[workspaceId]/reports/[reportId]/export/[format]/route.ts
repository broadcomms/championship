import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://auditguard-v2.liquidmetal-ai.workers.dev';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string; reportId: string; format: string } }
) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    // Validate format
    if (!['json', 'csv', 'pdf'].includes(params.format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be json, csv, or pdf' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/workspaces/${params.workspaceId}/reports/${params.reportId}/export/${params.format}`,
      {
        method: 'POST',
        headers: {
          ...(sessionCookie && { Cookie: `session=${sessionCookie.value}` }),
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to export report' },
        { status: response.status }
      );
    }

    // Forward the blob response
    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Disposition': response.headers.get('Content-Disposition') || `attachment; filename="report.${params.format}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
