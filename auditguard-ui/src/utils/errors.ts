/**
 * Enhanced Error Classes with Context
 * 
 * Provides rich error information for better debugging and user messaging.
 */

export interface ErrorContext {
  operation?: string;
  userId?: string;
  workspaceId?: string;
  documentId?: string;
  timestamp?: number;
  userMessage?: string;
  debugInfo?: Record<string, unknown>;
}

/**
 * Base application error with context
 */
export class AppError extends Error {
  public readonly context: ErrorContext;
  public readonly isRetryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    context: ErrorContext = {},
    isRetryable: boolean = false,
    statusCode?: number
  ) {
    super(message);
    this.name = this.constructor.name;
    this.context = {
      ...context,
      timestamp: context.timestamp || Date.now(),
    };
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  getUserMessage(): string {
    return this.context.userMessage || this.message;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      isRetryable: this.isRetryable,
      statusCode: this.statusCode,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

/**
 * Network/API related errors
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    context: ErrorContext = {},
    statusCode?: number
  ) {
    super(
      message,
      { ...context, operation: context.operation || 'network_request' },
      true, // Network errors are retryable
      statusCode
    );
  }

  static fromFetchError(error: unknown, url: string, context: ErrorContext = {}): NetworkError {
    const message = error instanceof Error ? error.message : 'Network request failed';
    const status = typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : undefined;
    return new NetworkError(
      message,
      {
        ...context,
        debugInfo: {
          url,
          originalError: error instanceof Error ? error.toString() : String(error),
        },
        userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      },
      status
    );
  }

  static fromResponse(response: Response, context: ErrorContext = {}): NetworkError {
    const statusCode = response.status;
    let userMessage = 'An error occurred while processing your request.';

    if (statusCode >= 500) {
      userMessage = 'Server error. Please try again later.';
    } else if (statusCode === 429) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (statusCode === 401) {
      userMessage = 'You are not authorized. Please sign in again.';
    } else if (statusCode === 403) {
      userMessage = 'You do not have permission to perform this action.';
    } else if (statusCode === 404) {
      userMessage = 'The requested resource was not found.';
    }

    return new NetworkError(
      `HTTP ${statusCode}: ${response.statusText}`,
      {
        ...context,
        debugInfo: {
          url: response.url,
          statusText: response.statusText,
        },
        userMessage,
      },
      statusCode
    );
  }
}

/**
 * Validation errors (user input, data format, etc.)
 */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>;

  constructor(
    message: string,
    fields?: Record<string, string[]>,
    context: ErrorContext = {}
  ) {
    super(
      message,
      { ...context, operation: context.operation || 'validation' },
      false, // Validation errors are not retryable
      400
    );
    this.fields = fields;
  }

  getUserMessage(): string {
    if (this.context.userMessage) {
      return this.context.userMessage;
    }

    if (this.fields) {
      const fieldErrors = Object.entries(this.fields)
        .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
        .join('; ');
      return `Validation failed: ${fieldErrors}`;
    }

    return this.message;
  }
}

/**
 * Authentication/Authorization errors
 */
export class AuthError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      {
        ...context,
        operation: context.operation || 'authentication',
        userMessage: context.userMessage || 'Authentication required. Please sign in again.',
      },
      false, // Auth errors are not retryable
      401
    );
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AppError {
  constructor(resourceType: string, resourceId: string, context: ErrorContext = {}) {
    super(
      `${resourceType} not found: ${resourceId}`,
      {
        ...context,
        operation: context.operation || 'resource_fetch',
        debugInfo: { resourceType, resourceId },
        userMessage: context.userMessage || `The requested ${resourceType} could not be found.`,
      },
      false,
      404
    );
  }
}

/**
 * Business logic errors
 */
export class BusinessError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      { ...context, operation: context.operation || 'business_logic' },
      false,
      400
    );
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AppError {
  constructor(operation: string, timeout: number, context: ErrorContext = {}) {
    super(
      `Operation timed out after ${timeout}ms`,
      {
        ...context,
        operation,
        debugInfo: { timeout },
        userMessage: 'The operation took too long. Please try again.',
      },
      true, // Timeouts are retryable
      408
    );
  }
}

/**
 * Helper to convert unknown errors to AppError
 */
export function toAppError(error: unknown, context: ErrorContext = {}): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, {
      ...context,
      debugInfo: { originalError: error.toString(), stack: error.stack },
    });
  }

  return new AppError(
    String(error),
    { ...context, debugInfo: { originalError: error } }
  );
}

/**
 * Error display helper
 */
export function getErrorDisplay(error: unknown): {
  title: string;
  message: string;
  canRetry: boolean;
  severity: 'error' | 'warning' | 'info';
} {
  const appError = toAppError(error);

  let severity: 'error' | 'warning' | 'info' = 'error';
  if (appError instanceof ValidationError) {
    severity = 'warning';
  } else if (appError instanceof NotFoundError) {
    severity = 'info';
  }

  return {
    title: appError.name.replace(/Error$/, ''),
    message: appError.getUserMessage(),
    canRetry: appError.isRetryable,
    severity,
  };
}
