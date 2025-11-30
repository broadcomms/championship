'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Copy, FileText } from 'lucide-react';
import type { Message as MessageType } from '@/types/assistant';
import { Message } from './Message';
import { EnhancedInput } from './EnhancedInput';
import { SuggestionChips, generateSuggestions, type Suggestion } from './SuggestionChips';
import { StreamingIndicator, useStreamingMessage } from './StreamingMessage';
import { useChatWidget, BroadcastMessage } from '@/contexts/ChatWidgetContext';
import { exportConversation, copyConversationToClipboard } from '@/lib/exportConversation';

/**
 * ARCHITECTURE NOTES:
 *
 * This component is a CONSUMER of session state, not a manager.
 * - Reads sessionId from context using getSessionId() (synchronous)
 * - Reports new sessions to parent via onSessionCreated callback
 * - Parent (AIAssistantPage) is responsible for localStorage persistence
 */

interface ChatInterfaceProps {
  workspaceId: string;
  messages: MessageType[];
  onMessageSent: (message: MessageType) => void;
  onSessionCreated: (sessionId: string) => void;
}

interface AssistantResponse {
  message: string;
  sessionId?: string;
  actions?: MessageType['actions'];
  sources?: MessageType['sources'];
  suggestions?: Array<Suggestion | string>;
}

export function ChatInterface({
  workspaceId,
  messages: externalMessages,
  onMessageSent,
  onSessionCreated,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageType[]>(externalMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() =>
    generateSuggestions({ workspaceData: {} })
  );
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { streamingContent } = useStreamingMessage();

  // Get chat widget context - use getSessionId() for synchronous reads
  const chatWidget = useChatWidget();

  // Sync external messages to local state
  useEffect(() => {
    console.log('📥 ChatInterface: Received external messages:', externalMessages.length, 'messages');
    setMessages(externalMessages);
  }, [externalMessages]);

  // Subscribe to messages from chat widget (for bidirectional sync with floating widget)
  useEffect(() => {
    const unsubscribe = chatWidget.subscribeToMessages((message: BroadcastMessage) => {
      // Only add message if it belongs to our session and is not a duplicate
      const currentSessionId = chatWidget.getSessionId();

      // Skip if message is from a different session
      if (message.sourceSessionId !== null && message.sourceSessionId !== currentSessionId) {
        console.log('⏭️ Skipping message from different session:', message.sourceSessionId, 'vs', currentSessionId);
        return;
      }

      setMessages(prev => {
        const exists = prev.some(m =>
          m.id === message.id ||
          (m.content === message.content &&
           m.role === message.role &&
           Math.abs(new Date(m.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000)
        );
        if (exists) return prev;
        return [...prev, message];
      });
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount, chatWidget methods are stable

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const normalizeSuggestions = useCallback((items?: Array<Suggestion | string>): Suggestion[] => {
    if (!items || items.length === 0) return [];
    return items.map((item, index) =>
      typeof item === 'string'
        ? {
            id: `api-suggestion-${Date.now()}-${index}`,
            text: item,
          }
        : item
    );
  }, []);

  const sendMessage = useCallback(async (messageText?: string) => {
    const messageToSend = messageText || input;
    if (!messageToSend.trim() || isLoading) return;

    // Get sessionId SYNCHRONOUSLY from context
    const currentSessionId = chatWidget.getSessionId();
    console.log('📤 Sending message with sessionId:', currentSessionId);

    const userMessage: MessageType = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    onMessageSent(userMessage);

    // Broadcast to chat widget so it stays in sync
    chatWidget.notifyMessage(userMessage);
    setInput('');
    setIsLoading(true);
    setSuggestions([]);

    // Create streaming message placeholder
    const streamingMsgId = `msg-${Date.now()}-assistant`;
    setStreamingMessageId(streamingMsgId);

    const streamingMessage: MessageType = {
      id: streamingMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true,
    };

    setMessages((prev) => [...prev, streamingMessage]);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          workspaceId,
          message: messageToSend,
          sessionId: currentSessionId,
          context: {
            currentPage: 'assistant',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as AssistantResponse;

      // If backend created a new session, notify parent (who will update context and localStorage)
      if (data.sessionId && !currentSessionId) {
        console.log('🆕 New session created by backend:', data.sessionId);
        onSessionCreated(data.sessionId);
      }

      // Update streaming message with final content
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamingMsgId
            ? {
                ...msg,
                content: data.message,
                streaming: false,
                actions: data.actions || [],
                sources: data.sources || [],
              }
            : msg
        )
      );

      const assistantMessage: MessageType = {
        id: streamingMsgId,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        actions: data.actions || [],
        sources: data.sources || [],
      };

      onMessageSent(assistantMessage);

      // Broadcast assistant message to chat widget
      chatWidget.notifyMessage(assistantMessage);

      // Generate context-aware suggestions
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(normalizeSuggestions(data.suggestions));
      } else {
        setSuggestions(
          generateSuggestions({
            currentTopic: data.message.substring(0, 100),
            workspaceData: {},
          })
        );
      }
    } catch (error) {
      console.error('Chat error:', error);

      // Update streaming message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamingMsgId
            ? {
                ...msg,
                content: 'Sorry, I encountered an error. Please try again.',
                streaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, workspaceId, onMessageSent, onSessionCreated, normalizeSuggestions]); // Exclude chatWidget

  const handleSuggestionClick = (suggestion: string | Suggestion) => {
    const text = typeof suggestion === 'string' ? suggestion : suggestion.text;
    sendMessage(text);
  };

  const handleRegenerate = (messageId: string) => {
    // Find the user message before this assistant message
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex > 0) {
      const previousMessage = messages[messageIndex - 1];
      if (previousMessage.role === 'user') {
        // Remove the assistant message and regenerate
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        sendMessage(previousMessage.content);
      }
    }
  };

  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    const currentSessionId = chatWidget.getSessionId();
    // Send feedback to API
    fetch('/api/assistant/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        messageId,
        feedback,
        sessionId: currentSessionId,
      }),
    }).catch((error) => {
      console.error('Failed to submit feedback:', error);
    });
  };

  const handleFileAttach = (files: File[]) => {
    console.log('Files attached:', files);
    // Handle file upload logic
  };

  const handleExport = (format: 'markdown' | 'json') => {
    const currentSessionId = chatWidget.getSessionId();
    try {
      exportConversation(messages, format, currentSessionId ?? undefined, workspaceId);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export conversation. Please try again.');
    }
  };

  const handleCopyToClipboard = async () => {
    const currentSessionId = chatWidget.getSessionId();
    setCopyStatus('copying');
    try {
      await copyConversationToClipboard(messages, currentSessionId ?? undefined, workspaceId);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Failed to copy to clipboard. Please try again.');
      setCopyStatus('idle');
    }
  };

  // Get current sessionId for display
  const currentSessionId = chatWidget.sessionId;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              AI Compliance Assistant
            </h1>
            {currentSessionId && (
              <p className="text-sm text-gray-500 mt-1">
                Session active • {messages.length} messages
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Export Menu */}
            {messages.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Export conversation"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      onClick={() => handleExport('markdown')}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Export as Markdown
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Export as JSON
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={handleCopyToClipboard}
                      disabled={copyStatus === 'copying'}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      <Copy className="w-4 h-4" />
                      {copyStatus === 'copied'
                        ? 'Copied!'
                        : copyStatus === 'copying'
                        ? 'Copying...'
                        : 'Copy to Clipboard'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center mt-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full mb-4 shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Welcome to AI Compliance Assistant
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              I&rsquo;m here to help with compliance questions, document analysis, and regulatory guidance.
            </p>
            <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto">
              <button
                onClick={() => sendMessage('What is my current compliance score?')}
                className="group p-4 text-left bg-white border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">📊</span>
                  <span className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    Check Compliance Score
                  </span>
                </div>
                <div className="text-sm text-gray-600 ml-11">
                  Get an overview of your current compliance status
                </div>
              </button>
              <button
                onClick={() => sendMessage('What documents need attention?')}
                className="group p-4 text-left bg-white border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">📄</span>
                  <span className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    Review Documents
                  </span>
                </div>
                <div className="text-sm text-gray-600 ml-11">
                  Find documents that require immediate attention
                </div>
              </button>
              <button
                onClick={() => sendMessage('Show me GDPR compliance gaps')}
                className="group p-4 text-left bg-white border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">🔍</span>
                  <span className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    Identify Gaps
                  </span>
                </div>
                <div className="text-sm text-gray-600 ml-11">
                  Discover areas that need compliance improvement
                </div>
              </button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            onRegenerate={
              message.role === 'assistant' ? () => handleRegenerate(message.id) : undefined
            }
            onFeedback={message.role === 'assistant' ? handleFeedback : undefined}
          />
        ))}

        {isLoading && !streamingMessageId && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <StreamingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <div className="px-6 py-4 bg-white border-t border-gray-200">
          <SuggestionChips
            suggestions={suggestions}
            onSelect={handleSuggestionClick}
            showCategories={true}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <EnhancedInput
          value={input}
          onChange={setInput}
          onSend={() => sendMessage()}
          onFileAttach={handleFileAttach}
          disabled={isLoading}
          placeholder="Ask me anything about compliance..."
          maxLength={4000}
        />
      </div>
    </div>
  );
}
