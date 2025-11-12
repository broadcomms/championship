'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Minimize2, Maximize2, ExternalLink, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: Action[];
}

interface Action {
  type: 'navigate' | 'download';
  target?: string;
  label?: string;
}

interface Suggestion {
  text: string;
  onClick: () => void;
}

interface Props {
  workspaceId?: string; // Made optional for demo mode
}

export function AIChatWidget({ workspaceId = 'demo-workspace' }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load session ID and conversation history from localStorage on mount
  useEffect(() => {
    const loadConversationHistory = async () => {
      // Get stored session ID for this workspace
      const storageKey = `ai_session_${workspaceId}`;
      const storedSessionId = localStorage.getItem(storageKey);
      
      if (storedSessionId) {
        setSessionId(storedSessionId);
        setIsLoadingHistory(true);
        
        try {
          // Fetch conversation history from backend
          const response = await fetch(
            `/api/assistant/chat?workspaceId=${workspaceId}&sessionId=${storedSessionId}`,
            {
              method: 'GET',
              credentials: 'include',
            }
          );

          if (response.ok) {
            const data = await response.json();
            
            // Convert backend messages to widget format
            if (data.messages && Array.isArray(data.messages)) {
              const loadedMessages: Message[] = data.messages.map((msg: any) => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.created_at ? new Date(msg.created_at) : 
                          msg.timestamp ? new Date(msg.timestamp) : 
                          new Date() // Fallback to current time if neither exists
              }));
              
              setMessages(loadedMessages);
            }
          }
        } catch (error) {
          console.error('Failed to load conversation history:', error);
          // If loading fails, clear the stored session to start fresh
          localStorage.removeItem(storageKey);
          setSessionId(null);
        } finally {
          setIsLoadingHistory(false);
        }
      }
    };

    loadConversationHistory();
  }, [workspaceId]);

  const sendMessage = async (messageText?: string) => {
    const messageToSend = messageText || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setSuggestions([]);

    try {
      // Send request - the API route will read the HttpOnly session cookie
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify({
          workspaceId,
          message: messageToSend,
          sessionId,
          context: {
            currentPage: window.location.pathname
          }
        })
      });

      let errorMessage = '';
      if (!response.ok) {
        // Try to get error message from response
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Save session ID for this workspace
      if (data.sessionId) {
        setSessionId(data.sessionId);
        const storageKey = `ai_session_${workspaceId}`;
        localStorage.setItem(storageKey, data.sessionId);
      }
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        actions: data.actions || []
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Set suggestions if available
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      // Show more helpful error messages
      let errorContent = 'Sorry, I encountered an error. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('Access denied')) {
          errorContent = '🔒 **Authentication Required**\n\nPlease log in to use the AI assistant. Your session may have expired.';
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorContent = '🚫 **Access Denied**\n\nYou don\'t have permission to access this workspace. Please check your workspace membership.';
        } else if (error.message.includes('500')) {
          errorContent = '⚠️ **Server Error**\n\nThe AI service is temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes('timeout')) {
          errorContent = '⏱️ **Request Timeout**\n\nThe request took too long to process. Please try a simpler question.';
        } else {
          errorContent = `❌ **Error**\n\n${error.message}\n\nPlease try again or contact support if the problem persists.`;
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
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    sendMessage(suggestion);
  };

  const handleAction = (action: Action) => {
    if (action.type === 'navigate' && action.target) {
      router.push(action.target);
    } else if (action.type === 'download' && action.target) {
      window.open(action.target, '_blank');
    }
  };

  const clearConversation = () => {
    if (confirm('Are you sure you want to clear this conversation? This cannot be undone.')) {
      const storageKey = `ai_session_${workspaceId}`;
      localStorage.removeItem(storageKey);
      setSessionId(null);
      setMessages([]);
      setSuggestions([]);
    }
  };

  return (
    <>
      {/* Float Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors"
            aria-label="Open AI Assistant"
          >
            <Bot className="w-6 h-6" />
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
            className="fixed bottom-6 right-6 z-50 w-96 h-[760px] bg-white rounded-lg shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-lg">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5" />
                <span className="font-semibold">AuditGuard AI</span>
                {sessionId && (
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
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-blue-700 p-1 rounded"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingHistory && (
                <div className="text-center text-gray-500 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm">Loading conversation history...</p>
                </div>
              )}
              
              {!isLoadingHistory && messages.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="mb-2 font-semibold">Hi! I'm your AI compliance assistant.</p>
                  <p className="text-sm">Ask me anything about your documents, compliance status, or regulations.</p>
                  <div className="mt-6 space-y-2">
                    <button
                      onClick={() => sendMessage("What is my current compliance score?")}
                      className="block w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                    >
                      📊 What is my current compliance score?
                    </button>
                    <button
                      onClick={() => sendMessage("What documents need attention?")}
                      className="block w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                    >
                      📄 What documents need attention?
                    </button>
                    <button
                      onClick={() => sendMessage("Show me GDPR compliance gaps")}
                      className="block w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                    >
                      🔍 Show me GDPR compliance gaps
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
                            // Customize rendering for better chat display
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

            {/* Suggestions */}
            {suggestions.length > 0 && !isLoading && (
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

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
