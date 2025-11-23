/**
 * Unified Notification System Types
 * Consolidates workspace and AI Assistant notifications into a single system
 */

// Base notification types from database
export type NotificationType = 
    // AI Types
    | 'ai_compliance_alert'
    | 'ai_recommendation'
    | 'ai_issue_detected'
    | 'ai_report_ready'
    | 'ai_insight'
    // Workspace Types
    | 'issue_assigned'
    | 'comment'
    | 'mention'
    | 'status_change'
    | 'workspace_invite'
    | 'due_date_reminder'
    | 'overdue_alert'
    // System & Billing Types
    | 'welcome'
    | 'trial_started'
    | 'trial_warning'
    | 'trial_expired'
    | 'subscription_created'
    | 'subscription_updated'
    | 'subscription_canceled'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'invoice_ready';

export type NotificationCategory = 'ai' | 'workspace' | 'system';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationSource = 'ai_assistant' | 'workspace' | 'system';
export type NotificationActionStyle = 'primary' | 'secondary' | 'danger';

/**
 * AI Context attached to AI-generated notifications
 */
export interface NotificationAIContext {
    compliance_framework?: string;
    issue_count?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    confidence?: number;
    document_id?: string;
    check_id?: string;
}

/**
 * Action button for notifications
 */
export interface NotificationAction {
    id: string;
    label: string;
    action: string; // e.g., 'view_issues', 'review_recommendation', 'dismiss'
    style: NotificationActionStyle;
}

/**
 * Complete notification object (matches database schema)
 */
export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    category: NotificationCategory;
    priority: NotificationPriority;
    source: NotificationSource;
    title: string;
    message: string;
    
    // Metadata
    read: boolean;
    archived: boolean;
    action_url: string;
    metadata: Record<string, any> | null;
    
    // Context
    workspace_id: string | null;
    
    // AI-specific
    ai_session_id: string | null;
    ai_context: NotificationAIContext | null;
    
    // Actions
    actions: NotificationAction[];
    
    // Timestamps
    created_at: number;
    read_at: number | null;
    snoozed_until: number | null;
}

/**
 * Notification filter for API requests
 */
export interface NotificationFilter {
    category?: NotificationCategory[];
    priority?: NotificationPriority[];
    status?: ('read' | 'unread')[];
    workspace_id?: string;
    limit?: number;
    offset?: number;
    before?: number; // Timestamp
    after?: number; // Timestamp
}

/**
 * Notification count response
 */
export interface NotificationCount {
    total: number;
    unread: number;
    by_category: {
        ai: number;
        workspace: number;
        system: number;
    };
    by_priority: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

/**
 * Create notification request
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
}

/**
 * AI notification creation helper types
 */
export interface CreateAINotificationRequest {
    workspace_id: string;
    user_id: string;
    session_id: string;
    type: Extract<NotificationType, 'ai_compliance_alert' | 'ai_recommendation' | 'ai_issue_detected' | 'ai_report_ready' | 'ai_insight'>;
    title: string;
    message: string;
    context: NotificationAIContext;
    actions?: NotificationAction[];
    priority?: NotificationPriority;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
    user_id: string;
    // Email preferences for each type
    email_issue_assigned: 'instant' | 'daily' | 'weekly' | 'never';
    email_comments: 'instant' | 'daily' | 'weekly' | 'never';
    email_mentions: 'instant' | 'daily' | 'weekly' | 'never';
    email_due_date: 'instant' | 'daily' | 'weekly' | 'never';
    email_status_change: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_compliance_alert: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_recommendation: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_issue_detected: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_report_ready: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_insight: 'instant' | 'daily' | 'weekly' | 'never';
    // In-app preferences
    in_app_enabled: boolean;
    in_app_sound: boolean;
    browser_push_enabled: boolean;
    updated_at: number;
}

/**
 * Notification list response
 */
export interface NotificationListResponse {
    notifications: Notification[];
    total: number;
    has_more: boolean;
    next_offset?: number;
}

/**
 * Notification action execution result
 */
export interface NotificationActionResult {
    success: boolean;
    action: string;
    notification_id: string;
    redirect_url?: string;
    message?: string;
}
