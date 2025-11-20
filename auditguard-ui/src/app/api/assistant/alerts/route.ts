import { NextRequest, NextResponse } from 'next/server';
import { ProactiveAlert } from '@/types/notification';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const since = parseInt(searchParams.get('since') || '0');

    // Mock proactive alerts
    const alerts: ProactiveAlert[] = [];

    // Simulate some alerts based on time
    const now = Date.now();
    
    // Only show new alerts if enough time has passed (5 minutes for demo)
    if (now - since > 5 * 60 * 1000) {
      // Randomly decide which alerts to show
      const random = Math.random();

      if (random > 0.7) {
        // 30% chance - Compliance issue alert
        alerts.push({
          id: `alert_${now}_compliance`,
          type: 'compliance_issue',
          severity: 'critical',
          title: 'GDPR Article 7 Violation Detected',
          description: 'Consent form does not meet GDPR Article 7 requirements. Missing clear affirmative action and separate consent for different processing purposes.',
          recommendation: 'Update consent form to include: 1) Clear affirmative action (checkbox), 2) Separate consent options for each purpose, 3) Easy withdrawal mechanism',
          affectedFrameworks: ['GDPR'],
          affectedDocuments: ['doc_consent_form'],
          detectedAt: now,
          actions: [
            {
              id: 'view_issue',
              label: 'View Details',
              action: 'view_compliance_issue',
              variant: 'primary',
            },
            {
              id: 'fix_now',
              label: 'Fix Now',
              action: 'fix_compliance_issue',
              variant: 'primary',
            },
            {
              id: 'dismiss',
              label: 'Dismiss',
              action: 'dismiss',
              variant: 'secondary',
            },
          ],
          metadata: {
            framework: 'GDPR',
            article: 'Article 7',
            requirement: 'Conditions for consent',
            violationType: 'Missing affirmative action',
            severity: 'critical',
            documentId: 'doc_consent_form',
            documentName: 'Consent Form v2.3',
            location: 'Section 2.1',
          },
        });
      } else if (random > 0.5) {
        // 20% chance - AI insight alert
        alerts.push({
          id: `alert_${now}_insight`,
          type: 'ai_insight',
          severity: 'info',
          title: 'AI Insight: Privacy Policy Optimization',
          description: 'Based on recent regulatory changes and your document analysis patterns, your privacy policy section 4.2 (Data Retention) should be updated to align with new GDPR guidelines.',
          recommendation: 'Review and update Data Retention section to specify: 1) Exact retention periods for each data category, 2) Criteria for determining retention periods, 3) Automated deletion procedures',
          detectedAt: now,
          actions: [
            {
              id: 'review',
              label: 'Review Suggestion',
              action: 'review_ai_insight',
              variant: 'primary',
            },
            {
              id: 'remind',
              label: 'Remind in 1 Day',
              action: 'remind_later',
              variant: 'secondary',
            },
          ],
          metadata: {
            insightType: 'recommendation',
            confidence: 0.87,
            description: 'Privacy policy optimization based on regulatory updates',
            reasoning: 'GDPR guidelines updated in January 2025 require more specific retention period documentation',
            suggestedAction: 'Update Data Retention section with specific timelines',
            potentialImpact: 'Improved compliance score by 8-12%',
            relatedConversations: ['conv_123', 'conv_456'],
          },
        });
      } else if (random > 0.3) {
        // 20% chance - Deadline alert
        alerts.push({
          id: `alert_${now}_deadline`,
          type: 'deadline',
          severity: 'warning',
          title: 'SOC2 Audit Deadline Approaching',
          description: 'Your SOC2 Type II audit is scheduled in 14 days. You have completed 78% of the required checklist items. 12 items remain pending.',
          recommendation: 'Focus on completing high-priority items: Access Control Documentation, Incident Response Procedures, and Vendor Risk Assessment',
          affectedFrameworks: ['SOC2'],
          detectedAt: now,
          resolveBy: now + 14 * 24 * 60 * 60 * 1000,
          actions: [
            {
              id: 'view_checklist',
              label: 'View Checklist',
              action: 'view_audit_checklist',
              variant: 'primary',
            },
            {
              id: 'schedule',
              label: 'Schedule Review',
              action: 'schedule_review',
              variant: 'secondary',
            },
          ],
          metadata: {
            auditType: 'SOC2 Type II',
            daysRemaining: 14,
            completionPercentage: 78,
            pendingItems: 12,
            highPriorityItems: ['Access Control', 'Incident Response', 'Vendor Risk'],
          },
        });
      }
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}
