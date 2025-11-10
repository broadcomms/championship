'use client';

import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AnalyticsPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            View insights and metrics for your workspace
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-6xl">📊</div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              Analytics Dashboard
            </h2>
            <p className="text-gray-600">
              Advanced analytics and reporting features are coming soon. This page will
              display comprehensive insights about your compliance status, trends, and
              performance metrics.
            </p>
            <div className="mt-6 text-sm text-gray-500">
              Workspace ID: {workspaceId}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
