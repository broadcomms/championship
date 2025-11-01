'use client';

import { ProcessingStatus } from '@/types';
import { cn } from '@/lib/utils';

interface ProcessingIndicatorProps {
  status: ProcessingStatus;
  className?: string;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800',
    icon: '⏳',
    animated: false,
  },
  processing: {
    label: 'Processing',
    className: 'bg-blue-100 text-blue-800',
    icon: '⚙️',
    animated: true,
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800',
    icon: '✓',
    animated: false,
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800',
    icon: '✗',
    animated: false,
  },
};

export function ProcessingIndicator({ status, className }: ProcessingIndicatorProps) {
  const config = statusConfig[status] || {
    label: 'Unknown',
    className: 'bg-gray-100 text-gray-800',
    icon: '?',
    animated: false,
  };

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', config.className, className)}>
      <span className={config.animated ? 'animate-spin' : ''}>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
