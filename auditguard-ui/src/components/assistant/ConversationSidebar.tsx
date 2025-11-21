'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Plus,
  Pin,
  Archive,
  ChevronDown,
  ChevronRight,
  Filter,
  MoreVertical,
  MessageSquare,
  Clock,
  Tag,
  Trash2,
  Download,
  Share2,
  CheckSquare,
  Square,
  Calendar,
} from 'lucide-react';
import type { Conversation, FilterOptions } from '@/types/assistant';
import { formatDistanceToNow } from 'date-fns';

interface ConversationGroup {
  label: string;
  conversations: Conversation[];
  isExpanded: boolean;
}

interface ConversationSidebarProps {
  workspaceId: string;
  currentId?: string;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  className?: string;
  refreshTrigger?: number; // Increment to trigger refresh
}

export function ConversationSidebar({
  workspaceId,
  currentId,
  onSelect,
  onNewConversation,
  className = '',
  refreshTrigger = 0,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<ConversationGroup[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    dateRange: { start: null, end: null },
    categories: [],
    frameworks: [],
    status: [],
    tags: [],
    showArchived: false,
    showPinned: false,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [workspaceId, filters, page]);

  // Refresh when refreshTrigger changes (e.g., after new session created)
  useEffect(() => {
    if (refreshTrigger > 0) {
      setPage(1);
      loadConversations();
    }
  }, [refreshTrigger]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/assistant/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workspaceId,
          filters,
          page,
          limit: 20,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (page === 1) {
          setConversations(data.conversations);
        } else {
          setConversations((prev) => [...prev, ...data.conversations]);
        }
        setHasMore(data.hasMore);
        groupConversations(data.conversations);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group conversations by date
  const groupConversations = (convos: Conversation[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);

    const grouped: ConversationGroup[] = [
      { label: 'Pinned', conversations: [], isExpanded: true },
      { label: 'Today', conversations: [], isExpanded: true },
      { label: 'Yesterday', conversations: [], isExpanded: true },
      { label: 'This Week', conversations: [], isExpanded: true },
      { label: 'This Month', conversations: [], isExpanded: false },
      { label: 'Older', conversations: [], isExpanded: false },
    ];

    convos.forEach((conv) => {
      if (conv.isPinned) {
        grouped[0].conversations.push(conv);
      } else {
        const updatedDate = new Date(conv.lastMessageTime);
        if (updatedDate >= today) {
          grouped[1].conversations.push(conv);
        } else if (updatedDate >= yesterday) {
          grouped[2].conversations.push(conv);
        } else if (updatedDate >= thisWeek) {
          grouped[3].conversations.push(conv);
        } else if (updatedDate >= thisMonth) {
          grouped[4].conversations.push(conv);
        } else {
          grouped[5].conversations.push(conv);
        }
      }
    });

    setGroups(grouped.filter((g) => g.conversations.length > 0));
  };

  // Toggle group expansion
  const toggleGroup = (label: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.label === label ? { ...g, isExpanded: !g.isExpanded } : g
      )
    );
  };

  // Handle search
  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPage(1);
  };

  // Handle pin/unpin
  const handlePin = async (conversationId: string, isPinned: boolean) => {
    try {
      await fetch('/api/assistant/conversations/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ conversationId, isPinned: !isPinned, workspaceId }),
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, isPinned: !isPinned } : c
        )
      );
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  };

  // Handle archive/unarchive
  const handleArchive = async (conversationId: string, isArchived: boolean) => {
    try {
      await fetch('/api/assistant/conversations/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ conversationId, isArchived: !isArchived, workspaceId }),
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, isArchived: !isArchived } : c
        )
      );
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  // Handle delete
  const handleDelete = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    // Optimistically remove from UI immediately
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));

    try {
      const response = await fetch('/api/assistant/conversations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ conversationId, workspaceId }),
      });

      if (!response.ok) {
        console.error('Failed to delete conversation:', await response.text());
        // Reload to restore state if delete failed
        loadConversations();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      // Reload to restore state if delete failed
      loadConversations();
    }
  };

  // Handle batch operations
  const handleBatchOperation = async (operation: string) => {
    if (selectedIds.length === 0) return;

    try {
      await fetch('/api/assistant/conversations/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationIds: selectedIds,
          operation,
        }),
      });

      // Reload conversations
      setPage(1);
      loadConversations();
      setSelectedIds([]);
      setBatchMode(false);
    } catch (error) {
      console.error('Failed to perform batch operation:', error);
    }
  };

  // Toggle conversation selection
  const toggleSelection = (conversationId: string) => {
    setSelectedIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  // Select all conversations
  const toggleSelectAll = () => {
    if (selectedIds.length === conversations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(conversations.map((c) => c.id));
    }
  };

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      setPage((prev) => prev + 1);
    }
  }, [isLoading, hasMore]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.addEventListener('scroll', handleScroll);
      return () => element.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return (
    <div className={`flex flex-col h-full bg-white border-r border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters
                  ? 'bg-primary-100 text-primary-600'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Filters"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setBatchMode(!batchMode)}
              className={`p-2 rounded-lg transition-colors ${
                batchMode
                  ? 'bg-primary-100 text-primary-600'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Select multiple"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={filters.search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* New Conversation */}
        <button
          onClick={onNewConversation}
          className="w-full mt-3 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs rounded-md bg-white border border-gray-300 hover:bg-gray-50">
                  Today
                </button>
                <button className="px-3 py-1 text-xs rounded-md bg-white border border-gray-300 hover:bg-gray-50">
                  Week
                </button>
                <button className="px-3 py-1 text-xs rounded-md bg-white border border-gray-300 hover:bg-gray-50">
                  Month
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showPinned}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, showPinned: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-700">Pinned only</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showArchived}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, showArchived: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-700">Show archived</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Batch Actions */}
      {batchMode && selectedIds.length > 0 && (
        <div className="p-3 border-b border-gray-200 bg-primary-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary-900">
              {selectedIds.length} selected
            </span>
            <button
              onClick={toggleSelectAll}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              {selectedIds.length === conversations.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBatchOperation('pin')}
              className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50"
            >
              Pin
            </button>
            <button
              onClick={() => handleBatchOperation('archive')}
              className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50"
            >
              Archive
            </button>
            <button
              onClick={() => handleBatchOperation('delete')}
              className="flex-1 px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-md text-xs font-medium hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label}>
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {group.isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {group.label}
                </span>
                <span className="text-xs text-gray-500">({group.conversations.length})</span>
              </div>
            </button>

            {/* Conversations */}
            {group.isExpanded && (
              <div>
                {group.conversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === currentId}
                    isSelected={selectedIds.includes(conversation.id)}
                    batchMode={batchMode}
                    onSelect={() => onSelect(conversation.id)}
                    onToggleSelection={() => toggleSelection(conversation.id)}
                    onPin={() => handlePin(conversation.id, conversation.isPinned)}
                    onArchive={() => handleArchive(conversation.id, conversation.isArchived)}
                    onDelete={() => handleDelete(conversation.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="p-4 text-center">
            <div className="inline-block w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && conversations.length === 0 && (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No conversations yet</p>
            <button
              onClick={onNewConversation}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Start your first conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Individual Conversation Item Component
interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isSelected: boolean;
  batchMode: boolean;
  onSelect: () => void;
  onToggleSelection: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  isSelected,
  batchMode,
  onSelect,
  onToggleSelection,
  onPin,
  onArchive,
  onDelete,
}: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`group relative px-4 py-3 border-l-2 transition-colors ${
        isActive
          ? 'bg-primary-50 border-primary-600'
          : 'border-transparent hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        {batchMode && (
          <button
            onClick={onToggleSelection}
            className="mt-1 flex-shrink-0"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-primary-600" />
            ) : (
              <Square className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}

        {/* Content */}
        <button
          onClick={onSelect}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm text-gray-900 truncate">
              {conversation.title}
            </h3>
            {conversation.isPinned && (
              <Pin className="w-3 h-3 text-primary-600 flex-shrink-0" fill="currentColor" />
            )}
            {conversation.isUnread && (
              <span className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-600 line-clamp-2 mb-2">{conversation.lastMessage}</p>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(conversation.lastMessageTime), { addSuffix: true })}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {conversation.messageCount}
            </span>
            {conversation.tags && conversation.tags.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {conversation.tags.length}
              </span>
            )}
          </div>
        </button>

        {/* Actions Menu */}
        {!batchMode && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
            >
              <MoreVertical className="w-4 h-4 text-gray-600" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-6 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  <button
                    onClick={() => {
                      onPin();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Pin className="w-4 h-4" />
                    {conversation.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={() => {
                      onArchive();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    {conversation.isArchived ? 'Unarchive' : 'Archive'}
                  </button>
                  <button
                    onClick={() => {
                      // Handle export
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button
                    onClick={() => {
                      // Handle share
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <div className="my-1 border-t border-gray-200" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      {conversation.tags && conversation.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {conversation.tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded"
            >
              {tag}
            </span>
          ))}
          {conversation.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
              +{conversation.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
