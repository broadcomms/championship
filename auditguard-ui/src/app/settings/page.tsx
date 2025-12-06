'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Redirect to account profile page with user ID
    if (user.userId) {
      router.push(`/account/${user.userId}/profile`);
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Redirecting to Profile Settings...</h1>
            <p className="mt-2 text-gray-600">
              Please wait while we redirect you to your profile settings page.
            </p>
          </div>
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
