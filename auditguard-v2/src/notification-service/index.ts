import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { nanoid } from 'nanoid';

/**
 * Notification Service - Handles in-app, email, and real-time notifications
 *
 * This service provides:
 * - Creating and managing in-app notifications
 * - User notification preferences management
 * - Integration with email-service for email notifications
 * - Integration with realtime-service for WebSocket notifications
 */

export interface CreateNotificationRequest {
  user_id: string;
  type: 'issue_assigned' | 'comment' | 'mention' | 'status_change' | 'workspace_invite' | 'due_date_reminder' | 'overdue_alert';
  title: string;
  message: string;
  action_url: string;
  metadata?: Record<string, any>;
  send_email?: boolean;      // Send email notification
  send_realtime?: boolean;    // Send real-time notification via WebSocket
}

export interface UpdatePreferencesRequest {
  email_issue_assigned?: 'instant' | 'daily' | 'weekly' | 'never';
  email_comments?: 'instant' | 'daily' | 'weekly' | 'never';
  email_mentions?: 'instant' | 'daily' | 'weekly' | 'never';
  email_due_date?: 'instant' | 'daily' | 'weekly' | 'never';
  email_status_change?: 'instant' | 'daily' | 'weekly' | 'never';
  in_app_enabled?: boolean;
  in_app_sound?: boolean;
  browser_push_enabled?: boolean;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /notifications/:userId - Get user's notifications
      if (path.match(/^\/notifications\/[^/]+$/) && request.method === 'GET') {
        const userId = path.split('/')[2];
        const unreadOnly = url.searchParams.get('unread') === 'true';
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        return await this.getUserNotifications(userId, unreadOnly, limit, offset);
      }

      // POST /notifications - Create a new notification
      if (path === '/notifications' && request.method === 'POST') {
        const body = await request.json() as CreateNotificationRequest;
        return await this.createNotification(body);
      }

      // PATCH /notifications/:id/read - Mark notification as read
      if (path.match(/^\/notifications\/[^/]+\/read$/) && request.method === 'PATCH') {
        const notificationId = path.split('/')[2];
        return await this.markAsRead(notificationId);
      }

      // PATCH /notifications/:userId/read-all - Mark all notifications as read
      if (path.match(/^\/notifications\/[^/]+\/read-all$/) && request.method === 'PATCH') {
        const userId = path.split('/')[2];
        return await this.markAllAsRead(userId);
      }

      // GET /notifications/:userId/count - Get unread count
      if (path.match(/^\/notifications\/[^/]+\/count$/) && request.method === 'GET') {
        const userId = path.split('/')[2];
        return await this.getUnreadCount(userId);
      }

      // GET /preferences/:userId - Get user's notification preferences
      if (path.match(/^\/preferences\/[^/]+$/) && request.method === 'GET') {
        const userId = path.split('/')[2];
        return await this.getPreferences(userId);
      }

      // PATCH /preferences/:userId - Update notification preferences
      if (path.match(/^\/preferences\/[^/]+$/) && request.method === 'PATCH') {
        const userId = path.split('/')[2];
        const body = await request.json() as UpdatePreferencesRequest;
        return await this.updatePreferences(userId, body);
      }

      // Internal webhook endpoints for notifications
      // POST /internal/webhook/issue-assigned
      if (path === '/internal/webhook/issue-assigned' && request.method === 'POST') {
        const body = await request.json();
        await this.handleIssueAssigned(body as any);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /internal/webhook/issue-status-changed
      if (path === '/internal/webhook/issue-status-changed' && request.method === 'POST') {
        const body = await request.json();
        await this.handleIssueStatusChanged(body as any);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /internal/webhook/issue-commented
      if (path === '/internal/webhook/issue-commented' && request.method === 'POST') {
        const body = await request.json();
        await this.handleIssueCommented(body as any);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /internal/webhook/compliance-check-complete
      if (path === '/internal/webhook/compliance-check-complete' && request.method === 'POST') {
        const body = await request.json();
        await this.handleComplianceCheckComplete(body as any);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Notification service error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        details: String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get user's notifications
   */
  private async getUserNotifications(
    userId: string,
    unreadOnly: boolean,
    limit: number,
    offset: number
  ): Promise<Response> {
    const db = this.getDb();

    let query = db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (unreadOnly) {
      query = query.where('read', '=', 0);
    }

    const notifications = await query.execute();

    // Parse metadata JSON strings
    const parsedNotifications = notifications.map(n => ({
      ...n,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
      read: n.read === 1
    }));

    return new Response(JSON.stringify(parsedNotifications), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Create a new notification
   */
  private async createNotification(req: CreateNotificationRequest): Promise<Response> {
    const db = this.getDb();
    const now = Date.now();
    const notificationId = nanoid();

    // Check if user has in-app notifications enabled
    const preferences = await db
      .selectFrom('notification_preferences')
      .selectAll()
      .where('user_id', '=', req.user_id)
      .executeTakeFirst();

    // Create default preferences if they don't exist
    if (!preferences) {
      await this.createDefaultPreferences(req.user_id);
    }

    // Only create in-app notification if enabled (or preferences don't exist yet)
    if (!preferences || preferences.in_app_enabled === 1) {
      await db
        .insertInto('notifications')
        .values({
          id: notificationId,
          user_id: req.user_id,
          type: req.type,
          title: req.title,
          message: req.message,
          read: 0,
          action_url: req.action_url,
          metadata: req.metadata ? JSON.stringify(req.metadata) : null,
          created_at: now,
          read_at: null
        })
        .execute();
    }

    // Send email notification if requested and enabled
    if (req.send_email) {
      await this.sendEmailNotification(req, preferences);
    }

    // Send real-time notification if requested
    if (req.send_realtime) {
      await this.sendRealtimeNotification(req.user_id, {
        id: notificationId,
        type: req.type,
        title: req.title,
        message: req.message,
        action_url: req.action_url,
        metadata: req.metadata
      });
    }

    return new Response(JSON.stringify({
      id: notificationId,
      success: true
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Mark notification as read
   */
  private async markAsRead(notificationId: string): Promise<Response> {
    const db = this.getDb();
    const now = Date.now();

    await db
      .updateTable('notifications')
      .set({
        read: 1,
        read_at: now
      })
      .where('id', '=', notificationId)
      .execute();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  private async markAllAsRead(userId: string): Promise<Response> {
    const db = this.getDb();
    const now = Date.now();

    await db
      .updateTable('notifications')
      .set({
        read: 1,
        read_at: now
      })
      .where('user_id', '=', userId)
      .where('read', '=', 0)
      .execute();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get unread notification count
   */
  private async getUnreadCount(userId: string): Promise<Response> {
    const db = this.getDb();

    const result = await db
      .selectFrom('notifications')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('user_id', '=', userId)
      .where('read', '=', 0)
      .executeTakeFirst();

    return new Response(JSON.stringify({
      count: result?.count || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get user's notification preferences
   */
  private async getPreferences(userId: string): Promise<Response> {
    const db = this.getDb();

    let preferences = await db
      .selectFrom('notification_preferences')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();

    // Create default preferences if they don't exist
    if (!preferences) {
      await this.createDefaultPreferences(userId);
      preferences = await db
        .selectFrom('notification_preferences')
        .selectAll()
        .where('user_id', '=', userId)
        .executeTakeFirst();
    }

    // Convert integers to booleans
    const parsed = {
      ...preferences,
      in_app_enabled: preferences?.in_app_enabled === 1,
      in_app_sound: preferences?.in_app_sound === 1,
      browser_push_enabled: preferences?.browser_push_enabled === 1
    };

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Update notification preferences
   */
  private async updatePreferences(userId: string, updates: UpdatePreferencesRequest): Promise<Response> {
    const db = this.getDb();
    const now = Date.now();

    // Ensure preferences exist
    const existing = await db
      .selectFrom('notification_preferences')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!existing) {
      await this.createDefaultPreferences(userId);
    }

    // Convert booleans to integers for SQLite
    const updateData: any = {
      updated_at: now
    };

    if (updates.email_issue_assigned !== undefined) updateData.email_issue_assigned = updates.email_issue_assigned;
    if (updates.email_comments !== undefined) updateData.email_comments = updates.email_comments;
    if (updates.email_mentions !== undefined) updateData.email_mentions = updates.email_mentions;
    if (updates.email_due_date !== undefined) updateData.email_due_date = updates.email_due_date;
    if (updates.email_status_change !== undefined) updateData.email_status_change = updates.email_status_change;
    if (updates.in_app_enabled !== undefined) updateData.in_app_enabled = updates.in_app_enabled ? 1 : 0;
    if (updates.in_app_sound !== undefined) updateData.in_app_sound = updates.in_app_sound ? 1 : 0;
    if (updates.browser_push_enabled !== undefined) updateData.browser_push_enabled = updates.browser_push_enabled ? 1 : 0;

    await db
      .updateTable('notification_preferences')
      .set(updateData)
      .where('user_id', '=', userId)
      .execute();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Create default notification preferences for a user
   */
  private async createDefaultPreferences(userId: string): Promise<void> {
    const db = this.getDb();
    const now = Date.now();

    await db
      .insertInto('notification_preferences')
      .values({
        user_id: userId,
        email_issue_assigned: 'instant',
        email_comments: 'instant',
        email_mentions: 'instant',
        email_due_date: 'instant',
        email_status_change: 'daily',
        in_app_enabled: 1,
        in_app_sound: 1,
        browser_push_enabled: 0,
        updated_at: now
      })
      .execute();
  }

  /**
   * Send email notification via email-service
   */
  private async sendEmailNotification(
    req: CreateNotificationRequest,
    preferences: any
  ): Promise<void> {
    // Check email preferences based on notification type
    let emailFrequency = 'never';

    switch (req.type) {
      case 'issue_assigned':
        emailFrequency = preferences?.email_issue_assigned || 'instant';
        break;
      case 'comment':
        emailFrequency = preferences?.email_comments || 'instant';
        break;
      case 'mention':
        emailFrequency = preferences?.email_mentions || 'instant';
        break;
      case 'status_change':
        emailFrequency = preferences?.email_status_change || 'daily';
        break;
      case 'due_date_reminder':
      case 'overdue_alert':
        emailFrequency = preferences?.email_due_date || 'instant';
        break;
    }

    // Only send instant emails here (daily/weekly handled by cron jobs)
    if (emailFrequency === 'instant') {
      // Get user email
      const db = this.getDb();
      const user = await db
        .selectFrom('users')
        .select('email')
        .where('id', '=', req.user_id)
        .executeTakeFirst();

      if (user) {
        // Call email-service
        await fetch(`http://email-service/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            subject: req.title,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${req.title}</h2>
                <p>${req.message}</p>
                <p style="margin-top: 20px;">
                  <a href="${req.action_url}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Details
                  </a>
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 40px;">
                  You received this email because you have notifications enabled in AuditGuardX.
                  <a href="/account/notifications">Manage your notification preferences</a>
                </p>
              </div>
            `,
            text: `${req.title}\n\n${req.message}\n\nView details: ${req.action_url}`
          })
        });
      }
    }
  }

  /**
   * Send real-time notification via realtime-service
   */
  private async sendRealtimeNotification(userId: string, notification: any): Promise<void> {
    // Call realtime-service to broadcast notification via WebSocket
    try {
      await fetch(`http://realtime-service/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          event: 'notification',
          data: notification
        })
      });
    } catch (error) {
      console.error('Failed to send realtime notification:', error);
      // Don't fail the whole operation if realtime fails
    }
  }

  /**
   * Handle issue assigned webhook (internal)
   */
  private async handleIssueAssigned(event: {
    issueId: string;
    workspaceId: string;
    assignedTo: string;
    assignedBy: string;
    issueTitle: string;
    issueSeverity: string;
    issueFramework: string;
    workspaceName: string;
    dueDate?: number;
    priorityLevel?: string;
    notes?: string;
    timestamp: number;
  }): Promise<void> {
    this.env.logger.info('Handling issue.assigned event', {
      issueId: event.issueId,
      assignedTo: event.assignedTo,
    });

    // Get assigner name
    const db = this.getDb();
    const assigner = await db
      .selectFrom('users')
      .select('email')
      .where('id', '=', event.assignedBy)
      .executeTakeFirst();

    const assignerName = assigner ? assigner.email.split('@')[0] : 'Team Member';

    // Severity emoji mapping
    const severityEmoji: Record<string, string> = {
      critical: '🚨',
      high: '⚠️',
      medium: '📍',
      low: 'ℹ️',
    };

    const emoji = severityEmoji[event.issueSeverity] || '📋';
    
    const dueDateText = event.dueDate 
      ? `\nDue Date: ${new Date(event.dueDate).toLocaleDateString()}`
      : '';
    
    const priorityText = event.priorityLevel 
      ? ` (Priority: ${event.priorityLevel})`
      : '';

    // Create notification
    await this.createNotification({
      user_id: event.assignedTo,
      type: 'issue_assigned',
      title: `${emoji} Issue Assigned: ${event.issueTitle}${priorityText}`,
      message: `You've been assigned a new ${event.issueSeverity} priority issue in ${event.workspaceName}${dueDateText}${event.notes ? '\n\nNote: ' + event.notes : ''}`,
      action_url: `/org/${event.workspaceId}/workspace/${event.workspaceId}/issues/${event.issueId}`,
      metadata: {
        issueId: event.issueId,
        severity: event.issueSeverity,
        framework: event.issueFramework,
        assignedBy: assignerName,
        dueDate: event.dueDate,
        priorityLevel: event.priorityLevel,
      },
      send_email: true,
      send_realtime: true,
    });
  }

  /**
   * Handle issue status changed webhook (internal)
   */
  private async handleIssueStatusChanged(event: {
    issueId: string;
    workspaceId: string;
    issueTitle: string;
    assignedTo?: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
    notes?: string;
    timestamp: number;
  }): Promise<void> {
    this.env.logger.info('Handling issue.status_changed event', {
      issueId: event.issueId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
    });

    // Only notify if issue is assigned to someone
    if (!event.assignedTo) {
      return;
    }

    // Get changer name
    const db = this.getDb();
    const changer = await db
      .selectFrom('users')
      .select('email')
      .where('id', '=', event.changedBy)
      .executeTakeFirst();

    const changerName = changer ? changer.email.split('@')[0] : 'Team Member';

    // Status emoji mapping
    const statusEmoji: Record<string, string> = {
      open: '🔓',
      in_progress: '⏳',
      resolved: '✅',
      dismissed: '❌',
    };

    const emoji = statusEmoji[event.newStatus] || '📋';

    // Create notification for the assigned user
    await this.createNotification({
      user_id: event.assignedTo,
      type: 'status_change',
      title: `${emoji} Issue Status Updated: ${event.issueTitle}`,
      message: `${changerName} changed the status from "${event.oldStatus}" to "${event.newStatus}"${event.notes ? '\n\nNote: ' + event.notes : ''}`,
      action_url: `/org/${event.workspaceId}/workspace/${event.workspaceId}/issues/${event.issueId}`,
      metadata: {
        issueId: event.issueId,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        changedBy: changerName,
      },
      send_email: true,
      send_realtime: true,
    });
  }

  /**
   * Handle issue commented webhook (internal)
   */
  private async handleIssueCommented(event: {
    issueId: string;
    workspaceId: string;
    commentId: string;
    userId: string;
    commentText: string;
    issueTitle: string;
    assignedTo?: string;
    timestamp: number;
  }): Promise<void> {
    this.env.logger.info('Handling issue.commented event', {
      issueId: event.issueId,
      commentId: event.commentId,
    });

    // Only notify if issue is assigned to someone other than the commenter
    if (!event.assignedTo || event.assignedTo === event.userId) {
      return;
    }

    // Get commenter name
    const db = this.getDb();
    const commenter = await db
      .selectFrom('users')
      .select('email')
      .where('id', '=', event.userId)
      .executeTakeFirst();

    const commenterName = commenter ? commenter.email.split('@')[0] : 'Team Member';

    // Truncate comment for notification
    const previewText = event.commentText.length > 100 
      ? event.commentText.substring(0, 100) + '...'
      : event.commentText;

    // Create notification for the assigned user
    await this.createNotification({
      user_id: event.assignedTo,
      type: 'comment',
      title: `💬 New Comment on: ${event.issueTitle}`,
      message: `${commenterName} commented: "${previewText}"`,
      action_url: `/org/${event.workspaceId}/workspace/${event.workspaceId}/issues/${event.issueId}`,
      metadata: {
        issueId: event.issueId,
        commentId: event.commentId,
        commentedBy: commenterName,
      },
      send_email: true,
      send_realtime: true,
    });
  }

  /**
   * Handle compliance check complete webhook (internal)
   * Notify workspace admins if critical issues found
   */
  private async handleComplianceCheckComplete(event: {
    checkId: string;
    documentId: string;
    workspaceId: string;
    framework: string;
    issuesFound: number;
    criticalIssues: number;
    timestamp: number;
  }): Promise<void> {
    this.env.logger.info('Handling compliance.check_complete event', {
      checkId: event.checkId,
      criticalIssues: event.criticalIssues,
    });

    // Only notify if critical issues found
    if (event.criticalIssues === 0) {
      return;
    }

    // Get workspace admins
    const db = this.getDb();
    const admins = await db
      .selectFrom('workspace_members')
      .select('user_id')
      .where('workspace_id', '=', event.workspaceId)
      .where('role', 'in', ['owner', 'admin'])
      .execute();

    // Get document name
    const document = await db
      .selectFrom('documents')
      .select('filename')
      .where('id', '=', event.documentId)
      .executeTakeFirst();

    const documentName = document?.filename || 'Unknown Document';

    // Create notification for each admin
    for (const admin of admins) {
      await this.createNotification({
        user_id: admin.user_id,
        type: 'status_change',
        title: `🚨 Compliance Check Complete: ${event.criticalIssues} Critical Issues Found`,
        message: `A compliance check for "${documentName}" (${event.framework}) found ${event.criticalIssues} critical issues that require immediate attention.`,
        action_url: `/org/${event.workspaceId}/workspace/${event.workspaceId}/compliance/${event.checkId}`,
        metadata: {
          checkId: event.checkId,
          documentId: event.documentId,
          framework: event.framework,
          criticalIssues: event.criticalIssues,
        },
        send_email: true,
        send_realtime: true,
      });
    }
  }
}

