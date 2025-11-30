'use client';

import React, { useState, useEffect } from 'react';

interface StreamingMessageProps {
  content: string;
  onComplete?: () => void;
  speed?: number; // milliseconds per character
}

export function StreamingMessage({
  content,
  onComplete,
  speed = 20,
}: StreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentIndex < content.length) {
      const timeout = setTimeout(() => {
        setDisplayedContent(content.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else if (!isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentIndex, content, speed, isComplete, onComplete]);

  return (
    <div className="relative">
      <span>{displayedContent}</span>
      {!isComplete && (
        <span className="inline-block w-1 h-4 ml-1 bg-primary-600 animate-pulse" />
      )}
    </div>
  );
}

/**
 * Hook for handling streaming messages from server
 */
export function useStreamingMessage() {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const startStreaming = async (
    endpoint: string,
    body: Record<string, unknown>,
    onComplete?: (content: string) => void,
    onError?: (error: Error) => void
  ): Promise<void> => {
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      setIsStreaming(false);
      onComplete?.(fullContent);
    } catch (error) {
      setIsStreaming(false);
      const normalizedError = error instanceof Error ? error : new Error('Streaming failed');
      onError?.(normalizedError);
    }
  };

  const stopStreaming = () => {
    setIsStreaming(false);
  };

  return {
    streamingContent,
    isStreaming,
    startStreaming,
    stopStreaming,
  };
}

/**
 * Component for displaying streaming status
 */
export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" />
        <span
          className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
          style={{ animationDelay: '0.1s' }}
        />
        <span
          className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
          style={{ animationDelay: '0.2s' }}
        />
      </div>
      <span>Generating response...</span>
    </div>
  );
}
