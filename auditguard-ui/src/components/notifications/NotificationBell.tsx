'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type NotificationCategory = 'ai' | 'workspace' | 'system';
type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

interface NotificationAction {
  id: string;
  label: string;
  action: string;
  style: 'primary' | 'secondary' | 'danger';
}

interface Notification {
  id: string;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  read: boolean;
  archived: boolean;
  action_url: string;
  actions: NotificationAction[];
  created_at: number;
  workspace_id?: string;
  ai_session_id?: string;
}

interface NotificationCount {
  total: number;
  unread: number;
  by_category: {
    ai: number;
    workspace: number;
    system: number;
  };
  by_priority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

const NOTIFICATION_TYPE_ICONS: Record<string, string> = {
  // Workspace types
  issue_assigned: '📋',
  comment: '💬',
  mention: '@',
  status_change: '🔄',
  workspace_invite: '✉️',
  due_date_reminder: '⏰',
  overdue_alert: '⚠️',
  // AI types
  ai_compliance_alert: '🚨',
  ai_recommendation: '💡',
  ai_issue_detected: '🔍',
  ai_report_ready: '📊',
  ai_insight: '✨',
};

const PRIORITY_COLORS = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  low: 'text-blue-600 bg-blue-50 border-blue-200',
};

export function NotificationBell() {
  const [counts, setCounts] = useState<NotificationCount>({
    total: 0,
    unread: 0,
    by_category: { ai: 0, workspace: 0, system: 0 },
    by_priority: { critical: 0, high: 0, medium: 0, low: 0 }
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | NotificationCategory>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notification counts
  const fetchCounts = async () => {
    try {
      const response = await api.get('/api/notifications/count');
      setCounts(response);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Notifications count not available');
      }
    }
  };

  // Fetch notifications with filters
  const fetchNotifications = async (category?: NotificationCategory) => {
    setLoading(true);
    try {
      const filter: any = {
        limit: 10,
        offset: 0
      };

      if (category) {
        filter.category = [category];
      }

      const response = await api.post('/api/notifications', { filter });
      setNotifications(response.notifications || []);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Notifications list not available');
      }
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // Poll for updates every 30 seconds
  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load notifications when dropdown opens or category changes
  useEffect(() => {
    if (isOpen) {
      const category = activeCategory === 'all' ? undefined : activeCategory;
      fetchNotifications(category);
    }
  }, [isOpen, activeCategory]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/api/notifications/${notificationId}/read`, {});
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setCounts(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1)
      }));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to mark notification as read');
      }
    }
  };

  // Mark all as read (filtered by category)
  const markAllAsRead = async () => {
    try {
      const category = activeCategory === 'all' ? undefined : activeCategory;
      await api.post('/api/notifications/read-all', { category });
      
      // Refresh notifications and counts
      fetchNotifications(category);
      fetchCounts();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to mark all as read');
      }
    }
  };

  // Execute notification action
  const handleAction = async (notification: Notification, action: NotificationAction, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await api.post(`/api/notifications/${notification.id}/action`, { action: action.action });
      
      // Remove notification from list if dismissed/archived
      if (['dismiss', 'archive'].includes(action.action)) {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
        if (!notification.read) {
          setCounts(prev => ({
            ...prev,
            unread: Math.max(0, prev.unread - 1)
          }));
        }
      }
      
      // Navigate if there's a redirect URL
      if (response.redirect_url) {
        window.location.href = response.redirect_url;
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to execute action:', error);
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const filteredCount = activeCategory === 'all' 
    ? counts.unread 
    : counts.by_category[activeCategory];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {counts.unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
            {counts.unread > 99 ? '99+' : counts.unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[440px] bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          {/* Header with Tabs */}
          <div className="border-b border-gray-200">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {filteredCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex px-2 pb-2">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  activeCategory === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All {counts.unread > 0 && `(${counts.unread})`}
              </button>
              <button
                onClick={() => setActiveCategory('ai')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ml-1 ${
                  activeCategory === 'ai'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🤖 AI {counts.by_category.ai > 0 && `(${counts.by_category.ai})`}
              </button>
              <button
                onClick={() => setActiveCategory('workspace')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ml-1 ${
                  activeCategory === 'workspace'
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                📁 Workspace {counts.by_category.workspace > 0 && `(${counts.by_category.workspace})`}
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="text-3xl mb-2">
                  {activeCategory === 'ai' ? '🤖' : activeCategory === 'workspace' ? '📁' : '🔔'}
                </div>
                <p className="text-sm">
                  No {activeCategory !== 'all' ? activeCategory : ''} notifications
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition ${
                    !notification.read ? 'bg-blue-50' : ''
                  } ${notification.priority === 'critical' ? 'border-l-4 border-l-red-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="text-xl flex-shrink-0 mt-0.5">
                      {NOTIFICATION_TYPE_ICONS[notification.type] || '📬'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                          <p
                            className={`text-sm text-gray-900 line-clamp-2 ${
                              !notification.read ? 'font-semibold' : ''
                            }`}
                          >
                            {notification.title}
                          </p>
                          {notification.priority === 'critical' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mt-1">
                              Critical
                            </span>
                          )}
                          {notification.priority === 'high' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                              High
                            </span>
                          )}
                        </div>
                        {!notification.read && (
                          <span className="flex-shrink-0 h-2 w-2 bg-blue-600 rounded-full mt-1" />
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {notification.message}
                      </p>

                      {/* Actions */}
                      {notification.actions && notification.actions.length > 0 && (
                        <div className="flex gap-2 mb-2">
                          {notification.actions.map((action) => (
                            <button
                              key={action.id}
                              onClick={(e) => handleAction(notification, action, e)}
                              className={`text-xs px-2 py-1 rounded font-medium transition ${
                                action.style === 'primary'
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : action.style === 'danger'
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(notification.created_at)}
                        </p>
                        {!notification.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200">
            <Link
              href="/notifications"
              className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => setIsOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
