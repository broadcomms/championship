'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Minimize2, Maximize2, ExternalLink, Download, Shield, MessageSquare, Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { VoiceInputPanel } from './VoiceInputPanel';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';
import { VoiceSettings } from '@/hooks/useSpeechSynthesis';
import { InputMode } from '@/hooks/useAudioCapture';
import { useChatWidget, BroadcastMessage } from '@/contexts/ChatWidgetContext';
import type { Message as MessageType, Action as ActionType } from '@/types/assistant';

/**
 * ARCHITECTURE NOTES:
 *
 * This widget is a CONSUMER of session state, not a manager.
 * - Reads sessionId from context using getSessionId() (synchronous)
 * - Does NOT read/write localStorage (that's AIAssistantPage's job)
 * - Clears messages when session changes to null
 * - Only displays messages; main chat handles API calls when on assistant page
 */

// Local simplified message interface for internal state
interface LocalMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: ActionType[];
}

type ChatMode = 'chat' | 'voice';

interface Props {
  workspaceId?: string;
  initialMode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  onMessageSent?: (message: MessageType) => void;
}

export function AIChatWidget({
  workspaceId = 'demo-workspace',
  initialMode = 'chat',
  onModeChange,
  onMessageSent,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get chat widget context for centralized state management
  const chatWidgetContext = useChatWidget();

  // Use context state
  const isOpen = chatWidgetContext.isOpen;
  const mode = chatWidgetContext.mode;

  // Voice settings state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voiceId: 'rachel',
    voiceName: 'Rachel',
    speed: 1.0,
    stability: 0.5,
    similarityBoost: 0.75,
    autoPlay: true,
  });

  const [inputMode, setInputMode] = useState<InputMode>('push-to-talk');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sync mode with context when initialMode changes from parent
  useEffect(() => {
    if (initialMode !== mode) {
      chatWidgetContext.setMode(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, mode]); // Exclude chatWidgetContext

  // Notify parent of mode changes
  useEffect(() => {
    if (onModeChange) {
      onModeChange(mode);
    }
  }, [mode, onModeChange]);

  // Load conversation history for a session
  const loadConversationHistory = useCallback(async (sessionId: string) => {
    console.log('📜 Widget: Loading conversation history for:', sessionId);
    try {
      const response = await fetch(
        `/api/assistant/chat?workspaceId=${workspaceId}&sessionId=${sessionId}`,
        { method: 'GET', credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages && Array.isArray(data.messages)) {
          const loadedMessages: LocalMessage[] = data.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.created_at ? new Date(msg.created_at) : new Date(msg.timestamp || Date.now()),
            actions: msg.actions || [],
          }));
          console.log('✅ Widget: Loaded', loadedMessages.length, 'messages');
          setMessages(loadedMessages);
        }
      }
    } catch (error) {
      console.error('Widget: Failed to load conversation history:', error);
    }
  }, [workspaceId]);

  // CRITICAL: Subscribe to session changes - load/clear messages appropriately
  useEffect(() => {
    const unsubscribe = chatWidgetContext.subscribeToSessionChange((newSessionId, prevSessionId) => {
      console.log('🔄 Widget: Session changed from', prevSessionId, 'to', newSessionId);

      // If session changed to null, clear messages (new conversation started)
      if (newSessionId === null && prevSessionId !== null) {
        console.log('🧹 Widget: Clearing messages for new conversation');
        setMessages([]);
        setSuggestions([]);
      }
      // If session changed from null to a value, load that conversation's history
      else if (newSessionId !== null && prevSessionId === null) {
        console.log('📂 Widget: Session activated - loading history');
        loadConversationHistory(newSessionId);
      }
      // If session changed to a different value, load the new conversation
      else if (newSessionId !== null && prevSessionId !== null && newSessionId !== prevSessionId) {
        console.log('🔄 Widget: Switching conversations - loading new history');
        setMessages([]);
        setSuggestions([]);
        loadConversationHistory(newSessionId);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConversationHistory]); // Include loadConversationHistory

  // Load initial conversation if session already exists on mount
  useEffect(() => {
    const currentSessionId = chatWidgetContext.getSessionId();
    if (currentSessionId && messages.length === 0) {
      console.log('🚀 Widget: Initial session detected, loading history');
      loadConversationHistory(currentSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Subscribe to messages from main chat interface
  useEffect(() => {
    const unsubscribe = chatWidgetContext.subscribeToMessages((message: BroadcastMessage) => {
      const currentSessionId = chatWidgetContext.getSessionId();

      // Only add message if it belongs to current session
      if (message.sourceSessionId !== null && message.sourceSessionId !== currentSessionId) {
        console.log('⏭️ Widget: Skipping message from different session');
        return;
      }

      const localMsg: LocalMessage = {
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        actions: message.actions,
      };

      setMessages(prev => {
        const exists = prev.some(m =>
          m.content === localMsg.content &&
          m.role === localMsg.role &&
          Math.abs(new Date(m.timestamp).getTime() - new Date(localMsg.timestamp).getTime()) < 1000
        );
        if (exists) return prev;
        return [...prev, localMsg];
      });
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Send message - uses context sessionId synchronously
  const sendMessage = useCallback(async (messageText?: string) => {
    const messageToSend = messageText || input;
    if (!messageToSend.trim() || isLoading) return;

    // Get sessionId SYNCHRONOUSLY from context
    const currentSessionId = chatWidgetContext.getSessionId();
    console.log('📤 Widget: Sending message with sessionId:', currentSessionId);

    const userMessage: LocalMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Notify context of user message (for main chat to receive)
    const contextMessage: MessageType = {
      id: `msg-${Date.now()}-user`,
      ...userMessage
    };
    chatWidgetContext.notifyMessage(contextMessage);

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
          sessionId: currentSessionId,
          context: {
            currentPage: window.location.pathname
          }
        })
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Widget: Received response');

      // If a new session was created, the main page will handle updating context
      // We don't touch localStorage here - that's AIAssistantPage's job
      // But we do update our local reference if one was created
      if (data.sessionId && !currentSessionId) {
        console.log('🆕 Widget: New session created by backend:', data.sessionId);
        // Let context know about the new session
        chatWidgetContext.setSessionId(data.sessionId);
      }

      const assistantMessage: LocalMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        actions: data.actions || []
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Notify context of assistant message
      const assistantContextMsg: MessageType = {
        id: `msg-${Date.now()}-assistant`,
        ...assistantMessage
      };

      if (onMessageSent) {
        onMessageSent(assistantContextMsg);
      }

      chatWidgetContext.notifyMessage(assistantContextMsg);

      // Set suggestions if available
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Widget chat error:', error);

      let errorContent = 'Sorry, I encountered an error. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorContent = 'Please log in to use the AI assistant.';
        } else if (error.message.includes('403')) {
          errorContent = 'You don\'t have permission to access this workspace.';
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, workspaceId, onMessageSent]); // Exclude chatWidgetContext

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    sendMessage(suggestion);
  };

  const handleAction = (action: ActionType) => {
    if (action.type === 'navigate' && action.target) {
      router.push(action.target);
    } else if (action.type === 'download' && action.target) {
      window.open(action.target, '_blank');
    }
  };

  const clearConversation = () => {
    if (confirm('Are you sure you want to clear this conversation? This cannot be undone.')) {
      // Clear context session (this will trigger the subscription and clear messages)
      chatWidgetContext.setSessionId(null);
    }
  };

  const handleToggleWidget = () => {
    chatWidgetContext.toggleWidget();
  };

  const handleCloseWidget = () => {
    chatWidgetContext.closeWidget();
  };

  // Get current sessionId for display
  const currentSessionId = chatWidgetContext.sessionId;

  return (
    <>
      {/* Float Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={handleToggleWidget}
            className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors"
            aria-label="Open AI Assistant"
          >
            <Shield className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-lg">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span className="font-semibold">AuditGuardX AI</span>
                {currentSessionId && (
                  <span className="text-xs opacity-70">• Active Session</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {messages.length > 0 && (
                  <button
                    onClick={clearConversation}
                    className="hover:bg-blue-700 px-2 py-1 rounded text-xs"
                    aria-label="Clear conversation"
                    title="Clear conversation"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={handleCloseWidget}
                  className="hover:bg-blue-700 p-1 rounded"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="px-4 pt-4">
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => chatWidgetContext.setMode('chat')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    mode === 'chat'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </button>
                <button
                  onClick={() => chatWidgetContext.setMode('voice')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    mode === 'voice'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  Voice
                </button>
              </div>
            </div>

            {/* Voice Input Panel */}
            {mode === 'voice' && (
              <div className="px-4 pt-4">
                <VoiceInputPanel
                  workspaceId={workspaceId}
                  onSendTranscription={sendMessage}
                  voiceSettings={voiceSettings}
                  inputMode={inputMode}
                  onSettingsClick={() => setShowVoiceSettings(true)}
                  lastAssistantMessage={messages.length > 0 && messages[messages.length - 1].role === 'assistant'
                    ? messages[messages.length - 1].content
                    : undefined}
                />
              </div>
            )}

            {/* Messages */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${mode === 'voice' ? 'max-h-64' : ''}`}>
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="mb-2 font-semibold">Hi! I'm your AI compliance assistant.</p>
                  <p className="text-sm">Ask me anything about your documents, compliance status, or regulations.</p>
                  <div className="mt-6 space-y-2">
                    <button
                      onClick={() => sendMessage("What is my current compliance score?")}
                      className="block w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                    >
                      What is my current compliance score?
                    </button>
                    <button
                      onClick={() => sendMessage("What documents need attention?")}
                      className="block w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                    >
                      What documents need attention?
                    </button>
                    <button
                      onClick={() => sendMessage("Show me GDPR compliance gaps")}
                      className="block w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                    >
                      Show me GDPR compliance gaps
                    </button>
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-2 prose-p:my-1 prose-pre:my-2">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-lg font-bold" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-base font-bold" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-sm font-bold" {...props} />,
                            p: ({node, ...props}) => <p className="text-sm" {...props} />,
                            code: ({node, inline, ...props}: any) =>
                              inline ? (
                                <code className="bg-gray-200 px-1 rounded text-xs" {...props} />
                              ) : (
                                <code className="text-xs" {...props} />
                              ),
                            pre: ({node, ...props}) => <pre className="bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside text-sm" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside text-sm" {...props} />,
                            a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>

                        {/* Action Buttons */}
                        {message.actions && message.actions.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-gray-200 flex flex-wrap gap-2">
                            {message.actions.map((action, actionIndex) => (
                              <button
                                key={actionIndex}
                                onClick={() => handleAction(action)}
                                className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                              >
                                {action.type === 'navigate' && <ExternalLink className="w-3 h-3" />}
                                {action.type === 'download' && <Download className="w-3 h-3" />}
                                {action.label || (action.type === 'navigate' ? 'View' : 'Download')}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions - Only show in chat mode */}
            {mode === 'chat' && suggestions.length > 0 && !isLoading && (
              <div className="px-4 pb-2 space-y-2">
                <p className="text-xs text-gray-500 font-medium">Suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full text-xs transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input - Only show in chat mode */}
            {mode === 'chat' && (
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Ask a question..."
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-gray-900"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Send message"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Settings Panel */}
      <VoiceSettingsPanel
        voiceSettings={voiceSettings}
        inputMode={inputMode}
        onVoiceSettingsChange={setVoiceSettings}
        onInputModeChange={setInputMode}
        onClose={() => setShowVoiceSettings(false)}
        isOpen={showVoiceSettings}
      />
    </>
  );
}
