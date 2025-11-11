import React from 'react';
import { WebSocketStatus } from '@/hooks/useWebSocket';

interface ConnectionStatusProps {
  status: WebSocketStatus;
  onReconnect?: () => void;
}

export function ConnectionStatus({ status, onReconnect }: ConnectionStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-500',
          text: 'Connected',
          icon: '✓',
          showReconnect: false,
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          text: 'Connecting...',
          icon: '⟳',
          showReconnect: false,
        };
      case 'disconnected':
        return {
          color: 'bg-gray-500',
          text: 'Disconnected',
          icon: '✕',
          showReconnect: true,
        };
      case 'error':
        return {
          color: 'bg-red-500',
          text: 'Connection Error',
          icon: '!',
          showReconnect: true,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${config.color} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
        <span className="text-gray-600 dark:text-gray-400">{config.text}</span>
      </div>
      
      {config.showReconnect && onReconnect && (
        <button
          onClick={onReconnect}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 
                     underline text-xs"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
