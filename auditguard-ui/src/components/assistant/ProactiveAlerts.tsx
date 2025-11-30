'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useToast } from './ToastProvider';
import {
  ProactiveAlert,
  ComplianceAlertData,
  WeeklyReportData,
  AIInsightData,
} from '@/types/notification';

interface ProactiveAlertsProps {
  workspaceId: string;
  enabled?: boolean;
  checkInterval?: number; // in milliseconds, default 60000 (1 minute)
}

export default function ProactiveAlerts({
  workspaceId,
  enabled = true,
  checkInterval = 60000,
}: ProactiveAlertsProps) {
  const { showToast } = useToast();
  const lastCheckedRef = useRef<number>(0);
  const shownAlertsRef = useRef<Set<string>>(new Set());

  const showAlertToast = useCallback((alert: ProactiveAlert) => {
    const actions = alert.actions.map((action) => ({
      id: action.id,
      label: action.label,
      action: action.action,
      variant: action.variant || 'primary',
      url: action.url,
    }));

    switch (alert.type) {
      case 'compliance_issue':
        showToast({
          type: alert.severity === 'critical' ? 'critical' : 'warning',
          category: 'compliance',
          priority: alert.severity === 'critical' ? 'urgent' : 'high',
          title: alert.title,
          message: alert.description,
          actions,
          autoHide: alert.severity !== 'critical',
          autoHideDuration: alert.severity === 'critical' ? 0 : 10000,
          showProgress: true,
          metadata: alert.metadata,
        });
        break;

      case 'weekly_report':
        showToast({
          type: 'info',
          category: 'report',
          priority: 'normal',
          title: alert.title,
          message: alert.description,
          actions,
          autoHide: false,
          showProgress: false,
          metadata: alert.metadata,
        });
        break;

      case 'ai_insight':
        showToast({
          type: 'info',
          category: 'insight',
          priority: 'normal',
          title: alert.title,
          message: alert.description,
          actions,
          autoHide: true,
          autoHideDuration: 10000,
          showProgress: true,
          metadata: alert.metadata,
        });
        break;

      case 'deadline':
        showToast({
          type: 'warning',
          category: 'alert',
          priority: 'high',
          title: alert.title,
          message: alert.description,
          actions,
          autoHide: false,
          showProgress: false,
          metadata: alert.metadata,
        });
        break;

      case 'anomaly':
        showToast({
          type: 'warning',
          category: 'system',
          priority: 'high',
          title: alert.title,
          message: alert.description,
          actions,
          autoHide: true,
          autoHideDuration: 8000,
          showProgress: true,
          metadata: alert.metadata,
        });
        break;
    }
  }, [showToast]);

  const checkForAlerts = useCallback(async () => {
    try {
      const response = await fetch(`/api/assistant/alerts?workspaceId=${workspaceId}&since=${lastCheckedRef.current}`);
      
      if (response.ok) {
        const data = await response.json();
        const alerts: ProactiveAlert[] = data.alerts || [];

        // Process each alert
        alerts.forEach((alert) => {
          // Skip if already shown
          if (shownAlertsRef.current.has(alert.id)) return;

          // Show toast based on alert type
          showAlertToast(alert);

          // Mark as shown
          shownAlertsRef.current.add(alert.id);
        });

        lastCheckedRef.current = Date.now();
      }
    } catch (error) {
      console.error('Failed to check for proactive alerts:', error);
    }
  }, [showAlertToast, workspaceId]);

  useEffect(() => {
    if (!enabled) return;

    // Check for alerts immediately on mount
    checkForAlerts();

    // Set up interval for periodic checks
    const interval = setInterval(checkForAlerts, checkInterval);

    return () => clearInterval(interval);
  }, [checkForAlerts, checkInterval, enabled]);

  // This component doesn't render anything visible
  return null;
}

// Helper function to create compliance alert
export function createComplianceAlert(
  data: ComplianceAlertData,
  workspaceId: string
): ProactiveAlert {
  // Map severity to ProactiveAlert severity type
  const severity = data.severity === 'critical' ? 'critical' : 
                   data.severity === 'high' || data.severity === 'medium' ? 'warning' : 'info';
  
  return {
    id: `alert_${Date.now()}_${Math.random()}`,
    type: 'compliance_issue',
    severity,
    title: `${data.framework} ${data.violationType} Detected`,
    description: data.suggestedFix
      ? `${data.violationType} found in ${data.documentName || 'document'}. ${data.suggestedFix}`
      : `${data.violationType} found in ${data.documentName || 'document'}. Please review and address this issue.`,
    recommendation: data.suggestedFix,
    affectedFrameworks: [data.framework],
    affectedDocuments: data.documentId ? [data.documentId] : undefined,
    detectedAt: Date.now(),
    actions: [
      {
        id: 'view_issue',
        label: 'View Details',
        action: 'view_compliance_issue',
        variant: 'primary',
        data: { issueId: data.documentId },
      },
      {
        id: 'dismiss',
        label: 'Dismiss',
        action: 'dismiss',
        variant: 'secondary',
      },
    ],
    metadata: { ...data, workspaceId },
  };
}

// Helper function to create weekly report alert
export function createWeeklyReportAlert(
  data: WeeklyReportData,
  workspaceId: string
): ProactiveAlert {
  return {
    id: `alert_${Date.now()}_${Math.random()}`,
    type: 'weekly_report',
    severity: 'info',
    title: 'Weekly Compliance Report Ready',
    description: `Your compliance score changed by ${data.summary.complianceScoreChange > 0 ? '+' : ''}${data.summary.complianceScoreChange}% this week. ${data.summary.issuesResolved} issues resolved out of ${data.summary.issuesDetected} detected.`,
    recommendation: data.recommendations.join(' '),
    detectedAt: Date.now(),
    actions: [
      {
        id: 'view_report',
        label: 'View Full Report',
        action: 'view_weekly_report',
        variant: 'primary',
      },
      {
        id: 'share',
        label: 'Share',
        action: 'share_report',
        variant: 'secondary',
      },
    ],
    metadata: { ...data, workspaceId },
  };
}

// Helper function to create AI insight alert
export function createAIInsightAlert(
  data: AIInsightData,
  workspaceId: string
): ProactiveAlert {
  return {
    id: `alert_${Date.now()}_${Math.random()}`,
    type: 'ai_insight',
    severity: 'info',
    title: `AI Insight: ${data.insightType.charAt(0).toUpperCase() + data.insightType.slice(1)}`,
    description: data.description,
    recommendation: data.suggestedAction,
    detectedAt: Date.now(),
    actions: [
      {
        id: 'review',
        label: 'Review Suggestion',
        action: 'review_ai_insight',
        variant: 'primary',
      },
      {
        id: 'remind',
        label: 'Remind Later',
        action: 'remind_later',
        variant: 'secondary',
      },
    ],
    metadata: { ...data, workspaceId },
  };
}
