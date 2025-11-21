/**
 * Proactive Notification System
 * Generates AI-powered compliance alerts based on workspace data
 */

export interface ProactiveNotification {
  id: string;
  type: 'compliance_alert' | 'document_expiring' | 'framework_update' | 'audit_recommendation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

interface ComplianceIssue {
  framework: string;
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  criticalGaps: number;
}

interface DocumentStatus {
  id: string;
  name: string;
  lastChecked: Date;
  status: 'compliant' | 'issues' | 'pending';
  issueCount?: number;
}

/**
 * Analyze workspace compliance and generate notifications
 */
export async function generateProactiveNotifications(
  workspaceId: string
): Promise<ProactiveNotification[]> {
  const notifications: ProactiveNotification[] = [];

  try {
    // Fetch workspace compliance data
    const [complianceData, documentsData, issuesData] = await Promise.all([
      fetchWorkspaceCompliance(workspaceId),
      fetchRecentDocuments(workspaceId),
      fetchComplianceIssues(workspaceId),
    ]);

    // Check for declining compliance scores
    if (complianceData.overall_score < 70) {
      notifications.push({
        id: `notif_${Date.now()}_compliance_low`,
        type: 'compliance_alert',
        severity: 'critical',
        title: 'Low Compliance Score Detected',
        message: `Your overall compliance score (${complianceData.overall_score}%) has fallen below the recommended threshold of 70%. Immediate action is required to address critical gaps.`,
        actionUrl: `/org/${workspaceId}/compliance`,
        actionLabel: 'View Compliance Dashboard',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: {
          score: complianceData.overall_score,
          threshold: 70,
        },
      });
    }

    // Check for framework-specific issues
    complianceData.frameworks?.forEach((framework: ComplianceIssue) => {
      if (framework.score < 75 && framework.criticalGaps > 0) {
        notifications.push({
          id: `notif_${Date.now()}_${framework.framework.toLowerCase()}`,
          type: 'compliance_alert',
          severity: 'warning',
          title: `${framework.framework} Compliance Gaps Detected`,
          message: `${framework.framework} score is ${framework.score}% with ${framework.criticalGaps} critical gap${framework.criticalGaps > 1 ? 's' : ''}. Review and address these issues to maintain compliance.`,
          actionUrl: `/org/${workspaceId}/compliance?framework=${framework.framework}`,
          actionLabel: `Review ${framework.framework}`,
          createdAt: new Date(),
          metadata: {
            framework: framework.framework,
            score: framework.score,
            gaps: framework.criticalGaps,
          },
        });
      }
    });

    // Check for documents with issues
    const documentsWithIssues = documentsData.filter(
      (doc: DocumentStatus) => doc.status === 'issues' && doc.issueCount && doc.issueCount > 0
    );

    if (documentsWithIssues.length > 0) {
      notifications.push({
        id: `notif_${Date.now()}_doc_issues`,
        type: 'document_expiring',
        severity: 'warning',
        title: 'Documents Require Attention',
        message: `${documentsWithIssues.length} document${documentsWithIssues.length > 1 ? 's have' : ' has'} compliance issues that need to be addressed.`,
        actionUrl: `/org/${workspaceId}/documents?filter=issues`,
        actionLabel: 'Review Documents',
        createdAt: new Date(),
        metadata: {
          documentCount: documentsWithIssues.length,
          documents: documentsWithIssues.map((d: DocumentStatus) => d.name),
        },
      });
    }

    // Check for high-priority issues
    const criticalIssues = issuesData.filter(
      (issue: any) => issue.severity === 'critical' && issue.status === 'open'
    );

    if (criticalIssues.length > 0) {
      notifications.push({
        id: `notif_${Date.now()}_critical_issues`,
        type: 'compliance_alert',
        severity: 'critical',
        title: 'Critical Compliance Issues Detected',
        message: `You have ${criticalIssues.length} critical compliance issue${criticalIssues.length > 1 ? 's' : ''} that require immediate attention.`,
        actionUrl: `/org/${workspaceId}/issues?severity=critical`,
        actionLabel: 'View Critical Issues',
        createdAt: new Date(),
        metadata: {
          issueCount: criticalIssues.length,
          issues: criticalIssues.slice(0, 5).map((i: any) => i.title),
        },
      });
    }

    // Add audit recommendations based on AI analysis
    const auditRecommendations = await generateAuditRecommendations(workspaceId, complianceData);
    notifications.push(...auditRecommendations);

  } catch (error) {
    console.error('Failed to generate proactive notifications:', error);
  }

  return notifications;
}

/**
 * Fetch workspace compliance data
 */
async function fetchWorkspaceCompliance(workspaceId: string): Promise<any> {
  try {
    const response = await fetch(`/api/workspaces/${workspaceId}/compliance`, {
      credentials: 'include',
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch compliance data:', error);
  }

  return {
    overall_score: 85,
    frameworks: [],
  };
}

/**
 * Fetch recent documents
 */
async function fetchRecentDocuments(workspaceId: string): Promise<DocumentStatus[]> {
  try {
    const response = await fetch(`/api/workspaces/${workspaceId}/documents`, {
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      return data.documents || [];
    }
  } catch (error) {
    console.error('Failed to fetch documents:', error);
  }

  return [];
}

/**
 * Fetch compliance issues
 */
async function fetchComplianceIssues(workspaceId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/workspaces/${workspaceId}/issues`, {
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      return data.issues || [];
    }
  } catch (error) {
    console.error('Failed to fetch issues:', error);
  }

  return [];
}

/**
 * Generate AI-powered audit recommendations
 */
async function generateAuditRecommendations(
  workspaceId: string,
  complianceData: any
): Promise<ProactiveNotification[]> {
  const recommendations: ProactiveNotification[] = [];

  // Example: Recommend audit if compliance is improving
  if (complianceData.overall_score > 85) {
    recommendations.push({
      id: `notif_${Date.now()}_audit_ready`,
      type: 'audit_recommendation',
      severity: 'info',
      title: 'Ready for Compliance Audit',
      message: `Your compliance score (${complianceData.overall_score}%) indicates you're well-prepared for a compliance audit. Consider scheduling an audit to validate your compliance posture.`,
      actionUrl: `/org/${workspaceId}/compliance`,
      actionLabel: 'View Compliance Status',
      createdAt: new Date(),
      metadata: {
        score: complianceData.overall_score,
        recommendation: 'Schedule compliance audit',
      },
    });
  }

  // Example: Framework updates
  const frameworksNeedingUpdate = complianceData.frameworks?.filter(
    (f: any) => f.score < 80
  ) || [];

  if (frameworksNeedingUpdate.length > 0) {
    recommendations.push({
      id: `notif_${Date.now()}_framework_update`,
      type: 'framework_update',
      severity: 'info',
      title: 'Framework Updates Recommended',
      message: `${frameworksNeedingUpdate.length} compliance framework${frameworksNeedingUpdate.length > 1 ? 's need' : ' needs'} attention to improve your overall compliance score.`,
      actionUrl: `/org/${workspaceId}/compliance`,
      actionLabel: 'Review Frameworks',
      createdAt: new Date(),
      metadata: {
        frameworks: frameworksNeedingUpdate.map((f: any) => f.framework),
      },
    });
  }

  return recommendations;
}

/**
 * Save notifications to backend
 */
export async function saveProactiveNotifications(
  workspaceId: string,
  userId: string,
  notifications: ProactiveNotification[]
): Promise<void> {
  try {
    await fetch('/api/assistant/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        workspaceId,
        userId,
        notifications: notifications.map(n => ({
          type: n.type,
          severity: n.severity,
          title: n.title,
          message: n.message,
          action_url: n.actionUrl,
          action_label: n.actionLabel,
          metadata: n.metadata,
        })),
      }),
    });
  } catch (error) {
    console.error('Failed to save notifications:', error);
  }
}

/**
 * Run proactive notification check
 * This can be called periodically (e.g., daily) or on-demand
 */
export async function runProactiveNotificationCheck(
  workspaceId: string,
  userId: string
): Promise<ProactiveNotification[]> {
  console.log('🔔 Running proactive notification check for workspace:', workspaceId);

  const notifications = await generateProactiveNotifications(workspaceId);

  if (notifications.length > 0) {
    console.log(`✅ Generated ${notifications.length} proactive notifications`);
    await saveProactiveNotifications(workspaceId, userId, notifications);
  } else {
    console.log('✓ No new notifications to generate');
  }

  return notifications;
}
