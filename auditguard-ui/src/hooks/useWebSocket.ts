import { useEffect, useRef, useState, useCallback } from 'react';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: Record<string, unknown>;
}

export interface UseWebSocketOptions {
  workspaceId: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectAttempts?: number;
  reconnectDelays?: number[]; // Exponential backoff delays in ms
}

export interface UseWebSocketReturn {
  status: WebSocketStatus;
  send: (message: WebSocketMessage) => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  reconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    workspaceId,
    onMessage,
    onError,
    onConnect,
    onDisconnect,
    reconnectAttempts = 3, // Match the number of backoff delays
    reconnectDelays = [1000, 2000, 4000], // Exponential backoff: 1s, 2s, 4s
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const subscribedChannelsRef = useRef<Set<string>>(new Set());

  // Build WebSocket URL - connect through API gateway
  const getWebSocketUrl = useCallback(() => {
    // Get backend API URL from environment
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';

    if (!backendUrl) {
      console.error('NEXT_PUBLIC_API_URL not configured');
      return '';
    }

    // Convert HTTP(S) URL to WebSocket URL
    const wsUrl = backendUrl.replace(/^https?:\/\//, (match) =>
      match === 'https://' ? 'wss://' : 'ws://'
    );

    // API Gateway expects: /api/realtime/:workspaceId
    // It will forward to realtime service at /ws/:workspaceId/realtime
    return `${wsUrl}/api/realtime/${workspaceId}`;
  }, [workspaceId]);

  // Send message through WebSocket
  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }, []);

  // Subscribe to a channel
  const subscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.add(channel);
    send({ type: 'subscribe', channel });
  }, [send]);

  // Unsubscribe from a channel
  const unsubscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.delete(channel);
    send({ type: 'unsubscribe', channel });
  }, [send]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    try {
      setStatus('connecting');
      const ws = new WebSocket(getWebSocketUrl());

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus('connected');
        reconnectCountRef.current = 0;
        
        // Re-subscribe to channels
        subscribedChannelsRef.current.forEach(channel => {
          ws.send(JSON.stringify({ type: 'subscribe', channel }));
        });

        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle pong messages internally
          if (message.type === 'pong') {
            return;
          }

          onMessage?.(message);
        } catch (error: unknown) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setStatus('error');
        onError?.(event);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setStatus('disconnected');
        wsRef.current = null;
        onDisconnect?.();

        // Attempt reconnection with exponential backoff
        if (reconnectCountRef.current < reconnectAttempts) {
          const attemptIndex = reconnectCountRef.current;
          const delay = reconnectDelays[attemptIndex] || reconnectDelays[reconnectDelays.length - 1];
          reconnectCountRef.current++;

          console.log(
            `Reconnecting in ${delay}ms... (attempt ${reconnectCountRef.current}/${reconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.warn('Max reconnection attempts reached');
        }
      };

      wsRef.current = ws;

      // Send periodic ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Every 30 seconds

      // Clean up ping interval when connection closes
      ws.addEventListener('close', () => {
        clearInterval(pingInterval);
      });

    } catch (error: unknown) {
      console.error('Failed to connect WebSocket:', error);
      setStatus('error');
    }
  }, [getWebSocketUrl, onConnect, onMessage, onError, onDisconnect, reconnectAttempts, reconnectDelays]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectCountRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    status,
    send,
    subscribe,
    unsubscribe,
    reconnect,
  };
}
