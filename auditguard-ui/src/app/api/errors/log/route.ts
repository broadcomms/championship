/**
 * Error Logging API Endpoint
 * 
 * Receives error logs from frontend and stores them for analytics and debugging.
 * Currently logs to console; can be extended to send to external service or database.
 */

import { NextRequest, NextResponse } from 'next/server';

interface ErrorLogRequest {
  message: string;
  stack?: string;
  componentStack?: string;
  context?: Record<string, any>;
  timestamp: number;
  level?: 'error' | 'warning' | 'info';
  userAgent?: string;
  url?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ErrorLogRequest = await request.json();
    
    // Validate required fields
    if (!body.message || !body.timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields: message, timestamp' },
        { status: 400 }
      );
    }

    // Log to console with context
    const logLevel = body.level || 'error';
    const logData = {
      level: logLevel,
      message: body.message,
      timestamp: new Date(body.timestamp).toISOString(),
      context: body.context || {},
      userAgent: body.userAgent || request.headers.get('user-agent'),
      url: body.url,
    };

    if (logLevel === 'error') {
      console.error('[Frontend Error]', logData, {
        stack: body.stack,
        componentStack: body.componentStack,
      });
    } else if (logLevel === 'warning') {
      console.warn('[Frontend Warning]', logData);
    } else {
      console.info('[Frontend Info]', logData);
    }

    // TODO: Send to external error tracking service (Sentry, etc.)
    // await sendToSentry(body);

    // TODO: Store in database for analytics
    // await storeInDatabase(body);

    return NextResponse.json({ 
      success: true,
      message: 'Error logged successfully'
    });

  } catch (error) {
    console.error('Failed to log error:', error);
    
    // Don't fail the request even if logging fails
    // This prevents infinite error loops
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to log error',
        detail: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve error logs
 * Currently returns empty - can be implemented when database is added
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    errors: [],
    count: 0,
    message: 'Error log storage not yet implemented. Check console logs.'
  });
}
