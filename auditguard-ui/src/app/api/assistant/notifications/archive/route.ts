import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId } = body;

    console.log('Archiving notification:', notificationId);

    return NextResponse.json({
      success: true,
      notificationId,
      status: 'archived',
    });
  } catch (error) {
    console.error('Archive notification API error:', error);
    return NextResponse.json(
      { error: 'Failed to archive notification' },
      { status: 500 }
    );
  }
}
