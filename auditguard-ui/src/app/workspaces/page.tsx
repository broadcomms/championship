'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { useRouter } from 'next/navigation';

export default function WorkspacesPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <h1 className="text-xl font-bold">AuditGuard</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Your Workspaces</h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome, {user?.name}! Your workspaces will appear here.
          </p>
        </div>

        <div className="rounded-lg bg-white p-12 text-center shadow">
          <h3 className="text-lg font-medium text-gray-900">
            Workspaces Coming Soon
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            The workspace management feature will be implemented in the next phase.
          </p>
          <div className="mt-6">
            <Button variant="primary">
              Create Workspace (Coming Soon)
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
