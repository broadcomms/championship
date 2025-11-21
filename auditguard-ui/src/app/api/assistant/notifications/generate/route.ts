import { NextRequest, NextResponse } from 'next/server';
import { runProactiveNotificationCheck } from '@/lib/proactiveNotifications';

export const runtime = 'edge';

/**
 * POST /api/assistant/notifications/generate
 *
 * Generates proactive AI-powered notifications for a workspace
 * This can be called manually or scheduled to run periodically
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, userId } = body;

    if (!workspaceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId, userId' },
        { status: 400 }
      );
    }

    console.log('🔔 Generating proactive notifications', { workspaceId, userId });

    // Run the proactive notification check
    const notifications = await runProactiveNotificationCheck(workspaceId, userId);

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        severity: n.severity,
        title: n.title,
        message: n.message,
        actionUrl: n.actionUrl,
        actionLabel: n.actionLabel,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Notification generation error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate notifications',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/assistant/notifications/generate
 * Returns API status
 */
export async function GET() {
  return NextResponse.json({
    status: 'available',
    description: 'AI-powered proactive notification generator',
    usage: 'POST with { workspaceId, userId } to generate notifications',
    features: [
      'Compliance score monitoring',
      'Framework-specific alerts',
      'Document issue detection',
      'Critical issue escalation',
      'Audit readiness recommendations',
    ],
  });
}
