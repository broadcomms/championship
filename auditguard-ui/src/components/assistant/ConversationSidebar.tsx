'use client';

import React, { useState } from 'react';
import { Search, Plus, Calendar, Tag } from 'lucide-react';
import type { Conversation, FilterOptions } from '@/types/assistant';

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentId?: string;
  onSelect: (id: string) => void;
  onSearch: (query: string) => void;
  onNewConversation: () => void;
  filters: FilterOptions;
}

export function ConversationSidebar({
  conversations,
  currentId,
  onSelect,
  onSearch,
  onNewConversation,
  filters,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  // Group conversations by date
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() - 7);

  const groupedConversations = {
    today: conversations.filter(c => 
      c.lastMessageTime.toDateString() === today.toDateString()
    ),
    yesterday: conversations.filter(c => 
      c.lastMessageTime.toDateString() === yesterday.toDateString()
    ),
    thisWeek: conversations.filter(c => {
      const date = c.lastMessageTime;
      return date > thisWeek && date < yesterday;
    }),
    older: conversations.filter(c => 
      c.lastMessageTime < thisWeek
    ),
    pinned: conversations.filter(c => c.isPinned && !c.isArchived),
    archived: conversations.filter(c => c.isArchived),
  };

  const ConversationItem = ({ conversation }: { conversation: Conversation }) => (
    <button
      onClick={() => onSelect(conversation.id)}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        currentId === conversation.id
          ? 'bg-primary-50 border-primary-500'
          : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-medium text-sm text-gray-900 truncate flex-1">
          {conversation.title}
        </h4>
        {conversation.completionPercentage !== undefined && (
          <span className="text-xs text-gray-500 ml-2">
            {conversation.completionPercentage}%
          </span>
        )}
      </div>
      <p className="text-xs text-gray-600 truncate mb-1">
        {conversation.lastMessage}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {conversation.lastMessageTime.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
        <div className="flex items-center gap-1">
          {conversation.messageCount > 0 && (
            <span className="text-xs text-gray-400">
              {conversation.messageCount} msgs
            </span>
          )}
        </div>
      </div>
      {conversation.tags && conversation.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {conversation.tags.slice(0, 2).map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );

  const ConversationGroup = ({ 
    label, 
    conversations: groupConversations,
    icon 
  }: { 
    label: string; 
    conversations: Conversation[];
    icon?: React.ReactNode;
  }) => {
    if (groupConversations.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 px-2 mb-2">
          {icon}
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {label} ({groupConversations.length})
          </h3>
        </div>
        <div className="space-y-1">
          {groupConversations.map(conversation => (
            <ConversationItem key={conversation.id} conversation={conversation} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Conversations
        </h2>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* New Conversation Button */}
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-4">No conversations yet</p>
            <p className="text-gray-400 text-xs">
              Start a new conversation to get compliance assistance
            </p>
          </div>
        ) : (
          <>
            <ConversationGroup
              label="Pinned"
              conversations={groupedConversations.pinned}
              icon={<Tag className="w-3 h-3 text-gray-500" />}
            />
            <ConversationGroup
              label="Today"
              conversations={groupedConversations.today}
              icon={<Calendar className="w-3 h-3 text-gray-500" />}
            />
            <ConversationGroup
              label="Yesterday"
              conversations={groupedConversations.yesterday}
            />
            <ConversationGroup
              label="This Week"
              conversations={groupedConversations.thisWeek}
            />
            <ConversationGroup
              label="Older"
              conversations={groupedConversations.older}
            />
            {groupedConversations.archived.length > 0 && (
              <ConversationGroup
                label="Archived"
                conversations={groupedConversations.archived}
              />
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{conversations.length} conversations</span>
          <button className="hover:text-primary-600 transition-colors">
            Filters
          </button>
        </div>
      </div>
    </div>
  );
}
