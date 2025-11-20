import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId } = body;

    console.log('Marking all notifications as read for workspace:', workspaceId);

    return NextResponse.json({
      success: true,
      workspaceId,
      markedCount: 3,
    });
  } catch (error) {
    console.error('Mark all as read API error:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}
