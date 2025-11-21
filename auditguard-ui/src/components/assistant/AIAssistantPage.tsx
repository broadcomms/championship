'use client';

import React, { useState, useEffect } from 'react';
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

interface AIAssistantPageProps {
  workspaceId: string;
  userId: string;
  sessionId?: string;
}

type ViewMode = 'chat' | 'analytics' | 'settings';

export function AIAssistantPage({ workspaceId, userId, sessionId: initialSessionId }: AIAssistantPageProps) {
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [hasLoadedInitialConversation, setHasLoadedInitialConversation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [conversationRefreshTrigger, setConversationRefreshTrigger] = useState(0);

  // Chat widget control - using context for shared state
  const chatWidget = useChatWidget();
  const sessionId = chatWidget.sessionId;

  // Restore session from localStorage on mount
  useEffect(() => {
    if (hasRestoredSession) return;

    const restoreSession = async () => {
      const storageKey = `ai_session_${workspaceId}`;
      const storedSessionId = localStorage.getItem(storageKey);

      console.log('🔍 Restoring session from localStorage:', storedSessionId);

      if (storedSessionId) {
        chatWidget.setSessionId(storedSessionId);
        // Load conversation history for this session
        await loadSessionHistory(storedSessionId);
      }

      setHasRestoredSession(true);
    };

    restoreSession();
  }, [workspaceId, hasRestoredSession]);

  // Load conversation history for a session
  const loadSessionHistory = async (sessionIdToLoad: string) => {
    try {
      setIsLoading(true);
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
      }
    } catch (error) {
      console.error('Error loading session history:', error);
    } finally {
      setIsLoading(false);
      setHasLoadedInitialConversation(true);
    }
  };
  
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

  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setViewMode('chat');
    announceToScreenReader('Loading conversation');
    // Load conversation messages from API
    loadConversationMessages(conversationId);
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/assistant/conversations/${conversationId}/messages?workspaceId=${workspaceId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        if (data.sessionId) {
          chatWidget.setSessionId(data.sessionId);
        }
        announceToScreenReader(`Loaded conversation with ${data.messages.length} messages`);
      }
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
      announceToScreenReader('Failed to load conversation', 'assertive');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId(undefined);
    chatWidget.setSessionId(null);
    setMessages([]);
    // Clear localStorage session
    const storageKey = `ai_session_${workspaceId}`;
    localStorage.removeItem(storageKey);
  };

  const handleMessageSent = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const handleSessionCreated = (newSessionId: string) => {
    chatWidget.setSessionId(newSessionId);
    setCurrentConversationId(newSessionId);
    // Save to localStorage for persistence
    const storageKey = `ai_session_${workspaceId}`;
    localStorage.setItem(storageKey, newSessionId);
    // Trigger conversation list refresh after a short delay to allow backend to save
    setTimeout(() => {
      setConversationRefreshTrigger(prev => prev + 1);
    }, 500);
  };

  // Load the most recent conversation on mount ONLY if no session was restored
  useEffect(() => {
    // Wait until we've tried to restore from localStorage
    if (!hasRestoredSession) return;

    // Only load most recent if we don't have a session AND haven't loaded initial conversation
    if (!hasLoadedInitialConversation && !sessionId) {
      console.log('📂 No session found, loading most recent conversation...');
      loadMostRecentConversation();
    } else if (sessionId && hasLoadedInitialConversation) {
      // Session was restored, we're good
      setIsLoading(false);
    }
  }, [hasRestoredSession, hasLoadedInitialConversation, sessionId]);

  const loadMostRecentConversation = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/assistant/conversations?workspaceId=${workspaceId}&limit=1`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.conversations && data.conversations.length > 0) {
          const mostRecent = data.conversations[0];
          setCurrentConversationId(mostRecent.id);
          // Load the conversation messages
          await loadConversationMessages(mostRecent.id);
        }
      }
    } catch (error) {
      console.error('Failed to load most recent conversation:', error);
    } finally {
      setHasLoadedInitialConversation(true);
      setIsLoading(false);
    }
  };

  const handleNotificationAction = (notificationId: string, action: string) => {
    console.log('Notification action:', action, notificationId);
    // Handle different notification actions
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

  // NOTE: Messages are already in sync because:
  // 1. ChatInterface broadcasts all messages to chatWidget context
  // 2. AIChatWidget receives messages from chatWidget context
  // 3. Both use the same API endpoint with same sessionId
  // No need for additional message syncing here

  // Show loading skeleton while restoring session or loading initial data
  if (isLoading && (!hasRestoredSession || !hasLoadedInitialConversation)) {
    return <SkeletonFullPage />;
  }

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

          {/* 
            Notifications are now handled by the global NotificationBell in the navbar.
            AI notifications appear in the bell dropdown with "🤖 AI" category tab.
            This provides a unified notification experience across the entire app.
          */}
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
                sessionId={sessionId ?? undefined}
                messages={messages}
                onMessageSent={handleMessageSent}
                onSessionCreated={handleSessionCreated}
              />
            </div>

            {/* Right Panel - Details & Actions */}
            <div className="w-[320px] bg-white border-l border-gray-200 flex-shrink-0 hidden lg:block">
              <DetailsSidebar
                sessionId={sessionId ?? undefined}
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
