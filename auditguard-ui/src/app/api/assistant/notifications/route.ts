import { NextResponse } from 'next/server';

/**
 * POST /api/assistant/notifications
 * This endpoint is deprecated - use /api/notifications instead
 * Returns empty response for backward compatibility
 */
export async function POST() {
  // Redirect to unified notification system
  // Return empty for backward compatibility
  return NextResponse.json({
    notifications: [],
    total: 0,
    unreadCount: 0,
    hasMore: false,
  });
}

/**
 * GET /api/assistant/notifications
 * This endpoint is deprecated - use /api/notifications instead
 */
export async function GET() {
  return NextResponse.json({
    notifications: [],
    total: 0,
    unreadCount: 0,
    hasMore: false,
  });
}
