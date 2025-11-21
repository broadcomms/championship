'use client';

import React, { createContext, useContext, useState, useCallback, useSyncExternalStore } from 'react';
import type { Message } from '@/types/assistant';

type ChatMode = 'chat' | 'voice';

/**
 * ARCHITECTURE NOTES:
 *
 * This context manages TWO separate concerns:
 * 1. Widget UI state (open/closed, mode) - local to widget
 * 2. Session state (sessionId, messages) - shared between main chat and widget
 *
 * For session state, we use a SYNCHRONOUS store pattern to avoid race conditions.
 * The sessionId is stored in a ref and exposed via useSyncExternalStore for
 * guaranteed synchronous reads across all components.
 */

// Synchronous session store - single source of truth
interface SessionStore {
  sessionId: string | null;
  workspaceId: string | null;
}

let sessionStore: SessionStore = {
  sessionId: null,
  workspaceId: null,
};

const sessionListeners = new Set<() => void>();

function notifySessionListeners() {
  sessionListeners.forEach(listener => listener());
}

// Synchronous getters
function getSessionSnapshot(): SessionStore {
  return sessionStore;
}

function getSessionServerSnapshot(): SessionStore {
  return { sessionId: null, workspaceId: null };
}

function subscribeToSession(callback: () => void): () => void {
  sessionListeners.add(callback);
  return () => sessionListeners.delete(callback);
}

// Synchronous setter - updates IMMEDIATELY
function setSessionStore(sessionId: string | null, workspaceId?: string | null) {
  const prevSessionId = sessionStore.sessionId;
  sessionStore = {
    sessionId,
    workspaceId: workspaceId ?? sessionStore.workspaceId,
  };

  // Notify all listeners synchronously
  notifySessionListeners();

  // Also notify session change callbacks
  sessionChangeCallbacks.forEach(callback => {
    try {
      callback(sessionId, prevSessionId);
    } catch (error) {
      console.error('Error in session change callback:', error);
    }
  });
}

// Session change callbacks (for components that need to react to changes)
const sessionChangeCallbacks = new Set<(newSessionId: string | null, prevSessionId: string | null) => void>();

// Message broadcasting
interface BroadcastMessage extends Message {
  sourceSessionId: string | null; // The sessionId this message belongs to
}

const messageListeners = new Set<(message: BroadcastMessage) => void>();

function broadcastMessage(message: Message, sourceSessionId: string | null) {
  const broadcastMsg: BroadcastMessage = { ...message, sourceSessionId };
  messageListeners.forEach(listener => {
    try {
      listener(broadcastMsg);
    } catch (error) {
      console.error('Error in message listener:', error);
    }
  });
}

interface ChatWidgetContextType {
  // Widget UI state
  isOpen: boolean;
  mode: ChatMode;
  openWidget: () => void;
  closeWidget: () => void;
  toggleWidget: () => void;
  setMode: (mode: ChatMode) => void;
  openVoiceMode: () => void;

  // Session management - SYNCHRONOUS
  getSessionId: () => string | null;
  setSessionId: (sessionId: string | null) => void;

  // For backward compatibility (but should use getSessionId for reads)
  sessionId: string | null;

  // Message broadcasting
  subscribeToMessages: (callback: (message: BroadcastMessage) => void) => () => void;
  notifyMessage: (message: Message) => void;

  // Session change subscription
  subscribeToSessionChange: (callback: (sessionId: string | null, prevSessionId: string | null) => void) => () => void;

  // Clear all state (for new conversation)
  clearSession: () => void;
}

const ChatWidgetContext = createContext<ChatWidgetContextType | undefined>(undefined);

export function ChatWidgetProvider({ children }: { children: React.ReactNode }) {
  // Widget UI state (local, can be async)
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>('chat');

  // Use synchronous external store for sessionId
  const sessionSnapshot = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    getSessionServerSnapshot
  );

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

  // SYNCHRONOUS session getter
  const getSessionId = useCallback((): string | null => {
    return sessionStore.sessionId;
  }, []);

  // SYNCHRONOUS session setter
  const setSessionId = useCallback((newSessionId: string | null) => {
    console.log('🔄 setSessionId called:', newSessionId, 'prev:', sessionStore.sessionId);
    setSessionStore(newSessionId);
  }, []);

  // Subscribe to messages
  const subscribeToMessages = useCallback((callback: (message: BroadcastMessage) => void) => {
    messageListeners.add(callback);
    return () => {
      messageListeners.delete(callback);
    };
  }, []);

  // Broadcast message with sessionId context
  const notifyMessage = useCallback((message: Message) => {
    const currentSessionId = sessionStore.sessionId;
    console.log('📢 Broadcasting message for session:', currentSessionId);
    broadcastMessage(message, currentSessionId);
  }, []);

  // Subscribe to session changes
  const subscribeToSessionChange = useCallback((callback: (sessionId: string | null, prevSessionId: string | null) => void) => {
    sessionChangeCallbacks.add(callback);
    return () => {
      sessionChangeCallbacks.delete(callback);
    };
  }, []);

  // Clear all session state
  const clearSession = useCallback(() => {
    console.log('🧹 Clearing session');
    setSessionStore(null);
  }, []);

  const value: ChatWidgetContextType = {
    isOpen,
    mode,
    openWidget,
    closeWidget,
    toggleWidget,
    setMode,
    openVoiceMode,
    getSessionId,
    setSessionId,
    sessionId: sessionSnapshot.sessionId, // For backward compatibility
    subscribeToMessages,
    notifyMessage,
    subscribeToSessionChange,
    clearSession,
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

// Export types for consumers
export type { BroadcastMessage };
