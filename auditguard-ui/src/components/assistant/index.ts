/**
 * AI Compliance Assistant - Component Exports
 * Phase 1 & Phase 2: Core Structure + Enhanced Chat Interface
 */

export { AIAssistantPage } from './AIAssistantPage';
export { AIChatWidget } from './AIChatWidget';
export { ConversationSidebar } from './ConversationSidebar';
export { ChatInterface } from './ChatInterface';
export { DetailsSidebar } from './DetailsSidebar';

// Phase 2 Components
export { Message } from './Message';
export { EnhancedInput } from './EnhancedInput';
export { SuggestionChips, generateSuggestions } from './SuggestionChips';
export { StreamingMessage, StreamingIndicator, useStreamingMessage } from './StreamingMessage';

// Re-export types
export type {
  Message as MessageType,
  MessageSource,
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

