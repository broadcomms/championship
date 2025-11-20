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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({});

  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    // TODO: Load conversation messages
  };

  const handleNewConversation = () => {
    setCurrentConversationId(undefined);
    setSessionId(undefined);
    setMessages([]);
  };

  const handleSearch = (query: string) => {
    // TODO: Implement conversation search
    console.log('Search:', query);
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
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={handleConversationSelect}
          onSearch={handleSearch}
          onNewConversation={handleNewConversation}
          filters={filters}
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
