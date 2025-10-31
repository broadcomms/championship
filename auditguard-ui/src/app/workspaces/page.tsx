'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';

export default function WorkspacesPage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Workspaces</h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back, {user?.name}! Manage your compliance workspaces here.
          </p>
        </div>

        {/* Empty State - Workspaces Coming Soon */}
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="text-6xl">🏢</div>
            <h3 className="mt-6 text-lg font-medium text-gray-900">
              No Workspaces Yet
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Workspace management will be available in the next phase. You'll be able to create and manage compliance workspaces for your organization.
            </p>
            <div className="mt-6">
              <Button variant="primary" disabled>
                Create Workspace (Coming Soon)
              </Button>
            </div>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="text-3xl">📄</div>
            <h4 className="mt-4 font-medium text-gray-900">Document Management</h4>
            <p className="mt-2 text-sm text-gray-600">
              Upload and organize compliance documents
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="text-3xl">✓</div>
            <h4 className="mt-4 font-medium text-gray-900">Compliance Checks</h4>
            <p className="mt-2 text-sm text-gray-600">
              AI-powered compliance analysis across 13 frameworks
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="text-3xl">🤖</div>
            <h4 className="mt-4 font-medium text-gray-900">AI Assistant</h4>
            <p className="mt-2 text-sm text-gray-600">
              Get compliance guidance and recommendations
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
