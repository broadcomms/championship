'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProtectedRoute>
      <WorkspaceProvider>
        <div className="flex h-screen flex-col">
          {/* Top Navbar */}
          <Navbar />

          {/* Main content area with sidebar */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="relative z-40">
              <Sidebar />
            </div>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto bg-gray-50">
              {children}
            </main>
          </div>
        </div>
      </WorkspaceProvider>
    </ProtectedRoute>
  );
}
