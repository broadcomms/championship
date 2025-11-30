'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Archive, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

interface NotificationAction {
  id: string;
  label: string;
  action: string;
  style: 'primary' | 'secondary' | 'danger';
}

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
  actions?: NotificationAction[];
  metadata?: Record<string, unknown>;
  created_at: number;
  read_at?: number;
}

interface NotificationDetailModalProps {
  notification: Notification;
  onClose: () => void;
  onUpdate: (updatedNotification: Notification) => void;
  onDelete: (notificationId: string) => void;
}

export default function NotificationDetailModal({
  notification,
  onClose,
  onUpdate,
  onDelete,
}: NotificationDetailModalProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const markAsRead = useCallback(async () => {
    try {
      await api.patch(`/api/notifications/${notification.id}/read`, {});
      onUpdate({ ...notification, read: true, read_at: Date.now() });
    } catch (error: unknown) {
      console.error('Failed to mark as read:', error);
    }
  }, [notification, onUpdate]);

  // Mark as read when opened
  useEffect(() => {
    if (!notification.read) {
      markAsRead();
    }
  }, [markAsRead, notification.read]);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await api.patch(`/api/notifications/${notification.id}/archive`, {});
      onUpdate({ ...notification, archived: true });
      onClose();
    } catch (error: unknown) {
      console.error('Failed to archive:', error);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    setIsDeleting(true);
    try {
      await api.delete(`/api/notifications/${notification.id}`);
      onDelete(notification.id);
      onClose();
    } catch (error: unknown) {
      console.error('Failed to delete:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleActionClick = async (action: NotificationAction) => {
    try {
      await api.post(`/api/notifications/${notification.id}/action`, {
        action: action.action,
      });

      if (action.action === 'dismiss') {
        onClose();
      } else if (action.action === 'view' || action.action === 'upgrade' || action.action === 'view_plans') {
        window.location.href = notification.action_url;
      }
    } catch (error: unknown) {
      console.error('Failed to execute action:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const priorityColors = {
    low: 'text-gray-600 bg-gray-100',
    medium: 'text-blue-600 bg-blue-100',
    high: 'text-orange-600 bg-orange-100',
    critical: 'text-red-600 bg-red-100',
  };

  const categoryColors = {
    system: 'text-purple-600 bg-purple-100',
    workspace: 'text-green-600 bg-green-100',
    ai: 'text-indigo-600 bg-indigo-100',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {notification.title}
            </h2>
            {!notification.read && (
              <span className="h-2 w-2 bg-blue-600 rounded-full" />
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Meta Info */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                categoryColors[notification.category as keyof typeof categoryColors]
              }`}
            >
              {notification.category}
            </span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                priorityColors[notification.priority as keyof typeof priorityColors]
              }`}
            >
              {notification.priority}
            </span>
            <span className="text-xs text-gray-500">
              {formatDate(notification.created_at)}
            </span>
          </div>

          {/* Message */}
          <p className="text-gray-700 text-base leading-relaxed mb-6">
            {notification.message}
          </p>

          {/* Metadata */}
          {notification.metadata && Object.keys(notification.metadata).length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Additional Information
              </h3>
              <dl className="space-y-2">
                {Object.entries(notification.metadata).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="text-sm font-medium text-gray-600 min-w-[120px]">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Action URL */}
          {notification.action_url && (
            <div className="mb-6">
              <a
                href={notification.action_url}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Go to related page
              </a>
            </div>
          )}

          {/* Custom Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {notification.actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      action.style === 'primary'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : action.style === 'danger'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleArchive}
              disabled={isArchiving || notification.archived}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Archive className="w-4 h-4" />
              {notification.archived ? 'Archived' : isArchiving ? 'Archiving...' : 'Archive'}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
