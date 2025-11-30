/**
 * Notification Types and Interfaces
 * Comprehensive type definitions for notification system
 */

// Notification Types
export type NotificationType = 'critical' | 'warning' | 'info' | 'success';
export type NotificationCategory = 'compliance' | 'system' | 'insight' | 'report' | 'alert';
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';
export type NotificationStatus = 'unread' | 'read' | 'archived' | 'dismissed';

// Notification Action
export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  variant?: 'primary' | 'secondary' | 'danger';
  url?: string;
  data?: Record<string, unknown>;
}

// Core Notification Interface
export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  timestamp: number;
  workspaceId: string;
  userId?: string;
  conversationId?: string;
  actions?: NotificationAction[];
  metadata?: Record<string, unknown>;
  expiresAt?: number;
  dismissible?: boolean;
  autoHide?: boolean;
  autoHideDuration?: number; // in ms
}

// Toast Notification
export interface ToastNotification extends Omit<Notification, 'status' | 'workspaceId'> {
  workspaceId?: string;
  duration?: number; // in ms, default 5000
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  showProgress?: boolean;
  onClose?: () => void;
}

// Notification Settings
export interface NotificationSettings {
  enabled: boolean;
  categories: {
    compliance: boolean;
    system: boolean;
    insight: boolean;
    report: boolean;
    alert: boolean;
  };
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  frequency: {
    realTime: boolean;
    digest: 'hourly' | 'daily' | 'weekly' | 'never';
    quietHours: {
      enabled: boolean;
      startTime: string; // HH:mm format
      endTime: string; // HH:mm format
    };
  };
  priorities: {
    urgent: boolean;
    high: boolean;
    normal: boolean;
    low: boolean;
  };
  doNotDisturb: {
    enabled: boolean;
    startTime?: string;
    endTime?: string;
  };
}

// Notification Filter
export interface NotificationFilter {
  types?: NotificationType[];
  categories?: NotificationCategory[];
  priorities?: NotificationPriority[];
  status?: NotificationStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

// Notification Query
export interface NotificationQuery {
  workspaceId: string;
  filters?: NotificationFilter;
  page?: number;
  limit?: number;
  sortBy?: 'timestamp' | 'priority' | 'type';
  sortOrder?: 'asc' | 'desc';
}

// Notification Response
export interface NotificationResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  hasMore: boolean;
}

// Proactive Alert
export interface ProactiveAlert {
  id: string;
  type: 'compliance_issue' | 'weekly_report' | 'ai_insight' | 'deadline' | 'anomaly';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation?: string;
  affectedFrameworks?: string[];
  affectedDocuments?: string[];
  detectedAt: number;
  resolveBy?: number;
  actions: NotificationAction[];
  metadata?: Record<string, unknown>;
}

// Compliance Alert Data
export interface ComplianceAlertData {
  framework: string;
  article?: string;
  requirement?: string;
  violationType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  documentId?: string;
  documentName?: string;
  location?: string;
  suggestedFix?: string;
}

// Weekly Report Data
export interface WeeklyReportData {
  startDate: string;
  endDate: string;
  summary: {
    conversationsCount: number;
    issuesDetected: number;
    issuesResolved: number;
    complianceScoreChange: number;
    topFrameworks: string[];
  };
  highlights: string[];
  recommendations: string[];
}

// AI Insight Data
export interface AIInsightData {
  insightType: 'pattern' | 'recommendation' | 'optimization' | 'risk';
  confidence: number; // 0-1
  description: string;
  reasoning: string;
  suggestedAction: string;
  potentialImpact: string;
  relatedConversations?: string[];
}

// Notification Center State
export interface NotificationCenterState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  filter: NotificationFilter;
  isLoading: boolean;
  hasMore: boolean;
  page: number;
}

// Toast State
export interface ToastState {
  toasts: ToastNotification[];
  maxToasts: number; // default 5
}

// Constants
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  critical: '⚠️',
  warning: '⚠️',
  info: 'ℹ️',
  success: '✅',
};

export const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  critical: '#EF4444',
  warning: '#EAB308',
  info: '#2563EB',
  success: '#22C55E',
};

export const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  urgent: '#DC2626',
  high: '#EF4444',
  normal: '#2563EB',
  low: '#6B7280',
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  categories: {
    compliance: true,
    system: true,
    insight: true,
    report: true,
    alert: true,
  },
  channels: {
    inApp: true,
    email: true,
    push: false,
  },
  frequency: {
    realTime: true,
    digest: 'daily',
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
  },
  priorities: {
    urgent: true,
    high: true,
    normal: true,
    low: true,
  },
  doNotDisturb: {
    enabled: false,
  },
};

export const DEFAULT_AUTO_HIDE_DURATION = 5000; // 5 seconds
export const URGENT_AUTO_HIDE_DURATION = 10000; // 10 seconds
export const CRITICAL_AUTO_HIDE_DURATION = 0; // Never auto-hide

// Utility function to get auto-hide duration based on priority
export function getAutoHideDuration(priority: NotificationPriority): number {
  switch (priority) {
    case 'urgent':
      return URGENT_AUTO_HIDE_DURATION;
    case 'high':
      return DEFAULT_AUTO_HIDE_DURATION;
    case 'normal':
      return DEFAULT_AUTO_HIDE_DURATION;
    case 'low':
      return DEFAULT_AUTO_HIDE_DURATION;
    default:
      return DEFAULT_AUTO_HIDE_DURATION;
  }
}

// Utility function to check if notification should show based on settings
export function shouldShowNotification(
  notification: Notification,
  settings: NotificationSettings
): boolean {
  if (!settings.enabled) return false;
  if (!settings.categories[notification.category]) return false;
  if (!settings.priorities[notification.priority]) return false;
  
  // Check quiet hours
  if (settings.frequency.quietHours.enabled) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { startTime, endTime } = settings.frequency.quietHours;
    
    if (startTime && endTime) {
      // Simple time comparison (doesn't handle midnight crossing)
      if (currentTime >= startTime || currentTime <= endTime) {
        // Only show urgent notifications during quiet hours
        return notification.priority === 'urgent';
      }
    }
  }
  
  // Check do not disturb
  if (settings.doNotDisturb.enabled) {
    return notification.priority === 'urgent';
  }
  
  return true;
}
