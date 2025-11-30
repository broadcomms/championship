import { NextRequest, NextResponse } from 'next/server';
import {
  AnalyticsDashboard,
  UsageTrend,
  TimeRangeFilter,
  formatMetricChange,
} from '@/types/analytics';

interface AnalyticsRequest {
  workspaceId: string;
  timeRange?: TimeRangeFilter;
  includeDetails?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyticsRequest;
    const {
      workspaceId,
      timeRange,
      includeDetails = true,
    } = body;

    const resolvedTimeRange: TimeRangeFilter = timeRange || { type: 'week' };
    const seedSource = (workspaceId || 'default-workspace').split('');
    const workspaceSeed = seedSource.reduce((sum, char) => sum + char.charCodeAt(0), 0) % 20;
    const conversationsValue = 230 + workspaceSeed;
    const previousConversations = conversationsValue - 18;
    const responseTimeValue = 1 + (workspaceSeed % 5) * 0.05;
    const previousResponseTime = responseTimeValue + 0.3;
    const satisfactionValue = 4.5 + (workspaceSeed % 5) * 0.05;
    const previousSatisfaction = satisfactionValue - 0.2;
    const activeUsersValue = 70 + (workspaceSeed % 25);
    const previousActiveUsers = activeUsersValue - 9;

    // Mock analytics data
    const analytics: AnalyticsDashboard = {
      metrics: {
        conversations: {
          id: 'conversations',
          type: 'conversations',
          label: 'Conversations',
          value: conversationsValue,
          previousValue: previousConversations,
          ...formatMetricChange(conversationsValue, previousConversations),
          trend: 'up',
        },
        responseTime: {
          id: 'response_time',
          type: 'response_time',
          label: 'Avg Response Time',
          value: Number(responseTimeValue.toFixed(2)),
          previousValue: Number(previousResponseTime.toFixed(2)),
          ...formatMetricChange(responseTimeValue, previousResponseTime),
          trend: 'down',
          unit: 's',
        },
        satisfaction: {
          id: 'satisfaction',
          type: 'satisfaction',
          label: 'Satisfaction',
          value: Number(satisfactionValue.toFixed(1)),
          previousValue: Number(previousSatisfaction.toFixed(1)),
          ...formatMetricChange(satisfactionValue, previousSatisfaction),
          trend: 'up',
          unit: '/5',
        },
        activeUsers: {
          id: 'active_users',
          type: 'usage',
          label: 'Active Users',
          value: activeUsersValue,
          previousValue: previousActiveUsers,
          ...formatMetricChange(activeUsersValue, previousActiveUsers),
          trend: 'up',
        },
      },
      usageTrends: generateUsageTrends(resolvedTimeRange.type),
      toolUsage: [
        { toolName: 'Compliance Check', count: 145, percentage: 35.3 },
        { toolName: 'Document Search', count: 98, percentage: 23.9 },
        { toolName: 'Knowledge Query', count: 76, percentage: 18.5 },
        { toolName: 'Issue Analysis', count: 52, percentage: 12.7 },
        { toolName: 'Report Generation', count: 41, percentage: 10.0 },
      ],
      responseQuality: {
        helpful: 92,
        accurate: 88,
        complete: 85,
        actionable: 90,
        avgScore: 88.8,
      },
      userEngagement: {
        avgSessionDuration: 900, // 15 minutes
        messagesPerSession: 8.2,
        returnRate: 73,
        voiceUsageRate: 34,
        activeUsers: 87,
        totalSessions: 356,
      },
      costAnalysis: {
        totalTokens: 1245780,
        apiCost: 24.5,
        costPerSession: 0.098,
        costPerMessage: 0.012,
        estimatedMonthlyCost: 735.0,
        roi: 320,
      },
      topQuestions: [
        {
          id: 'q1',
          question: 'What are the GDPR data breach notification requirements?',
          count: 45,
          category: 'compliance',
          framework: 'GDPR',
          lastAsked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'q2',
          question: 'How do I prepare for a SOC2 audit?',
          count: 38,
          category: 'compliance',
          framework: 'SOC2',
          lastAsked: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'q3',
          question: 'What should I do in case of a data breach?',
          count: 31,
          category: 'support',
          lastAsked: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'q4',
          question: 'How to update our privacy policy for CCPA compliance?',
          count: 28,
          category: 'compliance',
          framework: 'CCPA',
          lastAsked: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'q5',
          question: 'What are the ISO 27001 certification steps?',
          count: 24,
          category: 'training',
          framework: 'ISO27001',
          lastAsked: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      complianceIntelligence: [
        {
          framework: 'GDPR',
          issuesDetected: 12,
          issuesResolved: 10,
          resolutionRate: 83,
          avgResolutionTime: 4.5,
          criticalIssues: 2,
          warningIssues: 5,
          infoIssues: 5,
        },
        {
          framework: 'SOC2',
          issuesDetected: 8,
          issuesResolved: 6,
          resolutionRate: 75,
          avgResolutionTime: 6.2,
          criticalIssues: 1,
          warningIssues: 4,
          infoIssues: 3,
        },
        {
          framework: 'ISO27001',
          issuesDetected: 5,
          issuesResolved: 5,
          resolutionRate: 100,
          avgResolutionTime: 3.8,
          criticalIssues: 0,
          warningIssues: 2,
          infoIssues: 3,
        },
        {
          framework: 'HIPAA',
          issuesDetected: 3,
          issuesResolved: 2,
          resolutionRate: 67,
          avgResolutionTime: 5.5,
          criticalIssues: 1,
          warningIssues: 1,
          infoIssues: 1,
        },
        {
          framework: 'PCI',
          issuesDetected: 7,
          issuesResolved: 5,
          resolutionRate: 71,
          avgResolutionTime: 4.9,
          criticalIssues: 2,
          warningIssues: 3,
          infoIssues: 2,
        },
      ],
    };

    const responsePayload: AnalyticsDashboard = {
      ...analytics,
      topQuestions: includeDetails ? analytics.topQuestions : analytics.topQuestions.slice(0, 2),
      complianceIntelligence: includeDetails
        ? analytics.complianceIntelligence
        : analytics.complianceIntelligence.slice(0, 2),
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

function generateUsageTrends(timeRange: TimeRangeFilter['type']): UsageTrend[] {
  const days = timeRange === 'today' ? 1 : timeRange === 'week' ? 7 : 30;
  const trends: UsageTrend[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    trends.push({
      date: dateStr,
      timestamp: date.getTime(),
      messages: Math.floor(Math.random() * 100) + 50,
      sessions: Math.floor(Math.random() * 30) + 10,
      voiceMessages: Math.floor(Math.random() * 20) + 5,
      actions: Math.floor(Math.random() * 40) + 15,
      users: Math.floor(Math.random() * 15) + 5,
    });
  }

  return trends;
}
