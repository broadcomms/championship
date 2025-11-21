'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { Message } from '@/types/assistant';

type ChatMode = 'chat' | 'voice';

interface ChatWidgetContextType {
  isOpen: boolean;
  mode: ChatMode;
  sessionId: string | null;
  openWidget: () => void;
  closeWidget: () => void;
  toggleWidget: () => void;
  setMode: (mode: ChatMode) => void;
  openVoiceMode: () => void;
  setSessionId: (sessionId: string | null) => void;
  subscribeToMessages: (callback: (message: Message) => void) => () => void;
  notifyMessage: (message: Message) => void;
  // Subscribe to session changes (for clearing messages on new conversation)
  subscribeToSessionChange: (callback: (sessionId: string | null, prevSessionId: string | null) => void) => () => void;
}

const ChatWidgetContext = createContext<ChatWidgetContextType | undefined>(undefined);

export function ChatWidgetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>('chat');
  const [sessionId, setSessionIdState] = useState<string | null>(null);
  const messageListenersRef = useRef<Set<(message: Message) => void>>(new Set());
  const sessionChangeListenersRef = useRef<Set<(sessionId: string | null, prevSessionId: string | null) => void>>(new Set());

  // CRITICAL: Keep a ref for synchronous access to sessionId
  const sessionIdRef = useRef<string | null>(null);

  // Custom setSessionId that updates both ref (sync) and state (async)
  const setSessionId = useCallback((newSessionId: string | null) => {
    const prevSessionId = sessionIdRef.current;
    // Update ref FIRST (synchronous)
    sessionIdRef.current = newSessionId;
    // Then update state (async)
    setSessionIdState(newSessionId);

    // Notify session change listeners
    sessionChangeListenersRef.current.forEach(callback => {
      try {
        callback(newSessionId, prevSessionId);
      } catch (error) {
        console.error('Error in session change listener:', error);
      }
    });
  }, []);

  const openWidget = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeWidget = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleWidget = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const openVoiceMode = useCallback(() => {
    setMode('voice');
    setIsOpen(true);
  }, []);

  const subscribeToMessages = useCallback((callback: (message: Message) => void) => {
    messageListenersRef.current.add(callback);
    return () => {
      messageListenersRef.current.delete(callback);
    };
  }, []);

  const notifyMessage = useCallback((message: Message) => {
    messageListenersRef.current.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
  }, []);

  const subscribeToSessionChange = useCallback((callback: (sessionId: string | null, prevSessionId: string | null) => void) => {
    sessionChangeListenersRef.current.add(callback);
    return () => {
      sessionChangeListenersRef.current.delete(callback);
    };
  }, []);

  const value: ChatWidgetContextType = {
    isOpen,
    mode,
    sessionId,
    openWidget,
    closeWidget,
    toggleWidget,
    setMode,
    openVoiceMode,
    setSessionId,
    subscribeToMessages,
    notifyMessage,
    subscribeToSessionChange,
  };

  return (
    <ChatWidgetContext.Provider value={value}>
      {children}
    </ChatWidgetContext.Provider>
  );
}

export function useChatWidget() {
  const context = useContext(ChatWidgetContext);
  if (context === undefined) {
    throw new Error('useChatWidget must be used within a ChatWidgetProvider');
  }
  return context;
}
