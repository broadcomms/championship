'use client';

import { DocumentCategory } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  category: DocumentCategory | null;
  className?: string;
}

const categoryConfig = {
  policy: {
    label: 'Policy',
    className: 'bg-blue-100 text-blue-800',
  },
  procedure: {
    label: 'Procedure',
    className: 'bg-green-100 text-green-800',
  },
  evidence: {
    label: 'Evidence',
    className: 'bg-purple-100 text-purple-800',
  },
  other: {
    label: 'Other',
    className: 'bg-gray-100 text-gray-800',
  },
};

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  if (!category) {
    return (
      <span className={cn('inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600', className)}>
        Uncategorized
      </span>
    );
  }

  const config = categoryConfig[category];

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-1 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}
