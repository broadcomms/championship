/**
 * AI Notification Helpers
 * Provides easy-to-use functions for AI Assistant to create notifications
 */

import type {
  NotificationAction,
  NotificationAIContext,
  CreateAINotificationRequest
} from '../types/notifications';

export interface ComplianceAlertData {
  workspaceId: string;
  userId: string;
  sessionId: string;
  framework: string;
  issueCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  documentId?: string;
  checkId?: string;
}

export interface RecommendationData {
  workspaceId: string;
  userId: string;
  sessionId: string;
  title: string;
  description: string;
  confidence: number;
  framework?: string;
}

export interface IssueDetectedData {
  workspaceId: string;
  userId: string;
  sessionId: string;
  issueCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  framework: string;
  documentId?: string;
  checkId?: string;
}

export interface ReportReadyData {
  workspaceId: string;
  userId: string;
  sessionId: string;
  reportName: string;
  frameworks: string[];
  reportId: string;
}

/**
 * Create a compliance alert notification
 */
export async function createComplianceAlertNotification(
  data: ComplianceAlertData
): Promise<Response> {
  const context: NotificationAIContext = {
    compliance_framework: data.framework,
    issue_count: data.issueCount,
    severity: data.severity,
    document_id: data.documentId,
    check_id: data.checkId
  };

  const actions: NotificationAction[] = [
    { id: '1', label: 'View Issues', action: 'view_issues', style: 'primary' },
    { id: '2', label: 'Analyze', action: 'analyze', style: 'secondary' },
    { id: '3', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
  ];

  const severityEmoji = {
    critical: '🚨',
    high: '⚠️',
    medium: '📍',
    low: 'ℹ️'
  };

  const request: CreateAINotificationRequest = {
    workspace_id: data.workspaceId,
    user_id: data.userId,
    session_id: data.sessionId,
    type: 'ai_compliance_alert',
    title: `${severityEmoji[data.severity]} Compliance Alert: ${data.issueCount} ${data.framework.toUpperCase()} Issues Detected`,
    message: `The AI Assistant has detected ${data.issueCount} ${data.severity} priority ${data.framework.toUpperCase()} compliance issues that require your attention.`,
    context,
    actions,
    priority: data.severity
  };

  return await fetch('http://notification-service/api/notifications/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
}

/**
 * Create a recommendation notification
 */
export async function createRecommendationNotification(
  data: RecommendationData
): Promise<Response> {
  const context: NotificationAIContext = {
    compliance_framework: data.framework,
    confidence: data.confidence
  };

  const actions: NotificationAction[] = [
    { id: '1', label: 'Review', action: 'review_recommendation', style: 'primary' },
    { id: '2', label: 'Apply', action: 'apply', style: 'primary' },
    { id: '3', label: 'Snooze', action: 'snooze', style: 'secondary' },
    { id: '4', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
  ];

  const request: CreateAINotificationRequest = {
    workspace_id: data.workspaceId,
    user_id: data.userId,
    session_id: data.sessionId,
    type: 'ai_recommendation',
    title: `💡 AI Recommendation: ${data.title}`,
    message: data.description,
    context,
    actions,
    priority: 'medium'
  };

  return await fetch('http://notification-service/api/notifications/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
}

/**
 * Create an issue detected notification
 */
export async function createIssueDetectedNotification(
  data: IssueDetectedData
): Promise<Response> {
  const context: NotificationAIContext = {
    compliance_framework: data.framework,
    issue_count: data.issueCount,
    severity: data.severity,
    document_id: data.documentId,
    check_id: data.checkId
  };

  const actions: NotificationAction[] = [
    { id: '1', label: 'View Details', action: 'view_issues', style: 'primary' },
    { id: '2', label: 'Create Tasks', action: 'create_tasks', style: 'secondary' },
    { id: '3', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
  ];

  const request: CreateAINotificationRequest = {
    workspace_id: data.workspaceId,
    user_id: data.userId,
    session_id: data.sessionId,
    type: 'ai_issue_detected',
    title: `🔍 New Issues Detected: ${data.issueCount} ${data.framework.toUpperCase()} Findings`,
    message: `The AI Assistant has identified ${data.issueCount} new ${data.severity} priority compliance issues during analysis.`,
    context,
    actions,
    priority: data.severity
  };

  return await fetch('http://notification-service/api/notifications/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
}

/**
 * Create a report ready notification
 */
export async function createReportReadyNotification(
  data: ReportReadyData
): Promise<Response> {
  const context: NotificationAIContext = {
    compliance_framework: data.frameworks.join(', ')
  };

  const actions: NotificationAction[] = [
    { id: '1', label: 'View Report', action: 'view_report', style: 'primary' },
    { id: '2', label: 'Download PDF', action: 'download_pdf', style: 'secondary' },
    { id: '3', label: 'Share', action: 'share', style: 'secondary' }
  ];

  const request: CreateAINotificationRequest = {
    workspace_id: data.workspaceId,
    user_id: data.userId,
    session_id: data.sessionId,
    type: 'ai_report_ready',
    title: `📊 Report Ready: ${data.reportName}`,
    message: `Your AI-generated compliance report covering ${data.frameworks.join(', ')} is ready for review.`,
    context,
    actions,
    priority: 'medium'
  };

  return await fetch('http://notification-service/api/notifications/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
}

/**
 * Create an insight notification
 */
export async function createInsightNotification(
  workspaceId: string,
  userId: string,
  sessionId: string,
  title: string,
  message: string,
  framework?: string
): Promise<Response> {
  const context: NotificationAIContext = {
    compliance_framework: framework
  };

  const actions: NotificationAction[] = [
    { id: '1', label: 'Learn More', action: 'view', style: 'primary' },
    { id: '2', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
  ];

  const request: CreateAINotificationRequest = {
    workspace_id: workspaceId,
    user_id: userId,
    session_id: sessionId,
    type: 'ai_insight',
    title: `✨ ${title}`,
    message,
    context,
    actions,
    priority: 'low'
  };

  return await fetch('http://notification-service/api/notifications/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
}

/**
 * Batch create multiple AI notifications
 */
export async function createBatchAINotifications(
  requests: CreateAINotificationRequest[]
): Promise<Response[]> {
  return Promise.all(
    requests.map(request =>
      fetch('http://notification-service/api/notifications/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
    )
  );
}
