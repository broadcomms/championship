/**
 * Retry Utility with Exponential Backoff
 * 
 * Automatically retries failed async operations with increasing delays.
 */
import React from 'react';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, nextDelay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * Retry an async function with exponential backoff
 * 
 * @example
 * ```typescript
 * const data = await retryWithBackoff(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxAttempts: 5, initialDelay: 500 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= opts.maxAttempts || !opts.shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate next delay with exponential backoff
      const nextDelay = Math.min(delay, opts.maxDelay);
      
      // Notify about retry
      opts.onRetry(error, attempt, nextDelay);

      // Wait before retrying
      await sleep(nextDelay);

      // Increase delay for next attempt
      delay *= opts.backoffMultiplier;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Retry a fetch request with smart error handling
 * 
 * @example
 * ```typescript
 * const response = await retryFetch('/api/data', {
 *   method: 'POST',
 *   body: JSON.stringify(data)
 * });
 * ```
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, init);
      
      // Only retry on network errors or 5xx server errors
      if (!response.ok && response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    },
    {
      ...retryOptions,
      shouldRetry: (error, attempt) => {
        // Don't retry client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          return false;
        }
        
        // Custom retry logic if provided
        if (retryOptions?.shouldRetry) {
          return retryOptions.shouldRetry(error, attempt);
        }
        
        return true;
      },
    }
  );
}

/**
 * Create a retryable version of an async function
 * 
 * @example
 * ```typescript
 * const fetchUserData = createRetryable(
 *   async (userId: string) => {
 *     const res = await fetch(`/api/users/${userId}`);
 *     return res.json();
 *   },
 *   { maxAttempts: 3 }
 * );
 * 
 * const user = await fetchUserData('123');
 * ```
 */
export function createRetryable<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: RetryOptions
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => retryWithBackoff(() => fn(...args), options);
}

/**
 * Utility to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Timeout errors
  if (
    (error instanceof Error && error.name === 'AbortError') ||
    (error instanceof Error && error.message.includes('timeout'))
  ) {
    return true;
  }

  // Server errors (5xx)
  if (error instanceof Error && error.message.includes('HTTP 5')) {
    return true;
  }

  // Rate limiting
  if (error instanceof Error && error.message.includes('HTTP 429')) {
    return true;
  }

  return false;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry hook for React components
 * 
 * @example
 * ```typescript
 * const { execute, loading, error, retry } = useRetry(
 *   async () => fetch('/api/data').then(r => r.json())
 * );
 * 
 * useEffect(() => {
 *   execute();
 * }, []);
 * ```
 */
export function useRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [data, setData] = React.useState<T | null>(null);

  const execute = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await retryWithBackoff(fn, options);
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fn, options]);

  const retry = React.useCallback(() => {
    return execute();
  }, [execute]);

  return { execute, loading, error, data, retry };
}

