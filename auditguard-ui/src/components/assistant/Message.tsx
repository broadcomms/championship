'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2, RefreshCw, Download, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type { Message as MessageType } from '@/types/assistant';
import 'highlight.js/styles/github-dark.css';

interface MessageProps {
  message: MessageType;
  onRegenerate?: () => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
}

export function Message({ message, onRegenerate, onFeedback }: MessageProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AI Assistant Response',
          text: message.content,
        });
      } catch (error) {
        // User cancelled or share failed
        console.log('Share cancelled');
      }
    }
  };

  const handleExport = () => {
    const blob = new Blob([message.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assistant-message-${message.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    onFeedback?.(message.id, type);
  };

  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div
        className={`max-w-[85%] rounded-lg ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-white border border-gray-200 shadow-sm'
        }`}
      >
        {/* Message Header (Assistant only) */}
        {!isUser && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
            <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full">
              <svg
                className="w-4 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">AI Assistant</span>
            {message.streaming && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <span className="inline-block w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                Generating...
              </span>
            )}
          </div>
        )}

        {/* Message Content */}
        <div className={`px-4 ${isUser ? 'py-3' : 'py-3'}`}>
          {!isUser ? (
            <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary-600 prose-code:text-primary-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                components={{
                  // Enhanced code block rendering
                  code(props) {
                    const { node, className, children, ...rest } = props as any;
                    const inline = !(props as any).inline;
                    const match = /language-(\w+)/.exec(className || '');
                    return inline && match ? (
                      <div className="relative group/code">
                        <div className="absolute right-2 top-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
                            }
                            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded"
                          >
                            Copy
                          </button>
                        </div>
                        <code className={className} {...rest}>
                          {children}
                        </code>
                      </div>
                    ) : (
                      <code className={className} {...rest}>
                        {children}
                      </code>
                    );
                  },
                  // Enhanced table rendering
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  // Enhanced link rendering
                  a({ href, children }) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1"
                      >
                        {children}
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          )}

          {/* Sources (if available) */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-700 mb-2">📚 Sources:</p>
              <div className="space-y-1">
                {message.sources.map((source, index) => (
                  <div
                    key={index}
                    className="text-xs text-gray-600 flex items-start gap-2 hover:bg-gray-50 p-1 rounded"
                  >
                    <span>•</span>
                    <span>
                      {source.name}
                      {source.page && ` (Page ${source.page})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Message Footer */}
        <div
          className={`px-4 pb-3 flex items-center justify-between ${
            isUser ? 'text-white/70' : 'text-gray-500'
          }`}
        >
          <span className="text-xs">
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          {/* Action Buttons (Assistant messages only) */}
          {!isUser && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Copy message"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              {typeof window !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleShare}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleExport}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Export message"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Regenerate response"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="w-px h-4 bg-gray-300 mx-1" />

              <button
                onClick={() => handleFeedback('positive')}
                className={`p-1.5 hover:bg-gray-100 rounded transition-colors ${
                  feedback === 'positive' ? 'text-green-600' : ''
                }`}
                title="Helpful"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleFeedback('negative')}
                className={`p-1.5 hover:bg-gray-100 rounded transition-colors ${
                  feedback === 'negative' ? 'text-red-600' : ''
                }`}
                title="Not helpful"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons (from message.actions) */}
        {message.actions && message.actions.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {message.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  // Handle action
                  console.log('Action clicked:', action);
                }}
                className="px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-medium rounded-md transition-colors"
              >
                {action.icon && <span className="mr-1">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
