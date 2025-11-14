'use client';

import { SubscriptionDashboard } from '@/components/billing/SubscriptionDashboard';
import { AppLayout } from '@/components/layout/AppLayout';

interface BillingPageProps {
  params: {
    id: string;
  };
}

export default function BillingPage({ params }: BillingPageProps) {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your subscription, payment methods, and billing history.
          </p>
        </div>

        <SubscriptionDashboard workspaceId={params.id} />
      </div>
    </AppLayout>
  );
}
