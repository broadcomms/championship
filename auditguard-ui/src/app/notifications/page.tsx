'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import NotificationDetailModal from '@/components/notifications/NotificationDetailModal';

interface Notification {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  read: boolean;
  archived: boolean;
  action_url: string;
  actions?: Array<{
    id: string;
    label: string;
    action: string;
    style: 'primary' | 'secondary' | 'danger';
  }>;
  metadata?: Record<string, any>;
  created_at: number;
  read_at?: number;
}

const NOTIFICATION_TYPE_ICONS: Record<string, string> = {
  issue_assigned: '📋',
  comment: '💬',
  mention: '@',
  status_change: '🔄',
  workspace_invite: '✉️',
  due_date_reminder: '⏰',
  overdue_alert: '⚠️',
};

const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  issue_assigned: 'text-blue-600',
  comment: 'text-green-600',
  mention: 'text-purple-600',
  status_change: 'text-orange-600',
  workspace_invite: 'text-indigo-600',
  due_date_reminder: 'text-yellow-600',
  overdue_alert: 'text-red-600',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const accountId = user?.userId;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Load notifications
  const loadNotifications = useCallback(async (reset: boolean = false) => {
    try {
      const offset = reset ? 0 : notifications.length;
      const unreadOnly = filter === 'unread';

      // Use POST to match backend API
      const response = await api.post('/api/notifications', {
        filter: {
          unreadOnly,
          limit: 20,
          offset
        }
      });
      const newNotifications = response.notifications || [];

      if (reset) {
        setNotifications(Array.isArray(newNotifications) ? newNotifications : []);
      } else {
        setNotifications(prev => [...prev, ...(Array.isArray(newNotifications) ? newNotifications : [])]);
      }

      setHasMore((Array.isArray(newNotifications) ? newNotifications : []).length === 20);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, notifications.length]);

  // Initial load
  useEffect(() => {
    setNotifications([]);
    setLoading(true);
    loadNotifications(true);
  }, [filter]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadNotifications();
        }
      },
      { threshold: 1.0 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadNotifications]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/api/notifications/${notificationId}/read`, {});

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true, read_at: Date.now() } : n
        )
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      // Fixed: Use correct endpoint POST /api/notifications/read-all
      await api.post('/api/notifications/read-all', { 
        category: filter === 'all' ? undefined : 'system' 
      });

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, read_at: Date.now() }))
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <AccountLayout accountId={accountId}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h1>
          <p className="text-gray-600">Stay updated with your compliance workflow</p>
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unread
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={notifications.every(n => n.read)}
          >
            Mark all as read
          </Button>
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          {loading && notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">🔔</div>
              <p className="font-medium">No notifications yet</p>
              <p className="text-sm mt-2">
                You'll see updates about issues, comments, and more here
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border rounded-lg transition cursor-pointer ${
                  notification.read
                    ? 'bg-white border-gray-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
                onClick={() => {
                  // Open detail modal instead of direct navigation
                  setSelectedNotification(notification);
                  if (!notification.read) markAsRead(notification.id);
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`text-2xl ${
                      NOTIFICATION_TYPE_COLORS[notification.type]
                    }`}
                  >
                    {NOTIFICATION_TYPE_ICONS[notification.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3
                        className={`font-medium text-gray-900 ${
                          !notification.read ? 'font-semibold' : ''
                        }`}
                      >
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <span className="flex-shrink-0 h-2 w-2 bg-blue-600 rounded-full mt-1.5" />
                      )}
                    </div>

                    <p className="text-gray-700 text-sm mb-2">
                      {notification.message}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{formatRelativeTime(notification.created_at)}</span>
                      {notification.metadata?.workspace_name && (
                        <>
                          <span>•</span>
                          <span>{notification.metadata.workspace_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Infinite scroll trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="py-4 text-center text-gray-500">
              {loading && <span>Loading more...</span>}
            </div>
          )}
        </div>
      </div>

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
          onUpdate={(updated) => {
            setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
          }}
          onDelete={(id) => {
            setNotifications(prev => prev.filter(n => n.id !== id));
            setSelectedNotification(null);
          }}
        />
      )}
    </AccountLayout>
  );
}
