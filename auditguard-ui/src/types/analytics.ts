/**
 * Analytics Types and Interfaces
 * Comprehensive type definitions for analytics dashboard and metrics
 */

// Metric Types
export type MetricType = 'conversations' | 'response_time' | 'satisfaction' | 'usage' | 'compliance';
export type MetricTrend = 'up' | 'down' | 'stable';
export type TimeRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'composed';

// Core Metric Interface
export interface Metric {
  id: string;
  type: MetricType;
  label: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercentage?: number;
  trend: MetricTrend;
  unit?: string;
  icon?: string;
  color?: string;
}

// Usage Trends
export interface UsageTrend {
  date: string;
  timestamp: number;
  messages: number;
  sessions: number;
  voiceMessages: number;
  actions: number;
  users: number;
}

// Tool Usage
export interface ToolUsage {
  toolName: string;
  count: number;
  percentage: number;
  color?: string;
}

// Response Quality Metrics
export interface ResponseQuality {
  helpful: number;
  accurate: number;
  complete: number;
  actionable: number;
  avgScore: number;
}

// User Engagement
export interface UserEngagement {
  avgSessionDuration: number; // in seconds
  messagesPerSession: number;
  returnRate: number; // percentage
  voiceUsageRate: number; // percentage
  activeUsers: number;
  totalSessions: number;
}

// Cost Analysis
export interface CostAnalysis {
  totalTokens: number;
  apiCost: number;
  costPerSession: number;
  costPerMessage: number;
  estimatedMonthlyCost: number;
  roi: number; // percentage
}

// Top Questions
export interface TopQuestion {
  id: string;
  question: string;
  count: number;
  category: string;
  framework?: string;
  lastAsked: string;
}

// Compliance Intelligence
export interface ComplianceIntelligence {
  framework: string;
  issuesDetected: number;
  issuesResolved: number;
  resolutionRate: number;
  avgResolutionTime: number; // in hours
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  color?: string;
}

// Analytics Dashboard State
export interface AnalyticsDashboard {
  metrics: {
    conversations: Metric;
    responseTime: Metric;
    satisfaction: Metric;
    activeUsers: Metric;
  };
  usageTrends: UsageTrend[];
  toolUsage: ToolUsage[];
  responseQuality: ResponseQuality;
  userEngagement: UserEngagement;
  costAnalysis: CostAnalysis;
  topQuestions: TopQuestion[];
  complianceIntelligence: ComplianceIntelligence[];
}

// Time Range Filter
export interface TimeRangeFilter {
  type: TimeRange;
  startDate?: Date;
  endDate?: Date;
}

// Analytics Query
export interface AnalyticsQuery {
  workspaceId: string;
  timeRange: TimeRangeFilter;
  metrics?: MetricType[];
  includeDetails?: boolean;
}

// Chart Data Point
export interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

// Chart Configuration
export interface ChartConfig {
  type: ChartType;
  data: ChartDataPoint[];
  xAxisKey: string;
  yAxisKey?: string;
  dataKeys: string[];
  colors?: string[];
  legend?: boolean;
  grid?: boolean;
  tooltip?: boolean;
}

// Export Options
export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  includeCharts?: boolean;
  timeRange: TimeRangeFilter;
  metrics?: MetricType[];
}

// Analytics Event
export interface AnalyticsEvent {
  id: string;
  type: 'conversation_started' | 'message_sent' | 'voice_used' | 'action_taken' | 'issue_detected' | 'issue_resolved';
  timestamp: number;
  workspaceId: string;
  userId?: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

// Constants
export const METRIC_COLORS = {
  conversations: '#2563EB',
  response_time: '#22C55E',
  satisfaction: '#EAB308',
  usage: '#A855F7',
  compliance: '#EF4444',
} as const;

export const FRAMEWORK_COLORS = {
  GDPR: '#2563EB',
  SOC2: '#22C55E',
  ISO27001: '#EAB308',
  HIPAA: '#EF4444',
  PCI: '#A855F7',
  NIST: '#F97316',
  CCPA: '#06B6D4',
} as const;

export const TOOL_COLORS = [
  '#2563EB',
  '#22C55E',
  '#EAB308',
  '#EF4444',
  '#A855F7',
  '#F97316',
  '#06B6D4',
] as const;

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  custom: 'Custom Range',
};

// Utility function to calculate trend
export function calculateTrend(current: number, previous: number): MetricTrend {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'stable';
}

// Utility function to format metric change
export function formatMetricChange(current: number, previous: number): {
  change: number;
  changePercentage: number;
  trend: MetricTrend;
} {
  const change = current - previous;
  const changePercentage = previous > 0 ? ((change / previous) * 100) : 0;
  const trend = calculateTrend(current, previous);
  
  return {
    change,
    changePercentage: Math.round(changePercentage * 10) / 10,
    trend,
  };
}
