'use client';

import React, { useState } from 'react';
import { ConversationSidebar } from './ConversationSidebar';
import { ChatInterface } from './ChatInterface';
import { DetailsSidebar } from './DetailsSidebar';
import type { Conversation, Message, FilterOptions } from '@/types/assistant';

interface AIAssistantPageProps {
  workspaceId: string;
  userId: string;
  sessionId?: string;
}

export function AIAssistantPage({ workspaceId, userId, sessionId: initialSessionId }: AIAssistantPageProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);

  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    // Load conversation messages from API
    loadConversationMessages(conversationId);
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/assistant/conversations/${conversationId}/messages`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        setSessionId(data.sessionId);
      }
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
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

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Panel - Conversation Management */}
      <div className="w-[280px] bg-white border-r border-gray-200 flex-shrink-0">
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
      <div className="w-[320px] bg-white border-l border-gray-200 flex-shrink-0">
        <DetailsSidebar
          sessionId={sessionId}
          conversationId={currentConversationId}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}
