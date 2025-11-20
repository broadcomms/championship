import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId } = body;

    console.log('Dismissing notification:', notificationId);

    return NextResponse.json({
      success: true,
      notificationId,
      status: 'dismissed',
    });
  } catch (error) {
    console.error('Dismiss notification API error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss notification' },
      { status: 500 }
    );
  }
}
