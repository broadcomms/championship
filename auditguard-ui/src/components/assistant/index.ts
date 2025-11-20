/**
 * AI Compliance Assistant - Component Exports
 * Phase 1: Core Structure Implementation
 */

export { AIAssistantPage } from './AIAssistantPage';
export { AIChatWidget } from './AIChatWidget';
export { ConversationSidebar } from './ConversationSidebar';
export { ChatInterface } from './ChatInterface';
export { DetailsSidebar } from './DetailsSidebar';

// Re-export types
export type {
  Message,
  Action,
  Conversation,
  ConversationGroup,
  SessionDetails,
  ComplianceScore,
  SuggestedAction,
  RelatedDocument,
  FilterOptions,
  VoiceSettings,
  Notification,
  NotificationAction,
  AnalyticsData,
} from '@/types/assistant';
