/**
 * AI Compliance Assistant - Component Exports
 * Phase 1, 2 & 3: Core Structure + Enhanced Chat Interface + Voice Integration
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

// Phase 3 Components - Voice Integration
export { VoiceChat } from './VoiceChat';
export { VoiceVisualizer, WaveformVisualizer, AudioLevelMeter } from './VoiceVisualizer';
export { TranscriptionDisplay, LiveTranscription } from './TranscriptionDisplay';
export { VoiceSettingsPanel, VoiceControls } from './VoiceSettingsPanel';

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

