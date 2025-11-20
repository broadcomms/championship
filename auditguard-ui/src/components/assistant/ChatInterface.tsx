'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Message } from '@/types/assistant';
import 'highlight.js/styles/github-dark.css';

interface ChatInterfaceProps {
  workspaceId: string;
  sessionId?: string;
  messages: Message[];
  onMessageSent: (message: Message) => void;
  onSessionCreated: (sessionId: string) => void;
}

export function ChatInterface({
  workspaceId,
  sessionId: initialSessionId,
  messages: externalMessages,
  onMessageSent,
  onSessionCreated,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(externalMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(externalMessages);
  }, [externalMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText?: string) => {
    const messageToSend = messageText || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    onMessageSent(userMessage);
    setInput('');
    setIsLoading(true);
    setSuggestions([]);

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

      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        actions: data.actions || [],
      };

      setMessages(prev => [...prev, assistantMessage]);
      onMessageSent(assistantMessage);

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

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
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center mt-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-primary-600"
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
                className="p-4 text-left bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                <div className="font-medium text-gray-900 mb-1">
                  📊 Check Compliance Score
                </div>
                <div className="text-sm text-gray-600">
                  Get an overview of your current compliance status
                </div>
              </button>
              <button
                onClick={() => sendMessage('What documents need attention?')}
                className="p-4 text-left bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                <div className="font-medium text-gray-900 mb-1">
                  📄 Review Documents
                </div>
                <div className="text-sm text-gray-600">
                  Find documents that require immediate attention
                </div>
              </button>
              <button
                onClick={() => sendMessage('Show me GDPR compliance gaps')}
                className="p-4 text-left bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                <div className="font-medium text-gray-900 mb-1">
                  🔍 Identify Gaps
                </div>
                <div className="text-sm text-gray-600">
                  Discover areas that need compliance improvement
                </div>
              </button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
              <p className="text-xs opacity-70 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <div className="px-6 pb-4">
          <p className="text-xs text-gray-500 font-medium mb-2">
            Suggested questions:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-full text-sm transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your message..."
              rows={1}
              disabled={isLoading}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-3 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-3 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Voice input"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
