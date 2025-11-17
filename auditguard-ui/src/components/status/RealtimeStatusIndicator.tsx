'use client';

import { useState, useEffect } from 'react';

interface RealtimeStatusIndicatorProps {
  position?: 'fixed' | 'inline';
}

export function RealtimeStatusIndicator({ position = 'fixed' }: RealtimeStatusIndicatorProps) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [showDetails, setShowDetails] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastConnectedAt, setLastConnectedAt] = useState<number | null>(null);

  useEffect(() => {
    // Simulate WebSocket connection status
    // In production, this would be connected to the actual realtime service
    const checkConnection = () => {
      // Check if WebSocket is available and connected
      // This is a placeholder - actual implementation would check window.realtimeSocket or similar
      const isConnected = typeof window !== 'undefined' && Math.random() > 0.1; // Simulate 90% uptime

      if (isConnected) {
        setStatus('connected');
        if (!lastConnectedAt) {
          setLastConnectedAt(Date.now());
        }
        setRetryCount(0);
      } else {
        setStatus('disconnected');
        setRetryCount((prev) => prev + 1);
      }
    };

    // Check connection immediately
    checkConnection();

    // Check connection every 5 seconds
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, [lastConnectedAt]);

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
