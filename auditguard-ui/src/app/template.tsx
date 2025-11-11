'use client';

import { ErrorBoundary } from '@/components/errors';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
          console.error('App Error:', error);
          console.error('Error Info:', errorInfo);
        }
        
        // TODO: Send to error tracking service (e.g., Sentry)
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
