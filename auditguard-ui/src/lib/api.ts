// API Client for AuditGuard v2
// Based on UI_DEVELOPMENT_GUIDE.md specifications

import { ErrorResponse } from '@/types';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<TResponse>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<TResponse> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      ...options,
      credentials: 'include', // Include cookies for session management
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      // Handle 204 No Content
      if (response.status === 204) {
        return null as TResponse;
      }

      const data = (await response.json()) as unknown;

      if (!response.ok) {
        const payload = data as Partial<ErrorResponse>;
        const error: ErrorResponse = {
          error: typeof payload.error === 'string' ? payload.error : 'API request failed',
          status: response.status,
          details: payload.details,
        };

        // Handle specific error cases
        switch (response.status) {
          case 401:
            // Session expired or not authenticated
            if (typeof window !== 'undefined') {
              // Redirect to login page
              window.location.href = '/login';
            }
            break;
          case 403:
            console.error('Permission denied:', error.error);
            break;
          case 404:
            console.error('Resource not found:', error.error);
            break;
          case 429:
            console.error('Rate limit exceeded');
            break;
          default:
            console.error('API Error:', error);
        }

        throw error;
      }

      return data as TResponse;
    } catch (error) {
      if (error instanceof TypeError) {
        // Network error
        throw {
          error: 'Network error. Please check your connection.',
          status: 0,
        } as ErrorResponse;
      }
      throw error;
    }
  }

  // GET request
  async get<TResponse = unknown>(endpoint: string): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { method: 'GET' });
  }

  // POST request
  async post<TResponse = unknown>(endpoint: string, data?: unknown): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put<TResponse = unknown>(endpoint: string, data: unknown): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // PATCH request
  async patch<TResponse = unknown>(endpoint: string, data: unknown): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete<TResponse = unknown>(endpoint: string): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { method: 'DELETE' });
  }

  // File upload with multipart/form-data
  async uploadFile<TResponse = unknown>(
    endpoint: string,
    file: File,
    metadata?: Record<string, string>
  ): Promise<TResponse> {
    const formData = new FormData();
    formData.append('file', file);

    // Add metadata fields if provided
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    // Don't set Content-Type header - browser will set it with boundary
    const config: RequestInit = {
      method: 'POST',
      body: formData,
      credentials: 'include',
    };

    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json();
      throw {
        error: error.error || 'Upload failed',
        status: response.status,
      } as ErrorResponse;
    }

    return response.json() as Promise<TResponse>;
  }

  // Download file
  async downloadFile(endpoint: string): Promise<Blob> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw {
        error: error.error || 'Download failed',
        status: response.status,
      } as ErrorResponse;
    }

    return response.blob();
  }
}

// Export singleton instance
// Use empty baseURL to leverage Next.js rewrites (avoids CORS in development)
// The rewrites in next.config.mjs will proxy /api/* to the backend
export const api = new ApiClient('');

// Export class for testing
export { ApiClient };
