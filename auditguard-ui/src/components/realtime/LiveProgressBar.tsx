import React from 'react';

interface LiveProgressBarProps {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  checkId?: string;
  className?: string;
}

export function LiveProgressBar({ status, progress = 0, checkId, className = '' }: LiveProgressBarProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'running':
        return {
          color: 'bg-blue-500',
          text: 'Running...',
          animated: true,
          showProgress: true,
        };
      case 'completed':
        return {
          color: 'bg-green-500',
          text: 'Completed',
          animated: false,
          showProgress: false,
        };
      case 'failed':
        return {
          color: 'bg-red-500',
          text: 'Failed',
          animated: false,
          showProgress: false,
        };
      case 'pending':
      default:
        return {
          color: 'bg-gray-300',
          text: 'Pending',
          animated: false,
          showProgress: false,
        };
    }
  };

  const config = getStatusConfig();
  const displayProgress = config.showProgress ? progress : (status === 'completed' ? 100 : 0);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{config.text}</span>
        {config.showProgress && (
          <span className="text-gray-500 dark:text-gray-500 font-medium">
            {Math.round(displayProgress)}%
          </span>
        )}
      </div>
      
      <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${config.color} transition-all duration-500 ease-out ${
            config.animated ? 'animate-pulse' : ''
          }`}
          style={{ width: `${displayProgress}%` }}
        />
        
        {/* Animated shimmer effect for running state */}
        {config.animated && (
          <div className="absolute inset-0 flex">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        )}
      </div>
      
      {checkId && (
        <div className="text-xs text-gray-400 dark:text-gray-600 font-mono">
          {checkId}
        </div>
      )}
    </div>
  );
}
