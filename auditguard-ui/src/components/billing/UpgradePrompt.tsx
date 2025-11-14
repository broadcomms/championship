'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface UpgradePromptProps {
  workspaceId: string;
  title: string;
  message: string;
  feature?: string;
  currentUsage?: number;
  limit?: number;
  type?: 'warning' | 'danger' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function UpgradePrompt({
  workspaceId,
  title,
  message,
  feature,
  currentUsage,
  limit,
  type = 'warning',
  dismissible = true,
  onDismiss,
}: UpgradePromptProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if this prompt was previously dismissed (localStorage)
    if (dismissible && feature) {
      const dismissedKey = `upgrade-prompt-dismissed-${feature}`;
      const dismissed = localStorage.getItem(dismissedKey);
      if (dismissed) {
        setIsDismissed(true);
      }
    }
  }, [dismissible, feature]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (feature) {
      localStorage.setItem(`upgrade-prompt-dismissed-${feature}`, 'true');
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  if (isDismissed) {
    return null;
  }

  const typeStyles = {
    warning: {
      container: 'bg-yellow-50 border-yellow-400',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      text: 'text-yellow-700',
      button: 'bg-yellow-600 hover:bg-yellow-700',
    },
    danger: {
      container: 'bg-red-50 border-red-400',
      icon: 'text-red-400',
      title: 'text-red-800',
      text: 'text-red-700',
      button: 'bg-red-600 hover:bg-red-700',
    },
    info: {
      container: 'bg-blue-50 border-blue-400',
      icon: 'text-blue-400',
      title: 'text-blue-800',
      text: 'text-blue-700',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const styles = typeStyles[type];

  return (
    <div className={`border-l-4 p-4 ${styles.container}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {type === 'warning' && (
            <svg className={`h-5 w-5 ${styles.icon}`} viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {type === 'danger' && (
            <svg className={`h-5 w-5 ${styles.icon}`} viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {type === 'info' && (
            <svg className={`h-5 w-5 ${styles.icon}`} viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${styles.title}`}>{title}</h3>
          <div className={`mt-2 text-sm ${styles.text}`}>
            <p>{message}</p>
            {currentUsage !== undefined && limit !== undefined && (
              <p className="mt-1 font-medium">
                Current usage: {currentUsage.toLocaleString()} / {limit.toLocaleString()}
              </p>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Link
              href={`/workspaces/${workspaceId}/billing/upgrade`}
              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${styles.button} focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              Upgrade Plan
            </Link>
            <Link
              href={`/workspaces/${workspaceId}/billing`}
              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${styles.text} hover:underline`}
            >
              View Usage
            </Link>
          </div>
        </div>
        {dismissible && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={handleDismiss}
                className={`inline-flex rounded-md p-1.5 ${styles.text} hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
