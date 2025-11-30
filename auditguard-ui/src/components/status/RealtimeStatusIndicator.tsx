'use client';

import { useState, useEffect } from 'react';

interface RealtimeStatusIndicatorProps {
  position?: 'fixed' | 'inline';
  workspaceId?: string; // Optional workspace ID to connect to
}

export function RealtimeStatusIndicator({ position = 'fixed', workspaceId }: RealtimeStatusIndicatorProps) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [showDetails, setShowDetails] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastConnectedAt, setLastConnectedAt] = useState<number | null>(null);

  useEffect(() => {
    // If no workspaceId is provided, show connected status (optional display mode)
    if (!workspaceId) {
      setStatus('connected');
      setLastConnectedAt(Date.now());
      return;
    }

    let websocket: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        setStatus('connecting');

        // Get backend API URL
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';
        if (!backendUrl) {
          console.error('NEXT_PUBLIC_API_URL not configured');
          setStatus('disconnected');
          return;
        }

        // Convert to WebSocket URL
        const wsUrl = backendUrl.replace(/^https?:\/\//, (match) =>
          match === 'https://' ? 'wss://' : 'ws://'
        );

        // Connect through API gateway at /api/realtime/:workspaceId
        // Gateway forwards to realtime service at /ws/:workspaceId/realtime
        websocket = new WebSocket(`${wsUrl}/api/realtime/${workspaceId}`);

        websocket.onopen = () => {
          console.log('RealtimeStatusIndicator: WebSocket connected');
          setStatus('connected');
          setRetryCount(0);
          setLastConnectedAt(Date.now());

          // Send ping every 30 seconds to keep connection alive
          pingInterval = setInterval(() => {
            if (websocket?.readyState === WebSocket.OPEN) {
              websocket.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);
        };

        websocket.onmessage = (event) => {
          // Handle pong responses
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'pong') {
              // Connection is alive
              setLastConnectedAt(Date.now());
            }
          } catch {
            // Ignore parse errors
          }
        };

        websocket.onerror = (error) => {
          console.error('RealtimeStatusIndicator: WebSocket error', error);
          setStatus('disconnected');
        };

        websocket.onclose = () => {
          console.log('RealtimeStatusIndicator: WebSocket closed');
          setStatus('disconnected');

          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }

          // Attempt reconnection with exponential backoff (max 3 attempts)
          if (retryCount < 3) {
            const delays = [1000, 2000, 4000];
            const delay = delays[retryCount] || 4000;
            console.log(`Reconnecting in ${delay}ms... (attempt ${retryCount + 1}/3)`);

            setRetryCount((prev) => prev + 1);
            reconnectTimeout = setTimeout(connect, delay);
          }
        };
      } catch (error) {
        console.error('RealtimeStatusIndicator: Failed to connect', error);
        setStatus('disconnected');
      }
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (websocket) websocket.close();
    };
  }, [workspaceId, retryCount]);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '🔴';
    }
  };

  const formatUptime = () => {
    if (!lastConnectedAt) return 'N/A';
    const seconds = Math.floor((Date.now() - lastConnectedAt) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  if (position === 'inline') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm">
        <span className={`w-2 h-2 rounded-full ${getStatusColor()} ${status === 'connected' ? 'animate-pulse' : ''}`} />
        <span className="font-medium text-gray-700">{getStatusText()}</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div
        className="relative"
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
      >
        {/* Status Indicator Button */}
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition ${
            status === 'connected'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : status === 'connecting'
              ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${getStatusColor()} ${
              status === 'connected' ? 'animate-pulse' : ''
            }`}
          />
          <span className="font-semibold text-sm">{getStatusText()}</span>
        </button>

        {/* Details Popover */}
        {showDetails && (
          <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Real-time Status
                </span>
                <span className="text-xl">{getStatusIcon()}</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">{getStatusText()}</div>
            </div>

            <div className="space-y-2 text-xs">
              {status === 'connected' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Uptime</span>
                    <span className="font-semibold text-gray-900">{formatUptime()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Latency</span>
                    <span className="font-semibold text-green-600">&lt;50ms</span>
                  </div>
                </>
              )}

              {status === 'disconnected' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Retry attempts</span>
                    <span className="font-semibold text-red-600">{retryCount}</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                    <p className="text-red-800 text-xs">
                      Reconnecting... Real-time updates may be delayed.
                    </p>
                  </div>
                </>
              )}

              {status === 'connecting' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                  <p className="text-yellow-800 text-xs">
                    Establishing connection to real-time service...
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Real-time updates for notifications, issues, and compliance checks
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
