'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect to account dashboard as per blueprint
        const accountId = user.userId;
        if (accountId) {
          router.push(`/account/${accountId}`);
        } else {
          // Fallback to organizations if account ID not available
          router.push('/organizations');
        }
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">AuditGuard</h1>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
