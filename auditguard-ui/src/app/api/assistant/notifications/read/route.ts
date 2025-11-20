import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId } = body;

    console.log('Marking notification as read:', notificationId);

    return NextResponse.json({
      success: true,
      notificationId,
      status: 'read',
    });
  } catch (error) {
    console.error('Mark as read API error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
