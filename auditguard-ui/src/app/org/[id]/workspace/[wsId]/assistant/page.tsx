'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: {
    document_name: string;
    page?: number;
    relevance: number;
  }[];
}

interface Conversation {
  id: string;
  title: string;
  created_at: number;
  message_count: number;
}

export default function WorkspaceAssistantPage() {
  const params = useParams();
  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const { user } = useAuth();
  const accountId = user?.userId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    'What are the critical compliance gaps in my documents?',
    'Summarize the HIPAA requirements we need to address',
    'What documents are missing for SOC 2 compliance?',
    'Show me all critical issues that need immediate attention',
    'Explain the difference between ISO 27001 and SOC 2',
    'What are the common compliance issues in our workspace?',
  ];

  useEffect(() => {
    fetchConversations();
  }, [wsId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const response = await api.get(`/workspaces/${wsId}/assistant/conversations`);
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/assistant/conversations/${conversationId}`);
      setMessages(response.data.messages);
      setCurrentConversation(conversationId);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversation(null);
    setInput('');
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post(`/workspaces/${wsId}/assistant/chat`, {
        conversation_id: currentConversation,
        message: userMessage.content,
      });

      const assistantMessage: Message = {
        id: response.data.message_id,
        role: 'assistant',
        content: response.data.response,
        timestamp: Date.now(),
        sources: response.data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (!currentConversation && response.data.conversation_id) {
        setCurrentConversation(response.data.conversation_id);
        await fetchConversations();
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Conversation History Sidebar */}
        {showSidebar && (
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <Button onClick={startNewConversation} className="w-full">
                ➕ New Chat
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                Recent Conversations
              </h3>
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      currentConversation === conv.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900 truncate mb-1">
                      {conv.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {conv.message_count} messages •{' '}
                      {new Date(conv.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                ☰
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Compliance Assistant</h1>
                <p className="text-sm text-gray-600">
                  Ask questions about your compliance documents and requirements
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Online
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">🤖</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Welcome to your AI Compliance Assistant
                  </h2>
                  <p className="text-gray-600">
                    I can help you understand your compliance requirements, analyze documents,
                    and answer questions about security frameworks.
                  </p>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Suggested questions:
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {suggestedQuestions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => setInput(question)}
                        className="text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition"
                      >
                        <span className="text-sm text-gray-700">{question}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-semibold text-blue-900 mb-2">💡 Tips for best results</h3>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>• Be specific about the framework or document you're asking about</li>
                    <li>• Ask follow-up questions to dive deeper into topics</li>
                    <li>• Request specific examples or recommendations</li>
                    <li>• I have access to all documents in this workspace</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                          : 'bg-white border border-gray-200 rounded-2xl rounded-tl-sm'
                      } px-6 py-4`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">🤖</span>
                          <span className="font-semibold text-gray-900">AI Assistant</span>
                        </div>
                      )}
                      <div
                        className={`whitespace-pre-wrap ${
                          message.role === 'user' ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {message.content}
                      </div>

                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-2">
                            Sources:
                          </div>
                          <div className="space-y-1">
                            {message.sources.map((source, index) => (
                              <div
                                key={index}
                                className="text-xs text-gray-600 flex items-center gap-2"
                              >
                                <span>📄</span>
                                <span>
                                  {source.document_name}
                                  {source.page && ` (Page ${source.page})`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div
                        className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <span
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.1s' }}
                          />
                          <span
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a question about compliance..."
                  rows={1}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{
                    minHeight: '48px',
                    maxHeight: '120px',
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || loading}
                  className="px-6"
                >
                  Send
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </OrganizationLayout>
  );
}
