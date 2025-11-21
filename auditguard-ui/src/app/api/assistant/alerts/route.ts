import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/assistant/alerts
 * Get proactive alerts from the backend
 * Returns empty array when no real alerts are configured
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ alerts: [] });
    }

    // Return empty alerts - real alerts should come from backend notification system
    // The unified notification system handles all alerts via /api/notifications
    return NextResponse.json({ alerts: [] });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json({ alerts: [] });
  }
}
