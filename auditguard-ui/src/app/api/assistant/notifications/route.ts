import { NextRequest, NextResponse } from 'next/server';
import {
  Notification,
  NotificationResponse,
  ProactiveAlert,
  ComplianceAlertData,
} from '@/types/notification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, filters, page = 1, limit = 20, sortBy = 'timestamp', sortOrder = 'desc' } = body;

    // Mock notifications
    const allNotifications: Notification[] = [
      {
        id: 'notif_1',
        type: 'critical',
        category: 'compliance',
        priority: 'urgent',
        status: 'unread',
        title: 'Critical GDPR Violation Detected',
        message: '3 new GDPR violations detected in uploaded documents. Immediate action required.',
        timestamp: Date.now() - 5 * 60 * 1000,
        workspaceId,
        dismissible: true,
        autoHide: false,
        actions: [
          {
            id: 'action_1',
            label: 'View Details',
            action: 'view_issues',
            variant: 'primary',
          },
          {
            id: 'action_2',
            label: 'Dismiss',
            action: 'dismiss',
            variant: 'secondary',
          },
        ],
        metadata: {
          framework: 'GDPR',
          violationCount: 3,
          severity: 'critical',
        },
      },
      {
        id: 'notif_2',
        type: 'info',
        category: 'report',
        priority: 'normal',
        status: 'unread',
        title: 'Weekly Compliance Report Ready',
        message: 'Your compliance score improved by 12% this week. SOC2 audit preparation is 78% complete.',
        timestamp: Date.now() - 2 * 60 * 60 * 1000,
        workspaceId,
        dismissible: true,
        autoHide: false,
        actions: [
          {
            id: 'action_3',
            label: 'View Report',
            action: 'view_report',
            variant: 'primary',
          },
          {
            id: 'action_4',
            label: 'Share',
            action: 'share_report',
            variant: 'secondary',
          },
        ],
      },
      {
        id: 'notif_3',
        type: 'info',
        category: 'insight',
        priority: 'normal',
        status: 'unread',
        title: 'AI Insight: Privacy Policy Update Needed',
        message: 'Based on recent changes, update your privacy policy section 4.2 to align with new regulations.',
        timestamp: Date.now() - 24 * 60 * 60 * 1000,
        workspaceId,
        dismissible: true,
        autoHide: true,
        autoHideDuration: 10000,
        actions: [
          {
            id: 'action_5',
            label: 'Review Suggestion',
            action: 'review_insight',
            variant: 'primary',
          },
          {
            id: 'action_6',
            label: 'Remind Later',
            action: 'remind_later',
            variant: 'secondary',
          },
        ],
      },
      {
        id: 'notif_4',
        type: 'warning',
        category: 'compliance',
        priority: 'high',
        status: 'read',
        title: 'SOC2 Audit Deadline Approaching',
        message: 'Your SOC2 audit is scheduled in 14 days. Complete the remaining checklist items.',
        timestamp: Date.now() - 48 * 60 * 60 * 1000,
        workspaceId,
        dismissible: true,
        autoHide: false,
        actions: [
          {
            id: 'action_7',
            label: 'View Checklist',
            action: 'view_checklist',
            variant: 'primary',
          },
        ],
      },
      {
        id: 'notif_5',
        type: 'success',
        category: 'compliance',
        priority: 'normal',
        status: 'read',
        title: 'All ISO 27001 Issues Resolved',
        message: 'Congratulations! All detected ISO 27001 compliance issues have been successfully resolved.',
        timestamp: Date.now() - 72 * 60 * 60 * 1000,
        workspaceId,
        dismissible: true,
        autoHide: true,
        autoHideDuration: 5000,
      },
    ];

    // Apply filters
    let filtered = allNotifications;

    if (filters?.status) {
      filtered = filtered.filter((n) => filters.status.includes(n.status));
    }

    if (filters?.types) {
      filtered = filtered.filter((n) => filters.types.includes(n.type));
    }

    if (filters?.categories) {
      filtered = filtered.filter((n) => filters.categories.includes(n.category));
    }

    if (filters?.priorities) {
      filtered = filtered.filter((n) => filters.priorities.includes(n.priority));
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(search) ||
          n.message.toLowerCase().includes(search)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.timestamp - a.timestamp;
      }
      return a.timestamp - b.timestamp;
    });

    // Paginate
    const start = (page - 1) * limit;
    const end = start + limit;
    const notifications = filtered.slice(start, end);
    const hasMore = end < filtered.length;
    const unreadCount = filtered.filter((n) => n.status === 'unread').length;

    const response: NotificationResponse = {
      notifications,
      total: filtered.length,
      unreadCount,
      hasMore,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
