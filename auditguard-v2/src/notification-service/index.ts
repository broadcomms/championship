import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { nanoid } from 'nanoid';
import type {
  Notification,
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationSource,
  NotificationAction,
  NotificationAIContext,
  NotificationFilter,
  NotificationCount,
  CreateAINotificationRequest
} from '../types/notifications';

/**
 * Notification Service - Handles in-app, email, and real-time notifications
 *
 * This service provides:
 * - Creating and managing in-app notifications (workspace + AI)
 * - User notification preferences management
 * - Integration with email-service for email notifications
 * - Integration with realtime-service for WebSocket notifications
 * - AI Assistant proactive notifications
 */

export interface CreateNotificationRequest {
  user_id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  source: NotificationSource;
  title: string;
  message: string;
  action_url: string;
  workspace_id?: string;
  ai_session_id?: string;
  ai_context?: NotificationAIContext;
  actions?: NotificationAction[];
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
  email_ai_compliance_alert?: 'instant' | 'daily' | 'weekly' | 'never';
  email_ai_recommendation?: 'instant' | 'daily' | 'weekly' | 'never';
  email_ai_issue_detected?: 'instant' | 'daily' | 'weekly' | 'never';
  email_ai_report_ready?: 'instant' | 'daily' | 'weekly' | 'never';
  email_ai_insight?: 'instant' | 'daily' | 'weekly' | 'never';
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
      // POST /api/notifications - Get user's notifications with filters (unified system)
      if (path === '/api/notifications' && request.method === 'POST') {
        const body = await request.json() as { userId: string, filter?: NotificationFilter };
        return await this.getFilteredNotifications(body.userId, body.filter || {});
      }

      // GET /api/notifications/count - Get unread count with category breakdown
      if (path === '/api/notifications/count' && request.method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 });
        }
        return await this.getNotificationCount(userId);
      }

      // PATCH /api/notifications/:id/read - Mark notification as read
      if (path.match(/^\/api\/notifications\/[^/]+\/read$/) && request.method === 'PATCH') {
        const notificationId = path.split('/')[3];
        return await this.markAsRead(notificationId);
      }

      // POST /api/notifications/read-all - Mark all as read
      if (path === '/api/notifications/read-all' && request.method === 'POST') {
        const body = await request.json() as { userId: string, category?: NotificationCategory };
        return await this.markAllAsRead(body.userId, body.category);
      }

      // PATCH /api/notifications/:id/archive - Archive notification
      if (path.match(/^\/api\/notifications\/[^/]+\/archive$/) && request.method === 'PATCH') {
        const notificationId = path.split('/')[3];
        return await this.archiveNotification(notificationId);
      }

      // DELETE /api/notifications/:id - Delete notification
      if (path.match(/^\/api\/notifications\/[^/]+$/) && request.method === 'DELETE') {
        const notificationId = path.split('/')[3];
        return await this.deleteNotification(notificationId);
      }

      // POST /api/notifications/:id/action - Execute notification action
      if (path.match(/^\/api\/notifications\/[^/]+\/action$/) && request.method === 'POST') {
        const notificationId = path.split('/')[3];
        const body = await request.json() as { action: string };
        return await this.executeNotificationAction(notificationId, body.action);
      }

      // POST /api/notifications/ai - Create AI notification (helper endpoint)
      if (path === '/api/notifications/ai' && request.method === 'POST') {
        const body = await request.json() as CreateAINotificationRequest;
        return await this.createAINotification(body);
      }

      // Legacy endpoints (kept for backward compatibility)
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
        return await this._createNotification(body);
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
   * Get user's notifications with advanced filtering (unified system)
   */
  private async getFilteredNotifications(
    userId: string,
    filter: NotificationFilter
  ): Promise<Response> {
    const db = this.getDb();

    let query = db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .where('archived', '=', 0);

    // Apply category filter
    if (filter.category && filter.category.length > 0) {
      query = query.where('category', 'in', filter.category);
    }

    // Apply priority filter
    if (filter.priority && filter.priority.length > 0) {
      query = query.where('priority', 'in', filter.priority);
    }

    // Apply read/unread filter
    if (filter.status && filter.status.length > 0) {
      if (filter.status.includes('read') && !filter.status.includes('unread')) {
        query = query.where('read', '=', 1);
      } else if (filter.status.includes('unread') && !filter.status.includes('read')) {
        query = query.where('read', '=', 0);
      }
    }

    // Apply workspace filter
    if (filter.workspace_id) {
      query = query.where('workspace_id', '=', filter.workspace_id);
    }

    // Apply date range filters
    if (filter.after) {
      query = query.where('created_at', '>=', filter.after);
    }
    if (filter.before) {
      query = query.where('created_at', '<=', filter.before);
    }

    // Count total matching notifications
    const countQuery = query.select((eb) => eb.fn.count('id').as('total'));
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.total || 0);

    // Apply pagination
    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    query = query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const notifications = await query.execute();

    // Parse JSON fields
    const parsedNotifications = notifications.map(n => ({
      ...n,
      read: n.read === 1,
      archived: n.archived === 1,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
      ai_context: n.ai_context ? JSON.parse(n.ai_context) : null,
      actions: n.actions ? JSON.parse(n.actions) : []
    }));

    const hasMore = offset + notifications.length < total;

    return new Response(JSON.stringify({
      notifications: parsedNotifications,
      total,
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get notification count with category breakdown
   */
  private async getNotificationCount(userId: string): Promise<Response> {
    const db = this.getDb();

    // Get total unread count
    const totalResult = await db
      .selectFrom('notifications')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('user_id', '=', userId)
      .where('read', '=', 0)
      .where('archived', '=', 0)
      .executeTakeFirst();

    const total = Number(totalResult?.count || 0);

    // Get counts by category
    const categoryResults = await db
      .selectFrom('notifications')
      .select(['category', (eb) => eb.fn.count('id').as('count')])
      .where('user_id', '=', userId)
      .where('read', '=', 0)
      .where('archived', '=', 0)
      .groupBy('category')
      .execute();

    const byCategory = {
      ai: 0,
      workspace: 0,
      system: 0
    };

    categoryResults.forEach(r => {
      const category = r.category as NotificationCategory;
      byCategory[category] = Number(r.count);
    });

    // Get counts by priority
    const priorityResults = await db
      .selectFrom('notifications')
      .select(['priority', (eb) => eb.fn.count('id').as('count')])
      .where('user_id', '=', userId)
      .where('read', '=', 0)
      .where('archived', '=', 0)
      .groupBy('priority')
      .execute();

    const byPriority = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    priorityResults.forEach(r => {
      const priority = r.priority as NotificationPriority;
      byPriority[priority] = Number(r.count);
    });

    const count: NotificationCount = {
      total,
      unread: total,
      by_category: byCategory,
      by_priority: byPriority
    };

    return new Response(JSON.stringify(count), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Archive a notification
   */
  private async archiveNotification(notificationId: string): Promise<Response> {
    const db = this.getDb();

    await db
      .updateTable('notifications')
      .set({ archived: 1 })
      .where('id', '=', notificationId)
      .execute();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Delete a notification
   */
  private async deleteNotification(notificationId: string): Promise<Response> {
    const db = this.getDb();

    await db
      .deleteFrom('notifications')
      .where('id', '=', notificationId)
      .execute();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Execute a notification action
   */
  private async executeNotificationAction(
    notificationId: string,
    action: string
  ): Promise<Response> {
    const db = this.getDb();

    // Get notification
    const notification = await db
      .selectFrom('notifications')
      .selectAll()
      .where('id', '=', notificationId)
      .executeTakeFirst();

    if (!notification) {
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mark as read when action is executed
    await this.markAsRead(notificationId);

    // Parse actions
    const actions: NotificationAction[] = notification.actions ? JSON.parse(notification.actions) : [];
    const actionObj = actions.find(a => a.action === action);

    if (!actionObj) {
      return new Response(JSON.stringify({ error: 'Action not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Execute action based on type
    let redirectUrl = notification.action_url;

    switch (action) {
      case 'snooze':
        // Snooze for 1 hour
        await db
          .updateTable('notifications')
          .set({ snoozed_until: Date.now() + 3600000 })
          .where('id', '=', notificationId)
          .execute();
        redirectUrl = undefined;
        break;
      
      case 'dismiss':
      case 'archive':
        await this.archiveNotification(notificationId);
        redirectUrl = undefined;
        break;
      
      // For other actions, just mark as read and redirect
      default:
        break;
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      notification_id: notificationId,
      redirect_url: redirectUrl
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Create AI notification (helper for AI Assistant service)
   */
  private async createAINotification(req: CreateAINotificationRequest): Promise<Response> {
    const orgId = req.workspace_id; // Will need to get org from workspace
    
    return await this._createNotification({
      user_id: req.user_id,
      type: req.type,
      category: 'ai',
      priority: req.priority || this.getAIPriority(req.context),
      source: 'ai_assistant',
      title: req.title,
      message: req.message,
      action_url: `/org/${orgId}/workspace/${req.workspace_id}/assistant?session=${req.session_id}`,
      workspace_id: req.workspace_id,
      ai_session_id: req.session_id,
      ai_context: req.context,
      actions: req.actions || this.getDefaultAIActions(req.type),
      send_email: true,
      send_realtime: true
    });
  }

  /**
   * Get AI notification priority based on context
   */
  private getAIPriority(context: NotificationAIContext): NotificationPriority {
    if (context.severity === 'critical') return 'critical';
    if (context.severity === 'high') return 'high';
    if (context.severity === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Get default actions for AI notification types
   */
  private getDefaultAIActions(type: NotificationType): NotificationAction[] {
    switch (type) {
      case 'ai_compliance_alert':
        return [
          { id: '1', label: 'View Issues', action: 'view_issues', style: 'primary' },
          { id: '2', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
        ];
      
      case 'ai_recommendation':
        return [
          { id: '1', label: 'Review', action: 'review_recommendation', style: 'primary' },
          { id: '2', label: 'Snooze', action: 'snooze', style: 'secondary' },
          { id: '3', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
        ];
      
      case 'ai_issue_detected':
        return [
          { id: '1', label: 'View Details', action: 'view_issues', style: 'primary' },
          { id: '2', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
        ];
      
      case 'ai_report_ready':
        return [
          { id: '1', label: 'View Report', action: 'view_report', style: 'primary' }
        ];
      
      default:
        return [
          { id: '1', label: 'View', action: 'view', style: 'primary' }
        ];
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
   * Create a new notification (Public method for inter-service communication)
   */
  async createNotification(req: CreateNotificationRequest): Promise<Response> {
    return await this._createNotification(req);
  }

  /**
   * Get user notifications (Public method for inter-service communication)
   */
  async getNotifications(userId: string, filter?: { unreadOnly?: boolean; limit?: number; offset?: number }): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    const db = this.getDb();

    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;
    const unreadOnly = filter?.unreadOnly || false;

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

    // Get total count
    const totalResult = await db
      .selectFrom('notifications')
      .select(db.fn.count('id').as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirst();

    // Get unread count
    const unreadResult = await db
      .selectFrom('notifications')
      .select(db.fn.count('id').as('count'))
      .where('user_id', '=', userId)
      .where('read', '=', 0)
      .executeTakeFirst();

    // Parse metadata JSON strings
    const parsedNotifications = notifications.map(n => ({
      ...n,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
      read: n.read === 1,
      archived: n.archived === 1,
      ai_context: n.ai_context ? JSON.parse(n.ai_context) : null,
      actions: n.actions ? JSON.parse(n.actions) : null,
    }));

    return {
      notifications: parsedNotifications as Notification[],
      total: Number(totalResult?.count || 0),
      unreadCount: Number(unreadResult?.count || 0),
    };
  }

  /**
   * Mark notification as read (Public method for inter-service communication)
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
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
  }

  /**
   * Create a new notification (Private implementation)
   */
  private async _createNotification(req: CreateNotificationRequest): Promise<Response> {
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

    // Determine category from type if not provided
    const category = req.category || this.getCategoryFromType(req.type);
    
    // Determine priority if not provided
    const priority = req.priority || 'medium';
    
    // Determine source if not provided
    const source = req.source || 'system';

    // Only create in-app notification if enabled (or preferences don't exist yet)
    if (!preferences || preferences.in_app_enabled === 1) {
      await db
        .insertInto('notifications')
        .values({
          id: notificationId,
          user_id: req.user_id,
          type: req.type as any, // Cast to any to bypass type checking
          category,
          priority,
          source,
          title: req.title,
          message: req.message,
          read: 0,
          archived: 0,
          action_url: req.action_url,
          workspace_id: req.workspace_id || null,
          ai_session_id: req.ai_session_id || null,
          ai_context: req.ai_context ? JSON.stringify(req.ai_context) : null,
          actions: req.actions ? JSON.stringify(req.actions) : null,
          metadata: req.metadata ? JSON.stringify(req.metadata) : null,
          snoozed_until: null,
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
        category,
        priority,
        title: req.title,
        message: req.message,
        action_url: req.action_url,
        actions: req.actions,
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
   * Get category from notification type
   */
  private getCategoryFromType(type: NotificationType): NotificationCategory {
    if (type.startsWith('ai_')) {
      return 'ai';
    }
    return 'workspace';
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
   * Mark all notifications as read for a user (optionally filtered by category)
   */
  private async markAllAsRead(userId: string, category?: NotificationCategory): Promise<Response> {
    const db = this.getDb();
    const now = Date.now();

    let query = db
      .updateTable('notifications')
      .set({
        read: 1,
        read_at: now
      })
      .where('user_id', '=', userId)
      .where('read', '=', 0);

    // Apply category filter if provided
    if (category) {
      query = query.where('category', '=', category);
    }

    await query.execute();

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
        email_ai_compliance_alert: 'instant',
        email_ai_recommendation: 'daily',
        email_ai_issue_detected: 'instant',
        email_ai_report_ready: 'instant',
        email_ai_insight: 'weekly',
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
      case 'ai_compliance_alert':
        emailFrequency = preferences?.email_ai_compliance_alert || 'instant';
        break;
      case 'ai_recommendation':
        emailFrequency = preferences?.email_ai_recommendation || 'daily';
        break;
      case 'ai_issue_detected':
        emailFrequency = preferences?.email_ai_issue_detected || 'instant';
        break;
      case 'ai_report_ready':
        emailFrequency = preferences?.email_ai_report_ready || 'instant';
        break;
      case 'ai_insight':
        emailFrequency = preferences?.email_ai_insight || 'weekly';
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
    await this._createNotification({
      user_id: event.assignedTo,
      type: 'issue_assigned',
      category: 'workspace',
      priority: this.getPriorityFromSeverity(event.issueSeverity),
      source: 'workspace',
      title: `${emoji} Issue Assigned: ${event.issueTitle}${priorityText}`,
      message: `You've been assigned a new ${event.issueSeverity} priority issue in ${event.workspaceName}${dueDateText}${event.notes ? '\n\nNote: ' + event.notes : ''}`,
      action_url: `/org/${event.workspaceId}/workspace/${event.workspaceId}/issues/${event.issueId}`,
      workspace_id: event.workspaceId,
      metadata: {
        issueId: event.issueId,
        severity: event.issueSeverity,
        framework: event.issueFramework,
        assignedBy: assignerName,
        dueDate: event.dueDate,
        priorityLevel: event.priorityLevel,
      },
      actions: [
        { id: '1', label: 'View Issue', action: 'view', style: 'primary' },
        { id: '2', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
      ],
      send_email: true,
      send_realtime: true,
    });
  }

  /**
   * Convert severity to priority
   */
  private getPriorityFromSeverity(severity: string): NotificationPriority {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
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
      category: 'workspace',
      priority: 'medium',
      source: 'workspace',
      title: `${emoji} Issue Status Updated: ${event.issueTitle}`,
      message: `${changerName} changed the status from "${event.oldStatus}" to "${event.newStatus}"${event.notes ? '\n\nNote: ' + event.notes : ''}`,
      action_url: `/org/${event.workspaceId}/workspace/${event.workspaceId}/issues/${event.issueId}`,
      workspace_id: event.workspaceId,
      metadata: {
        issueId: event.issueId,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        changedBy: changerName,
      },
      actions: [
        { id: '1', label: 'View Issue', action: 'view', style: 'primary' }
      ],
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
      category: 'workspace',
      priority: 'low',
      source: 'workspace',
      title: `💬 New Comment on: ${event.issueTitle}`,
      message: `${commenterName} commented: "${previewText}"`,
      action_url: `/org/${event.workspaceId}/workspace/${event.workspaceId}/issues/${event.issueId}`,
      workspace_id: event.workspaceId,
      metadata: {
        issueId: event.issueId,
        commentId: event.commentId,
        commentedBy: commenterName,
      },
      actions: [
        { id: '1', label: 'View Comment', action: 'view', style: 'primary' },
        { id: '2', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
      ],
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
      await this._createNotification({
        user_id: admin.user_id,
        type: 'status_change',
        category: 'workspace',
        priority: 'critical',
        source: 'system',
        title: `🚨 Compliance Check Complete: ${event.criticalIssues} Critical Issues Found`,
        message: `A compliance check for "${documentName}" (${event.framework}) found ${event.criticalIssues} critical issues that require immediate attention.`,
        action_url: `/org/${event.workspaceId}/workspace/${event.workspaceId}/compliance/${event.checkId}`,
        workspace_id: event.workspaceId,
        metadata: {
          checkId: event.checkId,
          documentId: event.documentId,
          framework: event.framework,
          criticalIssues: event.criticalIssues,
        },
        actions: [
          { id: '1', label: 'View Check', action: 'view', style: 'primary' },
          { id: '2', label: 'View Issues', action: 'view_issues', style: 'secondary' }
        ],
        send_email: true,
        send_realtime: true,
      });
    }
  }
}

