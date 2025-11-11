import React from 'react';
import { getErrorDisplay } from '@/utils/errors';

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Error Display Component
 * 
 * Shows user-friendly error messages with retry and dismiss actions.
 */
export function ErrorDisplay({ error, onRetry, onDismiss, className = '' }: ErrorDisplayProps) {
  const { title, message, canRetry, severity } = getErrorDisplay(error);

  const colorClasses = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconColorClasses = {
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[severity]} ${className}`}>
      <div className="flex items-start">
        <svg
          className={`w-5 h-5 ${iconColorClasses[severity]} mt-0.5 mr-3 flex-shrink-0`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          {severity === 'error' && (
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          )}
          {severity === 'warning' && (
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          )}
          {severity === 'info' && (
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          )}
        </svg>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{title}</h4>
          <p className="text-sm mt-1">{message}</p>

          {(canRetry || onDismiss) && (
            <div className="mt-3 flex gap-2">
              {canRetry && onRetry && (
                <button
                  onClick={onRetry}
                  className={`text-sm font-medium ${
                    severity === 'error'
                      ? 'text-red-600 hover:text-red-700'
                      : severity === 'warning'
                      ? 'text-yellow-600 hover:text-yellow-700'
                      : 'text-blue-600 hover:text-blue-700'
                  } underline`}
                >
                  Try again
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className={`text-sm font-medium ${
                    severity === 'error'
                      ? 'text-red-600 hover:text-red-700'
                      : severity === 'warning'
                      ? 'text-yellow-600 hover:text-yellow-700'
                      : 'text-blue-600 hover:text-blue-700'
                  }`}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`ml-3 flex-shrink-0 ${iconColorClasses[severity]} hover:opacity-70`}
          >
            <span className="sr-only">Dismiss</span>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline error message for forms
 */
export function InlineError({ message, className = '' }: { message: string; className?: string }) {
  return (
    <p className={`text-sm text-red-600 flex items-center gap-1 ${className}`}>
      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </p>
  );
}

/**
 * Empty state with error fallback
 */
export function EmptyState({
  title,
  message,
  action,
  error,
  onRetry,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <div className="text-center py-12">
        <ErrorDisplay error={error} onRetry={onRetry} className="max-w-md mx-auto" />
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
