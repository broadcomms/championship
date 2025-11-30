import { NextResponse } from 'next/server';

/**
 * GET /api/assistant/notifications/count
 * This endpoint is deprecated - use /api/notifications/count instead
 * Returns zero counts for backward compatibility
 */
export async function GET() {
  return NextResponse.json({
    unreadCount: 0,
    total: 0,
    by_category: { ai: 0, workspace: 0, system: 0 },
    by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
  });
}
