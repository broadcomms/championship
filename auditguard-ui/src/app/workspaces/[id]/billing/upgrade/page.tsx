'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PricingTable } from '@/components/billing/PricingTable';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UpgradePageProps {
  params: {
    id: string;
  };
}

export default function UpgradePage({ params }: UpgradePageProps) {
  const router = useRouter();
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentPlan();
  }, [params.id]);

  const loadCurrentPlan = async () => {
    try {
      const data = await api.get(`/workspaces/${params.id}/subscription`);
      setCurrentPlanId(data.subscription?.stripePlanId);
    } catch (error) {
      console.error('Failed to load current plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planId: string) => {
    router.push(`/workspaces/${params.id}/billing/checkout?plan=${planId}`);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/workspaces/${params.id}/billing`}
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 mb-4"
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Billing
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Choose Your Plan</h1>
        <p className="mt-2 text-sm text-gray-600">
          Select the perfect plan for your compliance needs. Upgrade or downgrade anytime.
        </p>
      </div>

      {/* Pricing Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <PricingTable
          workspaceId={params.id}
          currentPlanId={currentPlanId}
          onSelectPlan={handleSelectPlan}
        />
      )}

      {/* Additional Info */}
      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Plan changes take effect immediately
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Upgrades are prorated and billed immediately</li>
                <li>Downgrades take effect at the end of your current billing period</li>
                <li>You can cancel anytime with no cancellation fees</li>
                <li>All plans include 24/7 email support</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
