'use client';

import { formatRelativeTime, getRiskBadgeClass } from '@/lib/analytics/formatting';

interface ActivityItem {
  type: 'document' | 'check' | 'issue' | 'resolution';
  title: string;
  description?: string;
  timestamp: string;
  severity?: string;
  user?: string;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  className?: string;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'document':
      return '📄';
    case 'check':
      return '✓';
    case 'issue':
      return '⚠️';
    case 'resolution':
      return '✅';
    default:
      return '•';
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'document':
      return 'bg-blue-100 text-blue-600';
    case 'check':
      return 'bg-purple-100 text-purple-600';
    case 'issue':
      return 'bg-orange-100 text-orange-600';
    case 'resolution':
      return 'bg-green-100 text-green-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export function ActivityTimeline({ activities, className = '' }: ActivityTimelineProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {activities.map((activity, index) => (
          <div key={index} className="flex gap-4">
            {/* Timeline dot and line */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${getActivityColor(activity.type)}`}>
                {getActivityIcon(activity.type)}
              </div>
              {index < activities.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 my-1"></div>
              )}
            </div>

            {/* Activity content */}
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">{activity.title}</div>
                  {activity.description && (
                    <div className="text-sm text-gray-600 mt-1">{activity.description}</div>
                  )}
                  {activity.user && (
                    <div className="text-xs text-gray-500 mt-1">by {activity.user}</div>
                  )}
                </div>
                {activity.severity && (
                  <span className={getRiskBadgeClass(activity.severity)}>
                    {activity.severity}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {formatRelativeTime(activity.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
