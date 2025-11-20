'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  X,
  Check,
  AlertTriangle,
  Info,
  CheckCircle,
  Archive,
  Trash2,
  Filter,
  Settings,
  ChevronDown,
} from 'lucide-react';
import {
  Notification,
  NotificationFilter,
  NotificationStatus,
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NOTIFICATION_ICONS,
  NOTIFICATION_COLORS,
} from '@/types/notification';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  workspaceId: string;
  userId?: string;
  onNotificationAction?: (notificationId: string, action: string) => void;
}

export default function NotificationCenter({
  workspaceId,
  userId,
  onNotificationAction,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>({
    status: ['unread', 'read'],
  });

  // Load notifications
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, filter, page]);

  // Load unread count on mount
  useEffect(() => {
    loadUnreadCount();
  }, [workspaceId]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/assistant/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          filters: filter,
          page,
          limit: 20,
          sortBy: 'timestamp',
          sortOrder: 'desc',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (page === 1) {
          setNotifications(data.notifications);
        } else {
          setNotifications((prev) => [...prev, ...data.notifications]);
        }
        setUnreadCount(data.unreadCount);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await fetch(`/api/assistant/notifications/count?workspaceId=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/assistant/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, status: 'read' as NotificationStatus } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`/api/assistant/notifications/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, status: 'read' as NotificationStatus }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const dismissNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/assistant/notifications/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      }
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const archiveNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/assistant/notifications/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      }
    } catch (error) {
      console.error('Failed to archive notification:', error);
    }
  };

  const handleAction = (notificationId: string, action: string) => {
    markAsRead(notificationId);
    if (onNotificationAction) {
      onNotificationAction(notificationId, action);
    }
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 max-h-[600px] bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                title="Filters"
              >
                <Filter className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {(['unread', 'read'] as NotificationStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilter((prev) => ({
                          ...prev,
                          status: prev.status?.includes(status)
                            ? prev.status.filter((s) => s !== status)
                            : [...(prev.status || []), status],
                        }));
                        setPage(1);
                      }}
                      className={`px-2 py-1 text-xs rounded ${
                        filter.status?.includes(status)
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-white text-gray-600 border border-gray-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {unreadCount > 0 && (
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Mark all as read
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <Bell className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => markAsRead(notification.id)}
                    onDismiss={() => dismissNotification(notification.id)}
                    onArchive={() => archiveNotification(notification.id)}
                    onAction={(action) => handleAction(notification.id, action)}
                  />
                ))}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="w-full py-3 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    {isLoading ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Notification Item Component
function NotificationItem({
  notification,
  onRead,
  onDismiss,
  onArchive,
  onAction,
}: {
  notification: Notification;
  onRead: () => void;
  onDismiss: () => void;
  onArchive: () => void;
  onAction: (action: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  const typeIcon = {
    critical: <AlertTriangle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
  }[notification.type];

  const bgColor = {
    critical: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
  }[notification.type];

  const textColor = NOTIFICATION_COLORS[notification.type];

  return (
    <div
      className={`relative p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors ${
        notification.status === 'unread' ? 'bg-blue-50/30' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`}>
          <div style={{ color: textColor }}>{typeIcon}</div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-900">{notification.title}</h4>
            {notification.status === 'unread' && (
              <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full"></div>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
          <p className="text-xs text-gray-500">
            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
          </p>

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {notification.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onAction(action.action)}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    action.variant === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : action.variant === 'danger'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {showActions && (
          <div className="flex-shrink-0 flex items-center gap-1">
            {notification.status === 'unread' && (
              <button
                onClick={onRead}
                className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                title="Mark as read"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onArchive}
              className="p-1 text-gray-600 hover:bg-gray-200 rounded"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
            {notification.dismissible && (
              <button
                onClick={onDismiss}
                className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
