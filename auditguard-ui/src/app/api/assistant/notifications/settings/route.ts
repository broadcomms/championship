import { NextRequest, NextResponse } from 'next/server';
import { NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '@/types/notification';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    // Mock settings - return default
    return NextResponse.json({
      settings: DEFAULT_NOTIFICATION_SETTINGS,
    });
  } catch (error) {
    console.error('Get notification settings API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, settings } = body;

    console.log('Saving notification settings for workspace:', workspaceId);
    console.log('Settings:', JSON.stringify(settings, null, 2));

    return NextResponse.json({
      success: true,
      workspaceId,
      settings,
    });
  } catch (error) {
    console.error('Save notification settings API error:', error);
    return NextResponse.json(
      { error: 'Failed to save notification settings' },
      { status: 500 }
    );
  }
}
