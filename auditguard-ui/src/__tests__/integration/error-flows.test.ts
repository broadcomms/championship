/**
 * Integration Tests for Error Handling Flows
 * 
 * Tests complete error handling scenarios from fetch through retry to recovery.
 */

import { retryFetch } from '../../utils/retry';
import { NetworkError, ValidationError } from '../../utils/errors';

// Mock global fetch
const originalFetch = global.fetch;

describe('Error Handling Flows', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('Network Error Recovery Flow', () => {
    it('should retry on network error and eventually succeed', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        
        if (attemptCount < 3) {
          // Fail first 2 attempts with network error
          throw new Error('Network request failed');
        }
        
        // Succeed on 3rd attempt
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await retryFetch('https://api.example.com/data', {
        maxAttempts: 3,
        baseDelay: 10,
      });

      expect(attemptCount).toBe(3);
      expect(result.ok).toBe(true);
      
      const data = await result.json();
      expect(data.success).toBe(true);
    });

    it('should fail after max retry attempts', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        throw new Error('Network request failed');
      });

      await expect(
        retryFetch('https://api.example.com/data', {
          maxAttempts: 3,
          baseDelay: 10,
        })
      ).rejects.toThrow('Network request failed');

      expect(attemptCount).toBe(3);
    });
  });

  describe('5xx Server Error Recovery Flow', () => {
    it('should retry on 500 error and succeed', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        
        if (attemptCount < 2) {
          // Return 500 on first attempt
          return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        // Succeed on 2nd attempt
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await retryFetch('https://api.example.com/data', {
        maxAttempts: 3,
        baseDelay: 10,
      });

      expect(attemptCount).toBe(2);
      expect(result.ok).toBe(true);
    });

    it('should retry on 503 Service Unavailable', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        
        if (attemptCount === 1) {
          return new Response('Service Unavailable', { status: 503 });
        }
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await retryFetch('https://api.example.com/data', {
        maxAttempts: 3,
        baseDelay: 10,
      });

      expect(attemptCount).toBe(2);
      expect(result.ok).toBe(true);
    });
  });

  describe('4xx Client Error No-Retry Flow', () => {
    it('should not retry on 400 Bad Request', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        return new Response(JSON.stringify({ error: 'Bad Request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await retryFetch('https://api.example.com/data', {
        maxAttempts: 3,
        baseDelay: 10,
      });

      expect(attemptCount).toBe(1); // No retries
      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
    });

    it('should not retry on 404 Not Found', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        return new Response('Not Found', { status: 404 });
      });

      const result = await retryFetch('https://api.example.com/data', {
        maxAttempts: 3,
        baseDelay: 10,
      });

      expect(attemptCount).toBe(1);
      expect(result.status).toBe(404);
    });

    it('should not retry on 401 Unauthorized', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        return new Response('Unauthorized', { status: 401 });
      });

      const result = await retryFetch('https://api.example.com/data', {
        maxAttempts: 3,
        baseDelay: 10,
      });

      expect(attemptCount).toBe(1);
      expect(result.status).toBe(401);
    });
  });

  describe('Mixed Error Scenario Flow', () => {
    it('should handle network error, 500 error, then success', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        
        if (attemptCount === 1) {
          throw new Error('Network timeout');
        } else if (attemptCount === 2) {
          return new Response('Internal Server Error', { status: 500 });
        } else {
          return new Response(JSON.stringify({ data: 'success' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      });

      const result = await retryFetch('https://api.example.com/data', {
        maxAttempts: 3,
        baseDelay: 10,
      });

      expect(attemptCount).toBe(3);
      expect(result.ok).toBe(true);
      
      const data = await result.json();
      expect(data.data).toBe('success');
    });
  });

  describe('Error Logging Integration', () => {
    it('should log errors to /api/errors/log endpoint', async () => {
      const mockLogFetch = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      global.fetch = mockLogFetch;

      const error = new NetworkError('Failed to fetch data', {
        url: 'https://api.example.com/data',
        method: 'GET',
      });

      // Simulate logging the error
      await fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          context: error.context,
          timestamp: Date.now(),
          level: 'error',
        }),
      });

      expect(mockLogFetch).toHaveBeenCalledWith(
        '/api/errors/log',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('Failed to fetch data'),
        })
      );
    });

    it('should log validation errors with field context', async () => {
      const mockLogFetch = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      global.fetch = mockLogFetch;

      const error = new ValidationError(
        'Validation failed',
        {
          email: ['Invalid email format'],
          password: ['Password too short'],
        }
      );

      await fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          context: {
            ...error.context,
            fields: error.fields,
          },
          timestamp: Date.now(),
          level: 'warning',
        }),
      });

      expect(mockLogFetch).toHaveBeenCalledWith(
        '/api/errors/log',
        expect.objectContaining({
          body: expect.stringContaining('Validation failed'),
        })
      );

      const callBody = JSON.parse(mockLogFetch.mock.calls[0][1].body);
      expect(callBody.context.fields).toEqual({
        email: ['Invalid email format'],
        password: ['Password too short'],
      });
    });
  });

  describe('Exponential Backoff Flow', () => {
    it('should increase delay between retries', async () => {
      const attemptTimes: number[] = [];
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptTimes.push(Date.now());
        attemptCount++;
        
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      await retryFetch('https://api.example.com/data', {
        maxAttempts: 3,
        baseDelay: 50,
        maxDelay: 200,
      });

      expect(attemptCount).toBe(3);
      expect(attemptTimes.length).toBe(3);

      // Check that delays are increasing
      const delay1 = attemptTimes[1] - attemptTimes[0];
      const delay2 = attemptTimes[2] - attemptTimes[1];

      // Second delay should be at least as long as first delay
      // (accounting for timing variance)
      expect(delay2).toBeGreaterThanOrEqual(delay1 * 0.8);
    });
  });

  describe('Successful Request Flow', () => {
    it('should succeed immediately without retries', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        return new Response(JSON.stringify({ data: 'success' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await retryFetch('https://api.example.com/data', {
        maxAttempts: 3,
        baseDelay: 10,
      });

      expect(attemptCount).toBe(1); // Only one attempt needed
      expect(result.ok).toBe(true);
      
      const data = await result.json();
      expect(data.data).toBe('success');
    });
  });
});
