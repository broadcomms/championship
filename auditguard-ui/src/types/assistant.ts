/**
 * Type definitions for AI Compliance Assistant
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: Action[];
}

export interface Action {
  type: 'navigate' | 'download' | 'check' | 'export';
  target?: string;
  label?: string;
  icon?: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageTime: Date;
  messageCount: number;
  status: 'active' | 'complete' | 'in-progress' | 'requires-action';
  isPinned: boolean;
  isArchived: boolean;
  tags?: string[];
  frameworks?: string[];
  completionPercentage?: number;
}

export interface ConversationGroup {
  label: string;
  conversations: Conversation[];
}

export interface SessionDetails {
  id: string;
  startedAt: Date;
  messageCount: number;
  duration: string;
  tokenCount: number;
  cost: number;
}

export interface ComplianceScore {
  overall: number;
  frameworks: {
    name: string;
    score: number;
    status: 'good' | 'warning' | 'critical';
  }[];
}

export interface SuggestedAction {
  id: string;
  type: 'view-guide' | 'check-issues' | 'view-analytics' | 'export';
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
}

export interface RelatedDocument {
  id: string;
  name: string;
  lastChecked: string;
  status: 'compliant' | 'issues' | 'pending';
  issueCount?: number;
}

export interface FilterOptions {
  dateRange?: 'today' | 'week' | 'month' | 'year' | 'custom';
  categories?: string[];
  frameworks?: string[];
  status?: string[];
  tags?: string[];
}

export interface VoiceSettings {
  voice: string;
  speed: number;
  inputMode: 'push-to-talk' | 'voice-activation' | 'always-on';
  autoPlay: boolean;
  showTranscription: boolean;
}

export interface Notification {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  type: 'primary' | 'secondary';
  onClick: () => void;
}

export interface AnalyticsData {
  conversationCount: number;
  conversationTrend: number;
  averageResponseTime: number;
  responseTimeTrend: number;
  satisfactionScore: number;
  satisfactionTrend: number;
  usageTrends: {
    date: string;
    messages: number;
    sessions: number;
    voice: number;
    actions: number;
  }[];
  topQuestions: {
    question: string;
    count: number;
  }[];
  complianceIntelligence: {
    framework: string;
    issues: number;
    resolved: number;
    resolvedPercentage: number;
  }[];
}
