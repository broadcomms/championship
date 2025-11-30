'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';
import {
  ToastNotification,
  NOTIFICATION_COLORS,
  DEFAULT_AUTO_HIDE_DURATION,
} from '@/types/notification';

interface ToastContextType {
  showToast: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  defaultPosition?: ToastNotification['position'];
}

export function ToastProvider({
  children,
  maxToasts = 5,
  defaultPosition = 'top-right',
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => {
      const id = `toast_${Date.now()}_${Math.random()}`;
      const timestamp = Date.now();
      const duration = toast.duration || DEFAULT_AUTO_HIDE_DURATION;
      const position = toast.position || defaultPosition;

      const newToast: ToastNotification = {
        ...toast,
        id,
        timestamp,
        duration,
        position,
        dismissible: toast.dismissible !== false,
        autoHide: toast.autoHide !== false,
      };

      setToasts((prev) => {
        // Remove oldest toasts if we exceed maxToasts
        const updated = [...prev, newToast];
        if (updated.length > maxToasts) {
          return updated.slice(updated.length - maxToasts);
        }
        return updated;
      });

      // Auto-hide if enabled
      if (newToast.autoHide && duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [defaultPosition, dismissToast, maxToasts]
  );

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, clearAllToasts }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// Toast Container Component
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}) {
  // Group toasts by position
  const toastsByPosition = toasts.reduce((acc, toast) => {
    const position = toast.position || 'top-right';
    if (!acc[position]) {
      acc[position] = [];
    }
    acc[position].push(toast);
    return acc;
  }, {} as Record<string, ToastNotification[]>);

  return (
    <>
      {Object.entries(toastsByPosition).map(([position, positionToasts]) => (
        <div
          key={position}
          className={`fixed z-50 flex flex-col gap-2 p-4 pointer-events-none ${getPositionClasses(
            position as ToastNotification['position']
          )}`}
        >
          {positionToasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
          ))}
        </div>
      ))}
    </>
  );
}

// Toast Component
function Toast({ toast, onDismiss }: { toast: ToastNotification; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.autoHide && toast.duration && toast.duration > 0 && toast.showProgress) {
      const interval = setInterval(() => {
        setProgress(() => {
          const elapsed = Date.now() - toast.timestamp;
          const remaining = Math.max(0, 100 - (elapsed / toast.duration!) * 100);
          return remaining;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [toast]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
      if (toast.onClose) {
        toast.onClose();
      }
    }, 300);
  };

  const typeIcon = {
    critical: <AlertCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
  }[toast.type];

  const bgColor = {
    critical: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
  }[toast.type];

  const textColor = NOTIFICATION_COLORS[toast.type];

  return (
    <div
      className={`pointer-events-auto w-96 bg-white rounded-lg shadow-lg border-2 overflow-hidden transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
      } ${bgColor}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div style={{ color: textColor }}>{typeIcon}</div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 mb-1">{toast.title}</h4>
            <p className="text-sm text-gray-600">{toast.message}</p>

            {/* Actions */}
            {toast.actions && toast.actions.length > 0 && (
              <div className="flex gap-2 mt-3">
                {toast.actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      if (action.url) {
                        window.location.href = action.url;
                      }
                      handleDismiss();
                    }}
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

          {/* Close Button */}
          {toast.dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {toast.showProgress && toast.autoHide && toast.duration && toast.duration > 0 && (
        <div className="h-1 bg-gray-200">
          <div
            className="h-full transition-all duration-100"
            style={{
              width: `${progress}%`,
              backgroundColor: textColor,
            }}
          />
        </div>
      )}
    </div>
  );
}

// Position Classes Helper
function getPositionClasses(position: ToastNotification['position']): string {
  const positionMap = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0',
    'top-center': 'top-0 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-0 left-0',
    'bottom-right': 'bottom-0 right-0',
    'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2',
  };
  return positionMap[position || 'top-right'];
}

// Helper function to quickly show different types of toasts
export function createToastHelpers(showToast: ToastContextType['showToast']) {
  return {
    success: (title: string, message: string, options?: Partial<ToastNotification>) =>
      showToast({
        type: 'success',
        category: 'system',
        priority: 'normal',
        title,
        message,
        ...options,
      }),

    error: (title: string, message: string, options?: Partial<ToastNotification>) =>
      showToast({
        type: 'critical',
        category: 'system',
        priority: 'urgent',
        title,
        message,
        autoHide: false,
        ...options,
      }),

    warning: (title: string, message: string, options?: Partial<ToastNotification>) =>
      showToast({
        type: 'warning',
        category: 'alert',
        priority: 'high',
        title,
        message,
        ...options,
      }),

    info: (title: string, message: string, options?: Partial<ToastNotification>) =>
      showToast({
        type: 'info',
        category: 'system',
        priority: 'normal',
        title,
        message,
        ...options,
      }),
  };
}
