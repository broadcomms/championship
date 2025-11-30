/**
 * Integration Tests for Error Logging API
 * 
 * Tests the /api/errors/log endpoint for error logging functionality.
 */

import { POST, GET } from '../log/route';
import { NextRequest } from 'next/server';

describe('/api/errors/log', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe('POST /api/errors/log', () => {
    it('should log error successfully with all fields', async () => {
      const errorData = {
        message: 'Test error message',
        stack: 'Error: Test error\n  at Component (app.tsx:10:5)',
        componentStack: 'in Component\n  in ErrorBoundary',
        context: { userId: '123', page: 'dashboard' },
        timestamp: Date.now(),
        level: 'error' as const,
        userAgent: 'Mozilla/5.0',
        url: 'https://example.com/dashboard',
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Error logged successfully');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Frontend Error]',
        expect.objectContaining({
          level: 'error',
          message: 'Test error message',
          context: { userId: '123', page: 'dashboard' },
        }),
        expect.objectContaining({
          stack: errorData.stack,
          componentStack: errorData.componentStack,
        })
      );
    });

    it('should log error with minimum required fields', async () => {
      const errorData = {
        message: 'Minimal error',
        timestamp: Date.now(),
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return 400 when message is missing', async () => {
      const errorData = {
        timestamp: Date.now(),
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: message, timestamp');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[Frontend Error]'),
        expect.anything()
      );
    });

    it('should return 400 when timestamp is missing', async () => {
      const errorData = {
        message: 'Test error',
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: message, timestamp');
    });

    it('should log warning when level is warning', async () => {
      const errorData = {
        message: 'Test warning',
        timestamp: Date.now(),
        level: 'warning' as const,
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Frontend Warning]',
        expect.objectContaining({
          level: 'warning',
          message: 'Test warning',
        })
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log info when level is info', async () => {
      const errorData = {
        message: 'Test info',
        timestamp: Date.now(),
        level: 'info' as const,
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Frontend Info]',
        expect.objectContaining({
          level: 'info',
          message: 'Test info',
        })
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should default to error level when level is not specified', async () => {
      const errorData = {
        message: 'Test without level',
        timestamp: Date.now(),
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Frontend Error]',
        expect.objectContaining({ level: 'error' }),
        expect.anything()
      );
    });

    it('should include user agent from headers when not in body', async () => {
      const errorData = {
        message: 'Test error',
        timestamp: Date.now(),
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Test Browser)',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Frontend Error]',
        expect.objectContaining({
          userAgent: 'Mozilla/5.0 (Test Browser)',
        }),
        expect.anything()
      );
    });

    it('should handle invalid JSON gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: 'invalid json {',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to log error');
      expect(data.detail).toBeTruthy();
    });

    it('should include context object in logs', async () => {
      const errorData = {
        message: 'Error with context',
        timestamp: Date.now(),
        context: {
          feature: 'document-upload',
          action: 'process',
          documentId: 'doc-123',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Frontend Error]',
        expect.objectContaining({
          context: {
            feature: 'document-upload',
            action: 'process',
            documentId: 'doc-123',
          },
        }),
        expect.anything()
      );
    });

    it('should format timestamp as ISO string', async () => {
      const timestamp = 1699000000000; // Specific timestamp for testing
      const errorData = {
        message: 'Test timestamp',
        timestamp,
      };

      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'POST',
        body: JSON.stringify(errorData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Frontend Error]',
        expect.objectContaining({
          timestamp: new Date(timestamp).toISOString(),
        }),
        expect.anything()
      );
    });
  });

  describe('GET /api/errors/log', () => {
    it('should return empty errors array', async () => {
      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.errors).toEqual([]);
      expect(data.count).toBe(0);
      expect(data.message).toContain('not yet implemented');
    });

    it('should return valid JSON structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/errors/log', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('errors');
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('message');
      expect(Array.isArray(data.errors)).toBe(true);
    });
  });
});
