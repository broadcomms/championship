'use client';

import React, { useState, useEffect } from 'react';
import { ConversationSidebar } from './ConversationSidebar';
import { ChatInterface } from './ChatInterface';
import { DetailsSidebar } from './DetailsSidebar';
import AnalyticsDashboard from './AnalyticsDashboard';
import NotificationSettingsPanel from './NotificationSettingsPanel';
import { MessageSquare, BarChart3, Settings } from 'lucide-react';
import type { Conversation, Message, FilterOptions } from '@/types/assistant';
import { useKeyboardShortcuts } from '@/lib/keyboard';
import { announceToScreenReader } from '@/lib/focus';
import { useDeviceType, useViewportHeight } from '@/lib/mobile';
import { SkeletonFullPage } from '@/components/common/Skeleton';
import { TRANSITIONS, PAGE_TRANSITION } from '@/lib/animations';

interface AIAssistantPageProps {
  workspaceId: string;
  userId: string;
  sessionId?: string;
}

type ViewMode = 'chat' | 'analytics' | 'settings';

export function AIAssistantPage({ workspaceId, userId, sessionId: initialSessionId }: AIAssistantPageProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [hasLoadedInitialConversation, setHasLoadedInitialConversation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
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
      const response = await fetch(`/api/assistant/conversations/${conversationId}/messages`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        setSessionId(data.sessionId);
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
    setSessionId(undefined);
    setMessages([]);
  };

  const handleMessageSent = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const handleSessionCreated = (newSessionId: string) => {
    setSessionId(newSessionId);
  };

  // Load the most recent conversation on mount if no conversation is selected
  useEffect(() => {
    if (!hasLoadedInitialConversation && !currentConversationId && !sessionId) {
      loadMostRecentConversation();
    }
  }, [hasLoadedInitialConversation, currentConversationId, sessionId]);

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

  // Show loading skeleton
  if (isLoading && !hasLoadedInitialConversation) {
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
              />
            </div>

            {/* Center Panel - Chat Interface */}
            <div className="flex-1 flex flex-col min-w-0">
              <ChatInterface
                workspaceId={workspaceId}
                sessionId={sessionId}
                messages={messages}
                onMessageSent={handleMessageSent}
                onSessionCreated={handleSessionCreated}
              />
            </div>

            {/* Right Panel - Details & Actions */}
            <div className="w-[320px] bg-white border-l border-gray-200 flex-shrink-0 hidden lg:block">
              <DetailsSidebar
                sessionId={sessionId}
                conversationId={currentConversationId}
                workspaceId={workspaceId}
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
