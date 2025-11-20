'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { Message as MessageType } from '@/types/assistant';
import { Message } from './Message';
import { EnhancedInput } from './EnhancedInput';
import { SuggestionChips, generateSuggestions } from './SuggestionChips';
import { StreamingIndicator, useStreamingMessage } from './StreamingMessage';
import { VoiceChat } from './VoiceChat';

interface ChatInterfaceProps {
  workspaceId: string;
  sessionId?: string;
  messages: MessageType[];
  onMessageSent: (message: MessageType) => void;
  onSessionCreated: (sessionId: string) => void;
}

export function ChatInterface({
  workspaceId,
  sessionId: initialSessionId,
  messages: externalMessages,
  onMessageSent,
  onSessionCreated,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageType[]>(externalMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [suggestions, setSuggestions] = useState(() =>
    generateSuggestions({ workspaceData: {} })
  );
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { streamingContent, isStreaming, startStreaming } = useStreamingMessage();

  useEffect(() => {
    setMessages(externalMessages);
  }, [externalMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const sendMessage = async (messageText?: string) => {
    const messageToSend = messageText || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage: MessageType = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    onMessageSent(userMessage);
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
          sessionId,
          context: {
            currentPage: 'assistant',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
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

      // Generate context-aware suggestions
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
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
                content: '❌ Sorry, I encountered an error. Please try again.',
                streaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
  };

  const handleSuggestionClick = (suggestion: any) => {
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
        sessionId,
      }),
    }).catch((error) => {
      console.error('Failed to submit feedback:', error);
    });
  };

  const handleFileAttach = (files: File[]) => {
    console.log('Files attached:', files);
    // Handle file upload logic
  };

  const handleVoiceTranscription = (text: string) => {
    setInput(text);
  };

  const handleVoiceSendMessage = (text: string) => {
    sendMessage(text);
  };

  const lastAssistantMessage = messages
    .slice()
    .reverse()
    .find((m) => m.role === 'assistant')?.content;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-900">
          AI Compliance Assistant
        </h1>
        {sessionId && (
          <p className="text-sm text-gray-500 mt-1">
            Session active • {messages.length} messages
          </p>
        )}
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
              I'm here to help with compliance questions, document analysis, and regulatory guidance.
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
        <div className="flex gap-2 items-end">
          <div className="flex-1">
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
          <VoiceChat
            onTranscription={handleVoiceTranscription}
            onSendMessage={handleVoiceSendMessage}
            lastAssistantMessage={lastAssistantMessage}
          />
        </div>
      </div>
    </div>
  );
}
