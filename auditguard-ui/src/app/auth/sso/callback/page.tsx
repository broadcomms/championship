'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function SSOCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Get authorization code from URL query parameters
      const code = searchParams.get('code');

      if (!code) {
        setError('No authorization code received from SSO provider');
        return;
      }

      // Exchange code for session via backend
      const response = await api.post<{
        user: {
          userId: string;
          email: string;
          organizationId: string;
          isNewUser: boolean;
        };
        sessionId: string;
      }>('/api/auth/sso/callback', {
        code,
      });

      // Session cookie is set automatically by the backend
      // Redirect to workspaces
      router.push('/workspaces');
    } catch (err: any) {
      setError(err.error || 'SSO authentication failed. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-md bg-red-50 p-4">
            <h2 className="mb-2 text-lg font-semibold text-red-900">
              SSO Authentication Failed
            </h2>
            <p className="text-sm text-red-800">{error}</p>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/login')}
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Return to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          Completing SSO sign-in...
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Please wait while we authenticate your account
        </p>
      </div>
    </div>
  );
}
