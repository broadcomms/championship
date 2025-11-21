import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/assistant/notifications
 * This endpoint is deprecated - use /api/notifications instead
 * Returns empty response for backward compatibility
 */
export async function POST(request: NextRequest) {
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
export async function GET(request: NextRequest) {
  return NextResponse.json({
    notifications: [],
    total: 0,
    unreadCount: 0,
    hasMore: false,
  });
}
