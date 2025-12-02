'use client';

import { ReactNode } from 'react';
import { getScoreClass } from '@/lib/analytics/formatting';

interface ScoreCardProps {
  title: string;
  score: number | string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  colorClass?: string;
}

export function ScoreCard({
  title,
  score,
  subtitle,
  icon,
  trend,
  className = '',
  colorClass,
}: ScoreCardProps) {
  const scoreClass = typeof score === 'number' && !colorClass ? getScoreClass(score) : colorClass;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 text-sm font-medium">{title}</span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      
      <div className="flex items-baseline gap-2">
        <div className={`text-3xl font-bold ${scoreClass || 'text-gray-900'}`}>
          {typeof score === 'number' && score % 1 === 0 ? score : score}
        </div>
        
        {trend && (
          <div className={`flex items-center text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      
      {subtitle && (
        <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}
