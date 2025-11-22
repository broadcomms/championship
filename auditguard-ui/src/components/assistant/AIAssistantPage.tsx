'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ConversationSidebar } from './ConversationSidebar';
import { ChatInterface } from './ChatInterface';
import { DetailsSidebar } from './DetailsSidebar';
import AnalyticsDashboard from './AnalyticsDashboard';
import NotificationSettingsPanel from './NotificationSettingsPanel';
import { MessageSquare, BarChart3, Settings, Mic } from 'lucide-react';
import type { Conversation, Message, FilterOptions } from '@/types/assistant';
import { useKeyboardShortcuts } from '@/lib/keyboard';
import { announceToScreenReader } from '@/lib/focus';
import { useDeviceType, useViewportHeight } from '@/lib/mobile';
import { SkeletonFullPage } from '@/components/common/Skeleton';
import { TRANSITIONS, PAGE_TRANSITION } from '@/lib/animations';
import { useChatWidget } from '@/contexts/ChatWidgetContext';

/**
 * ARCHITECTURE NOTES:
 *
 * This component is the SINGLE SOURCE OF TRUTH for:
 * 1. localStorage session persistence
 * 2. Session ID in context
 * 3. Conversation state
 *
 * The ChatInterface and AIChatWidget are CONSUMERS of session state,
 * not managers of it. They read sessionId from context and report
 * new sessions back to this component.
 */

interface AIAssistantPageProps {
  workspaceId: string;
  userId: string;
  sessionId?: string;
}

type ViewMode = 'chat' | 'analytics' | 'settings';

// localStorage key helper
function getStorageKey(workspaceId: string): string {
  return `ai_session_${workspaceId}`;
}

export function AIAssistantPage({ workspaceId, userId, sessionId: initialSessionId }: AIAssistantPageProps) {
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversationRefreshTrigger, setConversationRefreshTrigger] = useState(0);

  // Chat widget context - this is the SINGLE source of truth for sessionId
  const chatWidget = useChatWidget();

  // Initialize session on mount - SINGLE PLACE for localStorage reads
  useEffect(() => {
    if (isInitialized) return;

    const initializeSession = async () => {
      setIsLoading(true);

      try {
        // 1. Check localStorage for existing session
        const storageKey = getStorageKey(workspaceId);
        const storedSessionId = localStorage.getItem(storageKey);
        console.log('🔍 AIAssistantPage: Initializing session - stored:', storedSessionId);

        if (storedSessionId) {
          // 2. Set sessionId in context SYNCHRONOUSLY via the new pattern
          console.log('📍 AIAssistantPage: Setting sessionId in context:', storedSessionId);
          chatWidget.setSessionId(storedSessionId);
          setCurrentConversationId(storedSessionId);

          // 3. Load conversation history
          console.log('📚 AIAssistantPage: Loading session history...');
          await loadSessionHistory(storedSessionId);
          console.log('✅ AIAssistantPage: Session initialization complete');
        } else {
          // No stored session - start fresh
          console.log('🆕 AIAssistantPage: No stored session, starting fresh');
          chatWidget.setSessionId(null);
          setMessages([]);
        }
      } catch (error) {
        console.error('❌ AIAssistantPage: Error initializing session:', error);
        chatWidget.setSessionId(null);
        setMessages([]);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initializeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, isInitialized]); // Intentionally exclude chatWidget to prevent infinite loop

  // Load conversation history for a session
  const loadSessionHistory = useCallback(async (sessionIdToLoad: string) => {
    try {
      console.log('📜 Loading session history for:', sessionIdToLoad);

      const response = await fetch(
        `/api/assistant/chat?workspaceId=${workspaceId}&sessionId=${sessionIdToLoad}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded messages:', data.messages?.length || 0);

        if (data.messages && Array.isArray(data.messages)) {
          const loadedMessages: Message[] = data.messages.map((msg: any, index: number) => ({
            id: msg.id || `msg_${Date.now()}_${index}`,
            role: msg.role,
            content: msg.content,
            timestamp: msg.created_at ? new Date(msg.created_at) : new Date(msg.timestamp || Date.now()),
            actions: msg.actions || [],
            sources: msg.sources || [],
          }));

          setMessages(loadedMessages);
          announceToScreenReader(`Loaded ${loadedMessages.length} messages from conversation history`);
        }
      } else {
        console.warn('Failed to load session history:', response.status);
        // Session might be invalid - clear it
        const storageKey = getStorageKey(workspaceId);
        localStorage.removeItem(storageKey);
        chatWidget.setSessionId(null);
      }
    } catch (error) {
      console.error('Error loading session history:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]); // Intentionally exclude chatWidget

  // Mobile and accessibility hooks
  const deviceType = useDeviceType();
  useViewportHeight();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: '1',
      ctrl: true,
      description: 'Switch to Chat',
      handler: () => {
        setViewMode('chat');
        announceToScreenReader('Switched to Chat view');
      },
    },
    {
      key: '2',
      ctrl: true,
      description: 'Switch to Analytics',
      handler: () => {
        setViewMode('analytics');
        announceToScreenReader('Switched to Analytics view');
      },
    },
    {
      key: '3',
      ctrl: true,
      description: 'Switch to Settings',
      handler: () => {
        setViewMode('settings');
        announceToScreenReader('Switched to Settings view');
      },
    },
    {
      key: 'n',
      ctrl: true,
      description: 'New Conversation',
      handler: () => {
        handleNewConversation();
        announceToScreenReader('Started new conversation');
      },
    },
  ]);

  // Handle selecting an existing conversation from sidebar
  const handleConversationSelect = useCallback(async (conversationId: string) => {
    console.log('📂 Selecting conversation:', conversationId);

    setCurrentConversationId(conversationId);
    setViewMode('chat');

    try {
      setIsLoading(true);
      const response = await fetch(`/api/assistant/conversations/${conversationId}/messages?workspaceId=${workspaceId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);

        // Update sessionId in context and localStorage
        if (data.sessionId) {
          chatWidget.setSessionId(data.sessionId);
          const storageKey = getStorageKey(workspaceId);
          localStorage.setItem(storageKey, data.sessionId);
        }

        announceToScreenReader(`Loaded conversation with ${data.messages?.length || 0} messages`);
      }
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
      announceToScreenReader('Failed to load conversation', 'assertive');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]); // Intentionally exclude chatWidget

  // Handle creating a new conversation - CRITICAL: This is the ONLY place that clears session
  const handleNewConversation = useCallback(() => {
    console.log('🆕 Creating new conversation');

    // 1. Clear localStorage FIRST
    const storageKey = getStorageKey(workspaceId);
    localStorage.removeItem(storageKey);

    // 2. Clear context sessionId (this notifies all listeners synchronously)
    chatWidget.setSessionId(null);

    // 3. Clear local state
    setCurrentConversationId(undefined);
    setMessages([]);

    announceToScreenReader('Started new conversation');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]); // Intentionally exclude chatWidget

  // Handle when a message is sent (for local state tracking)
  const handleMessageSent = useCallback((message: Message) => {
    setMessages(prev => {
      // Avoid duplicates
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;
      return [...prev, message];
    });
  }, []);

  // Handle when a new session is created by ChatInterface - SINGLE PLACE for localStorage writes
  const handleSessionCreated = useCallback((newSessionId: string) => {
    console.log('✨ New session created:', newSessionId);

    // 1. Update context (synchronously via the new pattern)
    chatWidget.setSessionId(newSessionId);

    // 2. Update local state
    setCurrentConversationId(newSessionId);

    // 3. Save to localStorage - SINGLE PLACE
    const storageKey = getStorageKey(workspaceId);
    localStorage.setItem(storageKey, newSessionId);

    // 4. Trigger conversation list refresh after a delay
    setTimeout(() => {
      setConversationRefreshTrigger(prev => prev + 1);
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]); // Intentionally exclude chatWidget

  const handleNotificationAction = (notificationId: string, action: string) => {
    console.log('Notification action:', action, notificationId);
    if (action === 'view_issues' || action === 'view_checklist') {
      setViewMode('chat');
    } else if (action === 'view_report') {
      setViewMode('analytics');
    }
  };

  const handleVoiceModeClick = () => {
    chatWidget.openVoiceMode();
    announceToScreenReader('Voice mode activated in chat widget');
  };

  // Show loading skeleton while initializing
  if (isLoading && !isInitialized) {
    return <SkeletonFullPage />;
  }

  // Get current sessionId from context for passing to children
  const currentSessionId = chatWidget.sessionId;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header with Navigation and Notifications */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">AI Compliance Assistant</h1>

            {/* View Mode Tabs */}
            <div className="flex items-center gap-1 ml-8" role="tablist" aria-label="View modes">
              <button
                onClick={() => setViewMode('chat')}
                role="tab"
                aria-selected={viewMode === 'chat'}
                aria-controls="chat-panel"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${TRANSITIONS.all} ${
                  viewMode === 'chat'
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button
                onClick={() => setViewMode('analytics')}
                role="tab"
                aria-selected={viewMode === 'analytics'}
                aria-controls="analytics-panel"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${TRANSITIONS.all} ${
                  viewMode === 'analytics'
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
              <button
                onClick={() => setViewMode('settings')}
                role="tab"
                aria-selected={viewMode === 'settings'}
                aria-controls="settings-panel"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${TRANSITIONS.all} ${
                  viewMode === 'settings'
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>

          {/* Voice Mode Button */}
          <button
            onClick={handleVoiceModeClick}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg"
            title="Enable voice mode in chat widget"
          >
            <Mic className="w-4 h-4" />
            <span className="font-medium">Voice Mode</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'chat' && (
          <div id="chat-panel" role="tabpanel" className="flex w-full animate-fadeIn">
            {/* Left Panel - Conversation Management */}
            <div className="w-[280px] bg-white border-r border-gray-200 flex-shrink-0 hidden md:block">
              <ConversationSidebar
                workspaceId={workspaceId}
                currentId={currentConversationId}
                onSelect={handleConversationSelect}
                onNewConversation={handleNewConversation}
                refreshTrigger={conversationRefreshTrigger}
              />
            </div>

            {/* Center Panel - Chat Interface */}
            <div className="flex-1 flex flex-col min-w-0">
              <ChatInterface
                workspaceId={workspaceId}
                messages={messages}
                onMessageSent={handleMessageSent}
                onSessionCreated={handleSessionCreated}
              />
            </div>

            {/* Right Panel - Details & Actions */}
            <div className="w-[320px] bg-white border-l border-gray-200 flex-shrink-0 hidden lg:block">
              <DetailsSidebar
                sessionId={currentSessionId ?? undefined}
                conversationId={currentConversationId}
                workspaceId={workspaceId}
                messageCount={messages.length}
              />
            </div>
          </div>
        )}

        {viewMode === 'analytics' && (
          <div id="analytics-panel" role="tabpanel" className="flex-1 overflow-y-auto p-6 animate-fadeIn">
            <AnalyticsDashboard workspaceId={workspaceId} />
          </div>
        )}

        {viewMode === 'settings' && (
          <div id="settings-panel" role="tabpanel" className="flex-1 overflow-y-auto p-6 animate-fadeIn">
            <NotificationSettingsPanel workspaceId={workspaceId} />
          </div>
        )}
      </div>
    </div>
  );
}
